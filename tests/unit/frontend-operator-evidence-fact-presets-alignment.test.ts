import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator focused evidence keeps lane-specific fact presets for latest and trace views", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "const OPERATOR_EVIDENCE_FACT_PRESETS = Object.freeze({",
    'operatorApprovalsStatus: {',
    'latest: [/\\bpending\\b/i, /\\bsla watch\\/breach\\b/i, /\\blatest\\b/i],',
    'trace: [/\\bfrom tasks\\b/i, /\\bsla watch\\/breach\\b/i, /\\blatest\\b/i],',
    'operatorWorkflowRuntimeStatus: {',
    'latest: [/\\bsource\\b/i, /\\bassistive\\b/i, /\\boverride\\b/i],',
    'trace: [/\\bsource\\b/i, /\\boverride\\b/i, /\\bfingerprint\\b/i],',
    "function resolveOperatorEvidenceDrawerFactPresetPatterns(statusId, viewId) {",
    "function buildOperatorEvidenceDrawerPresetFacts(details, viewId, fallbackEntries = []) {",
    "function buildOperatorEvidenceDrawerLatestFacts(details) {",
    'label: "Next", value: details.primaryActionLabel || "Open lane"',
    'label: "Route", value: details.primaryActionLabel || details.traceLane || "Open lane"',
    'facts: buildOperatorEvidenceDrawerLatestFacts({',
    'fallbackFacts: facts,',
    'facts: buildOperatorEvidenceDrawerTraceFacts({',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing fact preset token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("reorders `Latest` and `Trace` facts by lane"),
    "README missing lane-specific fact preset note",
  );
  assert.ok(
    operatorGuideSource.includes("reorders `Latest` and `Trace` facts by lane"),
    "operator guide missing lane-specific fact preset note",
  );
});
