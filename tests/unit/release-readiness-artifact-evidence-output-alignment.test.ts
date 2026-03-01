import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release-readiness emits artifact source-run evidence snapshot output contract", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-readiness.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /sourceRunManifest\.gate\.evidenceSnapshot/);
  assert.match(source, /if \(\$null -ne \$manifestEvidenceSnapshot\)/);
  assert.match(source, /artifact\.source_run_manifest\.evidence: operator_turn_truncation_validated=/);
  assert.match(source, /operator_turn_delete_validated=/);
  assert.match(source, /operator_damage_control_validated=/);
  assert.match(source, /operator_damage_control_total=/);
  assert.match(source, /turn_truncation_status=/);
  assert.match(source, /turn_delete_status=/);
  assert.match(source, /operator_damage_control_status=/);
  assert.match(source, /governance_policy_status=/);
  assert.match(source, /skills_registry_status=/);
  assert.match(source, /device_nodes_status=/);
  assert.match(source, /device_node_updates_status=/);
  assert.match(source, /operator_damage_control_latest_verdict=/);
  assert.match(source, /operator_damage_control_latest_source=/);

  assert.match(source, /evidenceSnapshot\.operatorTurnTruncationSummaryValidated expected true/);
  assert.match(source, /evidenceSnapshot\.operatorTurnDeleteSummaryValidated expected true/);
  assert.match(source, /evidenceSnapshot\.operatorDamageControlSummaryValidated expected true/);
  assert.match(source, /evidenceSnapshot\.operatorDamageControlTotal expected >= 1/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceOperatorTurnTruncationStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceOperatorTurnDeleteStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceOperatorDamageControlStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceGovernancePolicyStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceSkillsRegistryStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceDeviceNodesStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceDeviceNodeUpdatesStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.operatorDamageControlLatestVerdict expected one of \[/);
  assert.match(source, /\$allowedOperatorDamageControlLatestVerdicts = @\("allow", "ask", "block"\)/);
  assert.match(source, /evidenceSnapshot\.operatorDamageControlLatestSource expected one of \[/);
  assert.match(source, /\$allowedOperatorDamageControlLatestSources = @\("default", "file", "env_json", "unknown"\)/);
});
