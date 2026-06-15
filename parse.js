#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: node parse.js <path-to-ctrf.json>');
  process.exit(1);
}

const resolvedInput = path.resolve(inputPath);

if (!fs.existsSync(resolvedInput)) {
  console.error(`File not found: ${resolvedInput}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
const tests = data.results?.tests || data.tests || [data];

const esc = (t) => t ? String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
const fmt = (t) => esc(t).replace(/\n/g, '<br />');

let body = '<h2>Security Issues</h2>\n';

tests.forEach((test) => {
  const extra = test.extra || {};
  const audit = extra.audit || {};
  const risk = extra.risk || {};

  body += `
  <div>
    <h3>## ${esc((test.name || '').split(' at ')[0])}</h3>
    <p><strong>File:</strong> <code>${esc(test.filePath || 'Unknown')}</code> (Line ${extra.line || 'N/A'}) &mdash; <strong>Severity:</strong> ${esc(risk.severity || extra.severity || 'High')} (Score: ${risk.score || 'N/A'})</p>

    <p><strong>Summary</strong><br />${fmt(test.message)}</p>

    <p><strong>Context / Rationale</strong><br />${fmt(audit.reason || 'No specific rationale provided.')}</p>

    ${extra.codeSnippet ? `<p><strong>Vulnerable Code</strong></p>\n    <pre><code>${esc(extra.codeSnippet)}</code></pre>` : ''}

    <p><strong>Explanation</strong><br />${fmt(extra.explanation || 'No deep analytical breakdown available.')}</p>

    <p><strong>Suggested Fix &amp; Remediation</strong><br />${fmt(audit.proposed_fix || extra.investigation?.fixProposal?.properRemediation || 'No automated remediation fix defined.')}</p>
  </div>
  <hr />
`;
});

body = body.replace(/<hr \/>[\s]*$/, '');

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
