import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires ui_task grounding controls into intent request payload", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredHtmlIds = [
    'id="uiTaskFields"',
    'id="uiTaskUrl"',
    'id="uiTaskDeviceNodeId"',
    'id="uiTaskScreenshotRef"',
    'id="uiTaskDomSnapshot"',
    'id="uiTaskAccessibilityTree"',
    'id="uiTaskMarkHints"',
    'id="uiTaskBrowserWorkerEnabled"',
    'id="uiTaskBrowserWorkerCheckpointEverySteps"',
    'id="uiTaskBrowserWorkerPauseAfterStep"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing ui grounding control: ${token}`);
  }

  const requiredRuntimeTokens = [
    "parseMarkHintsInput",
    "collectUiTaskOverrides",
    "uiTaskOverrides",
    "setUiTaskFieldsVisibility",
    "el.intent.addEventListener(\"change\", setUiTaskFieldsVisibility)",
    "el.uiTaskFields.hidden = !isUiTaskIntent;",
    "if (intent === \"ui_task\") {",
    "payload.domSnapshot",
    "payload.accessibilityTree",
    "payload.markHints",
    "payload.browserWorker",
    "uiTaskBrowserWorkerEnabled",
    "uiTaskBrowserWorkerCheckpointEverySteps",
    "uiTaskBrowserWorkerPauseAfterStep",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing ui grounding wiring token: ${token}`);
  }

  const requiredStyleTokens = [
    "[hidden] {",
    "display: none !important;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing ui grounding visibility token: ${token}`);
  }
});
