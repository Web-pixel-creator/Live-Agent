import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator turn-delete evidence widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorTurnDeleteStatus"',
    'id="operatorTurnDeleteTotal"',
    'id="operatorTurnDeleteRuns"',
    'id="operatorTurnDeleteSessions"',
    'id="operatorTurnDeleteTurnId"',
    'id="operatorTurnDeleteReason"',
    'id="operatorTurnDeleteScope"',
    'id="operatorTurnDeleteSeenAt"',
    'id="operatorTurnDeleteHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator turn-delete widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "state.operatorTurnDeleteSnapshot",
    "setOperatorTurnDeleteHint",
    "resetOperatorTurnDeleteWidget",
    "renderOperatorTurnDeleteWidget",
    "updateOperatorTurnDeleteWidgetFromEvent",
    "updateOperatorTurnDeleteWidgetFromEvent(event);",
    "turn_delete",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator turn-delete token: ${token}`);
  }
});

