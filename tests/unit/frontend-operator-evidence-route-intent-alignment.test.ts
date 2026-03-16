import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator focused evidence keeps workflow-intent aware route copy near provenance and checkpoints", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "const OPERATOR_EVIDENCE_ROUTE_INTENTS = Object.freeze({",
    "const OPERATOR_EVIDENCE_ROUTE_GROUP_INTENTS = Object.freeze({",
    "const OPERATOR_EVIDENCE_ROUTE_VIEW_INTENTS = Object.freeze({",
    "function resolveOperatorEvidenceDrawerRouteIntent(details = {}) {",
    'operatorHealthStatus: { latest: "Bridge recovery", trace: "Bridge trace", recovery: "Negotiation restart", audit: "Incident review" },',
    'operatorWorkflowRuntimeStatus: { latest: "Workflow override", trace: "Workflow trace", recovery: "Runtime override", audit: "Runtime review" },',
    'operatorDeviceNodesStatus: { latest: "Node health", trace: "Heartbeat trace", recovery: "Device resync", audit: "Device review" },',
    'label: "Route"',
    'return intentLabel ? `${baseLabel} / ${intentLabel}` : baseLabel;',
    'lane: `${groupKicker} / ${groupTitle} / ${cardTitle}`',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing workflow-intent route token: ${token}`);
  }

  assert.ok(
    stylesSource.includes("overflow-wrap: anywhere;"),
    "frontend styles missing provenance route wrapping guard",
  );
  assert.ok(
    readmeSource.includes("workflow-intent aware"),
    "README missing workflow-intent route note",
  );
  assert.ok(
    operatorGuideSource.includes("workflow-intent aware"),
    "operator guide missing workflow-intent route note",
  );
});
