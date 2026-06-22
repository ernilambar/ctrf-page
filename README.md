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
