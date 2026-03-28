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
    "function getCaseWorkspacePrimaryActionMeta(flowState, primaryActionCopy, isRu)",
    "function getCaseWorkspacePrimaryActionSurface(flowState, primaryActionCopy, isRu)",
    "function getCaseWorkspacePrimaryActionOutcome(flowState, primaryActionCopy, isRu)",
    'status: isRu ? "Начните здесь" : "Start here"',
    'status: isRu ? "Сделайте сейчас" : "Do now"',
    'status: isRu ? "Проверьте сейчас" : "Check now"',
    'status: isRu ? "Начните следующий" : "Start next"',
    'status: isRu ? "На паузе" : "On hold"',
    'label: isRu ? "Вернётся в" : "Returns in"',
    'label: isRu ? "Откроется в" : "Open in"',
    'title: isRu ? "Текущий шаг кейса" : "Current case move"',
    'title: isRu ? "Текущая проверка кейса" : "Current case review"',
    'title: isRu ? "Начните следующий кейс" : "Start another case"',
    'title: isRu ? "Путь кейса ждёт" : "Case path waiting"',
    "const primaryActionCopy = getCaseWorkspacePrimaryActionCopy(flowState, isRu);",
    "const primaryActionMeta = getCaseWorkspacePrimaryActionMeta(flowState, primaryActionCopy, isRu);",
    "const primaryActionSurface = getCaseWorkspacePrimaryActionSurface(flowState, primaryActionCopy, isRu);",
    "const primaryActionOutcome = getCaseWorkspacePrimaryActionOutcome(flowState, primaryActionCopy, isRu);",
    'mainActionSection.dataset.caseWorkspacePrimaryState = primaryActionCopy.state;',
    'mainActionSection.dataset.caseWorkspacePrimarySurface = primaryDrawerTarget || primaryActionCopy.state;',
    'el.caseWorkspaceMainActionsTitle.textContent = primaryActionCopy.title;',
    'mainActionHint.textContent = primaryActionCopy.hint;',
    'setStatusPill(el.caseWorkspaceMainActionStatus, primaryActionMeta.status, primaryActionMeta.tone);',
    'el.caseWorkspaceMainActionMeta.textContent = primaryActionMeta.meta;',
    'el.caseWorkspaceMainActionSurfaceLabel.textContent = primaryActionSurface.label;',
    'el.caseWorkspaceMainActionSurfaceValue.textContent = primaryActionSurface.value;',
    'el.caseWorkspaceMainActionOutcomeLabel.textContent = primaryActionOutcome.label;',
    'el.caseWorkspaceMainActionOutcomeValue.textContent = primaryActionOutcome.value;',
    'el.runVisaDemoBtn.textContent = primaryActionCopy.actionLabel;',
    'el.runVisaDemoBtn.dataset.dashboardAction = primaryActionCopy.actionId;',
    'el.runVisaDemoBtn.setAttribute("aria-describedby", "caseWorkspaceMainActionMeta caseWorkspaceMainActionOutcomeValue caseWorkspaceMainActionProofValue");',
    'el.runVisaDemoBtn.setAttribute("aria-controls", "caseWorkspaceCaseShortcuts");',
    'el.runVisaDemoBtn.setAttribute("aria-controls", "caseWorkspaceResultTools");',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing main-row flow token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("primary case row now mirrors the active guided step"),
    "README should explain that the primary case row mirrors the active guided step",
  );
  assert.ok(
    readmeSource.includes("primary case row now adds a small task-first status/meta strip"),
    "README should explain that the primary case row now carries a status/meta strip",
  );
  assert.ok(
    readmeSource.includes("primary case row now also shows where the current action opens next"),
    "README should explain that the primary case row now shows where the current action opens next",
  );
  assert.ok(
    readmeSource.includes("primary case row now also carries a short `Outcome / Next proof` line"),
    "README should explain that the primary case row now carries an outcome/proof line",
  );
  assert.ok(
    operatorGuideSource.includes("primary case row now mirrors the active guided step"),
    "operator guide should explain that the primary case row mirrors the active guided step",
  );
  assert.ok(
    operatorGuideSource.includes("primary case row now adds a small task-first status/meta strip"),
    "operator guide should explain that the primary case row now carries a status/meta strip",
  );
  assert.ok(
    operatorGuideSource.includes("primary case row now also shows where the current action opens next"),
    "operator guide should explain that the primary case row now shows where the current action opens next",
  );
  assert.ok(
    operatorGuideSource.includes("primary case row now also carries a short `Outcome / Next proof` line"),
    "operator guide should explain that the primary case row now carries an outcome/proof line",
  );
});
