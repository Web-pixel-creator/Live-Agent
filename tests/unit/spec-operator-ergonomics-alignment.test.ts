import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("requirements/design/tasks/runbook stay aligned on operator ergonomics and bootstrap surfaces", () => {
  const requirementsPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "requirements.md");
  const designPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "design.md");
  const tasksPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "tasks.md");
  const quickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");

  const requirementsSource = readFileSync(requirementsPath, "utf8");
  const designSource = readFileSync(designPath, "utf8");
  const tasksSource = readFileSync(tasksPath, "utf8");
  const quickstartSource = readFileSync(quickstartPath, "utf8");
  const runbookSource = readFileSync(runbookPath, "utf8");

  for (const token of ["purpose declaration", "session replay", "cross-agent discovery"]) {
    assert.ok(requirementsSource.includes(token), `requirements missing operator ergonomics token: ${token}`);
    assert.ok(designSource.includes(token), `design missing operator ergonomics token: ${token}`);
  }

  for (const token of ["bootstrap doctor", "auth-profile", "browser-worker"]) {
    assert.ok(requirementsSource.toLowerCase().includes(token), `requirements missing runtime surface token: ${token}`);
    assert.ok(designSource.toLowerCase().includes(token), `design missing runtime surface token: ${token}`);
  }

  for (const token of ["workflow control", "fault-profile"]) {
    assert.ok(requirementsSource.toLowerCase().includes(token), `requirements missing runtime recovery token: ${token}`);
  }

  for (const token of ["`Runtime Drill Runner`", "`Workflow Control Panel`"]) {
    assert.ok(designSource.includes(token), `design missing runtime recovery surface token: ${token}`);
    assert.ok(quickstartSource.includes(token), `quickstart missing runtime recovery surface token: ${token}`);
    assert.ok(runbookSource.includes(token), `runbook missing runtime recovery surface token: ${token}`);
  }

  for (const token of [
    "T-243 async browser-worker orchestration",
    "T-244 onboarding/bootstrap doctor + auth-profile rotation",
    "T-245 developer/operator ergonomics pack",
    "Runtime recovery control-plane baseline",
    "[Completed]",
  ]) {
    assert.ok(tasksSource.includes(token), `tasks missing completed ergonomics token: ${token}`);
  }

  for (const token of [
    "`Operator Session Ops`",
    "`Bootstrap Doctor & Auth Profiles`",
    "`Browser Worker Control`",
    "`operatorPurpose`",
    "`operatorSessionReplay`",
    "`operatorDiscovery`",
  ]) {
    assert.ok(runbookSource.includes(token), `runbook missing operator ergonomics token: ${token}`);
  }
});
