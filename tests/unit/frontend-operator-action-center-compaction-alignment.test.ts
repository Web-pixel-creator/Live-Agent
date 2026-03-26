import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console compacts the action center into a single recovery rail below focused evidence", () => {
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
    'id="operatorActionCenterSupportHead"',
    "Recovery Rail",
    "Next actions and Focused Evidence stay here. The Recovery Rail stays quieter below.",
    "Keep one fallback path here. Deeper drills stay below.",
    "Run one controlled scenario, then refresh summary.",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing compact action-center token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorActionCenterSupportHead: document.getElementById("operatorActionCenterSupportHead")',
    "cards.length >= 1",
    "const finalizeActions = (actions) => Array.isArray(actions) ? actions.filter(Boolean).slice(0, 2) : [];",
    "const compactRailOnly =",
    "el.operatorActionCenterSupportHead.hidden = compactRailOnly;",
    'el.operatorTriageSummary.dataset.supportHead = compactRailOnly ? "hidden" : "visible";',
    "entry.secondary ?? refreshAction",
    "compact: true",
    'article.classList.add("is-compact");',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing compact action-center token: ${token}`);
  }

  const triageStart = stylesSource.indexOf(".panel-operator-console .operator-triage-summary {");
  const queueIndex = stylesSource.indexOf('"queue"', triageStart);
  const evidenceIndex = stylesSource.indexOf('"evidence"', triageStart);
  const supportHeadIndex = stylesSource.indexOf('"supporthead"', triageStart);
  const supportIndex = stylesSource.indexOf('"support"', triageStart);
  assert.ok(
    triageStart >= 0 && queueIndex > triageStart && evidenceIndex > queueIndex && supportHeadIndex > evidenceIndex && supportIndex > supportHeadIndex,
    "triage summary should surface evidence before the recovery rail",
  );

  const requiredStyleTokens = [
    '.panel-operator-console .operator-triage-summary[data-support-head="hidden"] {',
    ".panel-operator-console .operator-action-center-card.is-compact {",
    ".panel-operator-console .operator-action-center-card.is-compact .operator-action-center-actions {",
    ".panel-operator-console .operator-action-center-card.is-compact .operator-action-center-action {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing compact action-center token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("single compact `Recovery Rail`"),
    "README missing recovery-rail compaction note",
  );
  assert.ok(
    readmeSource.includes("triage-shell helper now names `Focused Evidence` and `Recovery Rail` directly"),
    "README missing explicit triage helper naming note",
  );
  assert.ok(
    readmeSource.includes("queue -> evidence -> recovery"),
    "README missing triage shell ordering note",
  );
  assert.ok(
    readmeSource.includes("extra `Recovery Rail` heading collapses"),
    "README missing quiet recovery-rail header note",
  );
  assert.ok(
    operatorGuideSource.includes("single compact `Recovery Rail`"),
    "operator guide missing recovery-rail compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("triage-shell helper now names `Focused Evidence` and `Recovery Rail` directly"),
    "operator guide missing explicit triage helper naming note",
  );
  assert.ok(
    operatorGuideSource.includes("queue -> evidence -> recovery"),
    "operator guide missing triage shell ordering note",
  );
  assert.ok(
    operatorGuideSource.includes("extra `Recovery Rail` heading collapses"),
    "operator guide missing quiet recovery-rail header note",
  );
});
