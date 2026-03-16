import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes a compact lane focus rail for collapsed groups", () => {
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
    'id="operatorLaneFocusRail"',
    'class="operator-lane-focus-rail is-hidden"',
    'id="operatorLaneFocusRailHint"',
    'id="operatorLaneFocusRailList"',
    "Lane focus rail",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing lane focus rail token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorFocusedGroupKey: \"\",",
    "operatorLaneFocusRail: document.getElementById(\"operatorLaneFocusRail\")",
    "operatorLaneFocusRailHint: document.getElementById(\"operatorLaneFocusRailHint\")",
    "operatorLaneFocusRailList: document.getElementById(\"operatorLaneFocusRailList\")",
    "function resolveOperatorGroupFocusStatusId(group) {",
    "function renderOperatorLaneFocusRail() {",
    "function focusOperatorGroup(groupKey, options = {}) {",
    "const shouldUseInlineMode = collapsedGroups.length === 1;",
    "el.operatorLaneFocusRail.classList.toggle(\"is-inline\", shouldShow && shouldUseInlineMode);",
    "state.operatorFocusedGroupKey = normalizedKey;",
    "button.setAttribute(\"data-operator-group-focus\", key);",
    "button.addEventListener(\"click\", () => {",
    "focusOperatorGroup(key);",
    "renderOperatorLaneFocusRail();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing lane focus rail token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console > .operator-lane-focus-rail {",
    ".panel-operator-console .operator-lane-focus-rail {",
    "  .panel-operator-console .operator-lane-focus-rail-head {\n    display: none;",
    ".panel-operator-console .operator-lane-focus-rail.is-inline {",
    ".panel-operator-console .operator-lane-focus-rail-list,\n  .panel-operator-console .operator-lane-focus-rail.is-inline .operator-lane-focus-rail-list {",
    ".panel-operator-console .operator-lane-focus-rail-list {",
    ".panel-operator-console .operator-lane-focus-chip {",
    ".panel-operator-console .operator-lane-focus-rail.is-inline .operator-lane-focus-chip,",
    ".panel-operator-console .operator-lane-focus-chip-title {",
    ".panel-operator-console .operator-health-group-focus-flash {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing lane focus rail token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compact `Lane focus rail`"),
    "README missing lane focus rail note",
  );
  assert.ok(
    operatorGuideSource.includes("compact `Lane focus rail`"),
    "operator guide missing lane focus rail note",
  );
  assert.ok(
    readmeSource.includes("quieter inline mode"),
    "README missing inline lane focus mode note",
  );
  assert.ok(
    operatorGuideSource.includes("quieter inline mode"),
    "operator guide missing inline lane focus mode note",
  );
  assert.ok(
    readmeSource.includes("chip-only reopen row"),
    "README missing chip-only lane focus rail note",
  );
  assert.ok(
    operatorGuideSource.includes("chip-only reopen row"),
    "operator guide missing chip-only lane focus rail note",
  );
});
