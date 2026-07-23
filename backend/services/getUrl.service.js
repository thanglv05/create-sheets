const { resolveSpreadsheetId } = require("../core/processor");

/**
 * Cho 1 danh sách tên file hoặc URL, tìm URL Google Sheets tương ứng trong Drive (bao gồm cả file được share)
 * @param {Object} params
 * @param {string}   params.folderId  - ID folder Drive
 * @param {string[]} params.items     - Danh sách tên file/URL cần tìm (mỗi item 1 dòng)
 * @param {Function} [params.log]     - log(level, msg) tùy chọn
 * @returns {Promise<Array<{item, url, found}>>}
 */
async function runGetUrl({ folderId, items, log = () => {} }) {
  log("info", `📁 Tra cứu link file cho ${items.length} mục...`);

  const results = [];

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    try {
      const spreadsheetId = await resolveSpreadsheetId(trimmed, folderId);
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      results.push({ item: trimmed, url, found: true });
      log("success", `✅ ${trimmed} → ${url}`);
    } catch (err) {
      results.push({ item: trimmed, url: "", found: false });
      log("warn", `❌ Không tìm thấy: ${trimmed}`);
    }
  }

  const foundCount = results.filter((r) => r.found).length;
  log("info", `🏁 ${foundCount}/${results.length} tìm thấy`);

  return results;
}

module.exports = { runGetUrl };
