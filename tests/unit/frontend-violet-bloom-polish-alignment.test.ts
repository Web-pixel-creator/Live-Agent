import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend applies violet-bloom polish for spacing, dropdown checks, and warn-button contrast", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredTokens = [
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
    "grid-template-columns: repeat(4, minmax(0, 1fr));",
    ".kpi-panel > .grid-3 {",
    "grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));",
  ];

  for (const token of requiredTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing violet-bloom polish token: ${token}`);
  }
});
