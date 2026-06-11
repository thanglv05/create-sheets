const axios = require("axios");
const XLSX = require("xlsx");
const { getSpreadsheet } = require("./sheets.service");
const { getAuthClient } = require("./auth.service");
const { google } = require("googleapis");

/**
 * Gọi external API lấy file Excel, parse, fill vào đúng sheet trong Google Sheets
 * @param {Object} params
 * @param {string}   params.apiKey        - API key cho external service
 * @param {string}   params.apiBase       - Base URL của external API
 * @param {Object}   params.serviceToSheet - Map: service name → sheet tab name prefix
 * @param {Array}    params.jobs          - [{service, id, spreadsheetId}]
 * @param {Function} [params.log]         - log(level, msg) tùy chọn
 * @returns {Promise<{success: number, fail: number, details: Array}>}
 */
async function runPushData({ apiKey, apiBase, serviceToSheet, jobs, log = () => {} }) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  let successCount = 0;
  let failCount = 0;
  const details = [];

  for (const job of jobs) {
    const jobLabel = `service=${job.service} | sheet=${job.spreadsheetId}`;
    log("info", `🚀 Xử lý: ${jobLabel}`);

    try {
      // 1. Gọi API lấy Excel
      const rows = await fetchExcel(apiKey, apiBase, job.service, job.id, log);

      // 2. Map service → tên sheet
      const sheetName = serviceToSheet[job.service];
      if (!sheetName) {
        log("warn", `⚠️ Không có mapping cho service: "${job.service}"`);
        failCount++;
        details.push({ job, status: "error", error: `No mapping for service: ${job.service}` });
        continue;
      }

      // 3. Fill vào sheet
      const ok = await fillSheet(sheets, job.spreadsheetId, sheetName, rows, log);
      if (ok) {
        successCount++;
        details.push({ job, status: "success", rows: rows.length });
      } else {
        failCount++;
        details.push({ job, status: "error", error: `Sheet "${sheetName}" not found` });
      }
    } catch (err) {
      const errMsg = err.response ? `HTTP ${err.response.status}: ${err.message}` : err.message;
      log("error", `❌ Lỗi job ${job.service}: ${errMsg}`);
      failCount++;
      details.push({ job, status: "error", error: errMsg });
    }

    // Nhỏ delay tránh rate limit
    await new Promise((r) => setTimeout(r, 300));
  }

  log("success", `🏁 Hoàn thành! ✅ ${successCount} thành công | ❌ ${failCount} thất bại`);
  return { success: successCount, fail: failCount, details };
}

async function fetchExcel(apiKey, apiBase, service, id, log) {
  const API_SERVICE_MAP = {
    "Podcast": "podcast",
    "GG Stacking": "google-stacking",
    "Share Social": "social",
    "Blog 2.0": "blog20",
    "Entity": "entity"
  };

  const apiService = API_SERVICE_MAP[service] || service.toLowerCase().replace(/\s+/g, "-");
  const cleanApiBase = apiBase.trim().replace(/\/+$/, "");
  const url = `${cleanApiBase}/${apiService}/${id}`;
  log("info", `  🌐 GET ${url}`);

  const res = await axios.get(url, {
    headers: { "x-api-key": apiKey },
    responseType: "arraybuffer",
    timeout: 30000,
  });

  const workbook = XLSX.read(res.data, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  log("info", `  📊 Rows: ${rows.length}`);
  return rows;
}

async function fillSheet(sheets, spreadsheetId, targetSheetName, rows, log) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });

  // Tìm sheet có tên bắt đầu bằng targetSheetName (bỏ qua phần "- số lượng")
  const sheetObj = meta.data.sheets.find((s) =>
    s.properties.title.toUpperCase().startsWith(targetSheetName.toUpperCase())
  );

  if (!sheetObj) {
    log("warn", `  ⚠️ Không tìm thấy sheet bắt đầu bằng "${targetSheetName}"`);
    log("info", `  💡 Sheets hiện có: ${meta.data.sheets.map((s) => s.properties.title).join(", ")}`);
    return false;
  }

  const actualTitle = sheetObj.properties.title;
  log("info", `  📝 Fill vào sheet: "${actualTitle}"`);

  // Clear rồi ghi từ A1
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${actualTitle}'`,
  });

  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${actualTitle}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  }

  log("success", `  ✅ Đã fill ${rows.length} dòng vào "${actualTitle}"`);
  return true;
}

module.exports = { runPushData };
