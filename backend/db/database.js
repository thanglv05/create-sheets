/**
 * database.js — MongoDB Atlas persistence layer
 * Sử dụng official mongodb driver bất đồng bộ
 */

const { MongoClient } = require("mongodb");

let client = null;
let db = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Biến môi trường MONGODB_URI bị thiếu!");
  }

  if (uri.includes("<db_password>")) {
    console.warn("\n⚠️  CẢNH BÁO: MONGODB_URI chứa placeholder '<db_password>'.");
    console.warn("Vui lòng thay thế '<db_password>' bằng mật khẩu cơ sở dữ liệu thực của bạn trong file .env!\n");
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(); // Sử dụng database mặc định trong connection string
  console.log(`[DB] Đã kết nối thành công tới MongoDB Atlas: database "${db.databaseName}"`);

  // Tạo index nâng cao hiệu năng và đảm bảo tính duy nhất
  await db.collection("jobs").createIndex({ id: 1 }, { unique: true });
  await db.collection("jobs").createIndex({ status: 1 });
  await db.collection("jobs").createIndex({ createdAt: -1 });
  await db.collection("job_logs").createIndex({ jobId: 1 });
}

function getDb() {
  if (!db) {
    throw new Error("Cơ sở dữ liệu chưa được khởi tạo. Vui lòng gọi connectDB() trước.");
  }
  return db;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Lưu job mới vào DB
 */
async function dbInsertJob(job) {
  const database = getDb();
  const doc = {
    id:           job.id,
    name:         job.name,
    status:       job.status,
    config:       job.config, // Lưu trực tiếp dạng Object
    createdAt:   job.createdAt,
    startedAt:   job.startedAt,
    completedAt: job.completedAt,
    progress:     job.progress, // Lưu trực tiếp dạng Object
    results:      job.results,  // Lưu trực tiếp dạng Array
    error:        job.error,
  };
  await database.collection("jobs").insertOne(doc);
}

/**
 * Xóa job khỏi DB (xóa cả logs liên quan)
 */
async function dbDeleteJob(jobId) {
  const database = getDb();
  await Promise.all([
    database.collection("job_logs").deleteMany({ jobId }),
    database.collection("jobs").deleteOne({ id: jobId })
  ]);
}

/**
 * Cập nhật status, startedAt, completedAt, error
 */
async function dbUpdateJobStatus(job) {
  const database = getDb();
  await database.collection("jobs").updateOne(
    { id: job.id },
    {
      $set: {
        status:      job.status,
        startedAt:   job.startedAt,
        completedAt: job.completedAt,
        error:        job.error,
      }
    }
  );
}

/**
 * Cập nhật tiến độ progress
 */
async function dbUpdateJobProgress(jobId, progress) {
  const database = getDb();
  await database.collection("jobs").updateOne(
    { id: jobId },
    { $set: { progress } }
  );
}

/**
 * Cập nhật kết quả khi job done/error
 */
async function dbUpdateJobResults(job) {
  const database = getDb();
  await database.collection("jobs").updateOne(
    { id: job.id },
    {
      $set: {
        status:       job.status,
        completedAt:  job.completedAt,
        error:        job.error,
        results:      job.results || [],
      }
    }
  );
}

/**
 * Ghi 1 dòng log vào DB
 */
async function dbInsertLog(jobId, log) {
  const database = getDb();
  await database.collection("job_logs").insertOne({
    jobId,
    level:   log.level || "info",
    message: log.message || "",
    ts:      log.ts || new Date().toISOString(),
  });
}

/**
 * Load tất cả logs của 1 job (sắp xếp tăng dần theo thời gian ghi)
 */
async function dbGetLogs(jobId) {
  const database = getDb();
  const docs = await database.collection("job_logs")
    .find({ jobId })
    .sort({ _id: 1 })
    .toArray();
  return docs.map(doc => ({
    level:   doc.level,
    message: doc.message,
    ts:      doc.ts,
  }));
}

/**
 * Load tất cả jobs từ DB vào memory khi server start
 * Jobs đang ở trạng thái "running" khi server crash → reset về "error"
 */
async function dbLoadAllJobs() {
  const database = getDb();
  const docs = await database.collection("jobs")
    .find()
    .sort({ createdAt: -1 })
    .toArray();

  const jobs = docs.map(doc => ({
    id:          doc.id,
    name:        doc.name,
    status:      doc.status,
    config:      doc.config || {},
    createdAt:   doc.createdAt,
    startedAt:   doc.startedAt,
    completedAt: doc.completedAt,
    progress:    doc.progress || { current: 0, total: 0 },
    results:     doc.results || [],
    error:       doc.error,
    logs:        [], // Sẽ được tải bất đồng bộ khi cần detail
  }));

  // Đánh dấu lỗi cho các job bị treo khi server restart
  for (const job of jobs) {
    if (job.status === "running") {
      job.status = "error";
      job.error = "Server khởi động lại trong khi job đang chạy";
      job.completedAt = new Date().toISOString();
      await dbUpdateJobStatus(job);
    }
  }

  return jobs;
}

module.exports = {
  connectDB,
  dbInsertJob,
  dbDeleteJob,
  dbUpdateJobStatus,
  dbUpdateJobProgress,
  dbUpdateJobResults,
  dbInsertLog,
  dbGetLogs,
  dbLoadAllJobs,
};
