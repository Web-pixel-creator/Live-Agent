import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator damage-control timeline widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorDamageControlStatus"',
    'id="operatorDamageControlTotal"',
    'id="operatorDamageControlRuns"',
    'id="operatorDamageControlSessions"',
    'id="operatorDamageControlVerdicts"',
    'id="operatorDamageControlLatest"',
    'id="operatorDamageControlRuleIds"',
    'id="operatorDamageControlSeenAt"',
    'id="operatorDamageControlHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator damage-control widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "state.operatorDamageControlSnapshot",
    "setOperatorDamageControlHint",
    "resetOperatorDamageControlWidget",
    "renderOperatorDamageControlWidget",
    "updateOperatorDamageControlWidgetFromResponse",
    "updateOperatorDamageControlWidgetFromResponse(event);",
    "damage_control",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator damage-control token: ${token}`);
  }
});

