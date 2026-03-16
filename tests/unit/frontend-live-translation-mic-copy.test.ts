import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("translation composer explains translation direction and pause-based auto-submit behavior", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const indexPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");

  const appSource = readFileSync(appPath, "utf8");
  const indexSource = readFileSync(indexPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");
  const runbookSource = readFileSync(runbookPath, "utf8");
  const normalizedAppSource = appSource.toLowerCase();

  assert.ok(
    appSource.includes('speechLanguageLabel: isRu ? "С какого языка" : "From language"') &&
      appSource.includes('targetLanguageLabel: isRu ? "На какой язык" : "Translate to"'),
    "translation composer should present translation setup as From -> To instead of technical labels",
  );
  assert.ok(
    appSource.includes('speechLanguageHint: isRu ? "На каком языке ты говоришь или пишешь" : "Language you speak or type"') &&
      appSource.includes('targetLanguageHint: isRu ? "Какой перевод получить" : "Language you want back"'),
    "translation composer should explain source and target languages in plain language",
  );
  assert.ok(
    indexSource.includes('id="translationDirectionSummary"'),
    "translation composer should keep a dedicated translation-direction element available for optional future use",
  );
  assert.ok(
    normalizedAppSource.includes("короткая пауза"),
    "translation composer should explain the Russian short-pause auto-submit behavior",
  );
  assert.ok(
    normalizedAppSource.includes("short pause"),
    "translation composer should explain the English short-pause auto-submit behavior",
  );
  assert.ok(
    appSource.includes("A short pause auto-sends the phrase; Stop mic is only a manual fallback."),
    "translation send hint should explain pause-based auto-submit behavior for voice input",
  );
  assert.ok(
    readmeSource.includes("a short speech pause now auto-submits the spoken phrase and stops the mic"),
    "README should document that a speech pause auto-submits translation voice input",
  );
  assert.ok(
    operatorGuideSource.includes("a short pause after the phrase now auto-submits the translation and stops the mic"),
    "operator guide should document that a speech pause auto-submits translation voice input",
  );
  assert.ok(
    readmeSource.includes("From language -> Translate to"),
    "README should document the clearer From -> To translation direction model",
  );
  assert.ok(
    operatorGuideSource.includes("From language -> Translate to"),
    "operator guide should document the clearer From -> To translation direction model",
  );
  assert.ok(
    runbookSource.includes("From -> To"),
    "runbook should tell operators to read the translation direction as From -> To",
  );
});
