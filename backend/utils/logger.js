// Logger với timestamp + level + SSE emit
const LOG_LEVELS = { info: "ℹ️", warn: "⚠️", error: "❌", success: "✅", debug: "🔍" };

class Logger {
  constructor(emitter = null) {
    this.emitter = emitter; // EventEmitter để stream ra SSE
  }

  _log(level, message, data = null) {
    const ts = new Date().toISOString();
    const prefix = LOG_LEVELS[level] || "•";
    const line = `[${ts}] ${prefix} ${message}`;

    console.log(line, data ? JSON.stringify(data) : "");

    if (this.emitter) {
      this.emitter.emit("log", { level, message, data, ts });
    }
  }

  info(msg, data)    { this._log("info", msg, data); }
  warn(msg, data)    { this._log("warn", msg, data); }
  error(msg, data)   { this._log("error", msg, data); }
  success(msg, data) { this._log("success", msg, data); }
  debug(msg, data)   { this._log("debug", msg, data); }
}

module.exports = Logger;
