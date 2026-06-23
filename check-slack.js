#!/usr/bin/env node
/**
 * check-slack.js
 * Parses logslack.log, extracts "Gandalf scan detected findings" entries,
 * filters out plugins with < 100 active installs, and checks whether each
 * slug already has a CTRF JSON in reports/. Opens Details & Report URLs for
 * those that have NOT been reviewed yet.
 *
 * Usage:
 *   node check-slack.js [logslack.log]
 */

'use strict';
const fs        = require('fs');
const path      = require('path');
const { execSync } = require('child_process');

// Look for the log in: CLI arg → reports/logslack.log → ./logslack.log
const candidates = [
  process.argv[2],
  path.join(__dirname, 'reports', 'logslack.log'),
  path.join(__dirname, 'logslack.log'),
].filter(Boolean);
const LOG_FILE = candidates.find(f => { try { return fs.statSync(f).size > 0; } catch { return false; } });
if (!LOG_FILE) {
  console.error('Error: logslack.log not found or empty. Pass it as an argument:\n  node check-slack.js /path/to/logslack.log');
  process.exit(1);
}
console.log(`Reading log: ${LOG_FILE}\n`);
const REPORTS_DIR = path.join(__dirname, 'reports');
const OPEN_CMD    = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';

// ---------------------------------------------------------------------------
// 1. Parse the log into Gandalf entries
// ---------------------------------------------------------------------------
const log = fs.readFileSync(LOG_FILE, 'utf8');

// Split on the start of each Gandalf block
const GANDALF_RE = /Gandalf scan detected findings in ([^\n]+)\n([\s\S]*?)(?=(?:web\d+\.ord\.wordpress\.org|Gandalf scan detected findings in|Enviar un mensaje|$))/g;

const entries = [];
let m;
while ((m = GANDALF_RE.exec(log)) !== null) {
  const block = m[0];

  // Active installs — look for "NNN+ active installs" or ":bangbang:...: NNN+ active installs"
  const installsMatch = block.match(/([\d,]+)\+\s*active installs/i);
  const installsRaw   = installsMatch ? installsMatch[1].replace(/,/g, '') : '0';
  const installs      = parseInt(installsRaw, 10);

  // Plugin slug from "Plugin: https://wordpress.org/plugins/<slug>/"
  const slugMatch = block.match(/Plugin:\s*https?:\/\/wordpress\.org\/plugins\/([^/\s]+)/i);
  const slug      = slugMatch ? slugMatch[1] : null;

  // Plugin version
  const versionMatch = block.match(/Version:\s*([\S]+)/);
  const version       = versionMatch ? versionMatch[1] : '?';

  // Severity summary
  const sevMatch = block.match(/Severity:\s*([^\n]+)/);
  const severity  = sevMatch ? sevMatch[1].trim() : '?';

  // Findings count
  const findingsMatch = block.match(/Findings:\s*(\d+)/);
  const findings       = findingsMatch ? parseInt(findingsMatch[1], 10) : 0;

  // Details URL
  const detailsMatch = block.match(/Details:\s*(https?:\/\/\S+)/);
  const detailsUrl    = detailsMatch ? detailsMatch[1] : null;

  // Report URL (Gandalf admin link)
  const reportMatch = block.match(/Report:\s*(https?:\/\/\S+)/);
  const reportUrl    = reportMatch ? reportMatch[1] : null;

  // Plugin title (first line)
  const title = m[1].trim();

  entries.push({ title, slug, version, installs, findings, severity, detailsUrl, reportUrl });
}

// ---------------------------------------------------------------------------
// 2. De-duplicate by slug+version (keep last occurrence)
// ---------------------------------------------------------------------------
const seen = new Map();
for (const e of entries) {
  if (!e.slug) continue;
  const key = `${e.slug}@${e.version}`;
  seen.set(key, e); // last one wins
}
const unique = [...seen.values()];

// ---------------------------------------------------------------------------
// 3. Filter: must have >= 100 active installs AND a slug
// ---------------------------------------------------------------------------
const eligible = unique.filter(e => e.slug && e.installs >= 100);

// ---------------------------------------------------------------------------
// 4. Build set of already-reviewed slugs from existing CTRF JSON files
// ---------------------------------------------------------------------------
const reviewedSlugs = new Set();
for (const f of fs.readdirSync(REPORTS_DIR).filter(f => /^ctrf-\d+\.json$/.test(f))) {
  try {
    const d  = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'));
    const sa = d.results?.extra?.scanArtifact || {};
    const tg = d.results?.extra?.target || {};
    const s  = tg.id || sa.pluginSlug;
    if (s) reviewedSlugs.add(s);
  } catch { /* skip corrupt files */ }
}

// ---------------------------------------------------------------------------
// 5. Split into reviewed vs pending
// ---------------------------------------------------------------------------
const pending  = eligible.filter(e => !reviewedSlugs.has(e.slug));
const reviewed = eligible.filter(e =>  reviewedSlugs.has(e.slug));

// ---------------------------------------------------------------------------
// 6. Print summary
// ---------------------------------------------------------------------------
const fmt = (n) => String(n).padStart(3);
console.log('=== Slack Gandalf Log — New Findings Report ===\n');
console.log(`  Total Gandalf entries found : ${entries.length}`);
console.log(`  After de-duplication        : ${unique.length}`);
console.log(`  With >= 100 active installs : ${eligible.length}`);
console.log(`  Already in reports/         : ${reviewed.length}`);
console.log(`  PENDING review              : ${pending.length}`);
console.log('');

if (reviewed.length) {
  console.log('--- Already reviewed (in reports/) ---');
  for (const e of reviewed) {
    console.log(`  ✓ ${e.slug} v${e.version}  [${e.installs}+ installs]  ${e.severity}`);
  }
  console.log('');
}

if (!pending.length) {
  console.log('✅  Nothing new to review!');
  process.exit(0);
}

console.log('--- PENDING — not yet in reports/ ---');
for (const e of pending) {
  const bang = e.installs >= 10000 ? ' ‼️' : e.installs >= 1000 ? ' ⚠️' : '';
  console.log(`  ✗ ${e.slug} v${e.version}  [${e.installs}+ installs]${bang}`);
  console.log(`      Findings: ${e.findings}  Severity: ${e.severity}`);
  if (e.detailsUrl) console.log(`      Details : ${e.detailsUrl}`);
  if (e.reportUrl)  console.log(`      Report  : ${e.reportUrl}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// 7. Open all pending URLs in browser
// ---------------------------------------------------------------------------
const urlsToOpen = [];
for (const e of pending) {
  if (e.detailsUrl) urlsToOpen.push(e.detailsUrl);
  if (e.reportUrl)  urlsToOpen.push(e.reportUrl);
}

if (urlsToOpen.length) {
  console.log(`Opening ${urlsToOpen.length} URLs in browser…`);
  for (const url of urlsToOpen) {
    try { execSync(`${OPEN_CMD} "${url}"`); } catch { /* ignore */ }
  }
}
