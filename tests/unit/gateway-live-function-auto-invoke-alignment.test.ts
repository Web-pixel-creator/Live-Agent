import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("gateway wires realtime function-call auto dispatch with guardrails and audit events", () => {
  const gatewayPath = resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts");
  const source = readFileSync(gatewayPath, "utf8");

  assert.match(source, /LIVE_FUNCTION_AUTO_INVOKE/);
  assert.match(source, /LIVE_FUNCTION_ALLOWLIST/);
  assert.match(source, /function resolveFunctionCallIntent\(functionName: string\)/);
  assert.match(source, /type:\s*"live\.function_call\.dispatching"/);
  assert.match(source, /type:\s*"live\.function_call\.completed"/);
  assert.match(source, /type:\s*"live\.function_call\.failed"/);
  assert.match(source, /input\.sandboxPolicyMode = liveFunctionUiSandboxMode/);
  assert.match(source, /input\.approvalConfirmed = false/);
  assert.match(source, /type:\s*"live\.function_call_output"/);
  assert.match(source, /autoDispatch:\s*"gateway_auto_invoke"/);
});

test("frontend avoids duplicate function output when gateway auto dispatch is enabled", () => {
  const frontendPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const source = readFileSync(frontendPath, "utf8");

  assert.match(source, /autoDispatchMode === "gateway_auto_invoke"/);
  assert.match(source, /Function call requested: .*dispatch=gateway/);
});

