#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const puppeteer = require('/opt/homebrew/lib/node_modules/md-to-pdf/node_modules/puppeteer');

const DIR = path.join(__dirname, 'reports');

const files = fs.readdirSync(DIR)
  .filter(f => /^ctrf-\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

let totalFindings = 0, totalCritical = 0, totalHigh = 0, totalMedium = 0, totalLow = 0;
const rows = [], highDetails = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const tests = data.results?.tests || data.tests || [];
  const sa    = data.results?.extra?.scanArtifact || {};
  const tg    = data.results?.extra?.target || {};
  const slug    = tg.id || sa.pluginSlug || '(unknown)';
  const version = tg.version || sa.pluginVersion || '-';
  const scanDate = sa.scanTimestamp ? new Date(sa.scanTimestamp).toISOString().slice(0,10) : '-';

  let c=0, h=0, m=0, l=0;
  const hf = [];
  for (const t of tests) {
    const sev   = (t.extra?.risk?.severity || t.extra?.severity || '').toLowerCase();
    const score = t.extra?.risk?.score || '-';
    const name  = (t.name || '').replace(/^[\w.-]+\.(?=[\w-]+ at )/, '');
    if      (sev === 'critical') { c++; hf.push({ sev: 'CRITICAL', score, name, msg: (t.message||'').slice(0,120) }); }
    else if (sev === 'high')     { h++; hf.push({ sev: 'HIGH',     score, name, msg: (t.message||'').slice(0,120) }); }
    else if (sev === 'medium') m++;
    else if (sev === 'low')    l++;
  }
  totalFindings  += tests.length;
  totalCritical  += c; totalHigh += h; totalMedium += m; totalLow += l;
  rows.push({ file: file.replace('.json',''), slug, version, scanDate, total: tests.length, c, h, m, l });
  if (hf.length) highDetails.push({ file: file.replace('.json',''), slug, version, scanDate, findings: hf });
}

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const rowsHtml = rows.map(r => {
  const flag = r.c > 0 || r.h > 0;
  return `<tr class="${flag ? 'flagged' : ''}">
    <td>${esc(r.file)}</td>
    <td class="slug">${esc(r.slug)}</td>
    <td>${esc(r.version)}</td>
    <td>${esc(r.scanDate)}</td>
    <td class="num">${r.total}</td>
    <td class="num crit">${r.c || ''}</td>
    <td class="num high">${r.h || ''}</td>
    <td class="num med">${r.m || ''}</td>
    <td class="num low">${r.l || ''}</td>
  </tr>`;
}).join('\n');

const detailHtml = highDetails.map(d => `
  <div class="detail-block">
    <div class="detail-header">${esc(d.file)} &mdash; <span>${esc(d.slug)}</span> v${esc(d.version)} <em>${esc(d.scanDate)}</em></div>
    ${d.findings.map(f => `
      <div class="finding ${f.sev.toLowerCase()}">
        <span class="badge">${esc(f.sev)} ${esc(f.score)}</span>
        <strong>${esc(f.name)}</strong>
        <small>${esc(f.msg)}</small>
      </div>`).join('')}
  </div>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',Arial,sans-serif;background:#0f1117;color:#e2e8f0;padding:48px 56px;}
h1{font-size:30px;font-weight:800;color:#fff;margin-bottom:4px;letter-spacing:-.5px;}
.subtitle{color:#64748b;font-size:13px;margin-bottom:36px;}
.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:40px;}
.card{background:#161b27;border-radius:14px;padding:22px 18px;text-align:center;border:1px solid #1e2840;}
.card .val{font-size:40px;font-weight:900;line-height:1;}
.card .lbl{font-size:11px;color:#64748b;margin-top:8px;text-transform:uppercase;letter-spacing:.07em;}
.card.scans    .val{color:#60a5fa;}
.card.findings .val{color:#e2e8f0;}
.card.high     .val{color:#fb923c;}
.card.medium   .val{color:#facc15;}
.card.low      .val{color:#4ade80;}
.stat-bar{display:flex;gap:24px;margin-bottom:40px;background:#161b27;border-radius:14px;padding:18px 24px;border:1px solid #1e2840;align-items:center;}
.stat-item{text-align:center;}
.stat-item .sv{font-size:22px;font-weight:700;}
.stat-item .sl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;}
.stat-item.flagged .sv{color:#fb923c;}
h2{font-size:16px;font-weight:700;color:#94a3b8;margin-bottom:14px;margin-top:0;border-left:3px solid #6366f1;padding-left:10px;text-transform:uppercase;letter-spacing:.06em;}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:48px;}
th{background:#161b27;color:#64748b;padding:9px 11px;text-align:left;font-weight:600;text-transform:uppercase;font-size:10.5px;letter-spacing:.05em;border-bottom:2px solid #1e2840;}
td{padding:8px 11px;border-bottom:1px solid #161b27;color:#94a3b8;vertical-align:top;}
tr:nth-child(even) td{background:#0d1020;}
tr.flagged td{background:#180f0a;}
tr.flagged td.high{color:#fb923c;font-weight:700;}
tr.flagged td.crit{color:#f87171;font-weight:700;}
.num{text-align:center;}
.slug{font-family:'SF Mono',monospace;font-size:11.5px;color:#818cf8;}
.detail-block{background:#161b27;border-radius:12px;padding:18px 22px;margin-bottom:14px;border:1px solid #1e2840;}
.detail-header{font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:10px;}
.detail-header span{color:#818cf8;font-family:monospace;}
.detail-header em{color:#475569;font-style:normal;font-size:12px;margin-left:6px;}
.finding{padding:8px 12px;border-radius:7px;margin-bottom:8px;background:#0f1117;display:flex;flex-direction:column;gap:4px;}
.finding.high    {border-left:3px solid #fb923c;}
.finding.critical{border-left:3px solid #f87171;}
.badge{display:inline-block;padding:2px 9px;border-radius:4px;font-size:10.5px;font-weight:800;margin-right:8px;letter-spacing:.04em;}
.finding.high    .badge{background:#2d1a08;color:#fb923c;}
.finding.critical .badge{background:#2d0a0a;color:#f87171;}
.finding strong{font-size:12px;color:#e2e8f0;font-family:monospace;}
.finding small{color:#64748b;font-size:11px;line-height:1.55;margin-top:2px;}
.footer{margin-top:48px;color:#334155;font-size:11px;text-align:center;padding-top:20px;border-top:1px solid #1e2840;}
</style>
</head>
<body>
<h1>🛡 Gandalf Security Scan Report</h1>
<div class="subtitle">Generated: 2026-06-22 &nbsp;·&nbsp; WordPress.org Plugin Review Team &nbsp;·&nbsp; ${files.length} plugins scanned</div>

<div class="summary">
  <div class="card scans">   <div class="val">${files.length}</div><div class="lbl">Total Scans</div></div>
  <div class="card findings"><div class="val">${totalFindings}</div><div class="lbl">Total Findings</div></div>
  <div class="card high">    <div class="val">${totalHigh}</div><div class="lbl">High</div></div>
  <div class="card medium">  <div class="val">${totalMedium}</div><div class="lbl">Medium</div></div>
  <div class="card low">     <div class="val">${totalLow}</div><div class="lbl">Low</div></div>
</div>

<h2>All Scans</h2>
<table>
<thead><tr>
  <th>File</th><th>Plugin Slug</th><th>Version</th><th>Scan Date</th>
  <th>Total</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>

<h2>High &amp; Critical Findings — Detail</h2>
${detailHtml}

<div class="footer">Gandalf Automated Security Scanner &mdash; WordPress.org Plugin Review Team &mdash; 2026</div>
</body></html>`;

const htmlPath = '/tmp/gandalf-report.html';
fs.writeFileSync(htmlPath, html);
console.log('HTML written to', htmlPath);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  const outPath = path.join(DIR, 'gandalf-report.png');
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log('PNG written to', outPath);
})();
