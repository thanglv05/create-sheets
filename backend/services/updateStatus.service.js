const { readRange, batchWriteValues } = require("./sheets.service");

/**
 * Cho 1 danh sách URLs, tìm trong sheet cột H rồi ghi statusText vào cột statusCol
 * @param {Object} params
 * @param {string}   params.sourceSheetId - ID spreadsheet nguồn
 * @param {string}   params.sheetName     - Tên tab sheet
 * @param {string[]} params.urls          - Danh sách URLs cần cập nhật
 * @param {string}   [params.statusText]  - Nội dung cần ghi (mặc định: "Đang chạy")
 * @param {string}   [params.statusCol]   - Cột ghi trạng thái (mặc định: "L")
 * @param {Function} [params.log]         - log(level, msg)
 * @returns {Promise<{updated: number, notFound: string[]}>}
 */
async function runUpdateStatus({
  sourceSheetId,
  sheetName,
  urls,
  statusText = "Đang chạy",
  statusCol = "L",
  log = () => {},
}) {
  log("info", `📊 Đọc cột H từ: ${sheetName}`);
  const rows = await readRange(sourceSheetId, `${sheetName}!H2:H`);
  log("info", `📊 Tổng dòng: ${rows.length}`);

  // Normalize set để lookup nhanh
  const urlSet = new Set(urls.map((u) => u.trim()));
  const updates = [];
  const matchedUrls = new Set();

  rows.forEach((row, index) => {
    const cellUrl = (row[0] || "").trim();
    if (urlSet.has(cellUrl)) {
      const rowIndex = index + 2; // header ở row 1, data từ row 2
      updates.push({
        range: `${sheetName}!${statusCol}${rowIndex}`,
        values: [[statusText]],
      });
      matchedUrls.add(cellUrl);
      log("success", `✅ Match [row ${rowIndex}]: ${cellUrl}`);
    }
  });

  const notFound = urls.filter((u) => !matchedUrls.has(u.trim()));

  if (notFound.length > 0) {
    notFound.forEach((u) => log("warn", `❌ Không tìm thấy: ${u}`));
  }

  if (updates.length > 0) {
    await batchWriteValues(sourceSheetId, updates);
    log("success", `🚀 Đã update ${updates.length} dòng → "${statusText}" (cột ${statusCol})`);
  } else {
    log("warn", "⚠️ Không tìm thấy URL nào trong sheet");
  }

  return { updated: updates.length, notFound };
}

module.exports = { runUpdateStatus };
