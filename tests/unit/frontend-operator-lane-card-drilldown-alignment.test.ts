import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console supporting lane cards act as quiet focused-evidence selectors", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "operatorFocusedEvidencePinned: false,",
    "function getOperatorStatusIdFromCard(card) {",
    "function focusOperatorStatusCard(statusId, options = {}) {",
    "function ensureOperatorCardDrilldownNote(card) {",
    "function syncOperatorCardDrilldownState(card) {",
    "const currentPinned = state.operatorFocusedEvidencePinned === true;",
    "if (currentPinned && (!activeSavedView || currentGroupKey === (activeSavedView.groupKey ?? \"\"))) {",
    'card.classList.toggle("operator-health-card-selectable", shouldEnable);',
    'note.textContent = isActive ? "Focused" : "Inspect";',
    "state.operatorFocusedEvidencePinned = options.pin !== false;",
    'focusOperatorStatusCard(statusId, {',
    'scroll: false,',
    'focusCard: true,',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing lane drilldown token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-health-card.operator-health-card-selectable {",
    ".panel-operator-console .operator-health-card.operator-health-card-selectable:hover {",
    ".panel-operator-console .operator-health-card.is-evidence-active {",
    ".panel-operator-console .operator-health-card-drilldown-note {",
    ".panel-operator-console .operator-health-card.operator-health-card-supporting .operator-health-card-drilldown-note {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing lane drilldown token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("supporting summaries now also act as quiet drawer selectors"),
    "README missing supporting-card drilldown note",
  );
  assert.ok(
    operatorGuideSource.includes("supporting summaries now also act as quiet drawer selectors"),
    "operator guide missing supporting-card drilldown note",
  );
});
