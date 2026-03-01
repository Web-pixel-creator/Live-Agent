import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const REQUIRED_MANIFEST_KEYS = [
  "schemaVersion",
  "generatedAt",
  "repository",
  "sourceRun",
  "artifact",
  "sourceSelection",
  "gate",
  "retry",
];

const REQUIRED_EVIDENCE_SNAPSHOT_KEYS = [
  "evidenceSnapshot",
  "operatorTurnTruncationSummaryValidated",
  "operatorTurnDeleteSummaryValidated",
  "operatorDamageControlSummaryValidated",
  "operatorDamageControlTotal",
  "operatorDamageControlLatestVerdict",
  "operatorDamageControlLatestSource",
  "operatorDamageControlLatestSeenAt",
  "badgeEvidenceOperatorDamageControlStatus",
  "badgeEvidenceGovernancePolicyStatus",
  "badgeEvidenceSkillsRegistryStatus",
];

test("source-run manifest schema stays aligned between local helper and workflow", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-artifact-revalidate.ps1");
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-artifact-revalidation.yml");
  const scriptSource = readFileSync(scriptPath, "utf8");
  const workflowSource = readFileSync(workflowPath, "utf8");

  assert.match(scriptSource, /release-artifact-revalidation/);
  assert.match(scriptSource, /source-run\.json/);
  assert.match(workflowSource, /release-artifact-revalidation/);
  assert.match(workflowSource, /source-run\.json/);

  for (const key of REQUIRED_MANIFEST_KEYS) {
    assert.match(scriptSource, new RegExp(`\\b${key}\\b`), `Local helper manifest missing key '${key}'`);
    assert.match(workflowSource, new RegExp(`\\b${key}\\b`), `Workflow manifest missing key '${key}'`);
  }

  assert.match(scriptSource, /retryableStatusCodes/);
  assert.match(workflowSource, /retryableStatusCodes/);
  for (const key of REQUIRED_EVIDENCE_SNAPSHOT_KEYS) {
    assert.match(scriptSource, new RegExp(`\\b${key}\\b`), `Local helper manifest missing evidence key '${key}'`);
    assert.match(workflowSource, new RegExp(`\\b${key}\\b`), `Workflow manifest missing evidence key '${key}'`);
  }
  assert.match(scriptSource, /Source run manifest written/);
  assert.match(workflowSource, /Source run manifest written/);
});
