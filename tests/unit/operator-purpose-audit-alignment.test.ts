import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend propagates operator purpose into high-risk operator audit surfaces", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  for (const token of [
    "extractOperatorPurposeDetails",
    "withOperatorPurposeDetails",
    "parsed.operatorPurpose",
    "runtime_auth_profile_rotate",
    "workflow_control_plane_override",
    "fault_profile_execute",
    "browser_worker_resume",
    "browser_worker_cancel",
    "/v1/operator/actions",
  ]) {
    assert.ok(source.includes(token), `api backend missing operator-purpose audit token: ${token}`);
  }
});

test("docs describe operator session ops and purpose-gated audit trail", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");

  assert.match(readme, /Operator Session Ops/);
  assert.match(readme, /operatorPurpose/);
  assert.match(readme, /\/v1\/sessions/);
  assert.match(readme, /\/v1\/skills\/personas/);
  assert.match(operatorGuide, /Operator Session Ops/);
  assert.match(operatorGuide, /operatorPurpose/);
  assert.match(operatorGuide, /high-risk operator actions/i);
  assert.match(architecture, /purpose-gated high-risk actions/i);
});
