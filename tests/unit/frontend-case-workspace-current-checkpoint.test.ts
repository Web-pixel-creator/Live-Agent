import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("current case card exposes a checkpoint row for the active gate or unlock point", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.currentCheckpointLabel">Current checkpoint</dt>')
      && htmlSource.includes('id="caseWorkspaceCurrentCheckpointValue">Intake launch is open</dd>'),
    "index.html should expose a dedicated current-checkpoint row in the Current case card",
  );

  for (const token of [
    '"live.caseWorkspace.currentCheckpointLabel": "Current checkpoint"',
    'caseWorkspaceCurrentCheckpointValue: document.getElementById("caseWorkspaceCurrentCheckpointValue")',
    "function getCaseWorkspaceSummaryCheckpointValue(flowState, isRu)",
    '"Protected review is pending"',
    '"Next case move is unlocked"',
    '"Intake launch is open"',
    'const currentCheckpointLabel = document.querySelector(\'[data-i18n="live.caseWorkspace.currentCheckpointLabel"]\');',
    'el.caseWorkspaceCurrentCheckpointValue.textContent = getCaseWorkspaceSummaryCheckpointValue(flowState, isRu);',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing current-checkpoint token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Current case` now also shows the current checkpoint")
      && operatorGuideSource.includes("`Current case` now also shows the current checkpoint"),
    "docs should explain the current-checkpoint row in Current case",
  );
});
