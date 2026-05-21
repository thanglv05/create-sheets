const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");
const { runJob } = require("./processor");
const Logger = require("../utils/logger");
const {
  dbInsertJob,
  dbDeleteJob,
  dbUpdateJobStatus,
  dbUpdateJobProgress,
  dbUpdateJobResults,
  dbInsertLog,
  dbGetLogs,
  dbLoadAllJobs,
} = require("../db/database");

// ─── Trạng thái in-memory (primary working state) ────────────────────────────
const STATE = {
  jobs: [],        // Tất cả jobs (load từ DB khi start)
  running: false,
  currentJobId: null,
};

// ─── EventEmitter để push SSE ─────────────────────────────────────────────────
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

// ─── Khởi tạo: Load jobs từ DB khi module được require ───────────────────────
(function init() {
  try {
    STATE.jobs = dbLoadAllJobs();
    console.log(`[JobQueue] Loaded ${STATE.jobs.length} jobs from DB`);
  } catch (err) {
    console.error("[JobQueue] Lỗi load DB:", err.message);
    STATE.jobs = [];
  }
})();

// ─── Debounce helper cho progress (tránh ghi DB quá nhiều) ───────────────────
const progressTimers = new Map();
function debouncedSaveProgress(jobId, progress, delay = 500) {
  if (progressTimers.has(jobId)) clearTimeout(progressTimers.get(jobId));
  progressTimers.set(jobId, setTimeout(() => {
    dbUpdateJobProgress(jobId, progress);
    progressTimers.delete(jobId);
  }, delay));
}

/**
 * Thêm job mới vào queue
 */
function addJob(config, name) {
  const job = {
    id: uuidv4(),
    name: name || config.sheetName || "Job",
    config,
    status: "pending",
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    logs: [],
    results: [],
    progress: { current: 0, total: 0 },
    error: null,
  };

  STATE.jobs.push(job);
  dbInsertJob(job);                         // ← Persist ngay
  emitter.emit("jobs_updated", getJobList());
  return job;
}

/**
 * Xóa job (chỉ khi pending hoặc done/error)
 */
function removeJob(jobId) {
  const idx = STATE.jobs.findIndex((j) => j.id === jobId);
  if (idx === -1) throw new Error("Job không tồn tại");
  const job = STATE.jobs[idx];
  if (job.status === "running") throw new Error("Không thể xóa job đang chạy");
  STATE.jobs.splice(idx, 1);
  dbDeleteJob(jobId);                       // ← Xóa khỏi DB
  emitter.emit("jobs_updated", getJobList());
}

/**
 * Lấy danh sách jobs (không có logs chi tiết) — dùng cho frontend list view
 */
function getJobList() {
  return STATE.jobs.map((j) => ({
    id: j.id,
    name: j.name,
    status: j.status,
    createdAt: j.createdAt,
    startedAt: j.startedAt,
    completedAt: j.completedAt,
    progress: j.progress,
    resultsCount: j.results.length,
    error: j.error,
  }));
}

/**
 * Lấy chi tiết 1 job kèm logs
 * - Nếu job đang running → lấy logs từ memory (realtime)
 * - Nếu job done/error → lấy logs từ DB (persistent)
 */
function getJobDetail(jobId) {
  const job = STATE.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error("Job không tồn tại");

  // Với done/error: nếu logs trong memory đã bị clear, load từ DB
  if ((job.status === "done" || job.status === "error") && job.logs.length === 0) {
    job.logs = dbGetLogs(jobId);
  }

  return job;
}

/**
 * Bắt đầu chạy queue (xử lý tuần tự)
 */
async function startQueue() {
  if (STATE.running) return { message: "Queue đang chạy" };

  const pending = STATE.jobs.filter((j) => j.status === "pending");
  if (pending.length === 0) return { message: "Không có job pending nào" };

  STATE.running = true;
  emitter.emit("queue_status", { running: true });

  _processQueue().finally(() => {
    STATE.running = false;
    STATE.currentJobId = null;
    emitter.emit("queue_status", { running: false });
  });

  return { message: `Đang chạy ${pending.length} job...`, count: pending.length };
}

async function _processQueue() {
  while (true) {
    const job = STATE.jobs.find((j) => j.status === "pending");
    if (!job) break;

    // ── Chuyển trạng thái → running ──────────────────────────────────────────
    STATE.currentJobId = job.id;
    job.status = "running";
    job.startedAt = new Date().toISOString();
    job.logs = [];                           // Reset logs trong memory
    dbUpdateJobStatus(job);                  // ← Persist status
    emitter.emit("jobs_updated", getJobList());

    const logger = new Logger({
      emit: (event, data) => {
        if (event === "log") {
          job.logs.push(data);
          dbInsertLog(job.id, data);         // ← Persist từng dòng log
          emitter.emit("job_log", { jobId: job.id, ...data });
        }
      },
    });

    try {
      let result;
      if (job.config.type === "push-data") {
        const { runPushDataManual } = require("./processor");
        result = await runPushDataManual(
          job,
          (level, msg, data) => logger._log(level, msg, data),
          (current, total) => {
            job.progress = { current, total };
            debouncedSaveProgress(job.id, job.progress); // ← Debounced persist
            emitter.emit("job_progress", { jobId: job.id, current, total });
          }
        );
      } else {
        result = await runJob(
          job,
          (level, msg, data) => logger._log(level, msg, data),
          (current, total) => {
            job.progress = { current, total };
            debouncedSaveProgress(job.id, job.progress); // ← Debounced persist
            emitter.emit("job_progress", { jobId: job.id, current, total });
          }
        );
      }

      // ── Job thành công ────────────────────────────────────────────────────
      job.results = result.results || [];
      job.status = "done";
      job.completedAt = new Date().toISOString();
      logger.success(
        job.config.type === "push-data"
          ? `Hoàn thành: Đã push data cho ${result.processed} nhóm`
          : `Hoàn thành: ${result.processed} file đã tạo`
      );
    } catch (err) {
      // ── Job lỗi ───────────────────────────────────────────────────────────
      job.status = "error";
      job.error = err.message;
      job.completedAt = new Date().toISOString();
      logger.error(`Job thất bại: ${err.message}`);
    }

    dbUpdateJobResults(job);                 // ← Persist kết quả cuối
    emitter.emit("jobs_updated", getJobList());
  }
}

function getQueueStatus() {
  return {
    running: STATE.running,
    currentJobId: STATE.currentJobId,
    total: STATE.jobs.length,
    pending: STATE.jobs.filter((j) => j.status === "pending").length,
    running_count: STATE.jobs.filter((j) => j.status === "running").length,
    done: STATE.jobs.filter((j) => j.status === "done").length,
    error: STATE.jobs.filter((j) => j.status === "error").length,
  };
}

/**
 * Xóa toàn bộ jobs đã done hoặc error khỏi memory và DB
 * @returns {number} số lượng jobs đã xóa
 */
function clearHistory() {
  const toRemove = STATE.jobs.filter((j) => j.status === "done" || j.status === "error");
  toRemove.forEach((j) => dbDeleteJob(j.id));
  STATE.jobs = STATE.jobs.filter((j) => j.status !== "done" && j.status !== "error");
  emitter.emit("jobs_updated", getJobList());
  return toRemove.length;
}

module.exports = { addJob, removeJob, clearHistory, startQueue, getJobList, getJobDetail, getQueueStatus, emitter };
