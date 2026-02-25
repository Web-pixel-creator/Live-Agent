import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator turn-truncation evidence widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorTurnTruncationStatus"',
    'id="operatorTurnTruncationTotal"',
    'id="operatorTurnTruncationRuns"',
    'id="operatorTurnTruncationSessions"',
    'id="operatorTurnTruncationTurnId"',
    'id="operatorTurnTruncationReason"',
    'id="operatorTurnTruncationAudioEndMs"',
    'id="operatorTurnTruncationContentIndex"',
    'id="operatorTurnTruncationSeenAt"',
    'id="operatorTurnTruncationHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator turn-truncation widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "state.operatorTurnTruncationSnapshot",
    "setOperatorTurnTruncationHint",
    "resetOperatorTurnTruncationWidget",
    "renderOperatorTurnTruncationWidget",
    "updateOperatorTurnTruncationWidgetFromEvent",
    "updateOperatorTurnTruncationWidgetFromEvent(event);",
    "turn_truncation",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator turn-truncation token: ${token}`);
  }
});
