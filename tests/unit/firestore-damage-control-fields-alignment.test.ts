import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("firestore event mapping exposes damage-control fields for operator timeline", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "firestore.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "damageControlEnabled?: boolean;",
    "damageControlVerdict?: string;",
    "damageControlSource?: string;",
    "damageControlPath?: string;",
    "damageControlMatchedRuleCount?: number;",
    "damageControlMatchRuleIds?: string[];",
    "const damageControl = output ? asRecord(output.damageControl) : null;",
    "const damageControlMatches = Array.isArray(damageControl?.matches)",
    "damageControlMatchedRuleCount =",
    "damageControlMatchRuleIds = Array.from(",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `firestore damage-control mapping missing token: ${token}`);
  }
});

