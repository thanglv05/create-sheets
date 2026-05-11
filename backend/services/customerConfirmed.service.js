const { readRange } = require("./sheets.service");
const { listFiles } = require("./drive.service");

/**
 * Tìm các URL "khách chốt" trong sheet, match với file Drive
 * @param {Object} params
 * @param {string} params.sourceSheetId  - ID của spreadsheet nguồn
 * @param {string} params.sheetName      - Tên tab sheet (VD: "Tháng 4")
 * @param {string} params.folderId       - ID folder Drive chứa các file
 * @param {Function} [params.log]        - log(level, msg) tùy chọn
 * @returns {Promise<{results: Array, totalRows: number, totalFiles: number}>}
 */
async function runCustomerConfirmed({ sourceSheetId, sheetName, folderId, log = () => {} }) {
  const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Đọc sheet H2:M
  log("info", `📊 Đọc sheet: ${sheetName}!H2:M`);
  const rows = await readRange(sourceSheetId, `${sheetName}!H2:M`);
  log("info", `📊 Tổng dòng: ${rows.length}`);

  // 2. Liệt kê file trong folder Drive
  log("info", `📁 Lấy danh sách files trong folder...`);
  const files = await listFiles(folderId);
  log("info", `📁 Tổng files: ${files.length}`);

  // map normalized name → URL
  const fileMap = {};
  files.forEach((f) => {
    fileMap[normalize(f.name)] = `https://docs.google.com/spreadsheets/d/${f.id}`;
  });

  // 3. Duyệt rows, track lastUrl + lastSheetName
  const rawResults = [];
  let lastUrl = "";
  let lastSheetName = "";

  for (const row of rows) {
    const colH = (row[0] || "").trim(); // URL
    const colK = (row[3] || "").trim(); // sheet name (cột K = index 3)
    const colL = (row[4] || "").trim().toLowerCase(); // trạng thái (cột L = index 4)

    if (colH.includes("http")) lastUrl = colH;
    if (colK) lastSheetName = colK;

    if (colL === "khách chốt" && lastUrl) {
      rawResults.push({
        url: lastUrl,
        sheetName: lastSheetName,
        sheetUrl: fileMap[normalize(lastSheetName)] || null,
      });
    }
  }

  // 4. Loại trùng URL
  const results = Array.from(new Map(rawResults.map((x) => [x.url, x])).values());

  log("success", `✅ Tổng URL khách chốt (unique): ${results.length}`);

  return { results, totalRows: rows.length, totalFiles: files.length };
}

module.exports = { runCustomerConfirmed };
