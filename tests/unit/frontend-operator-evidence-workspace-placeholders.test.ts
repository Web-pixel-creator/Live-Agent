import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence swaps generic dormant placeholders for workspace-specific packets", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function getOperatorEvidenceDrawerWorkspaceConfig(model) {",
    "function shouldUseOperatorEvidenceDrawerWorkspacePlaceholder(model) {",
    "function normalizeOperatorEvidenceDrawerHydrateMeta(meta) {",
    "function buildOperatorEvidenceDrawerWorkspacePlaceholderFacts(activeView, model) {",
    "config.drawerDormantFacts",
    "function buildOperatorEvidenceDrawerWorkspacePlaceholderOrigins(activeView, model) {",
    "function buildOperatorEvidenceDrawerWorkspacePlaceholderTimeline(activeView, model) {",
    "function buildOperatorEvidenceDrawerWorkspacePlaceholderCheckpoints(activeView, model) {",
    "function buildOperatorEvidenceDrawerWorkspacePlaceholderProvenance(activeView, model) {",
    "const useWorkspacePlaceholderEvidence = shouldUseOperatorEvidenceDrawerWorkspacePlaceholder(model);",
    "buildOperatorEvidenceDrawerWorkspacePlaceholderFacts(activeView, model)",
    "buildOperatorEvidenceDrawerWorkspacePlaceholderOrigins(activeView, model)",
    "buildOperatorEvidenceDrawerWorkspacePlaceholderTimeline(activeView, model)",
    "buildOperatorEvidenceDrawerWorkspacePlaceholderCheckpoints(activeView, model)",
    "buildOperatorEvidenceDrawerWorkspacePlaceholderProvenance(activeView, model)",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-placeholder token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("swaps in workspace-specific dormant packets inside `Focused Evidence`"),
    "README should document workspace-specific focused evidence dormant packets",
  );
  assert.ok(
    operatorGuideSource.includes("swaps in workspace-specific dormant packets inside `Focused Evidence`"),
    "operator guide should document workspace-specific focused evidence dormant packets",
  );
});
