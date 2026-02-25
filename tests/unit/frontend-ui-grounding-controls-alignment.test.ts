import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires ui_task grounding controls into intent request payload", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="uiTaskUrl"',
    'id="uiTaskDeviceNodeId"',
    'id="uiTaskScreenshotRef"',
    'id="uiTaskDomSnapshot"',
    'id="uiTaskAccessibilityTree"',
    'id="uiTaskMarkHints"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing ui grounding control: ${token}`);
  }

  const requiredRuntimeTokens = [
    "parseMarkHintsInput",
    "collectUiTaskOverrides",
    "uiTaskOverrides",
    "payload.domSnapshot",
    "payload.accessibilityTree",
    "payload.markHints",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing ui grounding wiring token: ${token}`);
  }
});
