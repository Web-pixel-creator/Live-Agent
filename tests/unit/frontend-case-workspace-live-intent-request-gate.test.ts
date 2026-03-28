import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("active case flow opens the standalone live composer only through the live request drawer", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function getCaseWorkspaceLiveIntentShellContent(flowState, isRu, requestDrawerOpen = true)",
    'Open the Live request drawer below only when the request sits outside the current case step.',
    'Open the Live request drawer below only when you need one more standalone translation, negotiation, research, UI task, or chat before the next case.',
    "showComposer: false,",
    "const requestDrawerOpen =",
    "el.caseWorkspaceRequestShell instanceof HTMLDetailsElement ? el.caseWorkspaceRequestShell.open : true;",
    "el.liveIntentStageShell.hidden = liveIntentShellCopy.showComposer !== true;",
    'el.liveIntentStageShell.setAttribute("aria-hidden", liveIntentShellCopy.showComposer === true ? "false" : "true");',
    "el.liveComposePrimaryShell.hidden = liveIntentShellCopy.showComposer !== true;",
    'el.liveComposePrimaryShell.setAttribute("aria-hidden", liveIntentShellCopy.showComposer === true ? "false" : "true");',
    'el.caseWorkspaceRequestShell.addEventListener("toggle", () => {',
    "renderLiveIntentExperience();",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing request-gated live-intent token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("that standalone chooser/composer now opens only through the `Live request` drawer"),
    "README should describe request-gated standalone composer behavior",
  );
  assert.ok(
    operatorGuideSource.includes("that standalone chooser/composer now opens only through the `Live request` drawer"),
    "operator guide should describe request-gated standalone composer behavior",
  );
});
