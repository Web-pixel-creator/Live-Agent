import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator skills registry lifecycle widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorSkillsRegistryStatus"',
    'id="operatorSkillsRegistryTotal"',
    'id="operatorSkillsRegistrySkills"',
    'id="operatorSkillsRegistryOutcomes"',
    'id="operatorSkillsRegistryLifecycle"',
    'id="operatorSkillsRegistryConflicts"',
    'id="operatorSkillsRegistryLatest"',
    'id="operatorSkillsRegistrySeenAt"',
    'id="operatorSkillsRegistryHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator skills-registry widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "setOperatorSkillsRegistryHint",
    "resetOperatorSkillsRegistryWidget",
    "renderOperatorSkillsRegistryWidget",
    "summary.skillsRegistryLifecycle",
    "skills_registry.lifecycle",
    "skills_registry.latest",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator skills-registry token: ${token}`);
  }
});

