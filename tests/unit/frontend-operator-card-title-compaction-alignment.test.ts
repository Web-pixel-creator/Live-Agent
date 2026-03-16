import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console uses shorter card titles only in desktop demo compaction contexts", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "const OPERATOR_COMPACT_CARD_TITLES = Object.freeze({",
    'operatorGatewayErrorStatus: "Gateway errors",',
    'operatorGovernancePolicyStatus: "Policy changes",',
    'operatorTaskQueueStatus: "Queue load",',
    'operatorDeviceNodeUpdatesStatus: "Node updates",',
    'operatorTraceStatus: "Trace proof",',
    "const OPERATOR_COMPACT_CARD_TITLES_BY_TITLE = Object.freeze({",
    '"Errors & Recovery": "Recovery",',
    '"Probe Telemetry": "Probes",',
    "function isOperatorDesktopCompactionViewport() {",
    'window.matchMedia("(min-width: 921px)").matches;',
    "function resolveOperatorCompactCardTitle(card, fallbackTitle = \"\") {",
    "Object.prototype.hasOwnProperty.call(OPERATOR_COMPACT_CARD_TITLES_BY_TITLE, normalizedFallbackTitle)",
    "function shouldUseOperatorCompactCardTitle(card) {",
    'card.classList.contains("operator-health-card-lead") || card.classList.contains("operator-health-card-supporting")',
    "function syncOperatorCardPresentationTitle(card) {",
    "card.dataset.operatorCardOriginalTitle = originalTitle;",
    'titleNode.classList.toggle("is-compact-title", shouldUseCompactTitle);',
    "titleNode.title = originalTitle;",
    "function syncOperatorBoardCardPresentationTitles() {",
    "syncOperatorBoardCardPresentationTitles();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator card-title compaction token: ${token}`);
  }

  assert.ok(
    stylesSource.includes(".panel-operator-console .operator-health-card h3.is-compact-title {"),
    "frontend styles missing operator compact-title token",
  );

  assert.ok(
    readmeSource.includes("shorter operator-facing titles"),
    "README missing operator card-title compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("shorter operator-facing titles"),
    "operator guide missing operator card-title compaction note",
  );
});
