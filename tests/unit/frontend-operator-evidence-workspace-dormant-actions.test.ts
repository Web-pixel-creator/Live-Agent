import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence swaps generic dormant actions for workspace-specific CTAs", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function buildOperatorEvidenceDrawerWorkspacePlaceholderActions(activeView, model) {",
    'label: `Seed ${label}`,',
    'actionId: "open_workflow_control",',
    'label: `Open ${label}`,',
    'actionId: "saved_view_approvals",',
    'label: `Hydrate ${label}`,',
    'actionId: "saved_view_runtime",',
    'actionId: "saved_view_audit",',
    "const actions = useWorkspacePlaceholderEvidence",
    "buildOperatorEvidenceDrawerWorkspacePlaceholderActions(activeView, model)",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-action token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("swaps in workspace-specific dormant CTAs inside `Focused Evidence`"),
    "README should document workspace-specific dormant evidence CTAs",
  );
  assert.ok(
    operatorGuideSource.includes("swaps in workspace-specific dormant CTAs inside `Focused Evidence`"),
    "operator guide should document workspace-specific dormant evidence CTAs",
  );
});
