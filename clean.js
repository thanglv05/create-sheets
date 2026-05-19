const fs = require('fs');
let code = fs.readFileSync('frontend/app.js', 'utf8');

// Replace standard emojis with lucide icons
code = code.replace(/⏳/g, "<i data-lucide='loader-2' class='spinning'></i>");
code = code.replace(/⚡/g, "<i data-lucide='zap'></i>");
code = code.replace(/✅/g, "<i data-lucide='check'></i>");
code = code.replace(/❌/g, "<i data-lucide='x'></i>");
code = code.replace(/🚫/g, "<i data-lucide='ban'></i>");
code = code.replace(/🕐/g, "<i data-lucide='clock'></i>");
code = code.replace(/▶/g, "<i data-lucide='play'></i>");
code = code.replace(/🏁/g, "<i data-lucide='flag'></i>");
code = code.replace(/📦/g, "<i data-lucide='package'></i>");
code = code.replace(/⚠️/g, "<i data-lucide='alert-triangle'></i>");
code = code.replace(/🔍/g, "<i data-lucide='search'></i>");
code = code.replace(/🗑/g, "<i data-lucide='trash-2'></i>");
code = code.replace(/🔗/g, "<i data-lucide='link'></i>");
code = code.replace(/📟/g, "<i data-lucide='terminal'></i>");
code = code.replace(/⚙️/g, "<i data-lucide='settings'></i>");
code = code.replace(/📋/g, "<i data-lucide='clipboard-copy'></i>");
code = code.replace(/✏️/g, "<i data-lucide='edit-2'></i>");
code = code.replace(/➕/g, "<i data-lucide='plus'></i>");

// specifically strip mojibake
code = code.replace(/dY"[^<]*/g, '');
code = code.replace(/dY\?[^<]*/g, '');
code = code.replace(/o\.[^<]*/g, '');
code = code.replace(/\?O[^<]*/g, '');
code = code.replace(/\?3[^<]*/g, '');
code = code.replace(/\.[^<]*/g, '');
code = code.replace(/O[^<]*/g, '');

code = code.replace(/<i data-lucide=/g, "<i style='width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px' data-lucide=");

// Add hook
code = code.replace(/allEl\.innerHTML = \[\.\.\.filtered\]\.reverse\(\)\.map\(\(j\) => renderJobItem\(j\)\)\.join\(\"\"\);/g, 'allEl.innerHTML = [...filtered].reverse().map((j) => renderJobItem(j)).join(\"\"); setTimeout(() => lucide.createIcons(), 50);');
code = code.replace(/activeEl\.innerHTML = activeJobs\.map\(\(j\) => renderJobItem\(j\)\)\.join\(\"\"\);/g, 'activeEl.innerHTML = activeJobs.map((j) => renderJobItem(j)).join(\"\"); setTimeout(() => lucide.createIcons(), 50);');

fs.writeFileSync('frontend/app.js', code);
console.log("Emojis replaced successfully.");
