import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..", "..");
const appSource = fs.readFileSync(path.join(repoRoot, "apps/demo-frontend/public/app.js"), "utf8");
const readmeSource = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const operatorGuideSource = fs.readFileSync(path.join(repoRoot, "docs/operator-guide.md"), "utf8");

test("focused evidence flips dormant action meta by refresh posture", () => {
  const tokens = [
    '"Reseed approval signals if the queue still looks empty."',
    '"Open the approval queue after the first refresh."',
    '"Refresh runtime proof again if trace posture drifts."',
    '"Open runtime diagnostics after the first refresh."',
    '"Refresh governance proof again if audit posture changes."',
    '"Open audit proof after the first refresh."',
    '"Refresh again if the current lane needs fresher proof."',
    '"Open the current workspace proof path."',
    '"Open the current workspace after the first refresh."',
  ];

  for (const token of tokens) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant action refresh-meta token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant `Focused Evidence` CTA meta lines now also flip with refresh posture"),
    "README should document refresh-aware dormant action meta copy",
  );
  assert.ok(
    readmeSource.includes("generic post-refresh dormant CTA meta now also says `workspace` instead of `lane`"),
    "README should document workspace-first dormant CTA wording",
  );

  assert.ok(
    operatorGuideSource.includes("dormant `Focused Evidence` CTA meta lines now also flip with refresh posture"),
    "operator guide should document refresh-aware dormant action meta copy",
  );
  assert.ok(
    operatorGuideSource.includes("generic post-refresh dormant CTA meta now also says `workspace` instead of `lane`"),
    "operator guide should document workspace-first dormant CTA wording",
  );
});
