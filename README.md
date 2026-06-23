# ctrf-page

Converts a CTRF JSON report into a human-readable HTML file and opens it in the browser.

## Usage

### Generate a single Help Scout email (HTML)

```bash
node parse.js <ctrf-file> [author]
```

- `<ctrf-file>` — file name with or without `.json` extension (e.g. `ctrf-51` or `ctrf-51.json`). Looks in `reports/` first, then falls back to the current directory.
- `[author]` — optional reviewer username (e.g. `dgamoni`). Defaults to the value in the JSON or `unknown`.

The HTML file is written next to the JSON file (inside `reports/`) and opened automatically in the browser.

**Example:**
```bash
node parse.js ctrf-78 dgamoni
```

---

### Generate a full summary report (terminal)

```bash
node report.js
```

Reads all `ctrf-*.json` files from `reports/`, prints a severity breakdown table and a detailed list of High/Critical findings.

---

### Generate a full summary report (PNG image)

```bash
node make-report-png.js
```

Reads all `ctrf-*.json` files from `reports/`, generates a styled dark-theme HTML page at `/tmp/gandalf-report.html`, and exports it as a full-page PNG to `reports/gandalf-report.png`.

Requires Google Chrome installed at `/Applications/Google Chrome.app`.

---

### Check Slack log for new Gandalf findings to review

```bash
node check-slack.js [path/to/logslack.log]
```

Parses a Slack log file (`logslack.log`) containing `Gandalf scan detected findings` entries and:

1. Ignores plugins with **< 100 active installs**.
2. De-duplicates by slug + version (keeps last occurrence).
3. Checks whether each slug already has a CTRF JSON in `reports/`.
4. Prints a summary: already reviewed ✓ vs pending ✗.
5. **Opens** the Details and Report URLs for all pending plugins in the browser.

**Default log path:** `reports/logslack.log` (or pass as argument).

**Example:**
```bash
node check-slack.js reports/logslack.log
# or pipe from clipboard:
pbpaste | node check-slack.js /dev/stdin
```
