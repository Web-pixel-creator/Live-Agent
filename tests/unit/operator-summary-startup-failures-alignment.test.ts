import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes startup failure diagnostics contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "type ServiceProbeFailureType",
    "probeJsonWithTimeout",
    "buildStartupFailureSummary",
    "startupFailureCount",
    "startupBlockingFailure",
    "startupFailures: probeFailures",
    "const startupFailures = buildStartupFailureSummary(services);",
    "startupFailures,",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend operator summary contract missing token: ${token}`);
  }
});
