const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");
const { runJob } = require("./processor");
const Logger = require("../utils/logger");

// Trạng thái của queue
const STATE = {
  jobs: [],        // Tất cả jobs
  running: false,  // Có đang chạy không
  currentJobId: null,
};

// EventEmitter để push log qua SSE
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

/**
 * Thêm job mới vào queue
 */
function addJob(config, name) {
  const job = {
    id: uuidv4(),
    name: name || config.sheetName || "Job",
    config,
    status: "pending",   // pending | running | done | error | cancelled
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    logs: [],
    results: [],
    progress: { current: 0, total: 0 },
    error: null,
  };

  STATE.jobs.push(job);
  emitter.emit("jobs_updated", getJobList());
  return job;
}

/**
 * Xóa job (chỉ khi pending)
 */
function removeJob(jobId) {
  const idx = STATE.jobs.findIndex((j) => j.id === jobId);
  if (idx === -1) throw new Error("Job không tồn tại");
  const job = STATE.jobs[idx];
  if (job.status === "running") throw new Error("Không thể xóa job đang chạy");
  STATE.jobs.splice(idx, 1);
  emitter.emit("jobs_updated", getJobList());
}

/**
 * Lấy danh sách jobs (không có logs chi tiết)
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
 * Lấy chi tiết 1 job (có logs)
 */
function getJobDetail(jobId) {
  const job = STATE.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error("Job không tồn tại");
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

  // Chạy async (không block response)
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

    STATE.currentJobId = job.id;
    job.status = "running";
    job.startedAt = new Date().toISOString();
    emitter.emit("jobs_updated", getJobList());

    const logger = new Logger({
      emit: (event, data) => {
        if (event === "log") {
          job.logs.push(data);
          emitter.emit("job_log", { jobId: job.id, ...data });
        }
      },
    });

    try {
      const result = await runJob(
        job,
        (level, msg, data) => logger._log(level, msg, data),
        (current, total) => {
          job.progress = { current, total };
          emitter.emit("job_progress", { jobId: job.id, current, total });
        }
      );

      job.results = result.results;
      job.status = "done";
      job.completedAt = new Date().toISOString();
      logger.success(`Hoàn thành: ${result.processed} file đã tạo`);
    } catch (err) {
      job.status = "error";
      job.error = err.message;
      job.completedAt = new Date().toISOString();
      logger.error(`Job thất bại: ${err.message}`);
    }

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

module.exports = { addJob, removeJob, startQueue, getJobList, getJobDetail, getQueueStatus, emitter };
