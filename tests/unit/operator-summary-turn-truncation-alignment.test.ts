import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes turn truncation evidence contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "buildTurnTruncationSummary",
    'event.type !== "live.turn.truncated"',
    "const turnTruncation = buildTurnTruncationSummary(recentEvents, services);",
    "turnTruncation,",
    'source: "gateway_runtime"',
    'status: "observed"',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend turn truncation summary contract missing token: ${token}`);
  }
});
