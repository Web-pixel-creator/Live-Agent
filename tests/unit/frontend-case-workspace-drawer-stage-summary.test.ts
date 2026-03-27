import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace drawer summaries become stage-aware around the active case path", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function getCaseWorkspaceStepAfter(",
    "function getCaseWorkspaceCaseDrawerContent(flowState, isRu)",
    "function getCaseWorkspaceResultDrawerContent(flowState, isRu)",
    'title: isRu ? "Следующие шаги кейса" : "Later case steps"',
    'chip: isRu ? "После intake" : "After intake"',
    'title: isRu ? "Путь кейса на паузе" : "Case path paused"',
    'title: isRu ? "Проверка и перезапуск" : "Review and restart"',
    'title: isRu ? "Итоги ждут здесь" : "Results wait here"',
    'title: isRu ? "Кейс завершён" : "Case complete"',
    'title: isRu ? currentLabel + " — следующий этап" : currentLabel + " comes next"',
    'title: isRu ? nextLabel + " после итога" : nextLabel + " after review"',
    'title: isRu ? "Проверьте итог этапа «" + currentLabel + "»" : "Review the " + currentLabel + " result"',
    'title: isRu ? "Итог этапа «" + currentLabel + "»" : currentLabel + " result"',
    'const caseTitle = document.getElementById("caseWorkspaceCaseActionsTitle")',
    'const resultTitle = document.getElementById("caseWorkspaceResultToolsTitle")',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing stage-aware drawer token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("summaries now also shift with the active case stage"),
    "README should mention that collapsed case drawers now shift with the active case stage",
  );
  assert.ok(
    operatorGuideSource.includes("summaries now also shift with the active case stage"),
    "operator guide should mention that collapsed case drawers now shift with the active case stage",
  );
});
