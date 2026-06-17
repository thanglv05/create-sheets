const { getSpreadsheet, batchUpdateSheets } = require("./sheets.service");
const { resolveSpreadsheetId } = require("../core/processor");
const { google } = require("googleapis");
const { getAuthClient } = require("./auth.service");

async function getSheetsClient() {
  const auth = await getAuthClient();
  return google.sheets({ version: "v4", auth });
}

/**
 * Thêm một tab đơn lẻ từ template vào file spreadsheet hiện tại
 * @param {Object} params
 * @param {string} params.urlOrId - Link Google Sheets, ID, hoặc URL website
 * @param {string} params.serviceName - Tên dịch vụ cần thêm (VD: "Blog 2.0")
 * @param {number|string} params.count - Số lượng (VD: 100)
 * @param {string} [params.templateId] - ID của template
 * @param {string} [params.folderId] - ID folder Drive
 * @param {Object} params.nameMap - Bản đồ ánh xạ dịch vụ sang tên tab
 * @param {Function} [params.log] - log(level, msg)
 */
async function addSingleTab({ urlOrId, serviceName, count, templateId, folderId, nameMap, log = () => {} }) {
  log("info", `🔍 Đang tìm file spreadsheet từ input: "${urlOrId}"`);
  const targetSpreadsheetId = await resolveSpreadsheetId(urlOrId, folderId);
  log("info", `  -> Khớp Spreadsheet ID: ${targetSpreadsheetId}`);

  // 1. Kiểm tra ánh xạ tên tab (so sánh case/space/hyphen-insensitive)
  let mappedName = null;
  const normalizedService = serviceName.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [key, value] of Object.entries(nameMap)) {
    if (key.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedService) {
      mappedName = value;
      break;
    }
  }
  if (!mappedName) {
    throw new Error(`Không tìm thấy ánh xạ tên tab cho dịch vụ: "${serviceName}"`);
  }
  const targetTabTitle = `${mappedName} - ${count}`;
  log("info", `  -> Tên tab đích cần tạo: "${targetTabTitle}"`);

  // 2. Đọc danh sách tab hiện tại của file đích xem đã có chưa
  const destMeta = await getSpreadsheet(targetSpreadsheetId);
  const destSheetTitles = destMeta.sheets.map(s => s.properties.title);
  
  if (destSheetTitles.includes(targetTabTitle)) {
    log("warn", `⚠️ Tab "${targetTabTitle}" đã tồn tại trong file đích.`);
    return { 
      success: true, 
      alreadyExists: true, 
      sheetId: destMeta.sheets.find(s => s.properties.title === targetTabTitle).properties.sheetId,
      sheetTitle: targetTabTitle,
      fileId: targetSpreadsheetId,
      fileUrl: `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}`
    };
  }

  // 3. Đọc template để tìm sheetId của tab nguồn
  log("info", `📊 Đang đọc thông tin template: ${templateId}`);
  const tempMeta = await getSpreadsheet(templateId);
  const sourceSheetObj = tempMeta.sheets.find(s => 
    s.properties.title.trim().toUpperCase() === mappedName.trim().toUpperCase()
  );

  if (!sourceSheetObj) {
    throw new Error(`Không tìm thấy tab nguồn "${mappedName}" trong file template.`);
  }
  const sourceSheetId = sourceSheetObj.properties.sheetId;

  // 4. Copy tab từ template sang file đích
  log("info", `📋 Đang copy tab "${mappedName}" từ template sang file đích...`);
  const sheets = await getSheetsClient();
  const copyResult = await sheets.spreadsheets.sheets.copyTo({
    spreadsheetId: templateId,
    sheetId: sourceSheetId,
    requestBody: {
      destinationSpreadsheetId: targetSpreadsheetId
    }
  });
  const newSheetId = copyResult.data.sheetId;
  const tempTitle = copyResult.data.title;
  log("success", `✅ Đã copy xong tab. Tên tạm thời: "${tempTitle}" (ID: ${newSheetId})`);

  // 5. Đổi tên tab tạm thời sang tên đích
  log("info", `🏷️ Đang đổi tên tab từ "${tempTitle}" sang "${targetTabTitle}"...`);
  const requests = [{
    updateSheetProperties: {
      properties: {
        sheetId: newSheetId,
        title: targetTabTitle
      },
      fields: "title"
    }
  }];
  await batchUpdateSheets(targetSpreadsheetId, requests);
  log("success", `✅ Đã đổi tên tab thành công!`);

  return {
    success: true,
    alreadyExists: false,
    sheetId: newSheetId,
    sheetTitle: targetTabTitle,
    fileId: targetSpreadsheetId,
    fileUrl: `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}`
  };
}

module.exports = { addSingleTab };
