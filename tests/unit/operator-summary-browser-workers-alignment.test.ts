import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes browser worker diagnostics contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "getUiExecutorBrowserJobs",
    "buildBrowserWorkersSummary",
    "const browserWorkers = buildBrowserWorkersSummary(browserJobs);",
    "browserWorkers,",
    "latestPausedJobId",
    "checkpointReady",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend operator summary missing browser worker token: ${token}`);
  }
});

