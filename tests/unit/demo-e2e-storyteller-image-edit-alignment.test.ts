import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e storyteller image-edit summary uses inline storyData validation in final capability gate", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "demo-e2e.ps1"), "utf8");

  assert.match(source, /image_edit/);
  assert.match(source, /storytellerImageEditContractValidated = if \(/);
  assert.match(source, /storyData\.imageEditProvider/);
  assert.match(source, /storyData\.imageEditModel/);
  assert.doesNotMatch(source, /\$storytellerImageEditContractValidated -eq \$true/);
});
