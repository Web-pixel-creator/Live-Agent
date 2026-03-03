import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend applies violet-bloom polish for spacing, dropdown checks, and warn-button contrast", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredTokens = [
    "--status-neutral-fg: color-mix(in oklch, var(--foreground) 76%, var(--muted-foreground));",
    ".media-upload-row {",
    "grid-template-columns: minmax(0, 1fr) minmax(196px, auto);",
    ".media-upload-actions {",
    "align-self: stretch;",
    "display: flex;",
    ".media-upload-actions button {",
    "width: 100%;",
    ".select-option::after {",
    "border-left: 2px solid",
    ".select-option.is-selected::after {",
    ".button-warn {",
    "border-color: color-mix(in oklch, var(--destructive) 74%, var(--border));",
    ".button-warn:hover {",
    ".meta-row-status {",
    "display: grid;",
    "grid-template-columns: repeat(4, minmax(0, 1fr));",
    ".meta-row-status > div {",
    "align-items: center;",
    "radial-gradient(220px 90px at 0% -20%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 74%)",
    ".meta-row-status > div > span:not(.status-pill) {",
    "justify-content: flex-end;",
    "margin-left: auto;",
    "border-radius: 999px;",
    "font-size: 0.86rem;",
    ".kpi-panel > .grid-3 {",
    "grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));",
  ];

  for (const token of requiredTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing violet-bloom polish token: ${token}`);
  }
});
