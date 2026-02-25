import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("firestore event mapping exposes turn-truncation fields for operator summary", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "firestore.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "turnId?: string;",
    "truncateReason?: string;",
    "truncateContentIndex?: number;",
    "truncateAudioEndMs?: number;",
    "truncateScope?: string;",
    "const turnId = toNonEmptyString(payload?.turnId) ?? undefined;",
    "const truncateReason = toNonEmptyString(payload?.reason) ?? undefined;",
    "const truncateContentIndex = toNonNegativeInt(payload?.contentIndex) ?? undefined;",
    "const truncateAudioEndMs = toNonNegativeInt(payload?.audioEndMs) ?? undefined;",
    "const truncateScope = toNonEmptyString(payload?.scope) ?? undefined;",
    "turnId,",
    "truncateReason,",
    "truncateContentIndex,",
    "truncateAudioEndMs,",
    "truncateScope,",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `firestore turn truncation mapping missing token: ${token}`);
  }
});
