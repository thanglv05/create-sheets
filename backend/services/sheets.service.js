const { google } = require("googleapis");
const { getAuthClient } = require("./auth.service");

async function getSheetsClient() {
  const auth = await getAuthClient();
  return google.sheets({ version: "v4", auth });
}

/**
 * Đọc dữ liệu từ sheet nguồn
 */
async function readRange(spreadsheetId, range) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

/**
 * Lấy metadata của spreadsheet (danh sách sheets)
 */
async function getSpreadsheet(spreadsheetId) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return res.data;
}

/**
 * Đổi tên / xóa sheets theo batch requests
 */
async function batchUpdateSheets(spreadsheetId, requests) {
  if (!requests || requests.length === 0) return;
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

/**
 * Ghi nhiều range cùng lúc (batch write values)
 */
async function batchWriteValues(spreadsheetId, data, valueInputOption = "RAW") {
  if (!data || data.length === 0) return;
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption, data },
  });
}

module.exports = { readRange, getSpreadsheet, batchUpdateSheets, batchWriteValues };
