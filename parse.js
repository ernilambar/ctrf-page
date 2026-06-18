#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputPath = process.argv[2];
const authorArg = process.argv[3];

if (!inputPath) {
  console.error('Usage: node parse.js <path-to-ctrf.json> [author]');
  process.exit(1);
}

const resolvedInput = path.resolve(inputPath);

if (!fs.existsSync(resolvedInput)) {
  console.error(`File not found: ${resolvedInput}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
const tests = data.results?.tests || data.tests || [data];
const scanArtifact = data.results?.extra?.scanArtifact || {};
const target = data.results?.extra?.target || {};
const reportId = data.reportId || '';
const scanId = scanArtifact.scanId || '';
const pluginSlug = target.id || scanArtifact.pluginSlug || '';
const pluginVersion = target.version || scanArtifact.pluginVersion || '';
const scanTimestamp = scanArtifact.scanTimestamp || '';
const author = authorArg || scanArtifact.author || data.author || 'unknown';

const fmtReviewIdDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mon = months[d.getUTCMonth()];
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}${mon}${yy}`;
};

const reviewIdParts = [
  author,
  pluginSlug || 'unknown',
  fmtReviewIdDate(scanTimestamp) || 'unknown',
  pluginVersion || 'unknown',
];
const reviewId = `S ${reviewIdParts.join('/')}`;

const esc = (t) => t ? String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

// Help Scout strips whitespace between block tags and resets many styles.
// Inline styles + no newlines between block tags = reliable spacing.
// <br /> tags are unreliable in Help Scout — wrap each line in its own <p> instead.
const P = 'style="margin:0 0 14px 0;line-height:1.55;"';
const HR = '<hr style="border:0;border-top:1px solid #dcdcde;margin:20px 0;" />';
// Empty paragraph used as a vertical spacer between sections — Help Scout keeps
// it because of the &nbsp; content (it would otherwise collapse an empty <p>).
const SPACER = `<p ${P}>&nbsp;</p>`;

// Turn a multi-line string into a sequence of <p> blocks (Help Scout-safe).
// Empty lines are skipped because Help Scout would collapse them anyway.
const fmtParas = (t) => {
  if (!t) return '';
  return String(t)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p ${P}>${esc(line)}</p>`)
    .join('');
};

// Render a labelled section as: <p><strong>Label</strong></p><p>line1</p><p>line2</p>
const section = (label, value, fallback) => {
  const content = value || fallback || '';
  return `<p ${P}><strong>${label}</strong></p>${fmtParas(content)}`;
};

const fmtScanDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
};

const pluginLabel = [pluginSlug, pluginVersion].filter(Boolean).join(' ');

const intro =
  `<p ${P}>Hello,</p>` +
  `<p ${P}>This is an <strong>automated security review</strong> of your latest plugin submission. This review is informational only and is <strong>not</strong> used to approve or reject your plugin — a Plugin Review Team member will perform the actual review separately.</p>` +
  `<p ${P}>Our automated security scan identified issues in the updated files that we want to bring to your attention. The items listed below may represent serious security vulnerabilities that could expose your users to potential attacks, data exposure, or unauthorized access, and we strongly recommend resolving them prior to publication in the WordPress Plugin Directory.</p>` +
  `<p ${P}>Please review each issue carefully and address them in your next submission.</p>` +
  `<p ${P}><strong>Please do not reply to this email.</strong> This message is sent automatically and replies are not monitored. If you need to discuss the review, wait for the human reviewer's follow-up or contact the Plugin Review Team through the usual channels.</p>` +
  HR;

const metaParts = [];
if (scanTimestamp) metaParts.push(`Scan date: ${esc(fmtScanDate(scanTimestamp))}`);
if (pluginLabel) metaParts.push(`Plugin: ${esc(pluginLabel)}`);
if (reportId) metaParts.push(`Report ID: ${esc(reportId)}`);
if (scanId) metaParts.push(`Scan ID: ${esc(scanId)}`);

const findingsWord = tests.length === 1 ? 'finding' : 'findings';
const closing = tests.length === 1
  ? 'this finding'
  : `${tests.length === 2 ? 'both' : 'all'} ${findingsWord}`;
const META = 'style="margin:0 0 6px 0;font-size:11px;color:#a7aaad;line-height:1.5;"';
const footer =
  HR +
  `<p ${P}>Please address ${closing} in your next submission. Remember that this is an automated message — do not reply to this email.</p>` +
  `<p ${P}>Thank you,</p>` +
  `<p ${P}>The WordPress Plugin Review Team (automated notification)</p>` +
  HR +
  `<p ${META}>${metaParts.join(' | ')}</p>` +
  `<p ${META}>Review ID: ${esc(reviewId)}</p>`;

let body = intro;

const H3 = 'style="margin:18px 0 10px 0;font-size:18px;line-height:1.3;"';
const PRE = 'style="background:#1d2327;color:#a7aaad;padding:14px 16px;border-radius:4px;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin:0 0 14px 0;"';

tests.forEach((test) => {
  const extra = test.extra || {};
  const audit = extra.audit || {};
  const risk = extra.risk || {};

  const heading = esc(
    (test.name || '')
      .replace(/^[\w-]+(?:\.[\w-]+)*\.(?=[\w-]+ at )/, '')
      .replace(/^([\w-]+)( at .+)?$/, (_, slug, loc) =>
        slug.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + (loc || '')
      )
  );

  body +=
    `<h3 ${H3}>## ${heading}</h3>` +
    `<p ${P}><strong>Severity:</strong> ${esc(risk.severity || extra.severity || 'High')} (Score: ${risk.score || 'N/A'})</p>` +
    SPACER +
    section('Summary', test.message, 'No summary provided.') +
    SPACER +
    section('Context / Rationale', audit.reason, 'No specific rationale provided.') +
    SPACER +
    (extra.codeSnippet
      ? `<p ${P}><strong>Vulnerable Code</strong></p><pre ${PRE}><code>${esc(extra.codeSnippet)}</code></pre>` + SPACER
      : '') +
    section('Explanation', extra.explanation, 'No deep analytical breakdown available.') +
    SPACER +
    section('Suggested Fix &amp; Remediation', audit.proposed_fix || extra.investigation?.fixProposal?.properRemediation, 'No automated remediation fix defined.') +
    HR;
});

// Drop the trailing separator before the footer adds its own.
body = body.replace(new RegExp(HR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '');
body += footer;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CTRF Report</title>
</head>
<body>
${body}
</body>
</html>`;

const outputPath = resolvedInput.replace(/\.json$/i, '.html');
fs.writeFileSync(outputPath, html);
console.log(`Report written to: ${outputPath}`);

const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
try { execSync(`${open} "${outputPath}"`); } catch { /* ignore */ }
