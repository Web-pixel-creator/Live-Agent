import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("spec packaging reflects delivered baseline capabilities and future-scope extensions", () => {
  const requirementsSource = readFileSync(
    resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "requirements.md"),
    "utf8",
  );
  const designSource = readFileSync(
    resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "design.md"),
    "utf8",
  );
  const tasksSource = readFileSync(
    resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "tasks.md"),
    "utf8",
  );

  assert.match(
    designSource,
    /workspace` \/ `bundled` \/ `managed` skill sources with runtime precedence and policy gating/,
  );
  assert.match(designSource, /signing-aware plugin marketplace surfaces/);
  assert.match(
    requirementsSource,
    /Grounded web research \| Repo-owned research lane with deterministic fallback and Perplexity Sonar baseline \| Perplexity Sonar \|/,
  );
  assert.match(
    requirementsSource,
    /Система "Агенты нового поколения" предназначена для создания трёх классов мультимодальных агентов для Live Agent Challenge:/,
  );
  assert.match(
    requirementsSource,
    /- \*\*Computer_Use_Tool\*\*: Инструмент Gemini для восприятия скриншота и выдачи действий \(click\/type\/scroll\)\./,
  );
  assert.match(
    requirementsSource,
    /Этот раздел фиксирует расширения, которые \*\*не обязательны для MVP\/челленджа\*\*, но остаются допустимым направлением развития после текущего baseline\./,
  );
  assert.match(
    tasksSource,
    /capability-адаптеров \(live, reasoning, tts, image, image_edit, video, computer_use, research\)/,
  );
  assert.doesNotMatch(requirementsSource, /[\u0080-\u009F]/);

  const requirementsFutureTokens = [
    "expand the current repo-owned managed skills baseline",
    "expand the current repo-owned device-node baseline",
    "expand the current tenant/compliance/governance baseline",
    "expand the current signed plugin marketplace baseline",
  ];
  for (const token of requirementsFutureTokens) {
    assert.ok(requirementsSource.includes(token), `requirements missing future-scope packaging token: ${token}`);
  }

  const legacyRequirementPhrases = [
    "THE System MAY provide a managed skill registry with versioning, discovery, install/update workflows, and trust metadata.",
    "THE System MAY support device nodes (desktop/mobile) for distributed execution of camera/screen/system actions.",
    "THE System MAY add organization-level governance features, including tenancy, compliance templates, and centralized audit dashboards.",
    "THE System MAY add plugin marketplace capabilities with signed extensions and permission manifests.",
    "| Grounded web research | Repo-owned deterministic + Google stack where possible | Perplexity Sonar |",
    "Р­С‚РѕС‚ СЂР°Р·РґРµР»",
    "Ð¡Ð¸ÑÑ‚ÐµÐ¼Ð°",
    "ÐŸÐ»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ð°",
  ];
  for (const phrase of legacyRequirementPhrases) {
    assert.ok(
      !requirementsSource.includes(phrase),
      `requirements still treat delivered baseline as future-only or stale: ${phrase}`,
    );
  }

  const updatedTaskPhrases = [
    "T-302 | Расширить managed skill registry beyond current repo-owned baseline",
    "T-303 | Расширить device-node execution beyond current repo-owned baseline",
    "T-304 | Расширить org governance beyond current tenant/compliance baseline",
    "T-305 | Расширить plugin marketplace beyond current signed repo-owned baseline",
  ];
  for (const phrase of updatedTaskPhrases) {
    assert.ok(tasksSource.includes(phrase), `tasks missing baseline-aware V3 packaging phrase: ${phrase}`);
  }

  const legacyTaskPhrases = [
    "T-302 | Реализовать managed skill registry",
    "T-303 | Добавить device-node execution",
    "T-304 | Добавить org governance",
    "T-305 | Добавить plugin marketplace",
  ];
  for (const phrase of legacyTaskPhrases) {
    assert.ok(!tasksSource.includes(phrase), `tasks still frame delivered baseline as future-only: ${phrase}`);
  }
});
