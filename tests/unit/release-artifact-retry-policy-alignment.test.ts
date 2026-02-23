import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const EXPECTED_CODES = [408, 429, 500, 502, 503, 504];

test("artifact revalidation retryable status-code policy stays aligned", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-artifact-revalidate.ps1");
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-artifact-revalidation.yml");
  const scriptSource = readFileSync(scriptPath, "utf8");
  const workflowSource = readFileSync(workflowPath, "utf8");

  for (const code of EXPECTED_CODES) {
    assert.match(scriptSource, new RegExp(`\\b${code}\\b`), `Local helper missing retryable status ${code}`);
    assert.match(workflowSource, new RegExp(`\\b${code}\\b`), `Workflow missing retryable status ${code}`);
  }

  assert.match(scriptSource, /Is-RetryableStatusCode/);
  assert.match(workflowSource, /retryableStatuses/);
  assert.match(workflowSource, /function Is-RetryableStatusCode/);
});
