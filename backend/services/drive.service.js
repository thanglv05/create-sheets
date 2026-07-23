const { google } = require("googleapis");
const { getAuthClient } = require("./auth.service");

async function getDriveClient() {
  const auth = await getAuthClient();
  return google.drive({ version: "v3", auth });
}

/**
 * Copy template file to folder
 */
async function copyTemplate(templateId, folderId, name) {
  const drive = await getDriveClient();
  const copy = await drive.files.copy({
    fileId: templateId,
    requestBody: { name, parents: [folderId] },
  });
  return copy.data.id;
}

/**
 * Set file to public writer access
 */
async function setPublicAccess(fileId) {
  const drive = await getDriveClient();
  await drive.permissions.create({
    fileId,
    requestBody: { role: "writer", type: "anyone" },
  });
}

/**
 * Liệt kê tất cả spreadsheet files trong folder (hoặc toàn bộ nếu folderId null), có thể lọc theo query
 */
async function listFiles(folderId, customQuery = "") {
  const drive = await getDriveClient();
  let q = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }
  
  if (customQuery) {
    q += ` and ${customQuery}`;
  }
  
  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1000,
    orderBy: "modifiedTime desc",
  });
  return res.data.files || [];
}

/**
 * Delete a file
 */
async function deleteFile(fileId) {
  const drive = await getDriveClient();
  await drive.files.delete({ fileId });
}

module.exports = { copyTemplate, setPublicAccess, listFiles, deleteFile };
