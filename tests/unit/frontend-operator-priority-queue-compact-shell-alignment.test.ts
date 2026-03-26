import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator desktop active queue collapses visible items into compact action shells", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function buildOperatorPriorityQueueCompactMeta(entry) {",
    'return "Refresh once, then follow the highlighted workspace.";',
    "function resolveOperatorPriorityQueueCompactTitle(entry) {",
    "function resolveOperatorPriorityQueueCompactActionLabel(config) {",
    'const queueDensity = isDesktopQueue ? "compact" : "default";',
    'item.dataset.queueDensity = queueDensity;',
    'const visibleTitle = queueDensity === "compact"',
    'title.title = titleText;',
    'const metaTitle = entry.meta ?? "No operator guidance is available yet.";',
    'meta.textContent = queueDensity === "compact" ? buildOperatorPriorityQueueCompactMeta(entry) : metaTitle;',
    "meta.title = metaTitle;",
    'shortLabel: resolveOperatorPriorityQueueCompactActionLabel(config)',
    'button.title = fullLabel;',
    'button.setAttribute("aria-label", fullLabel);',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing compact queue token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-priority-queue-item[data-queue-density="compact"] {',
    '.panel-operator-console .operator-priority-queue-item[data-queue-density="compact"] .operator-priority-queue-kicker {',
    '.panel-operator-console .operator-priority-queue-item[data-queue-density="compact"] h3 {',
    '.panel-operator-console .operator-priority-queue-item[data-queue-density="compact"] .operator-priority-queue-meta {',
    '.panel-operator-console .operator-priority-queue-item[data-queue-density="compact"] .operator-priority-queue-actions {',
    '.panel-operator-console .operator-priority-queue-item[data-queue-density="compact"] .operator-priority-queue-action {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing compact queue token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("action column tightens into smaller utility buttons"),
    "README missing compact active queue note",
  );
  assert.ok(
    readmeSource.includes("shorten visible titles and CTA labels (`Hydrate board`, `Refresh`, `Quick Start`, `Workspace`)"),
    "README missing compact active queue label note",
  );
  assert.ok(
    operatorGuideSource.includes("action column tightens into smaller utility buttons"),
    "operator guide missing compact active queue note",
  );
  assert.ok(
    operatorGuideSource.includes("shorten visible titles and CTA labels (`Hydrate board`, `Refresh`, `Quick Start`, `Workspace`)"),
    "operator guide missing compact active queue label note",
  );
});
