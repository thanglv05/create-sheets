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

// ===== POST /api/tools/sheet-urls =====
router.post("/sheet-urls", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { items, folderId } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: "Danh sách tên file là bắt buộc" });

    const { runGetUrl } = require("../services/getUrl.service");
    const results = await runGetUrl({
      folderId: folderId || cfg.folderId,
      items: Array.isArray(items) ? items : [items],
      log: (lvl, msg) => console.log(`[GetURL] ${msg}`)
    });

    res.json({ success: true, results });
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
    const cfg = loadConfig();
    const { apiKey, apiBase, groups, services } = req.body;
    
    if (!groups || !groups.length) {
      return res.status(400).json({ error: "Dữ liệu nhóm là bắt buộc" });
    }

    const { addJob, startQueue } = require("../core/jobQueue");
    
    const jobConfig = {
      type: "push-data",
      apiKey: apiKey || cfg.pushDataApiKey,
      apiBase: apiBase || cfg.pushDataApiBase,
      groups,
      services
    };

    const job = await addJob(jobConfig, `Push Data (${groups.length} nhóm)`);
    
    // Bắt đầu chạy queue
    await startQueue();

    res.json({ success: true, jobId: job.id, message: "Đã tạo job push data và bắt đầu xử lý" });
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

  for (let url of urls) {
    const result = { url, status: "pending" };
    try {
      if (!url) continue;

      // Tự động sửa lỗi nếu người dùng nhập tên file thay vì URL
      // Ví dụ: trannhattruong.com_ong-mat_ -> https://trannhattruong.com/ong-mat/
      if (!url.startsWith("http") && url.includes("_")) {
        console.log(`[BulkScrape] Phát hiện input dạng tên file, đang chuyển đổi ngược lại...`);
        url = "https://" + url.replace(/_/g, "/").replace(/\/+$/, "/");
      } else if (!url.startsWith("http")) {
        url = "https://" + url;
      }

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

// ===== GET /api/tools/sheet-overview =====
// Đọc toàn bộ dữ liệu sheet nguồn, trả về danh sách URL groups với trạng thái
router.get("/sheet-overview", async (req, res) => {
  try {
    const cfg = loadConfig();
    const sourceSheetId = req.query.sourceSheetId || cfg.sourceSheetId;
    const sheetName = req.query.sheetName;

    if (!sourceSheetId) return res.status(400).json({ error: "Chưa cấu hình Source Sheet ID" });

    const { readRange, getSpreadsheet } = require("../services/sheets.service");

    // Nếu không truyền sheetName thì lấy tab đầu tiên
    let targetSheet = sheetName;
    if (!targetSheet) {
      const meta = await getSpreadsheet(sourceSheetId);
      targetSheet = meta.sheets[0]?.properties?.title;
    }
    if (!targetSheet) return res.status(400).json({ error: "Không tìm thấy tab sheet nào" });

    // Đọc từ A2 đến M để lấy đủ: A-G (các cột thông tin), H (URL), I (count), J (service), K (sheet name), L (status), M (...)
    const rows = await readRange(sourceSheetId, `${targetSheet}!A2:M`);

    // Parse thành danh sách URL groups
    const groups = [];
    let currentGroup = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const colH = (row[7] || "").trim();  // URL (cột H = index 7)
      const colI = (row[8] || "").trim();  // Count (cột I = index 8)
      const colJ = (row[9] || "").trim();  // Service (cột J = index 9)
      const colK = (row[10] || "").trim(); // Sheet name (cột K = index 10)
      const colL = (row[11] || "").trim(); // Status (cột L = index 11)

      if (colH.startsWith("http")) {
        // Bắt đầu group mới
        currentGroup = {
          rowIndex: i + 2,  // 1-indexed, bắt đầu từ dòng 2
          url: colH,
          sheetName: colK || null,
          sheetUrl: colK ? `https://docs.google.com/spreadsheets/d/${colK}`.includes('http') ? colK : null : null,
          status: colL || "pending",
          services: [],
          hasFile: !!colK && !colK.startsWith("http") ? false : !!colK,
        };

        // Nếu colK là một link Google Sheets thực sự
        if (colK && colK.startsWith("http")) {
          currentGroup.sheetUrl = colK;
          currentGroup.sheetName = null;
          currentGroup.hasFile = true;
        } else if (colK && !colK.startsWith("http")) {
          // colK là tên sheet
          currentGroup.sheetName = colK;
          currentGroup.sheetUrl = null;
          currentGroup.hasFile = false;
        }

        groups.push(currentGroup);
      }

      // Thêm dịch vụ vào group hiện tại
      if (currentGroup && colI && colJ) {
        currentGroup.services.push({ count: colI, name: colJ });
      }

      // Cập nhật status và sheetUrl từ các row con
      if (currentGroup && colL && !currentGroup.status) {
        currentGroup.status = colL;
      }
      if (currentGroup && colL) {
        // Lấy status từ dòng cuối cùng của group
        currentGroup.status = colL;
      }
    }

    // Thống kê tổng hợp
    const stats = {
      total: groups.length,
      hasFile: groups.filter(g => g.hasFile).length,
      noFile: groups.filter(g => !g.hasFile).length,
      byStatus: {},
    };
    groups.forEach(g => {
      const s = (g.status || "").toLowerCase() || "chưa có";
      stats.byStatus[s] = (stats.byStatus[s] || 0) + 1;
    });

    res.json({
      success: true,
      sheetName: targetSheet,
      sourceSheetId,
      groups,
      stats,
    });
  } catch (err) {
    console.error("[SheetOverview]", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/add-single-tab =====
router.post("/add-single-tab", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { urlOrId, urlsOrIds, serviceName, serviceNames, count, templateId, folderId } = req.body;

    // Hỗ trợ cả single urlOrId hoặc danh sách urlsOrIds (dạng array hoặc chuỗi phân tách bằng dòng mới)
    let targetInputs = [];
    if (Array.isArray(urlsOrIds)) {
      targetInputs = urlsOrIds;
    } else if (urlsOrIds && typeof urlsOrIds === "string") {
      targetInputs = urlsOrIds.split("\n").map(u => u.trim()).filter(u => u);
    } else if (urlOrId) {
      targetInputs = [urlOrId.trim()];
    }

    // Hỗ trợ cả single serviceName hoặc danh sách serviceNames (dạng array)
    let targetServices = [];
    if (Array.isArray(serviceNames)) {
      targetServices = serviceNames;
    } else if (serviceNames && typeof serviceNames === "string") {
      targetServices = [serviceNames];
    } else if (serviceName) {
      targetServices = [serviceName];
    }

    if (targetInputs.length === 0 || targetServices.length === 0 || !count) {
      return res.status(400).json({ error: "Danh sách URL/ID, loại dịch vụ và count là bắt buộc." });
    }

    const { addSingleTab } = require("../services/addTab.service");
    const results = [];

    for (const input of targetInputs) {
      for (const service of targetServices) {
        const result = { input, serviceName: service, status: "pending" };
        try {
          const astRes = await addSingleTab({
            urlOrId: input,
            serviceName: service,
            count,
            templateId: templateId || cfg.templateId,
            folderId: folderId || cfg.folderId,
            nameMap: cfg.nameMap,
            log: (lvl, msg) => console.log(`[Tool-AST] [${lvl.toUpperCase()}] ${msg}`)
          });
          result.status = astRes.alreadyExists ? "already_exists" : "success";
          result.sheetTitle = astRes.sheetTitle;
          result.fileId = astRes.fileId;
          result.fileUrl = astRes.fileUrl;
        } catch (err) {
          console.error(`[AddSingleTab] Lỗi khi xử lý ${input} - ${service}:`, err.message);
          result.status = "error";
          result.error = err.message;
        }
        results.push(result);
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error("[AddSingleTab]", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/tools/insert-email =====
router.post("/insert-email", async (req, res) => {
  try {
    const cfg = loadConfig();
    const { urls, emailText, entityMode = "One", defaultRecovery = "ilerarrewj7765754@hotmail.com", folderId } = req.body;

    if (!urls || !emailText) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ Danh sách URL và Nội dung Email." });
    }

    const urlList = (Array.isArray(urls) ? urls : urls.split("\n"))
      .map(u => u.trim())
      .filter(Boolean);

    const emailLines = emailText.split("\n").map(l => l.trim()).filter(Boolean);

    const parsedEmails = emailLines.map(line => {
      // Split by tab (\t) or 2+ spaces
      const parts = line.split(/\t+|\s{2,}/).map(p => p.trim());
      return {
        email: parts[0] || "",
        pass: parts[1] || "",
        appPassword: parts[2] || "",
        twoFA: parts[3] || "",
        recoveryEmail: parts[4] || defaultRecovery
      };
    });

    const { resolveSpreadsheetId } = require("../core/processor");
    const { batchWriteValues } = require("../services/sheets.service");

    const targetFolderId = folderId || cfg.folderId;
    const results = [];

    const totalToProcess = Math.min(urlList.length, parsedEmails.length);

    for (let i = 0; i < totalToProcess; i++) {
      const url = urlList[i];
      const mailInfo = parsedEmails[i];
      const itemResult = { url, email: mailInfo.email, status: "pending" };

      try {
        const spreadsheetId = await resolveSpreadsheetId(url, targetFolderId);

        const values = [
          [mailInfo.email],
          [mailInfo.pass],
          [mailInfo.appPassword],
          [mailInfo.twoFA],
          [mailInfo.recoveryEmail]
        ];

        await batchWriteValues(spreadsheetId, [
          {
            range: "THÔNG TIN!C11:C15",
            values: values
          }
        ], "USER_ENTERED");

        itemResult.status = "success";
        itemResult.fileId = spreadsheetId;
        itemResult.fileUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      } catch (err) {
        console.error(`[InsertEmail] Lỗi khi xử lý URL ${url}:`, err.message);
        itemResult.status = "error";
        itemResult.error = err.message;
      }

      results.push(itemResult);
    }

    res.json({ success: true, results, totalProcessed: results.length });
  } catch (err) {
    console.error("[InsertEmail]", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
