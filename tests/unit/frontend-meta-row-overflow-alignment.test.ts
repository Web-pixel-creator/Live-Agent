import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("frontend keeps long meta/status values wrapped without horizontal layout stretch", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredHtmlTokens = ['class="layout"', 'class="meta-row"', 'class="meta-row meta-row-status meta-row-status-live"'];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing overflow-guard token: ${token}`);
  }

  const requiredStyleTokens = [
    ".layout {",
    "overflow-x: hidden;",
    ".meta-row {",
    ".meta-row-status {",
    "display: flex;",
    "flex-wrap: wrap;",
    ".meta-row-status > div {",
    "display: inline-flex;",
    "border-radius: 999px;",
    "min-width: 0;",
    ".meta-row-status .status-item-wide {",
    "min-width: 0;",
    ".meta-row-status > div > span:not(.status-pill) {",
    "overflow-wrap: anywhere;",
    ".meta-row-status-live {",
    "display: grid;",
    "grid-template-columns: repeat(4, minmax(0, 1fr));",
    ".meta-row-status-live .status-item-wide > span:not(.status-pill) {",
    "text-overflow: ellipsis;",
    ".meta-row > div,",
    "max-width: 100%;",
    "min-width: 0;",
    "word-break: break-word;",
    "@media (max-width: 980px)",
    "grid-template-columns: repeat(2, minmax(0, 1fr));",
    "grid-column: span 2;",
    "@media (max-width: 1120px) and (min-width: 981px)",
    "@media (max-width: 480px)",
    "flex-direction: column;",
    "@media (max-width: 720px)",
    "justify-content: center;",
    ".operator-health-row span {",
    "max-width: 60%;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing overflow-guard token: ${token}`);
  }
});
