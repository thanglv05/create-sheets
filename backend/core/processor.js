const { readRange, getSpreadsheet, batchUpdateSheets, batchWriteValues } = require("../services/sheets.service");
const { copyTemplate, setPublicAccess } = require("../services/drive.service");

/**
 * Group rows thành các item theo URL
 * @param {string[][]} rows - Raw rows từ sheet (cột H, I, J, K)
 * @returns {Array} grouped items
 */
function groupRows(rows) {
  const grouped = [];
  let current = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const colH = row[0] || "";
    const colI = row[1] || "";
    const colJ = row[2] || "";
    const colK = row[3] || "";

    if (colH.startsWith("http")) {
      // Đã có link rồi → bỏ qua
      if (colK) {
        current = null;
        continue;
      }

      current = { url: colH, startRow: i, sheets: [] };
      grouped.push(current);
    }

    if (current && colI && colJ) {
      current.sheets.push({ count: colI, name: colJ });
    }
  }

  return grouped;
}

/**
 * Xử lý một group (1 URL)
 * @param {Object} item - Một grouped item
 * @param {Object} jobConfig - Config của job (templateId, folderId, nameMap...)
 * @param {Function} log - Logger function (level, msg, data?)
 * @returns {Object} { url, fileId, fileUrl, rowIndex }
 */
async function processGroup(item, jobConfig, log) {
  const { templateId, folderId, nameMap } = jobConfig;

  log("info", `🚀 Xử lý: ${item.url}`);

  const safeName = item.url.replace(/https?:\/\//, "").replace(/\//g, "_");

  // 1. Copy template
  const newFileId = await copyTemplate(templateId, folderId, safeName);
  log("info", `📄 Đã tạo file: ${newFileId}`);

  // 2. Set public access
  await setPublicAccess(newFileId);

  const fileUrl = `https://docs.google.com/spreadsheets/d/${newFileId}`;
  log("success", `🔗 ${fileUrl}`);

  // 3. Đổi tên sheets
  const meta = await getSpreadsheet(newFileId);
  const sheetMap = {};
  meta.sheets.forEach((s) => {
    sheetMap[s.properties.title.trim().toUpperCase()] = s.properties.sheetId;
  });

  const requests = [];

  for (const s of item.sheets) {
    const type = (s.name || "").trim();
    if (!type) continue;

    const mappedName = nameMap[type] || type.toUpperCase();
    const newTitle = `${mappedName} - ${s.count}`;

    if (sheetMap[mappedName] !== undefined) {
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: sheetMap[mappedName], title: newTitle },
          fields: "title",
        },
      });
      delete sheetMap[mappedName];
    } else {
      log("warn", `⚠️ Không có sheet: ${mappedName}`);
    }
  }

  // Xóa sheets thừa (trừ THÔNG TIN)
  Object.entries(sheetMap).forEach(([name, id]) => {
    if (name !== "THÔNG TIN") {
      requests.push({ deleteSheet: { sheetId: id } });
    }
  });

  if (requests.length > 0) {
    await batchUpdateSheets(newFileId, requests);
    log("info", `🏷️ Đã rename/xóa ${requests.length} sheets`);
  }

  return {
    url: item.url,
    fileId: newFileId,
    fileUrl,
    rowIndex: item.startRow + 2,
  };
}

/**
 * Chạy toàn bộ flow cho 1 job
 * @param {Object} job - Job object { config: { sourceSheetId, sheetName, ... } }
 * @param {Function} log - log(level, msg, data?)
 * @param {Function} onProgress - onProgress(current, total)
 */
async function runJob(job, log, onProgress) {
  const { sourceSheetId, sheetName } = job.config;

  // 1. Đọc sheet & Lấy sheetId
  log("info", `📊 Đọc sheet: ${sheetName}`);
  const meta = await getSpreadsheet(sourceSheetId);
  const targetSheet = meta.sheets.find((s) => s.properties.title === sheetName);
  if (!targetSheet) {
    throw new Error(`Không tìm thấy tab "${sheetName}" trong sheet nguồn.`);
  }
  const sheetId = targetSheet.properties.sheetId;

  const rows = await readRange(sourceSheetId, `${sheetName}!H2:K`);
  log("info", `📊 Tổng dòng: ${rows.length}`);

  // 2. Group
  const grouped = groupRows(rows);
  log("info", `🧩 Tổng group cần xử lý: ${grouped.length}`);

  if (grouped.length === 0) {
    log("warn", "⚠️ Không có group nào cần xử lý (tất cả đã có link hoặc rỗng)");
    return { processed: 0, results: [] };
  }

  // 3. Process từng group
  const updateData = [];
  const results = [];

  for (let i = 0; i < grouped.length; i++) {
    const item = grouped[i];
    onProgress(i, grouped.length);

    try {
      const result = await processGroup(item, job.config, log);
      results.push(result);
      updateData.push({
        range: `${sheetName}!K${result.rowIndex}`,
        values: [[result.fileUrl]],
      });
    } catch (err) {
      log("error", `❌ Lỗi khi xử lý ${item.url}: ${err.message}`);
    }

    // Delay nhỏ để tránh rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  onProgress(grouped.length, grouped.length);

  // 4. Batch write links về sheet gốc
  if (updateData.length > 0) {
    await batchWriteValues(sourceSheetId, updateData);
    log("success", `✅ Đã ghi ${updateData.length} link về sheet gốc`);
  }

  return { processed: updateData.length, results };
}

module.exports = { groupRows, processGroup, runJob };
