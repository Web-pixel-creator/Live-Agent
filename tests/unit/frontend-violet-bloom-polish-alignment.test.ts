import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend applies violet-bloom polish for spacing, dropdown checks, warn-button contrast, and mobile readability", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredTokens = [
    "--status-neutral-fg: color-mix(in oklch, var(--foreground) 84%, var(--muted-foreground));",
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
    "display: flex;",
    "flex-wrap: wrap;",
    ".meta-row-status > div {",
    "display: inline-flex;",
    "align-items: center;",
    "border-radius: 999px;",
    "radial-gradient(180px 70px at 0% -40%, color-mix(in oklch, var(--primary) 9%, transparent), transparent 72%)",
    ".meta-row-status .status-item-wide {",
    "flex: 1 1 290px;",
    ".meta-row-status > div > span:not(.status-pill) {",
    "background: transparent;",
    "font-size: 0.83rem;",
    "@media (max-width: 980px) {",
    ".live-negotiator-main {",
    "gap: 18px;",
    ".meta-row-status-live {",
    "padding: 10px;",
    "gap: 10px;",
    ".kpi-panel > .grid-3 {",
    "grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));",
    ".kpi-label {",
    "color: color-mix(in oklch, var(--foreground) 86%, var(--muted-foreground));",
    ".kpi-status-note {",
    "color: color-mix(in oklch, var(--foreground) 84%, var(--muted-foreground));",
  ];

  for (const token of requiredTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing violet-bloom polish token: ${token}`);
  }
});
