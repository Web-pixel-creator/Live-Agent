import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace main row mirrors the current guided step", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function getCaseWorkspacePrimaryActionCopy(flowState, isRu)",
    'title: isRu ? "Текущий шаг кейса" : "Current case move"',
    'title: isRu ? "Текущая проверка кейса" : "Current case review"',
    'title: isRu ? "Начните следующий кейс" : "Start another case"',
    'title: isRu ? "Путь кейса ждёт" : "Case path waiting"',
    "const primaryActionCopy = getCaseWorkspacePrimaryActionCopy(flowState, isRu);",
    'mainActionSection.dataset.caseWorkspacePrimaryState = primaryActionCopy.state;',
    'el.caseWorkspaceMainActionsTitle.textContent = primaryActionCopy.title;',
    'mainActionHint.textContent = primaryActionCopy.hint;',
    'el.runVisaDemoBtn.textContent = primaryActionCopy.actionLabel;',
    'el.runVisaDemoBtn.dataset.dashboardAction = primaryActionCopy.actionId;',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing main-row flow token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("primary case row now mirrors the active guided step"),
    "README should explain that the primary case row mirrors the active guided step",
  );
  assert.ok(
    operatorGuideSource.includes("primary case row now mirrors the active guided step"),
    "operator guide should explain that the primary case row mirrors the active guided step",
  );
});
