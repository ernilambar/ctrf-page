#!/usr/bin/env node
const fs = require('fs');

const REPORTS_DIR = require('path').join(__dirname, 'reports');
const files = fs.readdirSync(REPORTS_DIR).filter(f => /^ctrf-\d+\.json$/.test(f)).sort((a, b) => {
  return parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]);
});

let totalFindings = 0, totalCritical = 0, totalHigh = 0, totalMedium = 0, totalLow = 0, totalInfo = 0;
const rows = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(require('path').join(REPORTS_DIR, file), 'utf8'));
  const tests = data.results?.tests || data.tests || [];
  const scanArtifact = data.results?.extra?.scanArtifact || {};
  const target = data.results?.extra?.target || {};
  const slug = target.id || scanArtifact.pluginSlug || '(unknown)';
  const version = target.version || scanArtifact.pluginVersion || '-';
  const scanDate = scanArtifact.scanTimestamp ? new Date(scanArtifact.scanTimestamp).toISOString().slice(0, 10) : '-';

  let critical = 0, high = 0, medium = 0, low = 0, info = 0;
  for (const t of tests) {
    const sev = (t.extra?.risk?.severity || t.extra?.severity || '').toLowerCase();
    if (sev === 'critical') critical++;
    else if (sev === 'high') high++;
    else if (sev === 'medium') medium++;
    else if (sev === 'low') low++;
    else info++;
  }

  totalFindings += tests.length;
  totalCritical += critical;
  totalHigh += high;
  totalMedium += medium;
  totalLow += low;
  totalInfo += info;

  rows.push({ file: file.replace('.json', ''), slug, version, scanDate, total: tests.length, critical, high, medium, low, info });
}

// Summary
console.log('=== GANDALF SCAN REPORT ===');
console.log(`Total scans:    ${files.length}`);
console.log(`Total findings: ${totalFindings}`);
console.log(`  Critical:     ${totalCritical}`);
console.log(`  High:         ${totalHigh}`);
console.log(`  Medium:       ${totalMedium}`);
console.log(`  Low:          ${totalLow}`);
console.log(`  Info/Other:   ${totalInfo}`);
console.log('');

// Scans with high/critical
const flagged = rows.filter(r => r.critical > 0 || r.high > 0);
console.log(`Scans with Critical or High findings: ${flagged.length}`);
console.log('');

// Table header
const cols = ['File', 'Plugin Slug', 'Version', 'Date', 'Total', 'Crit', 'High', 'Med', 'Low', 'Info'];
const widths = [10, 40, 14, 12, 6, 5, 5, 5, 5, 5];
const line = widths.map(w => '-'.repeat(w)).join('-+-');
const fmt = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join(' | ');

console.log(fmt(cols));
console.log(line);
for (const r of rows) {
  const marker = (r.critical > 0 || r.high > 0) ? ' !' : '';
  console.log(fmt([r.file, r.slug, r.version, r.scanDate, r.total, r.critical, r.high, r.medium, r.low, r.info]) + marker);
}
console.log(line);
console.log(fmt(['TOTAL', `${files.length} scans`, '', '', totalFindings, totalCritical, totalHigh, totalMedium, totalLow, totalInfo]));

// Top findings detail
console.log('');
console.log('=== HIGH/CRITICAL FINDINGS DETAIL ===');
for (const r of rows) {
  if (r.critical === 0 && r.high === 0) continue;
  const data = JSON.parse(fs.readFileSync(require('path').join(REPORTS_DIR, r.file + '.json'), 'utf8'));
  const tests = data.results?.tests || data.tests || [];
  console.log(`\n[${r.file}] ${r.slug} v${r.version} (${r.scanDate})`);
  for (const t of tests) {
    const sev = (t.extra?.risk?.severity || t.extra?.severity || '').toLowerCase();
    if (sev !== 'high' && sev !== 'critical') continue;
    const score = t.extra?.risk?.score || '-';
    const name = (t.name || '').replace(/^[\w.-]+\.(?=[\w-]+ at )/, '');
    console.log(`  [${sev.toUpperCase()} ${score}] ${name}`);
    if (t.message) console.log(`           ${t.message.slice(0, 120)}`);
  }
}
