const express = require("express");
const router = express.Router();
const { loadConfig } = require("../config/settings");
const { runCustomerConfirmed } = require("../services/customerConfirmed.service");
const { runGetUrl } = require("../services/getUrl.service");
const { runPushData } = require("../services/pushData.service");
const { runUpdateStatus } = require("../services/updateStatus.service");

// ===== Helper: tạo logger đơn giản capture log vào array =====
function makeLogger(logs) {
  return (level, msg) => {
    const entry = { level, message: msg, ts: new Date().toISOString() };
    logs.push(entry);
    console.log(`[${entry.ts}] ${msg}`);
  };
}

// ===== POST /api/tools/customer-confirmed =====
// Body: { sourceSheetId?, sheetName, folderId? }
router.post("/customer-confirmed", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { sheetName, sourceSheetId, folderId } = req.body;

    if (!sheetName) return res.status(400).json({ error: "sheetName là bắt buộc" });

    const logs = [];
    const result = await runCustomerConfirmed({
      sourceSheetId: sourceSheetId || cfg.sourceSheetId,
      sheetName,
      folderId: folderId || cfg.folderId,
      log: makeLogger(logs),
    });

    res.json({ success: true, ...result, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/get-url =====
// Body: { folderId?, items: string[] | string (newline separated) }
router.post("/get-url", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { folderId, items } = req.body;

    // Chấp nhận cả array lẫn string nhiều dòng
    const itemList = Array.isArray(items)
      ? items
      : String(items || "").split("\n").map((l) => l.trim()).filter(Boolean);

    if (itemList.length === 0) return res.status(400).json({ error: "items là bắt buộc" });

    const logs = [];
    const results = await runGetUrl({
      folderId: folderId || cfg.folderId,
      items: itemList,
      log: makeLogger(logs),
    });

    res.json({ success: true, results, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/push-data =====
// Body: { apiKey?, apiBase?, jobs: [{service, id, spreadsheetId}], serviceToSheet? }
router.post("/push-data", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { apiKey, apiBase, jobs, serviceToSheet } = req.body;

    if (!jobs || jobs.length === 0) return res.status(400).json({ error: "jobs là bắt buộc" });

    // serviceToSheet: nếu không truyền → build từ nameMap (đảo ngược)
    // nameMap: { "Podcast": "PODCAST" } → serviceToSheet: { "podcast": "PODCAST" }
    // jobs dùng service key dạng lowercase-hyphen như "blog-2", "gg-stacking"
    // Cho phép truyền thẳng từ UI
    const resolvedServiceToSheet = serviceToSheet || buildServiceToSheet(cfg.nameMap);

    const logs = [];
    const result = await runPushData({
      apiKey: apiKey || cfg.pushDataApiKey,
      apiBase: apiBase || cfg.pushDataApiBase,
      serviceToSheet: resolvedServiceToSheet,
      jobs,
      log: makeLogger(logs),
    });

    res.json({ success: true, ...result, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/update-status =====
// Body: { sourceSheetId?, sheetName, urls: string[] | string, statusText?, statusCol? }
router.post("/update-status", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { sourceSheetId, sheetName, urls, statusText, statusCol } = req.body;

    if (!sheetName) return res.status(400).json({ error: "sheetName là bắt buộc" });

    const urlList = Array.isArray(urls)
      ? urls
      : String(urls || "").split("\n").map((l) => l.trim()).filter(Boolean);

    if (urlList.length === 0) return res.status(400).json({ error: "urls là bắt buộc" });

    const logs = [];
    const result = await runUpdateStatus({
      sourceSheetId: sourceSheetId || cfg.sourceSheetId,
      sheetName,
      urls: urlList,
      statusText: statusText || "Đang chạy",
      statusCol: statusCol || "L",
      log: makeLogger(logs),
    });

    res.json({ success: true, ...result, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/tools/sheet-names =====
// Lấy danh sách tên tab (sheet) từ spreadsheet
// Query: ?sourceSheetId=xxx  (nếu không truyền → dùng config mặc định)
router.get("/sheet-names", async (req, res) => {
  try {
    const cfg = loadConfig();
    const sourceSheetId = req.query.sourceSheetId || cfg.sourceSheetId;
    if (!sourceSheetId) return res.status(400).json({ error: "sourceSheetId là bắt buộc" });

    const { getSpreadsheetMeta } = require("../services/sheets.service");
    const meta = await getSpreadsheetMeta(sourceSheetId);
    const sheetNames = meta.sheets.map((s) => s.properties.title);

    res.json({ sheetNames, spreadsheetId: sourceSheetId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/tools/config =====
// Trả về config liên quan cho tools (để UI tự điền default)
router.get("/config", (req, res) => {
  const cfg = loadConfig();
  res.json({
    sourceSheetId: cfg.sourceSheetId,
    folderId: cfg.folderId,
    pushDataApiKey: cfg.pushDataApiKey,
    pushDataApiBase: cfg.pushDataApiBase,
    serviceToSheet: buildServiceToSheet(cfg.nameMap),
    nameMap: cfg.nameMap,
  });
});

// Helper: build serviceToSheet từ nameMap
// nameMap: { "Podcast": "PODCAST", "GG Stacking": "GOOGLE STACKING", ... }
// → serviceToSheet: { "podcast": "PODCAST", "gg-stacking": "GOOGLE STACKING", ... }
function buildServiceToSheet(nameMap) {
  const map = {};
  // Thêm mapping phổ biến từ script gốc
  const KNOWN = {
    "entity": "ENTITY",
    "podcast": "PODCAST",
    "blog-2": "BLOG 2.0",
    "share-social": "SHARE SOCIAL",
    "gg-stacking": "GOOGLE STACKING",
  };
  // Ưu tiên từ nameMap config
  Object.entries(nameMap || {}).forEach(([key, val]) => {
    const serviceKey = key.toLowerCase().replace(/\s+/g, "-");
    map[serviceKey] = val;
  });
  // Fallback KNOWN nếu chưa có
  Object.entries(KNOWN).forEach(([k, v]) => {
    if (!map[k]) map[k] = v;
  });
  return map;
}

module.exports = router;
