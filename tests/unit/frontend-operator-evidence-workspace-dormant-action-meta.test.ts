import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence uses workspace-specific dormant action meta copy", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'meta: "Run one approval-sensitive path first.",',
    'meta: "Review queue pressure, approvals, and startup gates.",',
    'meta: "Refresh trace anchors and runtime posture.",',
    'meta: "Inspect workflow, guardrails, and recovery paths.",',
    'meta: "Refresh governance proof and audit posture.",',
    'meta: "Review governance, cost, and export evidence.",',
    "function createOperatorEvidenceDrawerActionNode(config, options = {}) {",
    'wrapper.className = "operator-evidence-drawer-action-stack";',
    'metaNode.className = "operator-evidence-drawer-action-meta";',
    "const button = createOperatorEvidenceDrawerActionNode(actionConfig, {",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-action-meta token: ${token}`);
  }

  for (const token of [
    ".panel-operator-console .operator-evidence-drawer-action-stack {",
    ".panel-operator-console .operator-evidence-drawer-action-meta {",
    '.panel-operator-console .operator-evidence-drawer[data-evidence-action-density="compact"] .operator-evidence-drawer-action-meta {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing workspace dormant-action-meta token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant `Focused Evidence` CTAs now also carry workspace-specific secondary meta"),
    "README should document workspace-specific dormant action meta copy",
  );
  assert.ok(
    operatorGuideSource.includes("dormant `Focused Evidence` CTAs now also carry workspace-specific secondary meta"),
    "operator guide should document workspace-specific dormant action meta copy",
  );
});
