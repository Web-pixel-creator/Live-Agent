import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("idle case path keeps future steps visible as preview-only until intake is confirmed", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'if (CASE_WORKSPACE_CASE_ACTIONS.has(buttonActionId) && (typeof activeActionId !== "string" || activeActionId.length === 0)) {',
    'state: "preview"',
    'button.disabled = uiState.state === "preview";',
    'After intake • " + stageLabel',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing idle preview token: ${token}`);
  }

  for (const token of [
    '[data-case-workspace-action-state="preview"]',
    "cursor: not-allowed;",
    "border-style: dashed;",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing idle preview token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("future steps inside `Case path` now stay visible only as a route preview"),
    "README should mention idle case-path preview behavior",
  );
  assert.ok(
    operatorGuideSource.includes("future steps inside `Case path` stay visible only as a route preview"),
    "operator guide should mention idle case-path preview behavior",
  );
});
