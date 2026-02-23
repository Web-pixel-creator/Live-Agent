import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function extractPsIntDefault(source: string, name: string): number {
  const pattern = new RegExp(`\\[int\\]\\$${name}\\s*=\\s*(\\d+)`);
  const match = source.match(pattern);
  assert.ok(match, `Failed to locate PowerShell int default for ${name}`);
  return Number(match[1]);
}

function extractWorkflowInputDefault(source: string, name: string): string {
  const pattern = new RegExp(`${name}:[\\s\\S]*?default:\\s*\"?([^\"\\n]+)\"?`, "m");
  const match = source.match(pattern);
  assert.ok(match, `Failed to locate workflow input default for ${name}`);
  return match[1].trim();
}

test("artifact source-run guard defaults stay aligned between local helper and workflow", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-artifact-revalidate.ps1");
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-artifact-revalidation.yml");
  const scriptSource = readFileSync(scriptPath, "utf8");
  const workflowSource = readFileSync(workflowPath, "utf8");

  const helperAgeHours = extractPsIntDefault(scriptSource, "MaxSourceRunAgeHours");
  const workflowAgeHours = Number(extractWorkflowInputDefault(workflowSource, "max_source_run_age_hours"));

  assert.equal(helperAgeHours, 168);
  assert.equal(workflowAgeHours, 168);
  assert.equal(helperAgeHours, workflowAgeHours, "Source run max age defaults must match");

  assert.match(scriptSource, /\[switch\]\$AllowAnySourceBranch/);
  assert.match(workflowSource, /allow_any_source_branch:/);
  assert.match(workflowSource, /allow_any_source_branch:[\s\S]*?default:\s*false/m);
});
