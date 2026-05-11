const { listFiles } = require("./drive.service");

/**
 * Cho 1 danh sách tên file, tìm URL Google Sheets tương ứng trong Drive folder
 * @param {Object} params
 * @param {string}   params.folderId  - ID folder Drive
 * @param {string[]} params.items     - Danh sách tên file cần tìm (mỗi item 1 dòng)
 * @param {Function} [params.log]     - log(level, msg) tùy chọn
 * @returns {Promise<Array<{item, url, found}>>}
 */
async function runGetUrl({ folderId, items, log = () => {} }) {
  const normalize = (s) =>
    (s || "").toLowerCase().trim().replace(/[^a-z0-9._-]/g, "");

  log("info", `📁 Lấy danh sách files trong folder...`);
  const files = await listFiles(folderId);
  log("info", `📁 Tổng files: ${files.length}`);

  const results = [];

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    const normItem = normalize(trimmed);
    const found = files.find((f) => normalize(f.name) === normItem);

    if (found) {
      const url = `https://docs.google.com/spreadsheets/d/${found.id}`;
      results.push({ item: trimmed, url, found: true });
      log("success", `✅ ${trimmed} → ${url}`);
    } else {
      results.push({ item: trimmed, url: "", found: false });
      log("warn", `❌ Không tìm thấy: ${trimmed}`);
    }
  }

  const foundCount = results.filter((r) => r.found).length;
  log("info", `🏁 ${foundCount}/${results.length} tìm thấy`);

  return results;
}

module.exports = { runGetUrl };
