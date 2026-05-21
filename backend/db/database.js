/**
 * database.js — SQLite persistence layer
 * Dùng better-sqlite3 (synchronous API, phù hợp với Node.js single-thread)
 * File DB lưu tại: backend/data/jobs.db
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Đảm bảo thư mục data tồn tại
const DATA_DIR = path.join(__dirname, "../../data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "jobs.db");
const db = new Database(DB_PATH);

// ─── Tối ưu hiệu suất SQLite ──────────────────────────────────────────────────
db.pragma("journal_mode = WAL");   // Write-Ahead Logging: đọc/ghi song song
db.pragma("synchronous = NORMAL"); // Cân bằng giữa tốc độ và an toàn

// ─── Tạo bảng nếu chưa có ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    config      TEXT NOT NULL,       -- JSON string
    created_at  TEXT NOT NULL,
    started_at  TEXT,
    completed_at TEXT,
    progress    TEXT DEFAULT '{"current":0,"total":0}',  -- JSON string
    results     TEXT DEFAULT '[]',   -- JSON string
    error       TEXT
  );

  CREATE TABLE IF NOT EXISTS job_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id    TEXT NOT NULL,
    level     TEXT,
    message   TEXT,
    ts        TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_created    ON jobs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_logs_job_id     ON job_logs(job_id);
`);

console.log(`[DB] SQLite initialized at: ${DB_PATH}`);

// ─── Prepared Statements (compile 1 lần, chạy nhiều lần — nhanh hơn) ─────────
const stmts = {
  insertJob: db.prepare(`
    INSERT INTO jobs (id, name, status, config, created_at, started_at, completed_at, progress, results, error)
    VALUES (@id, @name, @status, @config, @created_at, @started_at, @completed_at, @progress, @results, @error)
  `),

  updateJobStatus: db.prepare(`
    UPDATE jobs SET status = @status, started_at = @started_at, completed_at = @completed_at, error = @error
    WHERE id = @id
  `),

  updateJobProgress: db.prepare(`
    UPDATE jobs SET progress = @progress WHERE id = @id
  `),

  updateJobResults: db.prepare(`
    UPDATE jobs SET results = @results, status = @status, completed_at = @completed_at, error = @error
    WHERE id = @id
  `),

  deleteJob: db.prepare(`DELETE FROM jobs WHERE id = ?`),

  getJobById: db.prepare(`SELECT * FROM jobs WHERE id = ?`),

  getAllJobs: db.prepare(`SELECT * FROM jobs ORDER BY created_at DESC`),

  getPendingJobs: db.prepare(`SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at ASC`),

  insertLog: db.prepare(`
    INSERT INTO job_logs (job_id, level, message, ts) VALUES (?, ?, ?, ?)
  `),

  getLogsByJobId: db.prepare(`
    SELECT level, message, ts FROM job_logs WHERE job_id = ? ORDER BY id ASC
  `),

  deleteLogsByJobId: db.prepare(`DELETE FROM job_logs WHERE job_id = ?`),
};

// ─── Helper: parse JSON an toàn ───────────────────────────────────────────────
function parseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ─── Helper: convert DB row → job object (in-memory format) ──────────────────
function rowToJob(row) {
  return {
    id:          row.id,
    name:        row.name,
    status:      row.status,
    config:      parseJSON(row.config, {}),
    createdAt:   row.created_at,
    startedAt:   row.started_at,
    completedAt: row.completed_at,
    progress:    parseJSON(row.progress, { current: 0, total: 0 }),
    results:     parseJSON(row.results, []),
    error:       row.error,
    logs:        [],  // logs load riêng khi cần (getJobDetail)
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Lưu job mới vào DB
 */
function dbInsertJob(job) {
  stmts.insertJob.run({
    id:           job.id,
    name:         job.name,
    status:       job.status,
    config:       JSON.stringify(job.config),
    created_at:   job.createdAt,
    started_at:   job.startedAt,
    completed_at: job.completedAt,
    progress:     JSON.stringify(job.progress),
    results:      JSON.stringify(job.results),
    error:        job.error,
  });
}

/**
 * Xóa job khỏi DB (cascade xóa cả logs)
 */
function dbDeleteJob(jobId) {
  stmts.deleteLogsByJobId.run(jobId);
  stmts.deleteJob.run(jobId);
}

/**
 * Cập nhật status, startedAt, completedAt, error
 */
function dbUpdateJobStatus(job) {
  stmts.updateJobStatus.run({
    id:           job.id,
    status:       job.status,
    started_at:   job.startedAt,
    completed_at: job.completedAt,
    error:        job.error,
  });
}

/**
 * Cập nhật tiến độ progress
 */
function dbUpdateJobProgress(jobId, progress) {
  stmts.updateJobProgress.run({ id: jobId, progress: JSON.stringify(progress) });
}

/**
 * Cập nhật kết quả khi job done/error
 */
function dbUpdateJobResults(job) {
  stmts.updateJobResults.run({
    id:           job.id,
    status:       job.status,
    completed_at: job.completedAt,
    error:        job.error,
    results:      JSON.stringify(job.results || []),
  });
}

/**
 * Ghi 1 dòng log vào DB
 */
function dbInsertLog(jobId, log) {
  stmts.insertLog.run(jobId, log.level || "info", log.message || "", log.ts || new Date().toISOString());
}

/**
 * Load tất cả logs của 1 job (dùng cho getJobDetail)
 */
function dbGetLogs(jobId) {
  return stmts.getLogsByJobId.all(jobId);
}

/**
 * Load tất cả jobs từ DB vào memory khi server start
 * Jobs đang ở trạng thái "running" khi server crash → reset về "error"
 */
function dbLoadAllJobs() {
  const rows = stmts.getAllJobs.all();
  const jobs = rows.map(rowToJob);

  // Jobs bị crash giữa chừng → đánh dấu lỗi
  jobs.forEach((job) => {
    if (job.status === "running") {
      job.status = "error";
      job.error = "Server khởi động lại trong khi job đang chạy";
      job.completedAt = new Date().toISOString();
      dbUpdateJobStatus(job);
    }
  });

  return jobs;
}

module.exports = {
  db,
  dbInsertJob,
  dbDeleteJob,
  dbUpdateJobStatus,
  dbUpdateJobProgress,
  dbUpdateJobResults,
  dbInsertLog,
  dbGetLogs,
  dbLoadAllJobs,
};
