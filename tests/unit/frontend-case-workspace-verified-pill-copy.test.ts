import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace routes verified completed-work pills through the explicit verified helper", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");

  assert.ok(
    appSource.includes("function getCaseWorkspaceVerifiedResultPill(isRu)") &&
      appSource.includes('return { text: isRu ? "\\u041f\\u0440\\u043e\\u0432\\u0435\\u0440\\u0435\\u043d\\u043e" : "Verified", tone: "ok" };'),
    "app.js should define one explicit verified pill helper with the readable RU badge",
  );

  const normalizedMatches = appSource.match(/sharedCompletedWork && sharedCompletedWork\.length > 0\s+\? getCaseWorkspaceVerifiedResultPill\(isRu\)\s+: defaultSnapshot\.completedPill;/g) ?? [];
  const staleMatches = appSource.match(/completedPill: sharedCompletedPill,/g) ?? [];
  assert.equal(normalizedMatches.length, 1, "shared completed-work pill should route through the verified helper");
  assert.equal(staleMatches.length, 10, "verified case snapshots should keep reusing the shared completed pill");
});
