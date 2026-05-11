const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
];

const CREDENTIALS_PATH = path.join(__dirname, "../../credentials.json");
const TOKEN_PATH = path.join(__dirname, "../../token.json");

let _cachedClient = null;

async function getAuthClient() {
  if (_cachedClient) return _cachedClient;

  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } else if (fs.existsSync(CREDENTIALS_PATH)) {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  } else {
    throw new Error("Không tìm thấy credentials (file hoặc env GOOGLE_CREDENTIALS).");
  }

  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web || credentials;
  
  // Ưu tiên redirect_uri từ credentials, fallback về oob
  const redirectUri = (redirect_uris && redirect_uris[0]) || "urn:ietf:wg:oauth:2.0:oob";

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  let tokens;
  if (process.env.GOOGLE_TOKEN) {
    tokens = JSON.parse(process.env.GOOGLE_TOKEN);
  } else if (fs.existsSync(TOKEN_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  } else {
    throw new Error("Không tìm thấy token (file hoặc env GOOGLE_TOKEN).");
  }

  oAuth2Client.setCredentials(tokens);

  // Auto-refresh token khi hết hạn
  oAuth2Client.on("tokens", (newTokens) => {
    // Luôn cố gắng lưu vào file nếu có thể (cho local hoặc persistent disks)
    try {
      const current = fs.existsSync(TOKEN_PATH) ? JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")) : tokens;
      const merged = { ...current, ...newTokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
      console.log("🔄 Token auto-refreshed and saved to file");
    } catch (err) {
      console.log("🔄 Token auto-refreshed (could not save to file, session only)");
    }
  });

  _cachedClient = oAuth2Client;
  return oAuth2Client;
}

function resetAuthCache() {
  _cachedClient = null;
}

function getAuthStatus() {
  const hasCredentials = !!(process.env.GOOGLE_CREDENTIALS || fs.existsSync(CREDENTIALS_PATH));
  const hasToken = !!(process.env.GOOGLE_TOKEN || fs.existsSync(TOKEN_PATH));
  let tokenExpiry = null;

  try {
    let tokens;
    if (process.env.GOOGLE_TOKEN) {
      tokens = JSON.parse(process.env.GOOGLE_TOKEN);
    } else if (fs.existsSync(TOKEN_PATH)) {
      tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    }
    if (tokens) tokenExpiry = tokens.expiry_date || null;
  } catch {}

  return {
    hasCredentials,
    hasToken,
    tokenExpiry,
    isReady: hasCredentials && hasToken,
    isEnvBased: !!(process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_TOKEN)
  };
}

module.exports = { getAuthClient, resetAuthCache, getAuthStatus };
