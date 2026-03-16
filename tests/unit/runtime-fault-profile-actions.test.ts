import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRuntimeFaultProfileExecutionPlan,
  extractRuntimeFaultProfileExecutionFollowUpContext,
  normalizeRuntimeFaultProfileExecutionPhase,
  resolveRuntimeFaultProfileExecution,
} from "../../apps/api-backend/src/runtime-fault-profile-actions.ts";
import { getRuntimeFaultProfilesSnapshot } from "../../apps/api-backend/src/runtime-fault-profiles.ts";

async function getProfile(profileId: string) {
  const snapshot = await getRuntimeFaultProfilesSnapshot({
    env: process.env,
    cwd: process.cwd(),
  });
  const profile = snapshot.profiles.find((item) => item.id === profileId);
  assert.ok(profile, `expected fault profile '${profileId}' to exist`);
  return profile;
}

test("runtime fault profile execution plan supports repo-owned http post drills", async () => {
  const profile = await getProfile("gateway-drain-rejection");
  const activation = buildRuntimeFaultProfileExecutionPlan(profile, "activation");
  const recovery = buildRuntimeFaultProfileExecutionPlan(profile, "recovery");

  assert.equal(activation.supported, true);
  assert.equal(activation.support, "http_post");
  assert.equal(activation.executableService, "realtime-gateway");
  assert.equal(activation.method, "POST");
  assert.equal(activation.path, "/drain");
  assert.deepEqual(activation.requestTemplate?.body, {});
  assert.equal(recovery.supported, true);
  assert.equal(recovery.path, "/warmup");
});

test("runtime fault profile execution plan supports orchestrator control-plane drills", async () => {
  const profile = await getProfile("orchestrator-last-known-good");
  const activation = buildRuntimeFaultProfileExecutionPlan(profile, "activation");

  assert.equal(activation.supported, true);
  assert.equal(activation.support, "http_post");
  assert.equal(activation.executableService, "orchestrator");
  assert.equal(activation.path, "/workflow/control-plane-override");
  assert.match(activation.reason, /control plane/i);
});

test("runtime fault profile execution plan supports ui-executor control-plane drills", async () => {
  const profile = await getProfile("ui-executor-sandbox-audit");
  const activation = buildRuntimeFaultProfileExecutionPlan(profile, "activation");
  const recovery = buildRuntimeFaultProfileExecutionPlan(profile, "recovery");

  assert.equal(activation.supported, true);
  assert.equal(activation.support, "http_post");
  assert.equal(activation.executableService, "ui-executor");
  assert.equal(activation.path, "/runtime/control-plane-override");
  assert.equal(recovery.supported, true);
  assert.equal(recovery.path, "/runtime/control-plane-override");
});

test("runtime fault profile execution plan maps storyteller drills to orchestrator control plane", async () => {
  const profile = await getProfile("storyteller-simulated-media");
  const activation = buildRuntimeFaultProfileExecutionPlan(profile, "activation");
  const recovery = buildRuntimeFaultProfileExecutionPlan(profile, "recovery");

  assert.equal(activation.supported, true);
  assert.equal(activation.support, "http_post");
  assert.equal(activation.executableService, "orchestrator");
  assert.equal(activation.path, "/story/runtime/control-plane-override");
  assert.equal(recovery.supported, true);
  assert.equal(recovery.path, "/story/runtime/control-plane-override");
});

test("runtime fault profile execution plan exposes repo-owned gateway binding mismatch script", async () => {
  const profile = await getProfile("gateway-binding-mismatch");
  const activation = buildRuntimeFaultProfileExecutionPlan(profile, "activation");
  const execution = resolveRuntimeFaultProfileExecution(profile, "activation");

  assert.equal(activation.supported, true);
  assert.equal(activation.support, "payload_flag");
  assert.equal(activation.executableService, "api-backend");
  assert.equal(activation.method, null);
  assert.equal(activation.path, null);
  assert.equal(activation.requestTemplate, null);
  assert.equal(activation.scriptTemplate?.path, "scripts/gateway-ws-binding-mismatch-check.mjs");
  assert.ok(activation.scriptTemplate?.args.includes("--sessionId"));
  assert.equal(execution.request, null);
  assert.equal(execution.script?.path, "scripts/gateway-ws-binding-mismatch-check.mjs");
  assert.ok(execution.script?.args.includes("--timeoutMs"));
});

test("runtime fault profile execution plan supports ui approval activation through orchestrator", async () => {
  const profile = await getProfile("ui-approval-resume");
  const activation = buildRuntimeFaultProfileExecutionPlan(profile, "activation");
  const execution = resolveRuntimeFaultProfileExecution(profile, "activation", {
    sessionId: "session-123",
    userId: "operator-123",
  });

  assert.equal(activation.supported, true);
  assert.equal(activation.support, "payload_flag");
  assert.equal(activation.executableService, "orchestrator");
  assert.equal(activation.method, "POST");
  assert.equal(activation.path, "/orchestrate");
  assert.equal(activation.requestTemplate?.path, "/orchestrate");
  assert.equal(execution.request?.executableService, "orchestrator");
  assert.equal(execution.request?.path, "/orchestrate");
  const requestBody = execution.request?.body as Record<string, unknown>;
  assert.equal(requestBody.sessionId, "session-123");
  assert.equal(requestBody.userId, "operator-123");
  assert.deepEqual((requestBody.payload as Record<string, unknown>).intent, "ui_task");

  const followUpContext = extractRuntimeFaultProfileExecutionFollowUpContext(profile, "activation", execution, {
    payload: {
      output: {
        approvalId: "approval-123",
        resumeRequestTemplate: {
          input: {
            goal: "Resume UI action",
          },
        },
      },
    },
  });
  assert.deepEqual(followUpContext, {
    approvalId: "approval-123",
    sessionId: "session-123",
    userId: "operator-123",
    input: {
      goal: "Resume UI action",
    },
  });
});

test("runtime fault profile execution plan supports ui approval recovery through approvals api", async () => {
  const profile = await getProfile("ui-approval-resume");
  const recovery = buildRuntimeFaultProfileExecutionPlan(profile, "recovery");
  const missingContextExecution = resolveRuntimeFaultProfileExecution(profile, "recovery");
  const execution = resolveRuntimeFaultProfileExecution(profile, "recovery", {
    approvalId: "approval-123",
    sessionId: "session-123",
    input: {
      goal: "Resume UI action",
    },
  });

  assert.equal(recovery.supported, true);
  assert.equal(recovery.support, "operator_action");
  assert.equal(recovery.executableService, "api-backend");
  assert.equal(recovery.method, "POST");
  assert.equal(recovery.path, "/v1/approvals/resume");
  assert.deepEqual(missingContextExecution.missingContext, ["approvalId", "sessionId"]);
  assert.equal(execution.request?.executableService, "api-backend");
  assert.equal(execution.request?.path, "/v1/approvals/resume");
  const requestBody = execution.request?.body as Record<string, unknown>;
  assert.equal(requestBody.approvalId, "approval-123");
  assert.equal(requestBody.sessionId, "session-123");
  assert.equal(requestBody.decision, "approved");
  assert.equal(requestBody.intent, "ui_task");
});

test("runtime fault profiles catalog no longer has manual-only drills", async () => {
  const snapshot = await getRuntimeFaultProfilesSnapshot({
    env: process.env,
    cwd: process.cwd(),
  });
  const manualOnly = snapshot.profiles
    .filter((profile) => {
      const activation = buildRuntimeFaultProfileExecutionPlan(profile, "activation");
      const recovery = buildRuntimeFaultProfileExecutionPlan(profile, "recovery");
      return !activation.supported && !recovery.supported;
    })
    .map((profile) => profile.id);

  assert.deepEqual(manualOnly, []);
});

test("runtime fault profile execution plan treats none mode as noop", async () => {
  const profile = await getProfile("gateway-binding-mismatch");
  const recovery = buildRuntimeFaultProfileExecutionPlan(profile, "recovery");

  assert.equal(recovery.supported, true);
  assert.equal(recovery.support, "noop");
  assert.equal(recovery.method, null);
  assert.equal(recovery.path, null);
  assert.match(recovery.reason, /No runtime action is required/i);
});

test("runtime fault profile execution phase normalizer accepts route aliases", () => {
  assert.equal(normalizeRuntimeFaultProfileExecutionPhase("activation"), "activation");
  assert.equal(normalizeRuntimeFaultProfileExecutionPhase("activate"), "activation");
  assert.equal(normalizeRuntimeFaultProfileExecutionPhase("recovery"), "recovery");
  assert.equal(normalizeRuntimeFaultProfileExecutionPhase("recover"), "recovery");
  assert.equal(normalizeRuntimeFaultProfileExecutionPhase("unknown"), null);
});
