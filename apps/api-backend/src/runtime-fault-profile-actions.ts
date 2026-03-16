import { randomUUID } from "node:crypto";
import type {
  RuntimeFaultAction,
  RuntimeFaultActionMode,
  RuntimeFaultProfile,
  RuntimeFaultProfileService,
} from "./runtime-fault-profiles.js";

export type RuntimeFaultProfileExecutionPhase = "activation" | "recovery";

export type RuntimeFaultProfileExecutionSupport =
  | "http_post"
  | "payload_flag"
  | "operator_action"
  | "manual"
  | "noop";

export type RuntimeFaultProfileExecutableService =
  | "realtime-gateway"
  | "api-backend"
  | "orchestrator"
  | "ui-executor";

export type RuntimeFaultProfileExecutionContextField = {
  key: string;
  required: boolean;
  description: string;
  example: unknown;
};

export type RuntimeFaultProfileExecutionRequestTemplate = {
  method: "POST";
  path: string;
  body: unknown;
};

export type RuntimeFaultProfileExecutionScriptTemplate = {
  runtime: "node";
  path: string;
  args: string[];
};

export type RuntimeFaultProfileExecutionPlan = {
  phase: RuntimeFaultProfileExecutionPhase;
  support: RuntimeFaultProfileExecutionSupport;
  supported: boolean;
  requiresAdmin: boolean;
  actionMode: RuntimeFaultActionMode;
  service: RuntimeFaultProfileService;
  executableService: RuntimeFaultProfileExecutableService | null;
  method: "POST" | null;
  path: string | null;
  target: string;
  value: string | null;
  reason: string;
  instructions: string[];
  requiredContext: RuntimeFaultProfileExecutionContextField[];
  requestTemplate: RuntimeFaultProfileExecutionRequestTemplate | null;
  scriptTemplate: RuntimeFaultProfileExecutionScriptTemplate | null;
};

export type RuntimeFaultProfileExecutionResolvedRequest = {
  executableService: RuntimeFaultProfileExecutableService;
  method: "POST";
  path: string;
  body: unknown;
};

export type RuntimeFaultProfileExecutionResolvedScript = {
  runtime: "node";
  path: string;
  args: string[];
};

export type RuntimeFaultProfileExecutionResolution = {
  plan: RuntimeFaultProfileExecutionPlan;
  missingContext: string[];
  request: RuntimeFaultProfileExecutionResolvedRequest | null;
  script: RuntimeFaultProfileExecutionResolvedScript | null;
};

const DEFAULT_GATEWAY_BINDING_MISMATCH_WS_URL = "ws://localhost:8080/realtime";
const DEFAULT_GATEWAY_BINDING_MISMATCH_TIMEOUT_MS = 15000;
const DEFAULT_UI_APPROVAL_USER_ID = "runtime-fault-operator";
const DEFAULT_UI_APPROVAL_INPUT = {
  goal: "Open a payment page and submit order with card details.",
  url: "https://example.com",
  screenshotRef: "ui://demo/start",
  formData: {
    email: "buyer@example.com",
    note: "Order request from runtime fault profile",
  },
  maxSteps: 6,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function getContextValue(context: Record<string, unknown>, key: string): unknown {
  return context[key];
}

function hasRequiredContextValue(context: Record<string, unknown>, field: RuntimeFaultProfileExecutionContextField): boolean {
  const value = getContextValue(context, field.key);
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== undefined && value !== null;
}

function parseActionValue(value: string | null): unknown {
  const raw = toNonEmptyString(value);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {
      value: raw,
    };
  }
}

function resolveExecutableService(
  service: RuntimeFaultProfileService,
): RuntimeFaultProfileExecutableService | null {
  switch (service) {
    case "realtime-gateway":
    case "api-backend":
    case "orchestrator":
    case "ui-executor":
      return service;
    case "storyteller-agent":
      return "orchestrator";
    default:
      return null;
  }
}

function getAction(
  profile: RuntimeFaultProfile,
  phase: RuntimeFaultProfileExecutionPhase,
): RuntimeFaultAction {
  return phase === "activation" ? profile.activation : profile.recovery;
}

function buildManualInstructions(
  action: RuntimeFaultAction,
  phase: RuntimeFaultProfileExecutionPhase,
): string[] {
  switch (action.mode) {
    case "payload_flag":
      return [
        `Inject request payload override at '${action.target}'.`,
        action.value ? `Use value '${action.value}' while running the drill.` : `Run the drill with the target override enabled.`,
      ];
    case "env_toggle":
      return [
        `Set runtime config '${action.target}'.`,
        action.value ? `Apply value '${action.value}' and reload or restart the target service.` : `Clear or restore the setting before rerunning probes.`,
      ];
    case "operator_action":
      return [
        `Use the operator flow '${action.target}'.`,
        action.value ? `Complete the operator step with verdict/value '${action.value}'.` : `Complete the operator step manually before validating evidence.`,
      ];
    case "http_post":
      return [
        `POST '${action.target}' on the target service control plane.`,
        `This ${phase} step is not mapped to an executable repo-owned service base URL.`,
      ];
    case "none":
    default:
      return [`No runtime action is required for the ${phase} step.`];
  }
}

function buildGatewayBindingMismatchPlan(
  profile: RuntimeFaultProfile,
  phase: RuntimeFaultProfileExecutionPhase,
  action: RuntimeFaultAction,
): RuntimeFaultProfileExecutionPlan | null {
  if (profile.id !== "gateway-binding-mismatch" || phase !== "activation") {
    return null;
  }

  return {
    phase,
    support: "payload_flag",
    supported: true,
    requiresAdmin: true,
    actionMode: action.mode,
    service: profile.service,
    executableService: "api-backend",
    method: null,
    path: null,
    target: action.target,
    value: action.value,
    reason:
      "API can execute this activation by running the repo-owned websocket binding mismatch check locally.",
    instructions: [
      "Run the repo-owned websocket binding mismatch check script.",
      "Validate session/user mismatch codes and error-correlation evidence from the script result.",
    ],
    requiredContext: [
      {
        key: "wsUrl",
        required: false,
        description: "Gateway websocket URL.",
        example: DEFAULT_GATEWAY_BINDING_MISMATCH_WS_URL,
      },
      {
        key: "sessionId",
        required: false,
        description: "Existing or synthetic session id for the probe.",
        example: "runtime-fault-binding-session",
      },
      {
        key: "runId",
        required: false,
        description: "Base run id used by the probe.",
        example: "runtime-fault-binding-run",
      },
      {
        key: "userId",
        required: false,
        description: "Bound user id for the probe.",
        example: "runtime-fault-user",
      },
      {
        key: "timeoutMs",
        required: false,
        description: "Timeout passed to the probe script.",
        example: DEFAULT_GATEWAY_BINDING_MISMATCH_TIMEOUT_MS,
      },
    ],
    requestTemplate: null,
    scriptTemplate: {
      runtime: "node",
      path: "scripts/gateway-ws-binding-mismatch-check.mjs",
      args: [
        "--url",
        "$context.wsUrl ?? ws://localhost:8080/realtime",
        "--sessionId",
        "$context.sessionId ?? auto",
        "--runId",
        "$context.runId ?? auto",
        "--userId",
        "$context.userId ?? demo-user",
        "--timeoutMs",
        "$context.timeoutMs ?? 15000",
      ],
    },
  };
}

function buildUiApprovalActivationTemplate(): RuntimeFaultProfileExecutionRequestTemplate {
  return {
    method: "POST",
    path: "/orchestrate",
    body: {
      id: "$generated.uuid",
      userId: "$context.userId ?? runtime-fault-operator",
      sessionId: "$context.sessionId ?? generated-session-id",
      runId: "$context.runId ?? generated-run-id",
      type: "orchestrator.request",
      source: "frontend",
      ts: "$generated.isoTimestamp",
      payload: {
        intent: "ui_task",
        input: "$context.input ?? runtimeFaultDefaults.uiApprovalSensitiveAction",
      },
    },
  };
}

function buildUiApprovalActivationPlan(
  profile: RuntimeFaultProfile,
  phase: RuntimeFaultProfileExecutionPhase,
  action: RuntimeFaultAction,
): RuntimeFaultProfileExecutionPlan | null {
  if (profile.id !== "ui-approval-resume" || phase !== "activation") {
    return null;
  }

  return {
    phase,
    support: "payload_flag",
    supported: true,
    requiresAdmin: true,
    actionMode: action.mode,
    service: profile.service,
    executableService: "orchestrator",
    method: "POST",
    path: "/orchestrate",
    target: action.target,
    value: action.value,
    reason:
      "API can execute this activation by POSTing a deterministic approval-required ui_task request to orchestrator.",
    instructions: [
      "POST '/orchestrate' on 'orchestrator' with a sensitive ui_task payload.",
      "Capture approvalId and resumeRequestTemplate.input from the response for the recovery step.",
    ],
    requiredContext: [
      {
        key: "sessionId",
        required: false,
        description: "Session id for the approval drill.",
        example: "runtime-fault-ui-approval-session",
      },
      {
        key: "runId",
        required: false,
        description: "Run id for the activation request.",
        example: "runtime-fault-ui-approval-run",
      },
      {
        key: "userId",
        required: false,
        description: "Operator or synthetic user id.",
        example: DEFAULT_UI_APPROVAL_USER_ID,
      },
      {
        key: "input",
        required: false,
        description: "Optional ui_task input override; defaults to the repo-owned sensitive-action payload.",
        example: DEFAULT_UI_APPROVAL_INPUT,
      },
    ],
    requestTemplate: buildUiApprovalActivationTemplate(),
    scriptTemplate: null,
  };
}

function buildUiApprovalRecoveryTemplate(action: RuntimeFaultAction): RuntimeFaultProfileExecutionRequestTemplate {
  return {
    method: "POST",
    path: "/v1/approvals/resume",
    body: {
      approvalId: "$context.approvalId",
      sessionId: "$context.sessionId",
      runId: "$context.runId ?? generated-run-id",
      userId: "$context.userId ?? runtime-fault-operator",
      decision: action.value ?? "approved",
      reason: "$context.reason ?? fault profile approval resume",
      intent: "ui_task",
      input: "$context.input ?? runtimeFaultDefaults.uiApprovalSensitiveAction",
    },
  };
}

function buildUiApprovalRecoveryPlan(
  profile: RuntimeFaultProfile,
  phase: RuntimeFaultProfileExecutionPhase,
  action: RuntimeFaultAction,
): RuntimeFaultProfileExecutionPlan | null {
  if (profile.id !== "ui-approval-resume" || phase !== "recovery" || action.target !== "approval_control.approve_resume") {
    return null;
  }

  return {
    phase,
    support: "operator_action",
    supported: true,
    requiresAdmin: true,
    actionMode: action.mode,
    service: profile.service,
    executableService: "api-backend",
    method: "POST",
    path: "/v1/approvals/resume",
    target: action.target,
    value: action.value,
    reason:
      "API can execute this recovery step by POSTing an approval resume decision through the repo-owned approvals API.",
    instructions: [
      "POST '/v1/approvals/resume' on 'api-backend' with approvalId/sessionId from the activation step.",
      "Use followUpContext from the activation response when chaining the recovery step.",
    ],
    requiredContext: [
      {
        key: "approvalId",
        required: true,
        description: "Approval id returned by the activation step.",
        example: "approval-runtime-fault-ui-approval",
      },
      {
        key: "sessionId",
        required: true,
        description: "Session id used by the activation step.",
        example: "runtime-fault-ui-approval-session",
      },
      {
        key: "input",
        required: false,
        description: "Optional resume input; defaults to the repo-owned sensitive-action payload.",
        example: DEFAULT_UI_APPROVAL_INPUT,
      },
      {
        key: "runId",
        required: false,
        description: "Optional run id for the recovery step.",
        example: "runtime-fault-ui-approval-recovery",
      },
      {
        key: "userId",
        required: false,
        description: "Optional actor id for the recovery step.",
        example: DEFAULT_UI_APPROVAL_USER_ID,
      },
      {
        key: "reason",
        required: false,
        description: "Optional operator rationale stored with the approval decision.",
        example: "Approved from runtime fault profile.",
      },
    ],
    requestTemplate: buildUiApprovalRecoveryTemplate(action),
    scriptTemplate: null,
  };
}

function buildPayloadFlagExecutablePlan(
  profile: RuntimeFaultProfile,
  phase: RuntimeFaultProfileExecutionPhase,
  action: RuntimeFaultAction,
): RuntimeFaultProfileExecutionPlan | null {
  return buildGatewayBindingMismatchPlan(profile, phase, action) ?? buildUiApprovalActivationPlan(profile, phase, action);
}

function buildOperatorActionExecutablePlan(
  profile: RuntimeFaultProfile,
  phase: RuntimeFaultProfileExecutionPhase,
  action: RuntimeFaultAction,
): RuntimeFaultProfileExecutionPlan | null {
  return buildUiApprovalRecoveryPlan(profile, phase, action);
}

export function normalizeRuntimeFaultProfileExecutionPhase(
  value: unknown,
): RuntimeFaultProfileExecutionPhase | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "activation" || normalized === "activate") {
    return "activation";
  }
  if (normalized === "recovery" || normalized === "recover") {
    return "recovery";
  }
  return null;
}

export function buildRuntimeFaultProfileExecutionPlan(
  profile: RuntimeFaultProfile,
  phase: RuntimeFaultProfileExecutionPhase,
): RuntimeFaultProfileExecutionPlan {
  const action = getAction(profile, phase);
  const executableService = resolveExecutableService(profile.service);

  if (action.mode === "none") {
    return {
      phase,
      support: "noop",
      supported: true,
      requiresAdmin: true,
      actionMode: action.mode,
      service: profile.service,
      executableService,
      method: null,
      path: null,
      target: action.target,
      value: action.value,
      reason: `No runtime action is required for ${phase}; the profile returns to baseline without an extra control-plane call.`,
      instructions: buildManualInstructions(action, phase),
      requiredContext: [],
      requestTemplate: null,
      scriptTemplate: null,
    };
  }

  if (action.mode === "http_post" && executableService && action.target.startsWith("/")) {
    return {
      phase,
      support: "http_post",
      supported: true,
      requiresAdmin: true,
      actionMode: action.mode,
      service: profile.service,
      executableService,
      method: "POST",
      path: action.target,
      target: action.target,
      value: action.value,
      reason: `API can execute this ${phase} step by POSTing '${action.target}' to the ${executableService} control plane.`,
      instructions: [
        `POST '${action.target}' on '${executableService}'.`,
        "Validate expected signals and evidence after the request completes.",
      ],
      requiredContext: [],
      requestTemplate: {
        method: "POST",
        path: action.target,
        body: parseActionValue(action.value),
      },
      scriptTemplate: null,
    };
  }

  if (action.mode === "payload_flag") {
    const executablePlan = buildPayloadFlagExecutablePlan(profile, phase, action);
    if (executablePlan) {
      return executablePlan;
    }
  }

  if (action.mode === "operator_action") {
    const executablePlan = buildOperatorActionExecutablePlan(profile, phase, action);
    if (executablePlan) {
      return executablePlan;
    }
  }

  let reason = `This ${phase} step requires manual handling.`;
  if (action.mode === "payload_flag") {
    reason = `This ${phase} step is request-scoped and requires payload mutation rather than a service-level control-plane call.`;
  } else if (action.mode === "env_toggle") {
    reason = `This ${phase} step requires an env/config override plus reload or restart of the target service.`;
  } else if (action.mode === "operator_action") {
    reason = `This ${phase} step depends on a higher-level operator action instead of a direct service HTTP endpoint.`;
  } else if (action.mode === "http_post") {
    reason = `This ${phase} step points to an HTTP control path, but the service is not mapped to an executable repo-owned base URL.`;
  }

  return {
    phase,
    support: "manual",
    supported: false,
    requiresAdmin: true,
    actionMode: action.mode,
    service: profile.service,
    executableService,
    method: null,
    path: null,
    target: action.target,
    value: action.value,
    reason,
    instructions: buildManualInstructions(action, phase),
    requiredContext: [],
    requestTemplate: null,
    scriptTemplate: null,
  };
}

function buildGatewayBindingMismatchExecution(context: Record<string, unknown>): RuntimeFaultProfileExecutionResolvedScript {
  const wsUrl = toNonEmptyString(context.wsUrl) ?? DEFAULT_GATEWAY_BINDING_MISMATCH_WS_URL;
  const sessionId = toNonEmptyString(context.sessionId) ?? `runtime-fault-binding-session-${randomUUID()}`;
  const runId = toNonEmptyString(context.runId) ?? `runtime-fault-binding-run-${randomUUID()}`;
  const userId = toNonEmptyString(context.userId) ?? "demo-user";
  const timeoutMs = toPositiveInt(context.timeoutMs, DEFAULT_GATEWAY_BINDING_MISMATCH_TIMEOUT_MS);

  return {
    runtime: "node",
    path: "scripts/gateway-ws-binding-mismatch-check.mjs",
    args: [
      "--url",
      wsUrl,
      "--sessionId",
      sessionId,
      "--runId",
      runId,
      "--userId",
      userId,
      "--timeoutMs",
      String(timeoutMs),
    ],
  };
}

function buildUiApprovalInput(context: Record<string, unknown>): Record<string, unknown> {
  return isRecord(context.input) ? context.input : DEFAULT_UI_APPROVAL_INPUT;
}

function buildUiApprovalActivationRequest(context: Record<string, unknown>): RuntimeFaultProfileExecutionResolvedRequest {
  const sessionId = toNonEmptyString(context.sessionId) ?? `runtime-fault-ui-approval-session-${randomUUID()}`;
  const runId = toNonEmptyString(context.runId) ?? `runtime-fault-ui-approval-run-${randomUUID()}`;
  const userId = toNonEmptyString(context.userId) ?? DEFAULT_UI_APPROVAL_USER_ID;
  const input = buildUiApprovalInput(context);

  return {
    executableService: "orchestrator",
    method: "POST",
    path: "/orchestrate",
    body: {
      id: randomUUID(),
      userId,
      sessionId,
      runId,
      type: "orchestrator.request",
      source: "frontend",
      ts: new Date().toISOString(),
      payload: {
        intent: "ui_task",
        input,
      },
    },
  };
}

function buildUiApprovalRecoveryRequest(
  context: Record<string, unknown>,
  action: RuntimeFaultAction,
): RuntimeFaultProfileExecutionResolvedRequest | null {
  const approvalId = toNonEmptyString(context.approvalId);
  const sessionId = toNonEmptyString(context.sessionId);
  if (!approvalId || !sessionId) {
    return null;
  }

  const runId = toNonEmptyString(context.runId) ?? `runtime-fault-ui-approval-recovery-${randomUUID()}`;
  const userId = toNonEmptyString(context.userId) ?? DEFAULT_UI_APPROVAL_USER_ID;
  const reason =
    toNonEmptyString(context.reason) ??
    (action.value === "approved" ? "Approved from runtime fault profile." : "Rejected from runtime fault profile.");

  return {
    executableService: "api-backend",
    method: "POST",
    path: "/v1/approvals/resume",
    body: {
      approvalId,
      sessionId,
      runId,
      userId,
      decision: action.value ?? "approved",
      reason,
      intent: "ui_task",
      input: buildUiApprovalInput(context),
    },
  };
}

export function resolveRuntimeFaultProfileExecution(
  profile: RuntimeFaultProfile,
  phase: RuntimeFaultProfileExecutionPhase,
  context: Record<string, unknown> = {},
): RuntimeFaultProfileExecutionResolution {
  const action = getAction(profile, phase);
  const plan = buildRuntimeFaultProfileExecutionPlan(profile, phase);
  const missingContext = plan.requiredContext
    .filter((field) => field.required && !hasRequiredContextValue(context, field))
    .map((field) => field.key);

  if (!plan.supported || plan.support === "noop") {
    return {
      plan,
      missingContext,
      request: null,
      script: null,
    };
  }

  if (profile.id === "gateway-binding-mismatch" && phase === "activation") {
    return {
      plan,
      missingContext,
      request: null,
      script: buildGatewayBindingMismatchExecution(context),
    };
  }

  if (profile.id === "ui-approval-resume" && phase === "activation") {
    return {
      plan,
      missingContext,
      request: buildUiApprovalActivationRequest(context),
      script: null,
    };
  }

  if (profile.id === "ui-approval-resume" && phase === "recovery" && action.target === "approval_control.approve_resume") {
    return {
      plan,
      missingContext,
      request: missingContext.length === 0 ? buildUiApprovalRecoveryRequest(context, action) : null,
      script: null,
    };
  }

  if (plan.requestTemplate && plan.executableService && plan.path) {
    return {
      plan,
      missingContext,
      request: {
        executableService: plan.executableService,
        method: plan.requestTemplate.method,
        path: plan.path,
        body: parseActionValue(plan.value),
      },
      script: null,
    };
  }

  return {
    plan,
    missingContext,
    request: null,
    script: null,
  };
}

function getNestedValue(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[key];
  }
  return current;
}

export function extractRuntimeFaultProfileExecutionFollowUpContext(
  profile: RuntimeFaultProfile,
  phase: RuntimeFaultProfileExecutionPhase,
  execution: RuntimeFaultProfileExecutionResolution,
  result: unknown,
): Record<string, unknown> | null {
  if (profile.id !== "ui-approval-resume" || phase !== "activation" || !execution.request) {
    return null;
  }

  const requestBody = isRecord(execution.request.body) ? execution.request.body : null;
  if (!requestBody) {
    return null;
  }

  const approvalId = toNonEmptyString(getNestedValue(result, ["payload", "output", "approvalId"]));
  if (!approvalId) {
    return null;
  }

  const sessionId = toNonEmptyString(requestBody.sessionId);
  if (!sessionId) {
    return null;
  }

  const resumeInput = getNestedValue(result, ["payload", "output", "resumeRequestTemplate", "input"]);

  return {
    approvalId,
    sessionId,
    userId: toNonEmptyString(requestBody.userId) ?? DEFAULT_UI_APPROVAL_USER_ID,
    input: isRecord(resumeInput)
      ? resumeInput
      : isRecord(getNestedValue(requestBody, ["payload", "input"]))
        ? (getNestedValue(requestBody, ["payload", "input"]) as Record<string, unknown>)
        : DEFAULT_UI_APPROVAL_INPUT,
  };
}
