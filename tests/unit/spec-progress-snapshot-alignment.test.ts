import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("spec progress snapshot reflects current packaging-pass validation without stale pinned counts", () => {
  const progressPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "progress.md");
  const progress = readFileSync(progressPath, "utf8");
  const topSnapshot = progress.split("## Implemented Hardening Highlights")[0] ?? progress;

  assert.match(topSnapshot, /Date:\s*2026-03-08/);
  assert.match(
    topSnapshot,
    /docs\/spec packaging aligned with current baseline; npm run test:unit \+ npm run build green/
  );
  assert.match(topSnapshot, /`npm run test:unit` passes\./);
  assert.match(topSnapshot, /`npm run build` passes\./);
  assert.match(topSnapshot, /Historical note:/);

  assert.doesNotMatch(topSnapshot, /`npm run verify:release` passes end-to-end\./);
  assert.doesNotMatch(topSnapshot, /Demo e2e policy gate is green with `193` checks\./);
  assert.doesNotMatch(topSnapshot, /Unit tests are green \(`329` tests passed\)\./);
});
