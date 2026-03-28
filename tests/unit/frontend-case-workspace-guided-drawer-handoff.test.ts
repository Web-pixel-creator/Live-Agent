import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("guided case flow hands off to the matching top-level drawer only after the case is active", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function getCaseWorkspaceDrawerTarget(flowState)",
    'if (activeActionId === "run_visa_intake_demo" && completedCount === 0) {',
    'return "result";',
    'return "case";',
    "const drawerTarget = getCaseWorkspaceDrawerTarget(flowState);",
    '"drawer:case:" + (drawerTarget === "case" ? activeActionId : "idle")',
    '"drawer:result:" + (drawerTarget === "result" ? activeActionId : "idle")',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing guided-drawer handoff token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Guided flow now also hands off into the matching top-level case drawer only after the case is active"),
    "README should describe the guided-to-drawer handoff",
  );
  assert.ok(
    operatorGuideSource.includes("Guided flow now also hands off into the matching top-level case drawer only after the case is active"),
    "operator guide should describe the guided-to-drawer handoff",
  );
});
