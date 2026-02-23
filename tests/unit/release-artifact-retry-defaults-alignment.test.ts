import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function extractPsDefault(source: string, name: string): number {
  const pattern = new RegExp(`\\[int\\]\\$${name}\\s*=\\s*(\\d+)`);
  const match = source.match(pattern);
  assert.ok(match, `Failed to locate PowerShell default for ${name}`);
  return Number(match[1]);
}

function extractWorkflowInputDefault(source: string, name: string): number {
  const pattern = new RegExp(`${name}:[\\s\\S]*?default:\\s*\"(\\d+)\"`, "m");
  const match = source.match(pattern);
  assert.ok(match, `Failed to locate workflow input default for ${name}`);
  return Number(match[1]);
}

test("artifact revalidation retry defaults stay aligned between local helper and workflow", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-artifact-revalidate.ps1");
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-artifact-revalidation.yml");
  const scriptSource = readFileSync(scriptPath, "utf8");
  const workflowSource = readFileSync(workflowPath, "utf8");

  const helperAttempts = extractPsDefault(scriptSource, "GithubApiMaxAttempts");
  const helperBackoff = extractPsDefault(scriptSource, "GithubApiRetryBackoffMs");

  const workflowAttempts = extractWorkflowInputDefault(workflowSource, "github_api_max_attempts");
  const workflowBackoff = extractWorkflowInputDefault(workflowSource, "github_api_retry_backoff_ms");

  assert.equal(helperAttempts, workflowAttempts, "Retry attempt defaults must match");
  assert.equal(helperBackoff, workflowBackoff, "Retry backoff defaults must match");
  assert.equal(helperAttempts, 3);
  assert.equal(helperBackoff, 1200);
});
