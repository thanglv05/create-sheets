const express = require("express");
const router = express.Router();
const { loadConfig } = require("../config/settings");
const {
  addJob,
  removeJob,
  clearHistory,
  startQueue,
  getJobList,
  getJobDetail,
  getQueueStatus,
  emitter,
} = require("../core/jobQueue");

// GET /api/run/status
router.get("/status", (req, res) => {
  res.json(getQueueStatus());
});

// GET /api/run/jobs
router.get("/jobs", (req, res) => {
  res.json(getJobList());
});

// GET /api/run/jobs/:id
router.get("/jobs/:id", (req, res) => {
  try {
    const job = getJobDetail(req.params.id);
    res.json(job);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/run/jobs — Thêm job mới
router.post("/jobs", (req, res) => {
  try {
    const globalConfig = loadConfig();
    const { sheetName, name, templateId, folderId, sourceSheetId } = req.body;

    if (!sheetName) {
      return res.status(400).json({ error: "sheetName là bắt buộc" });
    }

    const jobConfig = {
      templateId: templateId || globalConfig.templateId,
      folderId: folderId || globalConfig.folderId,
      sourceSheetId: sourceSheetId || globalConfig.sourceSheetId,
      sheetName,
      nameMap: globalConfig.nameMap,
    };

    const job = addJob(jobConfig, name || sheetName);
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/run/jobs/:id
router.delete("/jobs/:id", (req, res) => {
  try {
    removeJob(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/run/jobs/history — Xóa toàn bộ jobs đã done hoặc error
router.delete("/history", (req, res) => {
  try {
    const count = clearHistory();
    res.json({ success: true, cleared: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/run/start — Bắt đầu chạy queue
router.post("/start", async (req, res) => {
  try {
    const result = await startQueue();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/run/stream — SSE realtime stream
router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Gửi trạng thái ngay khi connect
  send("init", { jobs: getJobList(), status: getQueueStatus() });

  const handlers = {
    log: (data) => send("log", data),
    job_log: (data) => send("job_log", data),
    job_progress: (data) => send("job_progress", data),
    jobs_updated: (data) => send("jobs_updated", data),
    queue_status: (data) => send("queue_status", data),
  };

  Object.entries(handlers).forEach(([event, fn]) => emitter.on(event, fn));

  // Heartbeat mỗi 20s để giữ kết nối
  const heartbeat = setInterval(() => res.write(":heartbeat\n\n"), 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    Object.entries(handlers).forEach(([event, fn]) => emitter.off(event, fn));
  });
});

module.exports = router;
