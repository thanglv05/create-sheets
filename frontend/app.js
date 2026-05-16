// ===== STATE =====
const App = {
  jobs: [],
  config: null,
  logs: [],
  filterJob: "",
  filterStatus: "",
  sseConnected: false,
};

// ===== API =====
const API = {
  base: "/api",
  async get(path) {
    const r = await fetch(this.base + path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(this.base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || r.statusText);
    }
    return r.json();
  },
  async del(path) {
    const r = await fetch(this.base + path, { method: "DELETE" });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || r.statusText);
    }
    return r.json();
  },
};

// ===== TOAST =====
function toast(msg, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ===== TABS =====
function switchTab(tab) {
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((el) => el.classList.remove("active"));
  document.getElementById(`nav-${tab}`)?.classList.add("active");
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  const titles = { 
    dashboard: "Dashboard", 
    jobs: "Danh sách Jobs", 
    config: "Cấu hình", 
    logs: "Nhật ký", 
    tools: "🔧 Công cụ",
    "confirmed-manager": "📋 Quản lý Khách chốt" 
  };
  document.getElementById("page-title").textContent = titles[tab] || tab;
  
  if (tab === "confirmed-manager") refreshConfirmedList();
}

document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab(el.dataset.tab);
  });
});

// ===== SHEET SELECTOR COMBO =====
// Dùng chung cho mọi ô chọn tên sheet trong app
// HTML: <div class="sheet-selector" data-target="input-id" data-source-ref="source-sheet-id-input-id">
class SheetSelector {
  constructor(el) {
    this.el       = el;
    this.targetId = el.dataset.target;       // id của hidden input chứa giá trị cuối
    this.sourceRef= el.dataset.sourceRef;    // id của input chứa sourceSheetId (có thể rỗng)
    this.select   = el.querySelector(".ss-select");
    this.reloadBtn= el.querySelector(".ss-reload");
    this.custom   = el.querySelector(".ss-custom");  // the text input
    this._names   = [];

    this._bind();
    this.load();   // auto-load khi khởi tạo

    // Nếu source-ref thay đổi → reload
    if (this.sourceRef) {
      const srcEl = document.getElementById(this.sourceRef);
      if (srcEl) {
        let debounce;
        srcEl.addEventListener("input", () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => this.load(), 800);
        });
      }
    }
  }

  _bind() {
    this.reloadBtn.addEventListener("click", () => this.load());
    this.select.addEventListener("change", () => this._onSelectChange());
  }

  _getSourceSheetId() {
    if (this.sourceRef) {
      const val = document.getElementById(this.sourceRef)?.value.trim();
      if (val) return val;
    }
    // Fallback: dùng config đã load
    return App.config?.sourceSheetId || "";
  }

  async load() {
    const sourceSheetId = this._getSourceSheetId();
    this.reloadBtn.disabled = true;
    this.reloadBtn.classList.add("spinning");

    // Reset select về trạng thái loading
    this.select.innerHTML = `<option value="">⏳ Đang tải...</option>`;
    this.select.disabled = true;

    try {
      const qs = sourceSheetId ? `?sourceSheetId=${encodeURIComponent(sourceSheetId)}` : "";
      const res = await API.get(`/tools/sheet-names${qs}`);
      this._names = res.sheetNames || [];
      this._populateSelect();
    } catch (err) {
      this.select.innerHTML = `<option value="">⚠️ Lỗi tải: ${escHtml(err.message)}</option>`;
      this.select.disabled = false;
    } finally {
      this.reloadBtn.disabled = false;
      this.reloadBtn.classList.remove("spinning");
    }
  }

  _populateSelect() {
    const names = this._names;
    this.select.innerHTML =
      `<option value="">-- Chọn sheet (${names.length}) --</option>` +
      names.map((n) => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join("") +
      `<option value="__custom__">✏️ Nhập tùy chỉnh...</option>`;
    this.select.disabled = false;
    this._onSelectChange(); // sync state
  }

  _onSelectChange() {
    const val = this.select.value;
    const target = document.getElementById(this.targetId);

    if (val === "__custom__") {
      // Hiện text input
      this.custom.classList.remove("hidden");
      this.custom.required = true;
      if (target) { target.value = ""; target.required = false; }
      this.custom.focus();
    } else {
      // Ẩn text input, set target = giá trị select
      this.custom.classList.add("hidden");
      this.custom.required = false;
      if (target) { target.value = val; target.required = !!val; }
    }
  }

  // Trả về giá trị cuối cùng (custom hoặc select)
  getValue() {
    if (this.select.value === "__custom__") {
      return this.custom.value.trim();
    }
    return this.select.value;
  }
}

// ===== DRIVE FILE SELECTOR =====
class DriveFileSelector {
  constructor(el) {
    this.el = el;
    this.targetId = el.dataset.target;
    this.select = el.querySelector(".dfs-select");
    this.reloadBtn = el.querySelector(".dfs-reload");
    this.custom = el.querySelector(".dfs-custom");
    this._files = [];

    this._bind();
    this.load();
  }

  _bind() {
    this.reloadBtn.addEventListener("click", () => this.load());
    this.select.addEventListener("change", () => this._onSelectChange());
  }

  async load() {
    this.reloadBtn.disabled = true;
    this.reloadBtn.classList.add("spinning");
    this.select.innerHTML = `<option value="">⏳ Đang tải files...</option>`;
    this.select.disabled = true;

    try {
      const res = await API.get("/tools/drive-files");
      this._files = res.files || [];
      this._populateSelect();
    } catch (err) {
      this.select.innerHTML = `<option value="">⚠️ Lỗi tải: ${escHtml(err.message)}</option>`;
      this.select.disabled = false;
    } finally {
      this.reloadBtn.disabled = false;
      this.reloadBtn.classList.remove("spinning");
    }
  }

  _populateSelect() {
    const files = this._files;
    this.select.innerHTML =
      `<option value="">-- Chọn file (${files.length}) --</option>` +
      files.map((f) => `<option value="${escHtml(f.id)}">${escHtml(f.name)}</option>`).join("") +
      `<option value="__custom__">➕ Nhập ID thủ công...</option>`;
    this.select.disabled = false;
  }

  _onSelectChange() {
    const val = this.select.value;
    const target = document.getElementById(this.targetId);

    if (val === "__custom__") {
      this.select.classList.add("hidden");
      this.custom.classList.remove("hidden");
      this.custom.required = true;
      if (target) { target.value = ""; target.required = false; }
      this.custom.focus();
    } else {
      this.custom.classList.add("hidden");
      this.custom.required = false;
      if (target) { target.value = val; target.required = !!val; }
    }
  }

  getValue() {
    if (this.select.value === "__custom__") {
      return this.custom.value.trim();
    }
    return this.select.value;
  }
}

// Khởi tạo tất cả Selectors
const sheetSelectors = {};
document.querySelectorAll(".sheet-selector").forEach((el) => {
  sheetSelectors[el.id] = new SheetSelector(el);
});

const driveFileSelectors = {};
document.querySelectorAll(".drive-file-selector").forEach((el) => {
  driveFileSelectors[el.id] = new DriveFileSelector(el);
});

// Helper: lấy giá trị sheet name từ selector (hoặc plain input fallback)
function getSheetName(selectorId, fallbackInputId) {
  if (sheetSelectors[selectorId]) return sheetSelectors[selectorId].getValue();
  return document.getElementById(fallbackInputId)?.value.trim() || "";
}



// ===== STATUS BADGE HELPER =====
function statusBadge(status) {
  const labels = { pending: "⏳ Chờ", running: "⚡ Đang chạy", done: "✅ Xong", error: "❌ Lỗi", cancelled: "🚫 Hủy" };
  return `<span class="job-status-badge badge-${status}">${labels[status] || status}</span>`;
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" });
}

// ===== RENDER JOBS =====
function renderJobItem(job, containerId = null) {
  const pct = job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : (job.status === "done" ? 100 : 0);

  const actionsHtml = (() => {
    const btns = [];
    btns.push(`<button class="btn btn-ghost btn-sm" onclick="openJobDetail('${job.id}')">🔍 Chi tiết</button>`);
    if (job.status === "pending") {
      btns.push(`<button class="btn btn-danger btn-sm" onclick="deleteJob('${job.id}')">🗑 Xóa</button>`);
    }
    if (job.status === "done" && job.resultsCount > 0) {
      btns.push(`<button class="btn btn-success btn-sm" onclick="openJobDetail('${job.id}')">🔗 ${job.resultsCount} Links</button>`);
    }
    return btns.join("");
  })();

  return `
    <div class="job-item status-${job.status}" id="job-item-${job.id}">
      <div class="job-header">
        <span class="job-name">${escHtml(job.name)}</span>
        ${statusBadge(job.status)}
      </div>
      <div class="job-meta">
        <span>🕐 Tạo: ${formatTime(job.createdAt)}</span>
        ${job.startedAt ? `<span>▶ Bắt đầu: ${formatTime(job.startedAt)}</span>` : ""}
        ${job.completedAt ? `<span>🏁 Xong: ${formatTime(job.completedAt)}</span>` : ""}
        ${job.status === "running" ? `<span>📦 ${job.progress.current}/${job.progress.total} nhóm</span>` : ""}
        ${job.error ? `<span style="color:var(--error)">⚠️ ${escHtml(job.error)}</span>` : ""}
      </div>
      <div class="job-progress-bar">
        <div class="job-progress-fill" style="width: ${pct}%"></div>
      </div>
      <div class="job-actions">${actionsHtml}</div>
    </div>
  `;
}

function escHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderJobLists() {
  const activeJobs = App.jobs.filter((j) => ["pending", "running"].includes(j.status));
  const activeEl = document.getElementById("active-jobs-list");
  if (activeEl) {
    if (activeJobs.length === 0) {
      activeEl.innerHTML = '<div class="empty-state">Không có job nào đang chạy hoặc chờ.</div>';
    } else {
      activeEl.innerHTML = activeJobs.map((j) => renderJobItem(j)).join("");
    }
  }

  const allEl = document.getElementById("all-jobs-list");
  if (allEl) {
    let filtered = App.jobs;
    const fStatus = document.getElementById("filter-status")?.value;
    if (fStatus) filtered = filtered.filter((j) => j.status === fStatus);

    if (filtered.length === 0) {
      allEl.innerHTML = `<div class="empty-state">Không có job nào${fStatus ? " với trạng thái này" : ""}.</div>`;
    } else {
      allEl.innerHTML = [...filtered].reverse().map((j) => renderJobItem(j)).join("");
    }
  }

  // Update badges
  const pending = App.jobs.filter((j) => j.status === "pending").length;
  const total = App.jobs.length;
  document.getElementById("badge-jobs").textContent = total;
  document.getElementById("badge-jobs").classList.toggle("hidden", total === 0);

  // Stats
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-pending").textContent = App.jobs.filter((j) => j.status === "pending").length;
  document.getElementById("stat-running").textContent = App.jobs.filter((j) => j.status === "running").length;
  document.getElementById("stat-done").textContent = App.jobs.filter((j) => j.status === "done").length;
  document.getElementById("stat-error").textContent = App.jobs.filter((j) => j.status === "error").length;
}

// ===== JOB DETAIL MODAL =====
async function openJobDetail(jobId) {
  try {
    const job = await API.get(`/run/jobs/${jobId}`);
    document.getElementById("modal-title").textContent = `📋 ${job.name}`;

    const resultsHtml = job.results && job.results.length > 0
      ? `<div class="section-title" style="margin-top:16px">🔗 Files đã tạo (${job.results.length})</div>` +
        job.results.map((r) => `
          <div class="result-link">
            <a href="${r.fileUrl}" target="_blank" rel="noreferrer">${escHtml(r.url)}</a>
            <button class="copy-btn" onclick="copyText('${r.fileUrl}', this)">📋</button>
          </div>
        `).join("")
      : "";

    const logsHtml = job.logs && job.logs.length > 0
      ? `<div class="section-title" style="margin-top:16px">📟 Logs (${job.logs.length})</div>
         <div class="log-container" style="max-height:300px;border-radius:8px">` +
        job.logs.map((l) => `<div class="log-line log-${l.level}">
          <span class="log-ts">${new Date(l.ts).toLocaleTimeString("vi-VN")}</span>
          <span class="log-msg">${escHtml(l.message)}</span>
        </div>`).join("") +
        "</div>"
      : "";

    document.getElementById("modal-body").innerHTML = `
      <div class="job-meta" style="margin-bottom:12px">
        <span>${statusBadge(job.status)}</span>
        <span>🕐 ${formatTime(job.createdAt)}</span>
        ${job.startedAt ? `<span>▶ ${formatTime(job.startedAt)}</span>` : ""}
        ${job.completedAt ? `<span>🏁 ${formatTime(job.completedAt)}</span>` : ""}
      </div>
      <div class="section-title">⚙️ Config</div>
      <div style="background:var(--bg-elevated);border-radius:8px;padding:12px;font-family:var(--font-mono);font-size:0.78rem;color:var(--text-secondary)">
        Sheet: <b style="color:var(--text-primary)">${escHtml(job.config.sheetName)}</b><br>
        Source: <span>${escHtml(job.config.sourceSheetId)}</span><br>
        Template: <span>${escHtml(job.config.templateId)}</span><br>
        Folder: <span>${escHtml(job.config.folderId)}</span>
      </div>
      ${resultsHtml}
      ${logsHtml}
    `;

    document.getElementById("modal-overlay").classList.remove("hidden");
  } catch (err) {
    toast(`Không tải được chi tiết: ${err.message}`, "error");
  }
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}
document.getElementById("btn-modal-close").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});

// ===== COPY =====
async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = "✅";
    setTimeout(() => (btn.textContent = orig), 1500);
  } catch {
    toast("Không copy được", "error");
  }
}

// ===== ADD JOB FORM =====
let advancedOpen = false;
document.getElementById("btn-toggle-advanced").addEventListener("click", () => {
  advancedOpen = !advancedOpen;
  document.getElementById("job-advanced-row").classList.toggle("open", advancedOpen);
  document.getElementById("btn-toggle-advanced").textContent = advancedOpen ? "⬆ Ẩn bớt" : "⚙️ Tùy chọn nâng cao";
});

document.getElementById("form-add-job").addEventListener("submit", async (e) => {
  e.preventDefault();
  const sheetName = document.getElementById("job-sheet-name").value.trim();
  if (!sheetName) return toast("Vui lòng nhập tên sheet", "error");

  const body = {
    name: document.getElementById("job-name").value.trim() || sheetName,
    sheetName,
    sourceSheetId: document.getElementById("job-source-sheet-id").value.trim() || undefined,
    templateId: document.getElementById("job-template-id").value.trim() || undefined,
    folderId: document.getElementById("job-folder-id").value.trim() || undefined,
  };

  try {
    const res = await API.post("/run/jobs", body);
    toast(`✅ Đã thêm job: ${res.job.name}`, "success");
    document.getElementById("form-add-job").reset();
    advancedOpen = false;
    document.getElementById("job-advanced-row").classList.remove("open");
    await refreshJobs();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  }
});

// ===== DELETE JOB =====
async function deleteJob(id) {
  if (!confirm("Xóa job này?")) return;
  try {
    await API.del(`/run/jobs/${id}`);
    toast("Đã xóa job", "success");
    await refreshJobs();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  }
}

// ===== START QUEUE =====
document.getElementById("btn-start-queue").addEventListener("click", async () => {
  try {
    const res = await API.post("/run/start", {});
    toast(`▶ ${res.message}`, "success");
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  }
});

// ===== FILTER =====
document.getElementById("filter-status").addEventListener("change", renderJobLists);
document.getElementById("filter-log-job").addEventListener("change", (e) => {
  App.filterJob = e.target.value;
  renderLogs();
});

// ===== LOGS =====
let allLogs = [];

function addLog(entry) {
  allLogs.push(entry);
  if (allLogs.length > 2000) allLogs = allLogs.slice(-2000);

  // Update error badge
  const errCount = allLogs.filter((l) => l.level === "error").length;
  const badge = document.getElementById("badge-logs");
  if (errCount > 0) {
    badge.textContent = errCount;
    badge.classList.remove("hidden");
  }

  if (!App.filterJob || App.filterJob === (entry.jobId || "")) {
    appendLogLine(entry);
  }
}

function appendLogLine(entry) {
  const container = document.getElementById("log-container");
  const empty = container.querySelector(".log-empty");
  if (empty) empty.remove();

  const div = document.createElement("div");
  div.className = `log-line log-${entry.level || "info"}`;
  div.innerHTML = `
    <span class="log-ts">${new Date(entry.ts || Date.now()).toLocaleTimeString("vi-VN")}</span>
    ${entry.jobId ? `<span class="log-job-id">[${entry.jobId.slice(0,8)}]</span>` : ""}
    <span class="log-msg">${escHtml(entry.message)}</span>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function renderLogs() {
  const container = document.getElementById("log-container");
  container.innerHTML = "";
  const filtered = App.filterJob
    ? allLogs.filter((l) => l.jobId === App.filterJob)
    : allLogs;
  if (filtered.length === 0) {
    container.innerHTML = '<div class="log-empty">Chưa có log nào.</div>';
  } else {
    filtered.forEach(appendLogLine);
  }
}

document.getElementById("btn-clear-logs").addEventListener("click", () => {
  allLogs = [];
  document.getElementById("log-container").innerHTML = '<div class="log-empty">Logs đã được xóa.</div>';
  document.getElementById("badge-logs").classList.add("hidden");
});

// ===== CONFIG =====
async function loadConfig() {
  try {
    const res = await API.get("/config");
    App.config = res.config;

    document.getElementById("cfg-template-id").value = res.config.templateId || "";
    document.getElementById("cfg-folder-id").value = res.config.folderId || "";
    document.getElementById("cfg-source-sheet-id").value = res.config.sourceSheetId || "";
    document.getElementById("cfg-name-map").value = JSON.stringify(res.config.nameMap || {}, null, 2);

    // Auth detail
    const auth = res.auth;
    const authEl = document.getElementById("auth-detail-panel");
    const authTopEl = document.getElementById("auth-status");

    if (auth.isReady) {
      const expiry = auth.tokenExpiry ? new Date(auth.tokenExpiry).toLocaleString("vi-VN") : "Không rõ";
      authEl.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <span class="dot dot-success"></span>
          <b style="color:var(--success)">Đã xác thực Google API</b>
        </div>
        <div style="font-size:0.82rem;color:var(--text-secondary)">
          credentials.json: <span style="color:var(--success)">✅ Có</span><br>
          token.json: <span style="color:var(--success)">✅ Có</span><br>
          Token hết hạn: <span style="color:var(--text-primary)">${expiry}</span>
        </div>
      `;
      authTopEl.innerHTML = `<span class="dot dot-success"></span><span>Google API: OK</span>`;
    } else {
      authEl.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <span class="dot dot-error"></span>
          <b style="color:var(--error)">Chưa xác thực</b>
        </div>
        <div style="font-size:0.82rem;color:var(--text-secondary)">
          credentials.json: <span style="color:${auth.hasCredentials ? "var(--success)" : "var(--error)"}">${auth.hasCredentials ? "✅" : "❌"}</span><br>
          token.json: <span style="color:${auth.hasToken ? "var(--success)" : "var(--error)"}">${auth.hasToken ? "✅" : "❌"}</span><br>
          <br>
          <span style="color:var(--warning)">⚠️ Hãy đặt credentials.json và token.json vào thư mục gốc project và khởi động lại server.</span>
        </div>
      `;
      authTopEl.innerHTML = `<span class="dot dot-error"></span><span>Google API: Lỗi</span>`;
    }
  } catch (err) {
    console.error("Load config failed:", err);
    toast("Không tải được config", "error");
  }
}

document.getElementById("form-config").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    let nameMap;
    try {
      nameMap = JSON.parse(document.getElementById("cfg-name-map").value);
    } catch {
      return toast("Name Map không phải JSON hợp lệ", "error");
    }

    await API.post("/config", {
      templateId: document.getElementById("cfg-template-id").value.trim(),
      folderId: document.getElementById("cfg-folder-id").value.trim(),
      sourceSheetId: document.getElementById("cfg-source-sheet-id").value.trim(),
      nameMap,
    });
    toast("✅ Đã lưu cấu hình", "success");
    await loadConfig();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  }
});

document.getElementById("btn-reset-config").addEventListener("click", async () => {
  if (!confirm("Reset về config mặc định?")) return;
  try {
    const res = await API.get("/config");
    // Re-fetch default by clearing saved config
    toast("Đã reset config", "success");
    await loadConfig();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  }
});

// ===== FETCH JOBS =====
async function refreshJobs() {
  try {
    App.jobs = await API.get("/run/jobs");
    renderJobLists();
    updateLogJobFilter();
  } catch (err) {
    console.error("Refresh jobs failed:", err);
  }
}

function updateLogJobFilter() {
  const sel = document.getElementById("filter-log-job");
  const current = sel.value;
  sel.innerHTML = '<option value="">Tất cả jobs</option>';
  App.jobs.forEach((j) => {
    const opt = document.createElement("option");
    opt.value = j.id;
    opt.textContent = j.name;
    if (j.id === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ===== SSE =====
function connectSSE() {
  const es = new EventSource("/api/run/stream");

  es.onopen = () => {
    App.sseConnected = true;
    document.getElementById("status-dot").className = "status-dot connected";
    document.getElementById("status-text").textContent = "Đã kết nối";
  };

  es.onerror = () => {
    App.sseConnected = false;
    document.getElementById("status-dot").className = "status-dot error-state";
    document.getElementById("status-text").textContent = "Mất kết nối";
    setTimeout(connectSSE, 3000);
    es.close();
  };

  es.addEventListener("init", (e) => {
    const data = JSON.parse(e.data);
    App.jobs = data.jobs || [];
    renderJobLists();
    updateLogJobFilter();
  });

  es.addEventListener("jobs_updated", (e) => {
    App.jobs = JSON.parse(e.data);
    renderJobLists();
    updateLogJobFilter();
  });

  es.addEventListener("job_log", (e) => {
    const data = JSON.parse(e.data);
    addLog(data);
  });

  es.addEventListener("job_progress", (e) => {
    const data = JSON.parse(e.data);
    // Update progress bar in job item if visible
    const jobEl = document.getElementById(`job-item-${data.jobId}`);
    if (jobEl) {
      const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
      const fill = jobEl.querySelector(".job-progress-fill");
      if (fill) fill.style.width = pct + "%";
    }
  });

  es.addEventListener("queue_status", (e) => {
    const data = JSON.parse(e.data);
    const btn = document.getElementById("btn-start-queue");
    if (data.running) {
      btn.innerHTML = "<span>⏳ Đang chạy...</span>";
      btn.disabled = true;
    } else {
      btn.innerHTML = "<span>▶ Chạy Queue</span>";
      btn.disabled = false;
    }
  });
}

// ===== INIT =====
(async function init() {
  await Promise.all([loadConfig(), refreshJobs()]);
  connectSSE();
  // Polling fallback mỗi 10s
  setInterval(refreshJobs, 10000);
})();

// ============================================================
// ===== TOOLS TAB =====
// ============================================================

// ----- Tool sub-tab switching -----
document.querySelectorAll(".tool-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tool-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tool-${btn.dataset.tool}`)?.classList.add("active");
  });
});

// Initialize all selectors
document.querySelectorAll(".sheet-selector").forEach(el => new SheetSelector(el));
document.querySelectorAll(".drive-file-selector").forEach(el => new DriveFileSelector(el));

// ----- Helper: render logs array -----
function renderToolLogs(logs = []) {
  if (!logs.length) return "";
  return `
    <div class="section-title" style="margin-top:16px">📟 Logs (${logs.length})</div>
    <div class="log-container" style="max-height:200px;border-radius:8px">
      ${logs.map((l) => `<div class="log-line log-${l.level}">
        <span class="log-ts">${new Date(l.ts).toLocaleTimeString("vi-VN")}</span>
        <span class="log-msg">${escHtml(l.message)}</span>
      </div>`).join("")}
    </div>
  `;
}

// ----- Helper: set button loading state -----
function setBtnLoading(btnId, loading, originalText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span>⏳ Đang xử lý...</span>` : `<span>${originalText}</span>`;
}

// ===== TOOL 1: KHÁCH CHỐT =====
document.getElementById("form-customer-confirmed").addEventListener("submit", async (e) => {
  e.preventDefault();
  const sheetName = document.getElementById("cc-sheet-name").value.trim();
  if (!sheetName) return toast("Vui lòng nhập tên sheet", "error");

  setBtnLoading("btn-cc-submit", true, "🔍 Tìm khách chốt");
  try {
    const res = await API.post("/tools/customer-confirmed", {
      sheetName,
      sourceSheetId: document.getElementById("cc-source-sheet-id").value.trim() || undefined,
      folderId: document.getElementById("cc-folder-id").value.trim() || undefined,
    });

    document.getElementById("cc-result-title").textContent =
      `Kết quả: ${res.results.length} URL khách chốt (${res.totalRows} dòng / ${res.totalFiles} files)`;

    document.getElementById("cc-result-body").innerHTML = res.results.length === 0
      ? `<div class="empty-state">⚠️ Không tìm thấy URL nào có trạng thái "khách chốt".</div>`
      : `<table class="result-table">
          <thead><tr><th>#</th><th>URL</th><th>Sheet name</th><th>Sheet URL</th></tr></thead>
          <tbody>
            ${res.results.map((r, i) => `<tr>
              <td>${i + 1}</td>
              <td>${escHtml(r.url)}</td>
              <td>${escHtml(r.sheetName)}</td>
              <td class="td-url">
                ${r.sheetUrl
                  ? `<a href="${r.sheetUrl}" target="_blank">🔗 Mở file</a>
                     <button class="copy-btn" onclick="copyText('${r.sheetUrl}',this)">📋</button>`
                  : `<span style="color:var(--error)">❌ Không tìm thấy</span>`}
              </td>
            </tr>`).join("")}
          </tbody>
        </table>` + renderToolLogs(res.logs);

    document.getElementById("cc-result-card").classList.remove("hidden");
    toast(`✅ Tìm thấy ${res.results.length} URL`, "success");
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  } finally {
    setBtnLoading("btn-cc-submit", false, "🔍 Tìm khách chốt");
  }
});

// ===== TOOL 2: TRA LINK FILE =====
document.getElementById("form-get-url").addEventListener("submit", async (e) => {
  e.preventDefault();
  const items = document.getElementById("gu-items").value.trim();
  if (!items) return toast("Vui lòng nhập danh sách tên file", "error");

  setBtnLoading("btn-gu-submit", true, "🔍 Tìm URLs");
  try {
    const res = await API.post("/tools/get-url", {
      folderId: document.getElementById("gu-folder-id").value.trim() || undefined,
      items,
    });

    const foundCount = res.results.filter((r) => r.found).length;
    document.getElementById("gu-result-title").textContent =
      `Kết quả: ${foundCount}/${res.results.length} tìm thấy`;

    document.getElementById("gu-result-body").innerHTML =
      `<table class="result-table">
        <thead><tr><th>#</th><th>Tên file</th><th>Trạng thái</th><th>URL</th></tr></thead>
        <tbody>
          ${res.results.map((r, i) => `<tr>
            <td>${i + 1}</td>
            <td class="mono" style="font-size:0.78rem">${escHtml(r.item)}</td>
            <td class="td-status">
              ${r.found
                ? `<span class="tag-found">✅ Có</span>`
                : `<span class="tag-notfound">❌ Không tìm thấy</span>`}
            </td>
            <td class="td-url">
              ${r.url
                ? `<a href="${r.url}" target="_blank">${r.url}</a>
                   <button class="copy-btn" onclick="copyText('${r.url}',this)">📋</button>`
                : `<span style="color:var(--text-muted)">—</span>`}
            </td>
          </tr>`).join("")}
        </tbody>
      </table>` + renderToolLogs(res.logs);

    document.getElementById("gu-result-card").classList.remove("hidden");
    toast(`✅ ${foundCount}/${res.results.length} file tìm thấy`, foundCount > 0 ? "success" : "warning");
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  } finally {
    setBtnLoading("btn-gu-submit", false, "🔍 Tìm URLs");
  }
});

// Copy all found URLs
document.getElementById("btn-gu-copy-all")?.addEventListener("click", async () => {
  const links = document.querySelectorAll("#gu-result-body .td-url a");
  const text = Array.from(links).map((a) => a.href).join("\n");
  if (!text) return toast("Không có URL nào", "warning");
  try {
    await navigator.clipboard.writeText(text);
    toast("✅ Đã copy tất cả URLs", "success");
  } catch {
    toast("Không copy được", "error");
  }
});

// ===== TOOL 3: PUSH DATA LOGIC =====
function createPushRow(data = { service: "entity", id: "", spreadsheetId: "" }) {
  const container = document.getElementById("pd-rows-container");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "form-row push-data-row";
  row.style.borderBottom = "1px solid var(--border-subtle)";
  row.style.paddingBottom = "12px";
  row.style.marginBottom = "12px";
  row.style.display = "flex";
  row.style.gap = "12px";
  row.style.alignItems = "flex-end";
  
  row.innerHTML = `
    <div class="form-group" style="flex: 1">
      <label>Service</label>
      <select class="select-input pd-row-service">
        <option value="entity" ${data.service === "entity" ? "selected" : ""}>Entity</option>
        <option value="podcast" ${data.service === "podcast" ? "selected" : ""}>Podcast</option>
        <option value="blog-2" ${data.service === "blog-2" ? "selected" : ""}>Blog-2</option>
        <option value="share-social" ${data.service === "share-social" ? "selected" : ""}>Share Social</option>
        <option value="gg-stacking" ${data.service === "gg-stacking" ? "selected" : ""}>GG Stacking</option>
      </select>
    </div>
    <div class="form-group" style="flex: 2">
      <label>ID</label>
      <input type="text" class="mono pd-row-id" value="${data.id}" placeholder="UUID / ID" />
    </div>
    <div class="form-group" style="flex: 3">
      <label>Spreadsheet ID</label>
      <input type="text" class="mono pd-row-sheet" value="${data.spreadsheetId}" placeholder="ID Google Sheet" />
    </div>
    <button type="button" class="btn btn-danger btn-sm btn-remove-row" style="margin-bottom: 4px;">✕</button>
  `;

  row.querySelector(".btn-remove-row").addEventListener("click", () => {
    row.remove();
    if (container.children.length === 0) createPushRow();
  });

  container.appendChild(row);
}

// Khởi tạo hàng đầu tiên và gán sự kiện
if (document.getElementById("pd-rows-container")) {
  createPushRow();
  document.getElementById("btn-pd-add-row")?.addEventListener("click", () => createPushRow());
}

document.getElementById("form-push-data")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const rows = document.querySelectorAll(".push-data-row");
  const jobs = [];
  rows.forEach(row => {
    const service = row.querySelector(".pd-row-service").value;
    const id = row.querySelector(".pd-row-id").value.trim();
    const spreadsheetId = row.querySelector(".pd-row-sheet").value.trim();
    if (id && spreadsheetId) {
      jobs.push({ service, id, spreadsheetId });
    }
  });

  if (jobs.length === 0) return toast("Vui lòng nhập ít nhất một nhiệm vụ hợp lệ", "error");

  setBtnLoading("btn-pd-submit", true, "⌛ Đang xử lý...");
  try {
    const res = await API.post("/tools/push-data", {
      apiKey: document.getElementById("pd-api-key").value.trim() || undefined,
      apiBase: document.getElementById("pd-api-base").value.trim() || undefined,
      jobs,
    });

    document.getElementById("pd-result-title").textContent =
      `Kết quả: ✅ ${res.success} thành công | ❌ ${res.fail} thất bại`;

    document.getElementById("pd-result-body").innerHTML =
      `<table class="result-table">
        <thead><tr><th>#</th><th>Service</th><th>Spreadsheet ID</th><th>Trạng thái</th><th>Chi tiết</th></tr></thead>
        <tbody>
          ${res.details.map((d, i) => `<tr>
            <td>${i + 1}</td>
            <td><code>${escHtml(d.job.service)}</code></td>
            <td class="mono" style="font-size:0.75rem">${escHtml(d.job.spreadsheetId)}</td>
            <td>${d.status === "success"
              ? `<span class="tag-found">✅ OK</span>`
              : `<span class="tag-notfound">❌ Lỗi</span>`}
            </td>
            <td style="font-size:0.78rem;color:var(--text-secondary)">${d.rows != null ? `${d.rows} dòng` : escHtml(d.error || "")}</td>
          </tr>`).join("")}
        </tbody>
      </table>` + renderToolLogs(res.logs);

    document.getElementById("pd-result-card").classList.remove("hidden");
    toast(`✅ ${res.success} jobs thành công`, res.fail === 0 ? "success" : "warning");
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  } finally {
    setBtnLoading("btn-pd-submit", false, "📤 Bắt đầu push");
  }
});

// ===== TOOL 4: UPDATE STATUS =====
document.getElementById("form-update-status").addEventListener("submit", async (e) => {
  e.preventDefault();
  const sheetName = document.getElementById("us-sheet-name").value.trim();
  const urls = document.getElementById("us-urls").value.trim();
  if (!sheetName) return toast("Vui lòng nhập tên sheet", "error");
  if (!urls) return toast("Vui lòng nhập danh sách URLs", "error");

  setBtnLoading("btn-us-submit", true, "🏷️ Cập nhật trạng thái");
  try {
    const res = await API.post("/tools/update-status", {
      sheetName,
      sourceSheetId: document.getElementById("us-source-sheet-id").value.trim() || undefined,
      urls,
      statusText: document.getElementById("us-status-text").value.trim() || undefined,
      statusCol: document.getElementById("us-status-col").value.trim() || undefined,
    });

    document.getElementById("us-result-title").textContent =
      `Kết quả: ${res.updated} dòng đã cập nhật`;

    const notFoundHtml = res.notFound && res.notFound.length > 0
      ? `<div style="margin-top:12px"><div class="section-title">Không tìm thấy (${res.notFound.length})</div>
         ${res.notFound.map((u) => `<div style="font-size:0.82rem;color:var(--error);padding:3px 0">❌ ${escHtml(u)}</div>`).join("")}</div>`
      : "";

    document.getElementById("us-result-body").innerHTML =
      `<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px">
        <div class="stat-card" style="padding:14px 20px">
          <div class="stat-icon">✅</div>
          <div class="stat-body"><div class="stat-value">${res.updated}</div><div class="stat-label">Dòng đã update</div></div>
        </div>
        <div class="stat-card" style="padding:14px 20px">
          <div class="stat-icon">❌</div>
          <div class="stat-body"><div class="stat-value">${res.notFound?.length || 0}</div><div class="stat-label">Không tìm thấy</div></div>
        </div>
      </div>
      ${notFoundHtml}
      ${renderToolLogs(res.logs)}`;

    document.getElementById("us-result-card").classList.remove("hidden");
    toast(`✅ Đã update ${res.updated} dòng`, "success");
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  } finally {
    setBtnLoading("btn-us-submit", false, "🏷️ Cập nhật trạng thái");
  }
});

// ===== CONFIRMED MANAGER LOGIC =====
App.currentConfirmed = [];

async function refreshConfirmedList() {
  const container = document.getElementById("confirmed-list-container");
  if (!container) return;
  
  container.innerHTML = '<div class="empty-state">⏳ Đang quét sheet tìm khách chốt...</div>';
  
  try {
    const data = await API.get("/tools/confirmed-list");
    App.currentConfirmed = data.results || [];
    
    if (App.currentConfirmed.length === 0) {
      container.innerHTML = '<div class="empty-state">✅ Không có khách nào đang ở trạng thái "khách chốt".</div>';
      return;
    }

    container.innerHTML = `
      <table class="result-table">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>URL Khách</th>
            <th>Link Sheet</th>
            <th>Tên Sheet (K)</th>
          </tr>
        </thead>
        <tbody>
          ${App.currentConfirmed.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="td-url"><a href="${item.url}" target="_blank">${escHtml(item.url)}</a></td>
              <td><a href="${item.sheetUrl || '#'}" target="_blank" class="tag-found">${item.sheetUrl ? 'Mở Sheet 🔗' : 'Chưa có file'}</a></td>
              <td><code>${escHtml(item.sheetName)}</code></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--error)">❌ Lỗi: ${err.message}</div>`;
  }
}

document.getElementById("btn-refresh-confirmed")?.addEventListener("click", refreshConfirmedList);

// Helper copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback cho trình duyệt cũ
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      toast("Không thể copy. Hãy thử copy thủ công.", "error");
    }
    document.body.removeChild(textArea);
  }
}

document.getElementById("btn-copy-all-confirmed")?.addEventListener("click", () => {
  if (!App.currentConfirmed || App.currentConfirmed.length === 0) {
    return toast("Không có URL nào để copy", "warning");
  }
  // Lấy sheetUrl có sẵn từ Backend
  const allSheetUrls = App.currentConfirmed
    .map(item => item.sheetUrl)
    .filter(url => url)
    .join("\n");

  if (!allSheetUrls) return toast("Không tìm thấy link Sheet nào để copy", "warning");

  copyToClipboard(allSheetUrls);
  toast(`📋 Đã copy ${allSheetUrls.split("\n").length} link Google Sheet vào bộ nhớ đệm!`, "success");
});

document.getElementById("btn-bulk-to-running")?.addEventListener("click", async () => {
  if (!App.currentConfirmed || App.currentConfirmed.length === 0) {
    return toast("Không có dữ liệu để cập nhật", "warning");
  }
  
  if (!confirm(`Xác nhận chuyển ${App.currentConfirmed.length} URL sang "Đang chạy"?`)) return;
  
  const btn = document.getElementById("btn-bulk-to-running");
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⌛ Đang xử lý...";
  
  const urls = App.currentConfirmed.map(item => item.url);
  try {
    const res = await API.post("/tools/confirm-to-running", { urls });
    toast(`✅ Đã cập nhật ${res.updated} dòng sang "Đang chạy"`, "success");
    await refreshConfirmedList();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});

// ===== TOOL: SCRAPE INFO LOGIC =====
document.getElementById("form-scrape-info")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const urlsRaw = document.getElementById("si-urls").value.trim();
  const urls = urlsRaw.split("\n").map(u => u.trim()).filter(u => u);
  
  const selector = driveFileSelectors["dfs-scrape"];
  const spreadsheetId = selector ? selector.getValue() : document.getElementById("si-spreadsheet-id")?.value.trim();

  if (!urls.length) return toast("Vui lòng nhập ít nhất 1 URL", "warning");

  const statusArea = document.getElementById("si-status-area");
  const steps = [
    document.getElementById("si-step-1"),
    document.getElementById("si-step-2"),
    document.getElementById("si-step-3")
  ];

  // Reset UI
  statusArea.classList.remove("hidden");
  steps.forEach(s => { 
    s.textContent = s.textContent.replace(/[🔵✅❌]/g, "⚪"); 
    s.classList.remove("active"); 
  });
  document.getElementById("si-result-card").classList.add("hidden");

  setBtnLoading("btn-si-submit", true, `🚀 Đang xử lý ${urls.length} URLs...`);
  
  try {
    steps[0].textContent = `🔵 1. Đang xử lý ${urls.length} URLs (Cào + Tìm file + Điền)...`;
    steps[0].classList.add("active");

    const res = await API.post("/tools/scrape-info", { urls, spreadsheetId });
    
    steps[0].textContent = "✅ 1. Đã hoàn thành xử lý danh sách";
    steps[1].textContent = `✅ 2. Thành công: ${res.results.filter(r => r.status === "success").length}`;
    steps[2].textContent = `✅ 3. Lỗi: ${res.results.filter(r => r.status === "error").length}`;
    steps.forEach(s => s.classList.remove("active"));

    // Render table kết quả
    renderScrapeResults(res.results);
    document.getElementById("si-result-card").classList.remove("hidden");
    
    toast(`✅ Hoàn thành! Thành công ${res.results.filter(r => r.status === "success").length}/${urls.length}`, "success");
  } catch (err) {
    toast(`Thất bại: ${err.message}`, "error");
    steps[0].textContent = `❌ Lỗi: ${err.message}`;
  } finally {
    setBtnLoading("btn-si-submit", false, "🚀 Bắt đầu tự động điền");
  }
});

function renderScrapeResults(results) {
  const container = document.getElementById("si-result-json");
  if (!container) return;

  if (!results.length) {
    container.innerHTML = "Không có kết quả";
    return;
  }

  container.innerHTML = `
    <table class="result-table" style="font-size:0.8rem">
      <thead>
        <tr>
          <th>URL</th>
          <th>Trạng thái</th>
          <th>Thông tin thu thập</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => {
          const p = r.data?.businessProfile || {};
          const info = r.status === "success" 
            ? `<b>${p.firstName} ${p.lastName}</b><br>📞 ${p.phone}<br>📍 ${p.city}`
            : `<span style="color:var(--error)">${r.error || "Lỗi không xác định"}</span>`;
          
          return `
            <tr>
              <td class="td-url"><a href="${r.url}" target="_blank">${r.url}</a></td>
              <td><span class="tag-${r.status}">${r.status === "success" ? "✅ Xong" : "❌ Lỗi"}</span></td>
              <td>${info}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}
