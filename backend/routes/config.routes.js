const express = require("express");
const router = express.Router();
const { loadConfig, saveConfig } = require("../config/settings");
const { getAuthStatus } = require("../services/auth.service");

// GET /api/config
router.get("/", (req, res) => {
  try {
    const config = loadConfig();
    const auth = getAuthStatus();
    res.json({ config, auth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config
router.post("/", (req, res) => {
  try {
    const { templateId, folderId, sourceSheetId, nameMap } = req.body;
    const updated = saveConfig({ templateId, folderId, sourceSheetId, nameMap });
    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
