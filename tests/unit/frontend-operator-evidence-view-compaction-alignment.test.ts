import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator focused evidence compacts lower sections by view and keeps a short summary sentence", () => {
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
    'id="operatorEvidenceDrawerSummary"',
    'class="operator-evidence-drawer-summary"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing evidence compaction token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorEvidenceDrawerSummary: document.getElementById("operatorEvidenceDrawerSummary")',
    "function clipOperatorEvidenceDrawerSentence(value, maxLength = 88) {",
    "function buildOperatorEvidenceDrawerSummary(viewId, details = {}) {",
    "const hintSentence = clipOperatorEvidenceDrawerSentence(details.hint);",
    "const leadValueSentence = clipOperatorEvidenceDrawerSentence(leadFact?.value);",
    "const compactViewActionLimit = 2;",
    'const isCompactEvidenceView = !!activeView && isOperatorEvidenceDrawerCompactView(activeView.id);',
    "el.operatorEvidenceDrawerLane.hidden = isCompactEvidenceView;",
    "showLabel: false",
    "showTimeline: false",
    "showCheckpoints: false",
    "showProvenance: true",
    "showMeta: false",
    "showOrigins: false",
    'factsMode: "compact"',
    'el.operatorEvidenceDrawer.dataset.evidenceFacts = activeView?.factsMode ?? "default";',
    "el.operatorEvidenceDrawerPanelLabel.hidden = activeView?.showLabel === false;",
    "panelHead.hidden = activeView?.showLabel === false && activeView?.showMeta === false;",
    "el.operatorEvidenceDrawerPanelMeta.hidden = activeView?.showMeta === false;",
    "el.operatorEvidenceDrawerOrigins.hidden = activeView?.showOrigins === false;",
    "function buildOperatorEvidenceDrawerWorkspaceSummary(activeView, model) {",
    "buildOperatorEvidenceDrawerWorkspaceSummary(activeView, model)",
    "timelineShell.hidden = activeView?.showTimeline === false;",
    "checkpointsShell.hidden = activeView?.showCheckpoints === false;",
    "provenanceShell.hidden = activeView?.showProvenance === false;",
    "parts = [hintSentence || leadValueSentence || leadSnippet];",
    "clipOperatorEvidenceDrawerSentence(details.primaryActionMeta)",
    "Review in ${details.savedViewLabel} posture",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing evidence compaction token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-evidence-drawer-summary {",
    ".panel-operator-console .operator-evidence-drawer-panel-meta {",
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-summary,',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-facts="compact"] .operator-evidence-drawer-fact,',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-hint,',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-fact:nth-child(n + 3),',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-provenance-label,',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing evidence compaction token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("one concise view summary sentence"),
    "README missing evidence summary sentence note",
  );
  assert.ok(
    readmeSource.includes("route / verify lockup"),
    "README missing route/verify lockup note",
  );
  assert.ok(
    readmeSource.includes("prunes duplicated lower sections in `Recovery` / `Audit`"),
    "README missing evidence section pruning note",
  );
  assert.ok(
    readmeSource.includes("only `Trace` keeps the mini-log layer visible by default"),
    "README missing trace-only mini-log note",
  );
  assert.ok(
    readmeSource.includes("cap themselves at two CTA buttons"),
    "README missing compact evidence CTA cap note",
  );
  assert.ok(
    readmeSource.includes("long lane path visible only in `Trace`"),
    "README missing trace-only long lane path note",
  );
  assert.ok(
    readmeSource.includes("hide the header hint"),
    "README missing desktop compact hint-hiding note",
  );
  assert.ok(
    readmeSource.includes("keep only two visible evidence facts"),
    "README missing desktop compact fact-limit note",
  );
  assert.ok(
    operatorGuideSource.includes("one concise view summary sentence"),
    "operator guide missing evidence summary sentence note",
  );
  assert.ok(
    operatorGuideSource.includes("route / verify lockup"),
    "operator guide missing route/verify lockup note",
  );
  assert.ok(
    operatorGuideSource.includes("prunes duplicated lower sections in `Recovery` / `Audit`"),
    "operator guide missing evidence section pruning note",
  );
  assert.ok(
    operatorGuideSource.includes("only `Trace` keeps the mini-log layer visible by default"),
    "operator guide missing trace-only mini-log note",
  );
  assert.ok(
    operatorGuideSource.includes("cap themselves at two CTA buttons"),
    "operator guide missing compact evidence CTA cap note",
  );
  assert.ok(
    operatorGuideSource.includes("long lane path visible only in `Trace`"),
    "operator guide missing trace-only long lane path note",
  );
  assert.ok(
    operatorGuideSource.includes("hide the header hint"),
    "operator guide missing desktop compact hint-hiding note",
  );
  assert.ok(
    operatorGuideSource.includes("keep only two visible evidence facts"),
    "operator guide missing desktop compact fact-limit note",
  );
});
