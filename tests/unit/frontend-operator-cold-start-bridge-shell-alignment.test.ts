import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console bridge lane cold-starts as a compact desktop shell", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'id="operatorGroupBridgeSafety" class="operator-health-group" data-operator-group="bridge-safety"',
    'operator-health-card operator-health-card-condensed operator-health-card-empty" data-operator-critical data-operator-demo-essential',
    'operator-health-card operator-health-card-condensed operator-health-card-empty" data-operator-critical',
    'operator-health-card operator-health-card-condensed operator-health-card-empty operator-health-card-hidden',
    'Run negotiation, then refresh.',
    'No gateway error yet. Refresh after a live run.',
    'No turn cut yet. Trigger interruption, then refresh.',
    'No delete event yet. Run delete, then refresh.',
    'No UI safety event yet. Run UI task, then refresh.',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator cold-start bridge token: ${token}`);
  }

  const compactShellMatches = htmlSource.match(/operator-health-card-condensed operator-health-card-empty/g) ?? [];
  assert.ok(compactShellMatches.length >= 5, "bridge lane should ship five compact empty-shell cards in static HTML");

  const hiddenMatches = htmlSource.match(/operator-health-card-hidden/g) ?? [];
  assert.ok(hiddenMatches.length >= 2, "bridge lane should hide secondary turn-cut and turn-delete cards on cold start");

  const requiredStyleTokens = [
    '.panel-operator-console .operator-health-group[data-operator-group="bridge-safety"] .operator-health-card.operator-health-card-empty {',
    '.panel-operator-console .operator-health-group[data-operator-group="bridge-safety"] .operator-health-group-body {',
    '.panel-operator-console .operator-health-group[data-operator-group="bridge-safety"] .operator-health-card.operator-health-card-empty .status-pill {',
    '.panel-operator-console .operator-health-group[data-operator-group="bridge-safety"] .operator-health-card.operator-health-card-empty .operator-health-hint {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator cold-start bridge token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("cold-starts as a compact empty shell"),
    "README missing operator cold-start bridge shell note",
  );
  assert.ok(
    operatorGuideSource.includes("cold-starts as a compact empty shell"),
    "operator guide missing operator cold-start bridge shell note",
  );
});
