import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps desktop support rails as quieter utility toggles", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'class="operator-support-summary-head"',
    'class="operator-support-summary-pill operator-support-summary-pill-idle"',
    'class="operator-support-summary-pill operator-support-summary-pill-hot"',
    "Idle lanes",
    "Hot lane",
    "Reseed lanes.",
    "Jump to evidence.",
    "Drills, overrides, browser jobs, bootstrap, replay.",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing desktop support-rail token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-support-summary-head {",
    ".operator-support-summary-pill {",
    ".operator-support-summary-pill-idle {",
    ".operator-support-summary-pill-hot {",
    "@media (min-width: 921px) {",
    ".panel-operator-console .operator-quick-start:not([open]),",
    ".panel-operator-console .operator-lane-playbook:not([open]),",
    ".panel-operator-console .operator-control-surfaces:not([open]),",
    ".panel-operator-console .operator-control-surfaces-body > .operator-support-panel:not([open]) {",
    ".panel-operator-console .operator-quick-start:not([open]) > summary .operator-support-summary-hint,",
    ".panel-operator-console .operator-lane-playbook:not([open]) > summary .operator-support-summary-hint,",
    ".panel-operator-console .operator-control-surfaces:not([open]) > summary .operator-support-summary-hint,",
    "display: none;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing desktop support-rail token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("quieter utility toggles with small purpose pills"),
    "README missing desktop support-rail compaction note",
  );
  assert.ok(
    readmeSource.includes("lower support rails now retreat further into near single-line toggles"),
    "README missing desktop support-rail single-line-toggle note",
  );
  assert.ok(
    operatorGuideSource.includes("quieter utility toggles with small purpose pills"),
    "operator guide missing desktop support-rail compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("lower support rails now retreat further into near single-line toggles"),
    "operator guide missing desktop support-rail single-line-toggle note",
  );
});
