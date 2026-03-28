import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace demotes the generic live-intent shell once case flow is active", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const cssSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="liveComposePanelHeading"',
    'id="liveComposePanelIntro"',
    'id="liveIntentStageShell"',
    'id="liveComposePrimaryShell"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing live-intent shell token: ${token}`);
  }

  for (const token of [
    "function getCaseWorkspaceLiveIntentShellContent(flowState, isRu, requestDrawerOpen = true)",
    'heading: isRu ? "Отдельный live-запрос" : "Standalone live request"',
    'heading: isRu ? "Live-запрос после кейса" : "Live request after case"',
    'stageLabel: isRu ? "Отдельные действия" : "Standalone actions"',
    'mode: "secondary"',
    'mode: "after-case"',
    'el.liveComposePanelHeading.textContent = liveIntentShellCopy.heading;',
    'el.liveComposePanelIntro.dataset.caseWorkspaceIntentMode = liveIntentShellCopy.mode;',
    'el.liveIntentStageShell.dataset.caseWorkspaceIntentMode = liveIntentShellCopy.mode;',
    'el.liveComposePrimaryShell.dataset.caseWorkspaceIntentMode = liveIntentShellCopy.mode;',
    "renderCaseWorkspaceFlow(awaitingFreshResponse, flowState);",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing live-intent demotion token: ${token}`);
  }

  for (const token of [
    '.case-workspace-panel-intro[data-case-workspace-intent-mode="secondary"]',
    '.live-intent-stage[data-case-workspace-intent-mode="secondary"]',
    '.live-compose-primary-shell[data-case-workspace-intent-mode="secondary"] .intent-compose-grid',
  ]) {
    assert.ok(cssSource.includes(token), `styles.css missing live-intent demotion selector: ${token}`);
  }

  assert.ok(
    readmeSource.includes("the generic live-intent chooser and composer now also quiet down during active or completed case flow"),
    "README should describe the stage-aware live-intent shell",
  );
  assert.ok(
    operatorGuideSource.includes("the generic live-intent chooser and composer now also quiet down during active or completed case flow"),
    "operator guide should describe the stage-aware live-intent shell",
  );
});
