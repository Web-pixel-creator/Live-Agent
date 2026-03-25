import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("workspace chooser keeps fuller current-state meta on the active card and short jump hints on inactive cards", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  for (const token of [
    'id="operatorWorkspaceOverviewMeta"',
    'id="operatorWorkspaceApprovalsMeta"',
    'id="operatorWorkspaceRuntimeMeta"',
    'id="operatorWorkspaceAuditMeta"',
    'class="operator-workspace-card-meta"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing chooser meta token: ${token}`);
  }

  for (const token of [
    'target.meta.textContent =',
    'function buildOperatorWorkspaceCardCompactMeta(presentation) {',
    'target.meta.dataset.metaDensity = isActive ? "full" : "compact";',
    'buildOperatorWorkspaceCardCompactMeta(presentation)',
    'Current workspace. Refresh once to hydrate',
    'Current workspace. Inspect the flagged',
    'Current workspace. Review',
    'Current workspace. Stay here unless fresher proof is needed elsewhere.',
    'Refresh ${workspaceLabel} evidence.',
    'Inspect ${workspaceLabel} signal.',
    'Review ${workspaceLabel} signal.',
    'Keep ${workspaceLabel} steady.',
    'isActive',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing chooser meta-guidance token: ${token}`);
  }

  assert.match(
    appSource,
    /target\.meta\.textContent\s*=\s*!presentation\.hasManualRefresh\s*\?\s*isActive\s*\?\s*`Current workspace\. Refresh once to hydrate \$\{presentation\.routeFacts\.label\.toLowerCase\(\)\} evidence\.`\s*:\s*buildOperatorWorkspaceCardCompactMeta\(presentation\)\s*:\s*isActive\s*\?\s*presentation\.tone === "fail"\s*\?\s*`Current workspace\. Inspect the flagged \$\{presentation\.routeFacts\.label\.toLowerCase\(\)\} signal before switching lanes\.`\s*:\s*presentation\.tone === "neutral"\s*\?\s*`Current workspace\. Review \$\{presentation\.routeFacts\.label\.toLowerCase\(\)\} before reopening broader triage\.`\s*:\s*`Current workspace\. Stay here unless fresher proof is needed elsewhere\.`\s*:\s*buildOperatorWorkspaceCardCompactMeta\(presentation\);/s,
    "app.js should keep the active chooser meta as fuller current-state guidance and inactive chooser meta as compact jump hints",
  );

  assert.ok(
    stylesSource.includes(".panel-operator-console .operator-workspace-card-meta {"),
    "styles.css should keep the chooser meta row styled",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-meta {'),
    "styles.css should compact inactive chooser meta guidance",
  );
});
