import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release evidence report helper keeps required evidence lanes and outputs", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-evidence-report.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /BadgeDetailsPath/);
  assert.match(source, /OutputJsonPath/);
  assert.match(source, /OutputMarkdownPath/);
  assert.match(source, /artifacts\/release-evidence\/report\.json/);
  assert.match(source, /artifacts\/release-evidence\/report\.md/);
  assert.match(source, /turnTruncationStatus/);
  assert.match(source, /turnDeleteStatus/);
  assert.match(source, /operatorDamageControlStatus/);
  assert.match(source, /governancePolicyStatus/);
  assert.match(source, /skillsRegistryStatus/);
  assert.match(source, /deviceNodesStatus/);
  assert.match(source, /agentUsageStatus/);
  assert.match(source, /deviceNodeUpdatesStatus/);
  assert.match(source, /updatesValidated/);
  assert.match(source, /updatesHasUpsert/);
  assert.match(source, /updatesHasHeartbeat/);
  assert.match(source, /updatesApiValidated/);
  assert.match(source, /updatesTotal/);
  assert.match(source, /\$report\.statuses\.deviceNodeUpdatesStatus = "pass"/);
  assert.match(source, /\$report\.statuses\.deviceNodeUpdatesStatus = "fail"/);
  assert.match(source, /\[release-evidence-report\] JSON:/);
  assert.match(source, /\[release-evidence-report\] Markdown:/);
});
