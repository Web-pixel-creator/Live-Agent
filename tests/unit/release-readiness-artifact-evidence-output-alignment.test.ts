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
  assert.match(source, /operator_damage_control_status=/);
  assert.match(source, /operator_damage_control_latest_verdict=/);
  assert.match(source, /operator_damage_control_latest_source=/);
});
