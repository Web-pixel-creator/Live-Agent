import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const playbooks = [
  {
    id: "lead-qualification-playbook",
    personaId: "lead-qualifier",
    recipeId: "lead-qualification-intake",
    skillPath: resolve(repoRoot, "skills", "bundled", "lead-qualification", "SKILL.md"),
  },
  {
    id: "consultation-booking-playbook",
    personaId: "consultation-booking",
    recipeId: "consultation-booking-flow",
    skillPath: resolve(repoRoot, "skills", "bundled", "consultation-booking", "SKILL.md"),
  },
  {
    id: "document-collection-playbook",
    personaId: "document-collection",
    recipeId: "document-collection-flow",
    skillPath: resolve(repoRoot, "skills", "bundled", "document-collection", "SKILL.md"),
  },
];

const followUpPlaybooks = [
  {
    id: "missing-documents-follow-up-playbook",
    personaId: "missing-documents-follow-up",
    recipeId: "missing-documents-follow-up-flow",
    skillPath: resolve(repoRoot, "skills", "bundled", "missing-documents-follow-up", "SKILL.md"),
  },
  {
    id: "consultation-reminder-playbook",
    personaId: "consultation-reminder",
    recipeId: "consultation-reminder-flow",
    skillPath: resolve(repoRoot, "skills", "bundled", "consultation-reminder", "SKILL.md"),
  },
];

test("bundled playbooks are discoverable and export visa/relocation instructions", () => {
  for (const playbook of playbooks) {
    assert.ok(existsSync(playbook.skillPath), `missing bundled skill file: ${playbook.skillPath}`);
    const source = readFileSync(playbook.skillPath, "utf8");
    assert.match(source, new RegExp(`id:\\s*${playbook.id}`));
    assert.match(source, /prompt:/i);
    assert.match(source, /approval boundary/i);
    assert.match(source, /browser scope/i);
    assert.match(source, /success metrics/i);
    assert.match(source, /failure and escalation/i);
  }

  const leadSource = readFileSync(playbooks[0].skillPath, "utf8");
  assert.match(leadSource, /visa\/relocation/i);
  assert.match(leadSource, /5 to 7/i);
  assert.match(leadSource, /structured summary/i);
  assert.match(leadSource, /next step/i);

  const documentSource = readFileSync(playbooks[2].skillPath, "utf8");
  assert.match(documentSource, /visa\/relocation/i);
  assert.match(documentSource, /checklist/i);
  assert.match(documentSource, /has/i);
  assert.match(documentSource, /missing/i);
  assert.match(documentSource, /missing-items summary/i);
});

test("bundled visa/relocation follow-up playbooks are discoverable and export operator-ready instructions", () => {
  for (const playbook of followUpPlaybooks) {
    assert.ok(existsSync(playbook.skillPath), `missing bundled skill file: ${playbook.skillPath}`);
    const source = readFileSync(playbook.skillPath, "utf8");
    assert.match(source, new RegExp(`id:\\s*${playbook.id}`));
    assert.match(source, /visa\/relocation/i);
    assert.match(source, /prompt:/i);
    assert.match(source, /approval boundary/i);
    assert.match(source, /browser scope/i);
    assert.match(source, /success metrics/i);
    assert.match(source, /failure and escalation/i);
  }

  const followUpSource = readFileSync(followUpPlaybooks[0].skillPath, "utf8");
  assert.match(followUpSource, /has/i);
  assert.match(followUpSource, /missing/i);
  assert.match(followUpSource, /next action/i);
  assert.match(followUpSource, /missing-items summary/i);

  const reminderSource = readFileSync(followUpPlaybooks[1].skillPath, "utf8");
  assert.match(reminderSource, /appointment/i);
  assert.match(reminderSource, /timezone/i);
  assert.match(reminderSource, /reschedule/i);
  assert.match(reminderSource, /should bring/i);
});

test("skills catalog exposes visa/relocation playbooks as personas and recipes", () => {
  const catalogPath = resolve(repoRoot, "configs", "skills.catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
    personas: Array<{ id: string; name?: string; description?: string; recommendedSkillIds?: string[]; defaultRecipeId?: string | null }>;
    recipes: Array<{ id: string; name?: string; description?: string; recommendedSkillIds?: string[]; judgeCategory?: string | null }>;
  };

  const personaIds = new Set(catalog.personas.map((item) => item.id));
  const recipeIds = new Set(catalog.recipes.map((item) => item.id));

  for (const playbook of playbooks) {
    assert.ok(personaIds.has(playbook.personaId), `missing persona ${playbook.personaId}`);
    assert.ok(recipeIds.has(playbook.recipeId), `missing recipe ${playbook.recipeId}`);
  }

  const leadPersona = catalog.personas.find((item) => item.id === "lead-qualifier");
  const bookingPersona = catalog.personas.find((item) => item.id === "consultation-booking");
  const documentPersona = catalog.personas.find((item) => item.id === "document-collection");
  const followUpPersona = catalog.personas.find((item) => item.id === "missing-documents-follow-up");
  const reminderPersona = catalog.personas.find((item) => item.id === "consultation-reminder");

  assert.deepEqual(leadPersona?.recommendedSkillIds, ["lead-qualification-playbook"]);
  assert.deepEqual(bookingPersona?.recommendedSkillIds, ["consultation-booking-playbook"]);
  assert.deepEqual(documentPersona?.recommendedSkillIds, ["document-collection-playbook"]);
  assert.deepEqual(followUpPersona?.recommendedSkillIds, ["missing-documents-follow-up-playbook"]);
  assert.deepEqual(reminderPersona?.recommendedSkillIds, ["consultation-reminder-playbook"]);
  assert.equal(leadPersona?.defaultRecipeId, "lead-qualification-intake");
  assert.equal(bookingPersona?.defaultRecipeId, "consultation-booking-flow");
  assert.equal(documentPersona?.defaultRecipeId, "document-collection-flow");
  assert.equal(followUpPersona?.defaultRecipeId, "missing-documents-follow-up-flow");
  assert.equal(reminderPersona?.defaultRecipeId, "consultation-reminder-flow");
  assert.match(leadPersona?.name ?? "", /visa\/relocation/i);
  assert.match(documentPersona?.name ?? "", /visa\/relocation/i);
  assert.match(followUpPersona?.name ?? "", /visa\/relocation/i);
  assert.match(reminderPersona?.name ?? "", /visa\/relocation/i);
  assert.match(leadPersona?.description ?? "", /visa/i);
  assert.match(documentPersona?.description ?? "", /visa/i);
  assert.match(followUpPersona?.description ?? "", /visa/i);
  assert.match(reminderPersona?.description ?? "", /visa/i);

  const leadRecipe = catalog.recipes.find((item) => item.id === "lead-qualification-intake");
  const documentRecipe = catalog.recipes.find((item) => item.id === "document-collection-flow");
  const followUpRecipe = catalog.recipes.find((item) => item.id === "missing-documents-follow-up-flow");
  const reminderRecipe = catalog.recipes.find((item) => item.id === "consultation-reminder-flow");
  assert.match(leadRecipe?.name ?? "", /visa\/relocation/i);
  assert.match(documentRecipe?.name ?? "", /visa\/relocation/i);
  assert.match(followUpRecipe?.name ?? "", /visa\/relocation/i);
  assert.match(reminderRecipe?.name ?? "", /visa\/relocation/i);
  assert.match(leadRecipe?.description ?? "", /visa/i);
  assert.match(documentRecipe?.description ?? "", /visa/i);
  assert.match(followUpRecipe?.description ?? "", /visa/i);
  assert.match(reminderRecipe?.description ?? "", /visa/i);
});

test("eval manifest and promptfoo suites are wired for translation, negotiation, research, ui safety, and red team", () => {
  const manifestPath = resolve(repoRoot, "configs", "evals", "eval-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    runner: string;
    apiKeyEnvAlias: string;
    suites: Array<{ id: string; configPath: string; outputPath: string }>;
  };

  assert.equal(manifest.runner, "promptfoo");
  assert.equal(manifest.apiKeyEnvAlias, "GOOGLE_API_KEY");

  const suiteIds = manifest.suites.map((suite) => suite.id);
  assert.deepEqual(suiteIds, ["translation", "negotiation", "research", "ui-safety", "red-team"]);

  for (const suite of manifest.suites) {
    const configPath = resolve(repoRoot, suite.configPath);
    assert.ok(existsSync(configPath), `missing promptfoo config: ${suite.configPath}`);
    const source = readFileSync(configPath, "utf8");
    assert.match(source, /google:gemini-2\.5-flash/);
    assert.match(source, /google:gemini-2\.5-pro/);
    assert.match(source, /type:\s*is-json/);
    assert.match(source, /type:\s*javascript/);
  }
});

test("eval runner and package scripts are present for local runs and release gating", () => {
  const packageJsonPath = resolve(repoRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts: Record<string, string>;
  };

  const requiredScripts = [
    "eval:promptfoo",
    "eval:promptfoo:translation",
    "eval:promptfoo:negotiation",
    "eval:promptfoo:research",
    "eval:promptfoo:ui-safety",
    "eval:promptfoo:red-team",
    "eval:promptfoo:gate",
    "eval:promptfoo:dry-run",
  ];

  for (const scriptName of requiredScripts) {
    assert.ok(packageJson.scripts[scriptName], `missing package script ${scriptName}`);
  }

  const runnerPath = resolve(repoRoot, "scripts", "eval-plane.mjs");
  assert.ok(existsSync(runnerPath), `missing eval runner: ${runnerPath}`);
  const runner = readFileSync(runnerPath, "utf8");
  assert.match(runner, /promptfoo@latest/);
  assert.match(runner, /GOOGLE_API_KEY/);
  assert.match(runner, /artifacts", "evals", "latest-run\.json/);
});

test("worker roles and eval docs are linked from the repository", () => {
  const readme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
  assert.match(readme, /docs\/worker-roles\.md/);
  assert.match(readme, /docs\/evals\.md/);
  assert.match(readme, /skills\/bundled\/lead-qualification/);
  assert.match(readme, /npm run eval:promptfoo/);
  assert.match(readme, /npm run eval:promptfoo:red-team/);
  assert.match(readme, /verify:release.*red-team summary/i);

  const rolesDoc = readFileSync(resolve(repoRoot, "docs", "worker-roles.md"), "utf8");
  assert.match(rolesDoc, /Playbook Architect/);
  assert.match(rolesDoc, /Eval Plane Engineer/);
  assert.match(rolesDoc, /Red Team Guardian/);

  const evalsDoc = readFileSync(resolve(repoRoot, "docs", "evals.md"), "utf8");
  assert.match(evalsDoc, /verify:release/);
  assert.match(evalsDoc, /non-dry-run/i);
  assert.match(evalsDoc, /red-team/i);
});
