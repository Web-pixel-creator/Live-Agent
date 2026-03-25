import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("workspace chooser keeps fuller hints on the current card and shorter hints on inactive jump cards", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  for (const token of [
    'class="operator-workspace-card-hint"',
    "Fail, stale, and watch lanes stay together for broad first-pass triage.",
    "Resume decisions, queue backlog, startup gates, and pending approval health.",
    "Workflow routing, guardrails, UI executor failover, and device-node readiness.",
    "Governance, skills, cost posture, and review-ready export evidence.",
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing workspace-card hint token: ${token}`);
  }

  for (const token of [
    "function buildOperatorWorkspaceCardCompactHint(presentation) {",
    'hintNode.textContent = isActive ? presentation.hint : buildOperatorWorkspaceCardCompactHint(presentation);',
    'hintNode.dataset.hintDensity = isActive ? "full" : "compact";',
    'Jump here after refreshing ${workspaceLabel} evidence.',
    'Jump here to inspect ${workspaceLabel} attention.',
    'Jump here to review ${workspaceLabel}.',
    'Jump here when you need ${workspaceLabel} evidence.',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-card hint density token: ${token}`);
  }

  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-hint {'),
    "styles.css should compact inactive workspace-card hints",
  );
});
