// ===== CENTRAL CONFIG =====
// Mọi cấu hình mặc định đều ở đây
// Có thể override bằng .env hoặc qua UI (lưu vào config.json)

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const fs = require("fs");

const CONFIG_FILE = path.join(__dirname, "../../config.json");

const DEFAULT_CONFIG = {
  templateId: process.env.TEMPLATE_ID || "1gCEhAJ0YasEvtjYu-gsLKcwISc8rrv02XROcCJTtLPc",
  folderId: process.env.FOLDER_ID || "13kD0llWsXd6CfMhLQFdhJVvJe56SaJxh",
  sourceSheetId: process.env.SOURCE_SHEET_ID || "1jeh9MTCKlnDlrTxRTcpOX2qmgwEfrc-UwcQ-ckmF6pY",
  nameMap: {
    Podcast: "PODCAST",
    "GG Stacking": "GOOGLE STACKING",
    "Share Social": "SHARE SOCIAL",
    "Blog 2.0": "BLOG 2.0",
    Entity: "ENTITY",
  },
  // Cấu hình cho pushData
  pushDataApiKey: process.env.PUSH_DATA_API_KEY || "46a5cc0181990549672bb6d70558393d",
  pushDataApiBase: process.env.PUSH_DATA_API_BASE || "https://apikey-test.likepion.com/api/admin-download",
};

function loadConfig() {
  let config = { ...DEFAULT_CONFIG };

  // 1. Ưu tiên load từ Environment Variable (cho Cloud deployment)
  if (process.env.APP_CONFIG) {
    try {
      const envConfig = JSON.parse(process.env.APP_CONFIG);
      config = { ...config, ...envConfig };
    } catch (err) {
      console.error("Lỗi parse APP_CONFIG từ env:", err.message);
    }
  }

  // 2. Load từ file config.json (cho Local hoặc Persistent Storage)
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      config = { ...config, ...saved };
    } catch (err) {
      console.error("Lỗi đọc config.json:", err.message);
    }
  }

  return config;
}

function saveConfig(newConfig) {
  const merged = { ...loadConfig(), ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

module.exports = { loadConfig, saveConfig, DEFAULT_CONFIG };
