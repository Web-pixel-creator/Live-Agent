import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e research summary uses inline researchData validation in final capability gate", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "demo-e2e.ps1"), "utf8");

  assert.match(source, /-Name "live\.research"/);
  assert.match(source, /researchMetadataValidated = if \(/);
  assert.match(source, /researchData\.citationCount/);
  assert.match(source, /researchData\.sourceUrlCount/);
  assert.doesNotMatch(source, /\$researchMetadataValidated -eq \$true/);
});
