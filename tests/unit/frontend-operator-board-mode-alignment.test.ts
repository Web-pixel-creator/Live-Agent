import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes demo/full board mode toggles with runtime presets", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'id="operatorDemoViewBtn"',
    'id="operatorFullOpsViewBtn"',
    "Demo View",
    "Full Ops View",
    'class="action-group operator-view-mode-actions"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-board-mode token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorBoardMode: "demo"',
    'operatorDemoViewBtn: document.getElementById("operatorDemoViewBtn")',
    'operatorFullOpsViewBtn: document.getElementById("operatorFullOpsViewBtn")',
    "function normalizeOperatorBoardMode(value)",
    "function syncOperatorBoardModeButtons()",
    "function setOperatorBoardMode(mode, options = {})",
    'setOperatorBoardMode("demo", { syncPresets: false });',
    "el.operatorDemoViewBtn.addEventListener(\"click\", () => {",
    "setOperatorBoardMode(\"demo\");",
    "el.operatorFullOpsViewBtn.addEventListener(\"click\", () => {",
    "setOperatorBoardMode(\"full\");",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-board-mode token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-view-mode-actions {",
    ".operator-view-mode-actions .button-muted {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-board-mode token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Demo View` (default, critical-first) and `Full Ops View`"),
    "README missing operator board-mode note",
  );
  assert.ok(
    operatorGuideSource.includes("`Demo View` (default) keeps Operator Console in critical-first mode"),
    "operator guide missing operator board-mode note",
  );
});
