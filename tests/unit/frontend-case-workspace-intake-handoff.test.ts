import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("idle guided flow hands off to the main start-case action instead of launching intake directly", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'proxyTargetId = ""',
    'proxyTargetId: "runVisaDemoBtn"',
    '"Use Start case below"',
    'el.caseWorkspaceFlowActionBtn.dataset.dashboardProxyTarget = flowState.proxyTargetId;',
    'delete el.caseWorkspaceFlowActionBtn.dataset.dashboardProxyTarget;',
    'const proxyTargetId = button.dataset.dashboardProxyTarget;',
    'proxyTarget.focus();',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing idle guided handoff token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Guided flow now hands off to the main Start case action on the empty intake state"),
    "README should describe the idle guided-flow handoff to Start case",
  );
  assert.ok(
    operatorGuideSource.includes("Guided flow now hands off to the main Start case action on the empty intake state"),
    "operator guide should describe the idle guided-flow handoff to Start case",
  );
});
