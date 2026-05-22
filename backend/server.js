const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend/out")));

// ===== ROUTES =====
app.use("/api/config", require("./routes/config.routes"));
app.use("/api/run", require("./routes/run.routes"));
app.use("/api/tools", require("./routes/tools.routes"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/out/index.html"));
});

// ===== START =====
const { connectDB } = require("./db/database");
const { initJobQueue } = require("./core/jobQueue");

async function start() {
  try {
    // 1. Kết nối MongoDB
    await connectDB();

    // 2. Khởi tạo Job Queue
    await initJobQueue();

    // 3. Lắng nghe cổng
    app.listen(PORT, () => {
      console.log(`\n🚀 Server đang chạy tại: http://localhost:${PORT}`);
      console.log(`📋 Dashboard: http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error("❌ Lỗi khởi động ứng dụng:", err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
