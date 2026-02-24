import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("artifact provenance guardrails stay aligned across readiness gate and manifest producers", () => {
  const readinessPath = resolve(process.cwd(), "scripts", "release-readiness.ps1");
  const helperPath = resolve(process.cwd(), "scripts", "release-artifact-revalidate.ps1");
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-artifact-revalidation.yml");

  const readinessSource = readFileSync(readinessPath, "utf8");
  const helperSource = readFileSync(helperPath, "utf8");
  const workflowSource = readFileSync(workflowPath, "utf8");

  assert.match(readinessSource, /sourceRun\.conclusion expected success/i);
  assert.match(readinessSource, /sourceSelection\.allowedBranches is required when allowAnySourceBranch=false/i);
  assert.match(readinessSource, /sourceRun\.branch not in allowlist/i);
  assert.match(readinessSource, /sourceRun\.ageHours expected <=/i);
  assert.match(readinessSource, /maxSourceRunAgeHours/i);

  assert.match(helperSource, /conclusion\s*=\s*\$resolvedRunConclusion/);
  assert.match(helperSource, /allowAnySourceBranch\s*=\s*\[bool\]\$AllowAnySourceBranch/);
  assert.match(helperSource, /allowedBranches\s*=\s*\$AllowedBranches/);
  assert.match(helperSource, /maxSourceRunAgeHours\s*=\s*\$MaxSourceRunAgeHours/);
  assert.match(helperSource, /branch\s*=\s*\$resolvedRunBranch/);
  assert.match(helperSource, /ageHours\s*=\s*\$runAgeHoursRounded/);

  assert.match(workflowSource, /core\.setOutput\("source_run_conclusion"/);
  assert.match(workflowSource, /conclusion\s*=\s*"\$\{\{\s*steps\.resolve_source\.outputs\.source_run_conclusion\s*\}\}"/);
  assert.match(workflowSource, /allowAnySourceBranch\s*=\s*"\$\{\{\s*steps\.resolve_source\.outputs\.allow_any_source_branch\s*\}\}"/);
  assert.match(workflowSource, /allowedBranches\s*=\s*@\("main", "master"\)/);
  assert.match(workflowSource, /maxSourceRunAgeHours\s*=\s*"\$\{\{\s*steps\.resolve_source\.outputs\.max_source_run_age_hours\s*\}\}"/);
  assert.match(workflowSource, /branch\s*=\s*"\$\{\{\s*steps\.resolve_source\.outputs\.source_run_branch\s*\}\}"/);
  assert.match(workflowSource, /ageHours\s*=\s*"\$\{\{\s*steps\.resolve_source\.outputs\.source_run_age_hours\s*\}\}"/);
});
