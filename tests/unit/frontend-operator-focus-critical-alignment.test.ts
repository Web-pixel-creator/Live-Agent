import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console supports focus-critical mode with mirrored signal strip", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredHtmlTokens = [
    'id="operatorFocusCriticalBtn"',
    'class="operator-signal-strip"',
    'id="operatorSignalBridge"',
    'id="operatorSignalQueue"',
    'id="operatorSignalApprovals"',
    'id="operatorSignalStartup"',
    'id="operatorSignalUiExecutor"',
    'id="operatorSignalDeviceNodes"',
    'data-operator-critical',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-focus token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorFocusCriticalOnly: false",
    "operatorFocusCriticalBtn: document.getElementById(\"operatorFocusCriticalBtn\")",
    "const OPERATOR_SIGNAL_STATUS_MIRROR_IDS = {",
    "function syncOperatorSignalFromStatus(node)",
    "function isOperatorCriticalCard(card)",
    "function setOperatorFocusCriticalMode(enabled)",
    "if (state.operatorFocusCriticalOnly === true && !isOperatorCriticalCard(card)) {",
    "card.classList.toggle(\"operator-health-card-hidden\", true);",
    "card.classList.toggle(\"operator-health-card-hidden\", shouldHide);",
    "el.operatorFocusCriticalBtn.addEventListener(\"click\", () => {",
    "setOperatorFocusCriticalMode(!state.operatorFocusCriticalOnly);",
    "setOperatorFocusCriticalMode(requestedMode === \"demo\");",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-focus token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-signal-strip {",
    ".operator-signal-card {",
    ".button-muted.is-active {",
    ".operator-health-card[data-operator-critical] {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-focus token: ${token}`);
  }
});
