import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("active guided case flow hands off to the main current-step row instead of duplicating the launcher", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'const flowProxyTargetId = typeof flowState.proxyTargetId === "string" && flowState.proxyTargetId.length > 0',
    'primaryActionCopy.actionId === flowState.actionId',
    '? "runVisaDemoBtn"',
    '"Start another case below"',
    '"Open current step below"',
    '"Open current review below"',
    'el.caseWorkspaceFlowActionBtn.dataset.dashboardProxyTarget = flowProxyTargetId;',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing active-step handoff token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Guided flow now hands active case steps, reviews, and the completed-flow restart down to the main Start/current step row"),
    "README should describe the active-step guided handoff to the main row",
  );
  assert.ok(
    operatorGuideSource.includes("Guided flow now hands active case steps, reviews, and the completed-flow restart down to the main Start/current step row"),
    "operator guide should describe the active-step guided handoff to the main row",
  );
});
