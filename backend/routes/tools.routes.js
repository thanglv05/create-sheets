const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const { loadConfig } = require("../config/settings");

// ===== GET /api/tools/sheet-names =====
router.get("/sheet-names", async (req, res) => {
  try {
    const { getSpreadsheet } = require("../services/sheets.service");
    const spreadsheetId = req.query.sourceSheetId || loadConfig().sourceSheetId;
    if (!spreadsheetId) return res.status(400).json({ error: "Chưa cấu hình Source Sheet ID" });

    const ss = await getSpreadsheet(spreadsheetId);
    const sheetNames = ss.sheets.map((s) => s.properties.title);
    res.json({ success: true, sheetNames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/customer-confirmed =====
router.post("/customer-confirmed", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { sheetName, sourceSheetId, folderId } = req.body;
    const { runCustomerConfirmed } = require("../services/customerConfirmed.service");

    const result = await runCustomerConfirmed({
      sourceSheetId: sourceSheetId || cfg.sourceSheetId,
      sheetName,
      folderId: folderId || cfg.folderId,
      log: (lvl, msg) => console.log(`[Tool-CC] ${msg}`)
    });

    res.json({ success: true, results: result.results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/push-data-groups =====
router.post("/push-data-groups", async (req, res) => {
  try {
    const { groups } = req.body;
    if (!groups || !groups.length) return res.status(400).json({ error: "Dữ liệu nhóm là bắt buộc" });

    const { runJobManually } = require("../core/processor");
    const jobId = await runJobManually("Push Data Manual", groups);

    res.json({ success: true, jobId, message: "Đã tạo job xử lý" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/update-status =====
router.post("/update-status", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { urls, sheetName, sourceSheetId, statusText, statusCol } = req.body;

    if (!urls || !urls.length) return res.status(400).json({ error: "Danh sách URL là bắt buộc" });

    const { runUpdateStatus } = require("../services/updateStatus.service");
    const result = await runUpdateStatus({
      sourceSheetId: sourceSheetId || cfg.sourceSheetId,
      sheetName,
      urls: Array.isArray(urls) ? urls : [urls],
      statusText: statusText || "Đang chạy",
      statusCol: statusCol || "L",
      log: (lvl, msg) => console.log(`[Tool-US] ${msg}`)
    });

    res.json({ success: true, updated: result.updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/tools/confirmed-list =====
router.get("/confirmed-list", async (req, res) => {
  try {
    const cfg = loadConfig();
    const sourceSheetId = req.query.sourceSheetId || cfg.sourceSheetId;
    const sheetName = req.query.sheetName || "Tháng 5";

    const { runCustomerConfirmed } = require("../services/customerConfirmed.service");
    const result = await runCustomerConfirmed({
      sourceSheetId,
      sheetName,
      folderId: cfg.folderId,
      log: (lvl, msg) => console.log(`[ConfirmedList] ${msg}`)
    });

    res.json({ success: true, results: result.results, sheetName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/confirm-to-running =====
router.post("/confirm-to-running", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { urls, sheetName, sourceSheetId } = req.body;
    if (!urls || !urls.length) return res.status(400).json({ error: "Danh sách URL là bắt buộc" });

    const { runUpdateStatus } = require("../services/updateStatus.service");
    const result = await runUpdateStatus({
      sourceSheetId: sourceSheetId || cfg.sourceSheetId,
      sheetName: sheetName || "Tháng 5",
      urls: Array.isArray(urls) ? urls : [urls],
      statusText: "Đang chạy",
      statusCol: "L",
      log: (lvl, msg) => console.log(`[ToRunning] ${msg}`)
    });

    res.json({ success: true, updated: result.updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/scrape-info =====
// Bulk Scrape & Auto-fill
router.post("/scrape-info", async (req, res) => {
  const { urls, spreadsheetId: manualId } = req.body;
  if (!urls || !Array.isArray(urls)) return res.status(400).json({ error: "Danh sách URLs là bắt buộc" });

  console.log(`[BulkScrape] Bắt đầu xử lý ${urls.length} URLs`);

  const { scrapeUrl, mapScrapeDataToSheet } = require("../services/scrape.service");
  const { batchWriteValues } = require("../services/sheets.service");
  const { listFiles } = require("../services/drive.service");
  const cfg = loadConfig();

  const results = [];

  for (const url of urls) {
    const result = { url, status: "pending" };
    try {
      if (!url) continue;

      // 1. Cào
      const data = await scrapeUrl(url);

      // 2. Tìm file phù hợp (Dùng list và filter trong JS để tăng độ chính xác)
      let finalSheetId = manualId;
      if (!finalSheetId) {
        const safeName = url.replace(/https?:\/\//, "").replace(/\//g, "_").toLowerCase().trim();
        console.log(`[BulkScrape] Đang tìm file khớp với: "${safeName}"`);
        
        const allFiles = await listFiles(cfg.folderId);
        const match = allFiles.find(f => {
          const fileName = f.name.toLowerCase().trim();
          return fileName === safeName || fileName === safeName.replace(/_$/, ""); // Thử cả trường hợp có/không có gạch dưới cuối
        });

        if (!match) {
          throw new Error(`Không tìm thấy file spreadsheet tên: ${safeName}`);
        }
        finalSheetId = match.id;
        console.log(`[BulkScrape] Khớp thành công file: ${match.name} (${finalSheetId})`);
      }

      // 3. Ghi vào tab "THÔNG TIN"
      const values = mapScrapeDataToSheet(data);
      await batchWriteValues(finalSheetId, [
        {
          range: "THÔNG TIN!C2:C15",
          values: values
        }
      ], "USER_ENTERED");

      result.status = "success";
      result.fileId = finalSheetId;
      result.data = data;
    } catch (err) {
      console.error(`[BulkScrape] Lỗi URL ${url}:`, err.message);
      result.status = "error";
      result.error = err.message;
    }
    results.push(result);
  }

  res.json({ success: true, results });
});

// ===== GET /api/tools/drive-files =====
router.get("/drive-files", async (req, res) => {
  try {
    const cfg = loadConfig();
    const folderId = req.query.folderId || cfg.folderId;
    if (!folderId) return res.status(400).json({ error: "Chưa cấu hình Folder ID" });

    const { listFiles } = require("../services/drive.service");
    const files = await listFiles(folderId, "mimeType = 'application/vnd.google-apps.spreadsheet'");
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
