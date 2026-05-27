import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createEnvelope, type OrchestratorRequest } from "../shared/contracts/src/index.js";
import { runUiNavigatorAgent } from "../agents/ui-navigator-agent/src/index.ts";

type VisaFlowScenario = {
  name: "booking" | "reminder" | "handoff" | "escalation";
  goal: string;
  urlPath: string;
  summary: string;
  domSnapshot: string;
  accessibilityTree: string;
  markHints: string[];
  refMap: Record<string, { selector: string; kind: string; label: string; aliases: string[] }>;
  prepareTarget: string;
  submitTarget: string;
  confirmationTarget: string;
};

type BrowserJobApiResponse = {
  data?: {
    job?: {
      jobId?: string;
      status?: string;
      totalSteps?: number;
      adapterNotes?: string[];
      session?: {
        mode?: string | null;
        persistenceRequested?: boolean | null;
        persistenceEnabled?: boolean | null;
        status?: string | null;
        notes?: string[] | null;
      } | null;
      trace?: unknown[];
      replayBundle?: {
        verification?: {
          state?: string | null;
          requested?: boolean | null;
          completedVerifySteps?: number | null;
        } | null;
        recovery?: {
          checkpointCount?: number | null;
          resumedCheckpointCount?: number | null;
          staleRefCount?: number | null;
          healedRefCount?: number | null;
          staleRefTargets?: unknown[];
          healedRefTargets?: unknown[];
          summary?: string | null;
        } | null;
        latestResultRef?: string | null;
      } | null;
    } | null;
    runtime?: {
      recovery?: {
        resumedCheckpointCount?: number | null;
        staleRefCount?: number | null;
        healedRefCount?: number | null;
      } | null;
      queue?: {
        checkpointReady?: number | null;
      } | null;
    } | null;
  };
};

type UiExecutorHealthResponse = {
  runtime?: {
    browserWorkers?: {
      queue?: {
        checkpointReady?: number | null;
      } | null;
    } | null;
  } | null;
};

export type VisaFlowResult = {
  name: string;
  url: string;
  jobId: string;
  executionMode: "real_playwright" | "simulated";
  actionPlanSteps: number;
  blockedPlanSteps: number;
  finalStatus: string;
  pausedStatus: string;
  persistentSessionReady: boolean;
  persistentSessionReleased: boolean;
  verificationState: string | null;
  verificationRequested: boolean;
  completedVerifySteps: number;
  checkpointCount: number;
  resumedCheckpointCount: number;
  staleRefCount: number;
  healedRefCount: number;
  staleRefTargets: string[];
  healedRefTargets: string[];
  runtimeResumedCheckpointCount: number;
  runtimeStaleRefCount: number;
  runtimeHealedRefCount: number;
  checkpointReadyCleared: boolean;
  replayBundlePresent: boolean;
  traceCount: number;
  latestResultRef: string | null;
  summary: string | null;
  success: boolean;
};

export type NavigatorVisaFlowValidationMode =
  | "real_playwright"
  | "simulated"
  | "mixed"
  | "unknown";

export type VisaFlowSummary = {
  validated: boolean;
  validationMode: NavigatorVisaFlowValidationMode;
  realPlaywrightValidated: boolean;
  simulatedValidated: boolean;
  strictPersistentSessionValidated: boolean;
  executionModeCounts: {
    real_playwright: number;
    simulated: number;
    unknown: number;
  };
  totalFlows: number;
  succeededFlows: number;
  successRate: number;
  persistentSessionCount: number;
  replayBundleCount: number;
  verifiedCount: number;
  staleRecoveryObservedCount: number;
  healedRecoveryObservedCount: number;
  resumedCheckpointCount: number;
  checkpointReadyClearedCount: number;
  scenarioNames: string[];
  results: VisaFlowResult[];
  summary: string;
};

export type ConsultationBookingApprovedArtifact = {
  schemaVersion: string;
  generatedAt: string;
  artifactType: "consultation_booking_approved";
  product: string;
  workflow: "consultation_booking";
  scenarioName: "booking";
  status: "approved";
  approvalStatus: "approved";
  approvalBoundaryRespected: boolean;
  bookingFlowValidated: boolean;
  calendarWritebackCompleted: boolean;
  clientName: string;
  caseId: string;
  service: string;
  timezone: string;
  preferredSlot: string;
  backupSlot: string;
  evidence: {
    navigatorVisaFlowsPath: string | null;
    latestResultRef: string | null;
    jobId: string;
    verificationState: string | null;
    checkpointCount: number;
    resumedCheckpointCount: number;
    replayBundlePresent: boolean;
    summary: string | null;
  };
};

type ParsedArgs = {
  frontendBaseUrl: string;
  uiExecutorBaseUrl: string;
  timeoutMs: number;
  outputPath: string | null;
};

const browserWorkerCheckpointEverySteps = 2;

const visaFlowScenarios: VisaFlowScenario[] = [
  {
    name: "booking",
    goal:
      "Open the visa consultation booking demo page, prepare Anna Petrova's consultation booking from the provided summary, stop before the protected calendar confirmation step, and wait for approval.",
    urlPath: "/ui-task-visa-booking-demo.html",
    summary: [
      "full_name: Anna Petrova",
      "email: anna.petrova@example.com",
      "service: Initial consultation",
      "preferred_timezone: Europe/Madrid",
      "requested_window: Tomorrow afternoon",
      "backup_slot: Tomorrow 17:00",
    ].join("\n"),
    domSnapshot:
      "<main><section id='protected-booking-boundary'><button id='prepare-booking-btn' type='button'>Prepare booking draft</button><button id='confirm-booking-btn' type='button' disabled>Confirm booking for approval</button></section><section id='approved-booking-confirmation' data-state='approved'><h3>Approved booking confirmation</h3></section></main>",
    accessibilityTree:
      "main > section[name=protected booking boundary] > button[name=Prepare booking draft] > button[name=Confirm booking for approval disabled] > section[name=approved booking confirmation]",
    markHints: [
      "prepare-booking-btn@(240,460)",
      "confirm-booking-btn@(540,460)",
      "approved-booking-confirmation@(260,610)",
    ],
    refMap: {
      "prepare-booking-btn": {
        selector: "#legacy-prepare-booking-btn",
        kind: "button",
        label: "Prepare booking draft",
        aliases: ["prepare booking", "prepare consultation booking"],
      },
      "confirm-booking-btn": {
        selector: "#legacy-confirm-booking-btn",
        kind: "submit",
        label: "Confirm booking for approval",
        aliases: ["confirm booking for approval", "protected calendar confirmation step"],
      },
    },
    prepareTarget: "ref:prepare-booking-btn",
    submitTarget: "ref:confirm-booking-btn",
    confirmationTarget: "css:#approved-booking-confirmation[data-state='approved']",
  },
  {
    name: "reminder",
    goal:
      "Open the visa reminder demo page, prepare Anna Petrova's consultation reminder from the provided summary, stop before the protected send step, and wait for approval.",
    urlPath: "/ui-task-visa-reminder-demo.html",
    summary: [
      "full_name: Anna Petrova",
      "email: anna.petrova@example.com",
      "booking_slot: Tomorrow 16:00",
      "prep_items: passport originals, proof of address, intake questionnaire",
    ].join("\n"),
    domSnapshot:
      "<main><section id='protected-reminder-boundary'><button id='prepare-reminder-btn' type='button'>Prepare reminder draft</button><button id='send-reminder-btn' type='button' disabled>Send reminder for approval</button></section><section id='approved-reminder-confirmation' data-state='approved'><h3>Approved reminder confirmation</h3></section></main>",
    accessibilityTree:
      "main > section[name=protected reminder boundary] > button[name=Prepare reminder draft] > button[name=Send reminder for approval disabled] > section[name=approved reminder confirmation]",
    markHints: [
      "prepare-reminder-btn@(240,470)",
      "send-reminder-btn@(520,470)",
      "approved-reminder-confirmation@(260,620)",
    ],
    refMap: {
      "prepare-reminder-btn": {
        selector: "#legacy-prepare-reminder-btn",
        kind: "button",
        label: "Prepare reminder draft",
        aliases: ["prepare reminder", "consultation reminder draft"],
      },
      "send-reminder-btn": {
        selector: "#legacy-send-reminder-btn",
        kind: "submit",
        label: "Send reminder for approval",
        aliases: ["send reminder for approval", "protected send step"],
      },
    },
    prepareTarget: "ref:prepare-reminder-btn",
    submitTarget: "ref:send-reminder-btn",
    confirmationTarget: "css:#approved-reminder-confirmation[data-state='approved']",
  },
  {
    name: "handoff",
    goal:
      "Open the visa CRM handoff demo page, prepare Anna Petrova's CRM update handoff from the provided summary, stop before the protected writeback step, and wait for approval.",
    urlPath: "/ui-task-visa-handoff-demo.html",
    summary: [
      "full_name: Anna Petrova",
      "email: anna.petrova@example.com",
      "crm_owner: Sofia Kim",
      "writeback_payload: crm note, case owner assignment, checklist handoff, next-touch date",
    ].join("\n"),
    domSnapshot:
      "<main><section id='protected-crm-boundary'><button id='prepare-crm-note-btn' type='button'>Prepare CRM note</button><button id='commit-crm-update-btn' type='button' disabled>Commit CRM update for approval</button></section><section id='approved-crm-confirmation' data-state='approved'><h3>Approved CRM handoff confirmation</h3></section></main>",
    accessibilityTree:
      "main > section[name=protected crm boundary] > button[name=Prepare CRM note] > button[name=Commit CRM update for approval disabled] > section[name=approved crm confirmation]",
    markHints: [
      "prepare-crm-note-btn@(240,430)",
      "commit-crm-update-btn@(540,430)",
      "approved-crm-confirmation@(260,580)",
    ],
    refMap: {
      "prepare-crm-note-btn": {
        selector: "#legacy-prepare-crm-note-btn",
        kind: "button",
        label: "Prepare CRM note",
        aliases: ["prepare crm note", "prepare crm update"],
      },
      "commit-crm-update-btn": {
        selector: "#legacy-commit-crm-update-btn",
        kind: "submit",
        label: "Commit CRM update for approval",
        aliases: ["commit crm update", "protected writeback step"],
      },
    },
    prepareTarget: "ref:prepare-crm-note-btn",
    submitTarget: "ref:commit-crm-update-btn",
    confirmationTarget: "css:#approved-crm-confirmation[data-state='approved']",
  },
  {
    name: "escalation",
    goal:
      "Open the visa escalation demo page, prepare Anna Petrova's case escalation from the provided summary, stop before the protected human handoff step, and wait for approval.",
    urlPath: "/ui-task-visa-escalation-demo.html",
    summary: [
      "full_name: Anna Petrova",
      "email: anna.petrova@example.com",
      "human_owner: Sofia Kim",
      "handoff_queue: Visa Escalations Tier 2",
    ].join("\n"),
    domSnapshot:
      "<main><section id='protected-step-boundary'><button id='prepare-escalation-btn' type='button'>Prepare escalation packet</button><button id='approval-required-btn' type='button' disabled>Send for human approval</button></section><section id='approved-confirmation' data-state='approved'><h3>Approved handoff confirmation</h3></section></main>",
    accessibilityTree:
      "main > section[name=protected step boundary] > button[name=Prepare escalation packet] > button[name=Send for human approval disabled] > section[name=approved handoff confirmation]",
    markHints: [
      "prepare-escalation-btn@(240,450)",
      "approval-required-btn@(540,450)",
      "approved-confirmation@(260,600)",
    ],
    refMap: {
      "prepare-escalation-btn": {
        selector: "#legacy-prepare-escalation-btn",
        kind: "button",
        label: "Prepare escalation packet",
        aliases: ["prepare escalation", "prepare escalation packet"],
      },
      "approval-required-btn": {
        selector: "#legacy-approval-required-btn",
        kind: "submit",
        label: "Send for human approval",
        aliases: ["send for human approval", "protected human handoff step"],
      },
    },
    prepareTarget: "ref:prepare-escalation-btn",
    submitTarget: "ref:approval-required-btn",
    confirmationTarget: "css:#approved-confirmation[data-state='approved']",
  },
];

function parseArgs(argv: string[]): ParsedArgs {
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      result.set(key, "true");
      continue;
    }
    result.set(key, value);
    index += 1;
  }

  return {
    frontendBaseUrl: (result.get("frontendBaseUrl") ?? "http://localhost:3000").replace(/\/+$/, ""),
    uiExecutorBaseUrl: (result.get("uiExecutorBaseUrl") ?? "http://localhost:8090").replace(/\/+$/, ""),
    timeoutMs: Math.max(15_000, Number(result.get("timeoutMs") ?? 60_000)),
    outputPath: result.get("output") ?? null,
  };
}

function resolveSiblingOutputPath(outputPath: string | null, fileName: string): string | null {
  if (!outputPath) {
    return null;
  }
  const resolvedOutputPath = resolve(outputPath);
  return resolve(dirname(resolvedOutputPath), fileName);
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function assertEqualWithContext(actual: unknown, expected: unknown, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}. expected=${formatValue(expected)} actual=${formatValue(actual)}`);
  }
}

function assertOneOfWithContext(actual: unknown, expected: unknown[], message: string): void {
  if (!expected.some((entry) => Object.is(actual, entry))) {
    throw new Error(
      `${message}. expectedOneOf=${formatValue(expected)} actual=${formatValue(actual)}`,
    );
  }
}

function withEnv(overrides: Record<string, string | null>, runner: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(overrides)) {
    previous.set(name, process.env[name]);
    if (value === null) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  return runner().finally(() => {
    for (const [name, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });
}

async function requestJson(url: string, init?: RequestInit): Promise<BrowserJobApiResponse> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const rawText = await response.text();
  const payload = rawText.length > 0 ? (JSON.parse(rawText) as BrowserJobApiResponse) : {};
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${rawText}`);
  }
  return payload;
}

async function getCheckpointReadyCount(uiExecutorBaseUrl: string): Promise<number> {
  const response = await fetch(`${uiExecutorBaseUrl}/healthz`);
  const rawText = await response.text();
  const payload = rawText.length > 0 ? (JSON.parse(rawText) as UiExecutorHealthResponse) : {};
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${rawText}`);
  }
  return Math.max(0, Number(payload.runtime?.browserWorkers?.queue?.checkpointReady ?? 0));
}

async function waitForBrowserJobState(
  uiExecutorBaseUrl: string,
  jobId: string,
  statuses: string[],
  timeoutMs: number,
  predicate?: (response: BrowserJobApiResponse) => boolean,
  describeLastObservation?: (response: BrowserJobApiResponse) => string,
): Promise<BrowserJobApiResponse> {
  const deadline = Date.now() + timeoutMs;
  let lastResponse: BrowserJobApiResponse | null = null;
  while (Date.now() < deadline) {
    const response = await requestJson(`${uiExecutorBaseUrl}/browser-jobs/${encodeURIComponent(jobId)}`);
    lastResponse = response;
    const status = response.data?.job?.status ?? "unknown";
    if (statuses.includes(status) && (predicate ? predicate(response) : true)) {
      return response;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }

  const lastStatus = lastResponse?.data?.job?.status ?? "unknown";
  const observationSummary =
    describeLastObservation && lastResponse ? describeLastObservation(lastResponse) : null;
  const observationSuffix = observationSummary ? `. ${observationSummary}` : "";
  throw new Error(
    `Timed out waiting for browser job ${jobId} to reach ${statuses.join(
      ", ",
    )}. Last status: ${lastStatus}${observationSuffix}`,
  );
}

/**
 * Infers whether a browser-job run was executed under real Playwright or under
 * the ui-executor's simulation fallback. The discriminator is read from
 * `adapterNotes`, which the ui-executor service emits for every executed step
 * (see `apps/ui-executor/src/index.ts` `simulateExecution()` and the real
 * Playwright path). The browser-job public response carries `adapterNotes`
 * after each step, so the visa flows scenario reads it via a probe poll.
 *
 * Detection rule (exact regex per design.md):
 *   simulated when any note matches /Forced simulation|Playwright unavailable in ui-executor|Simulated browser session/i
 *   real_playwright otherwise.
 */
export function inferExecutionMode(
  adapterNotes: string[],
): "real_playwright" | "simulated" {
  return adapterNotes.some((note) =>
    /Forced simulation|Playwright unavailable in ui-executor|Simulated browser session/i.test(note),
  )
    ? "simulated"
    : "real_playwright";
}

// Side-effect: publish `inferExecutionMode` on `globalThis` so the preservation
// PBT block in `tests/unit/demo-e2e-navigator-visa-flows.test.ts` flips its
// `typeof inferExecutionMode === "function"` activation gate to truthy once
// this module is imported by the test file. The test file does not import the
// helper directly (per the bugfix tasks' "do not modify tests" constraint
// during Task 3.2), so the global publish is the import-time bridge that
// activates Property 2 (real-Playwright preservation) without touching the
// test file. Pure-function publish — no leaked state.
(globalThis as { inferExecutionMode?: typeof inferExecutionMode }).inferExecutionMode =
  inferExecutionMode;

/**
 * Infers the `NavigatorVisaFlowValidationMode` from a set of `VisaFlowResult`
 * entries. The discriminator is the per-result `executionMode` field, which
 * the runtime self-reports honestly via the probe-poll path in `runScenario`
 * (see `inferExecutionMode` above). The rule is the literal contract from
 * `design.md` "Proposed Contract":
 *
 *   - `results.length === 0` → `"unknown"`.
 *   - any `result.executionMode` outside the strict union
 *     (`"real_playwright"` | `"simulated"`) → `"unknown"`.
 *   - every `result.executionMode === "real_playwright"` → `"real_playwright"`.
 *   - every `result.executionMode === "simulated"` → `"simulated"`.
 *   - otherwise (mix of the two valid modes) → `"mixed"`.
 *
 * Downstream gates and tests can branch on declared mode without
 * re-implementing the rule. The helper is also published on `globalThis`
 * (mirroring the `inferExecutionMode` publish) so the summary preservation
 * PBT activation gate (`typeof inferNavigatorVisaFlowValidationMode === "function"`)
 * flips on at module-import time without forcing the test file to import the
 * helper directly.
 */
export function inferNavigatorVisaFlowValidationMode(
  results: VisaFlowResult[],
): NavigatorVisaFlowValidationMode {
  if (results.length === 0) {
    return "unknown";
  }
  let realCount = 0;
  let simulatedCount = 0;
  for (const result of results) {
    if (result.executionMode === "real_playwright") {
      realCount += 1;
    } else if (result.executionMode === "simulated") {
      simulatedCount += 1;
    } else {
      return "unknown";
    }
  }
  if (realCount === results.length) {
    return "real_playwright";
  }
  if (simulatedCount === results.length) {
    return "simulated";
  }
  return "mixed";
}

// Side-effect: publish `inferNavigatorVisaFlowValidationMode` on `globalThis`
// so the summary preservation PBT block in
// `tests/unit/demo-e2e-navigator-visa-flows.test.ts` flips its
// `typeof inferNavigatorVisaFlowValidationMode === "function"` activation
// gate to truthy once this module is imported by the test file. Mirrors the
// `inferExecutionMode` publish above. Pure-function publish — no leaked state.
(globalThis as {
  inferNavigatorVisaFlowValidationMode?: typeof inferNavigatorVisaFlowValidationMode;
}).inferNavigatorVisaFlowValidationMode = inferNavigatorVisaFlowValidationMode;

function toActionPlan(output: unknown): Array<Record<string, unknown>> {
  if (!output || typeof output !== "object") {
    return [];
  }
  const actionPlan = (output as { actionPlan?: unknown }).actionPlan;
  return Array.isArray(actionPlan)
    ? actionPlan.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    : [];
}

function createScenarioRequest(
  scenario: VisaFlowScenario,
  frontendBaseUrl: string,
  runIdSuffix: string,
  approved: boolean,
): OrchestratorRequest {
  const goal = approved ? scenario.goal.replace("stop before", "continue through") : scenario.goal;
  return createEnvelope({
    userId: "demo-e2e-user",
    sessionId: `navigator-visa-${scenario.name}-session`,
    runId: `navigator-visa-${scenario.name}-${runIdSuffix}`,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "ui_task",
      input: {
        goal,
        url: `${frontendBaseUrl}${scenario.urlPath}`,
        summary: scenario.summary,
        domSnapshot: scenario.domSnapshot,
        accessibilityTree: scenario.accessibilityTree,
        markHints: scenario.markHints,
        refMap: scenario.refMap,
        approvalConfirmed: approved,
        approvalDecision: approved ? "approved" : null,
        approvalReason: approved ? "Reviewed and approved the protected demo step." : null,
        browserWorker: approved
          ? {
              enabled: true,
              checkpointEverySteps: browserWorkerCheckpointEverySteps,
              label: `demo navigator visa flow ${scenario.name}`,
            }
          : undefined,
      },
    },
  }) as OrchestratorRequest;
}

async function runScenario(
  scenario: VisaFlowScenario,
  frontendBaseUrl: string,
  uiExecutorBaseUrl: string,
  timeoutMs: number,
): Promise<VisaFlowResult> {
  const checkpointReadyBaseline = await getCheckpointReadyCount(uiExecutorBaseUrl);
  const blockedResponse = await runUiNavigatorAgent(
    createScenarioRequest(scenario, frontendBaseUrl, "blocked", false),
  );
  assertOneOfWithContext(
    blockedResponse.payload.status,
    ["accepted", "completed"],
    `${scenario.name} blocked request should stay non-failing`,
  );
  const blockedOutput = blockedResponse.payload.output;
  const blockedPlan = toActionPlan(blockedOutput);
  assertEqualWithContext(
    (blockedOutput as { approvalRequired?: unknown }).approvalRequired,
    true,
    `${scenario.name} blocked request should require approval before protected action`,
  );
  assert.ok(
    blockedPlan.some((action) => action.type === "click" && action.target === scenario.prepareTarget),
    `${scenario.name} blocked plan should click the prepare action`,
  );
  assert.ok(
    !blockedPlan.some((action) => action.type === "click" && action.target === scenario.submitTarget),
    `${scenario.name} blocked plan should not click the protected submit action`,
  );

  const approvedResponse = await runUiNavigatorAgent(
    createScenarioRequest(scenario, frontendBaseUrl, "approved", true),
  );
  assertOneOfWithContext(
    approvedResponse.payload.status,
    ["accepted", "completed"],
    `${scenario.name} approved request should complete or stage cleanly`,
  );
  const approvedOutput = approvedResponse.payload.output as {
    browserWorker?: { jobId?: string | null } | null;
    actionPlan?: unknown;
  };
  const approvedPlan = toActionPlan(approvedOutput);
  const jobId = approvedOutput.browserWorker?.jobId ?? null;
  assert.ok(jobId, `${scenario.name} browser-worker submission should return a jobId`);
  assert.ok(
    approvedPlan.some((action) => action.type === "click" && action.target === scenario.prepareTarget),
    `${scenario.name} approved plan should click the prepare action`,
  );
  assert.ok(
    approvedPlan.some((action) => action.type === "verify"),
    `${scenario.name} approved plan should include a verification step`,
  );

  // Probe poll: bounded fraction of the overall scenario timeout. Wait for the
  // job to advance past "queued" so the runtime has a chance to record at least
  // one adapterNote. We do not gate on "paused" here because a fast simulation
  // run can land on "completed" before this loop fires; we accept any
  // post-queued status. The probe captures `adapterNotes` from the public
  // browser-job response (set by ui-executor's browser-jobs runner after each
  // executed step), which is the discriminator input for `inferExecutionMode`.
  const probeTimeoutMs = Math.min(timeoutMs, 10_000);
  const probeResponse = await waitForBrowserJobState(
    uiExecutorBaseUrl,
    jobId,
    ["running", "paused", "completed", "failed"],
    probeTimeoutMs,
  );
  const probeJob = probeResponse.data?.job;
  const probeAdapterNotes = Array.isArray(probeJob?.adapterNotes)
    ? probeJob.adapterNotes.filter((note): note is string => typeof note === "string")
    : [];
  const executionMode = inferExecutionMode(probeAdapterNotes);

  // Paused-state poll: the predicate is execution-mode-aware. Real-Playwright
  // runs keep the strict persistent-session proof (preservation of the
  // production assertion set). Simulated runs use a relaxed predicate that
  // does NOT require persistenceEnabled === true, because the simulation lane
  // never holds a real persistent session.
  const pausedResponse = await waitForBrowserJobState(
    uiExecutorBaseUrl,
    jobId,
    ["paused"],
    timeoutMs,
    (response) => {
      const session = response.data?.job?.session;
      if (executionMode === "simulated") {
        return session?.mode === "resumable" && session?.persistenceRequested === true;
      }
      return (
        session?.mode === "resumable" &&
        session?.persistenceEnabled === true &&
        (session?.status === "ready" || session?.status === "active")
      );
    },
    (response) => {
      const session = response.data?.job?.session;
      const observed =
        `predicate (executionMode=${executionMode}) observed ` +
        `mode=${session?.mode ?? "<missing>"}, ` +
        `persistenceRequested=${session?.persistenceRequested ?? "<missing>"}, ` +
        `persistenceEnabled=${session?.persistenceEnabled ?? "<missing>"}, ` +
        `status=${session?.status ?? "<missing>"}; `;
      const required =
        executionMode === "simulated"
          ? "required mode=resumable AND persistenceRequested=true"
          : "required mode=resumable AND persistenceEnabled=true AND status\u2208{ready, active}";
      return observed + required;
    },
  );
  const pausedJob = pausedResponse.data?.job;
  assertEqualWithContext(pausedJob?.status, "paused", `${scenario.name} job should pause before resume`);
  assertEqualWithContext(
    pausedJob?.session?.mode,
    "resumable",
    `${scenario.name} should use a resumable browser session`,
  );
  if (executionMode === "real_playwright") {
    // Strict persistent-session proof preserved on the real-Playwright lane.
    assertEqualWithContext(
      pausedJob?.session?.persistenceEnabled,
      true,
      `${scenario.name} should persist the browser session while paused`,
    );
    assert.ok(
      pausedJob?.session?.status === "ready" || pausedJob?.session?.status === "active",
      `${scenario.name} paused session should be ready for resume`,
    );
  } else {
    // Simulated lane: assert the simulation-mode markers. The simulation lane
    // does not hold a real persistent session, so `persistenceEnabled` stays
    // false; what we DO assert is that the runtime requested persistence and
    // self-identified the session as simulated via the explicit notes marker.
    assertEqualWithContext(
      pausedJob?.session?.persistenceRequested,
      true,
      `${scenario.name} simulated browser session should request persistence`,
    );
    const simulationNotes = Array.isArray(pausedJob?.session?.notes)
      ? pausedJob.session.notes
      : [];
    assert.ok(
      simulationNotes.some(
        (note: unknown) => typeof note === "string" && /Simulated browser session/i.test(note),
      ),
      `${scenario.name} simulated browser session should carry the simulation marker note`,
    );
  }

  await requestJson(`${uiExecutorBaseUrl}/browser-jobs/${encodeURIComponent(jobId)}/resume`, {
    method: "POST",
    body: JSON.stringify({ reason: `Resume visa navigator flow ${scenario.name} for proof.` }),
  });

  const completedResponse = await waitForBrowserJobState(uiExecutorBaseUrl, jobId, ["completed"], timeoutMs, (response) => {
    const completedJob = response.data?.job;
    const replayBundle = completedJob?.replayBundle;
    return (
      completedJob?.session?.status === "released" &&
      replayBundle?.verification?.state === "verified" &&
      typeof replayBundle?.latestResultRef === "string" &&
      replayBundle.latestResultRef.trim().length > 0
    );
  });
  const completedJob = completedResponse.data?.job;
  const completedRuntime = completedResponse.data?.runtime;
  const replayBundle = completedJob?.replayBundle;
  const recovery = replayBundle?.recovery;
  const verification = replayBundle?.verification;
  const session = completedJob?.session;
  const staleRefTargets = Array.isArray(recovery?.staleRefTargets)
    ? recovery.staleRefTargets.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const healedRefTargets = Array.isArray(recovery?.healedRefTargets)
    ? recovery.healedRefTargets.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

  assertEqualWithContext(completedJob?.status, "completed", `${scenario.name} job should complete after resume`);
  assertEqualWithContext(session?.mode, "resumable", `${scenario.name} completed session should keep resumable mode`);
  assertEqualWithContext(session?.status, "released", `${scenario.name} completed session should be released`);
  assertEqualWithContext(verification?.state, "verified", `${scenario.name} replay bundle should finish verified`);
  assert.ok(replayBundle?.latestResultRef, `${scenario.name} replay bundle should expose a result artifact ref`);

  const checkpointCount = Math.max(0, Number(recovery?.checkpointCount ?? 0));
  const resumedCheckpointCount = Math.max(0, Number(recovery?.resumedCheckpointCount ?? 0));
  const staleRefCount = Math.max(0, Number(recovery?.staleRefCount ?? 0));
  const healedRefCount = Math.max(0, Number(recovery?.healedRefCount ?? 0));
  const completedVerifySteps = Math.max(0, Number(verification?.completedVerifySteps ?? 0));
  const runtimeResumedCheckpointCount = Math.max(
    0,
    Number(completedRuntime?.recovery?.resumedCheckpointCount ?? 0),
  );
  const runtimeStaleRefCount = Math.max(0, Number(completedRuntime?.recovery?.staleRefCount ?? 0));
  const runtimeHealedRefCount = Math.max(0, Number(completedRuntime?.recovery?.healedRefCount ?? 0));
  const checkpointReadyFinal = Math.max(0, Number(completedRuntime?.queue?.checkpointReady ?? checkpointReadyBaseline));
  const checkpointReadyCleared = checkpointReadyFinal <= checkpointReadyBaseline;
  const traceCount = Array.isArray(completedJob?.trace) ? completedJob.trace.length : 0;

  const success =
    completedJob?.status === "completed" &&
    session?.status === "released" &&
    checkpointCount >= 1 &&
    resumedCheckpointCount >= 1 &&
    staleRefCount >= 1 &&
    healedRefCount >= 1 &&
    staleRefTargets.includes(scenario.prepareTarget.slice("ref:".length)) &&
    healedRefTargets.includes(scenario.prepareTarget.slice("ref:".length)) &&
    completedVerifySteps >= 1 &&
    checkpointReadyCleared &&
    runtimeResumedCheckpointCount >= resumedCheckpointCount &&
    runtimeStaleRefCount >= staleRefCount &&
    runtimeHealedRefCount >= healedRefCount &&
    traceCount >= 3;

  return {
    name: scenario.name,
    url: `${frontendBaseUrl}${scenario.urlPath}`,
    jobId,
    executionMode,
    actionPlanSteps: approvedPlan.length,
    blockedPlanSteps: blockedPlan.length,
    finalStatus: completedJob?.status ?? "unknown",
    pausedStatus: pausedJob?.status ?? "unknown",
    persistentSessionReady:
      (pausedJob?.session?.status === "ready" || pausedJob?.session?.status === "active") &&
      pausedJob?.session?.persistenceEnabled === true,
    persistentSessionReleased: session?.status === "released",
    verificationState: verification?.state ?? null,
    verificationRequested: verification?.requested === true,
    completedVerifySteps,
    checkpointCount,
    resumedCheckpointCount,
    staleRefCount,
    healedRefCount,
    staleRefTargets,
    healedRefTargets,
    runtimeResumedCheckpointCount,
    runtimeStaleRefCount,
    runtimeHealedRefCount,
    checkpointReadyCleared,
    replayBundlePresent: Boolean(replayBundle),
    traceCount,
    latestResultRef: replayBundle?.latestResultRef ?? null,
    summary: typeof recovery?.summary === "string" && recovery.summary.trim().length > 0 ? recovery.summary : null,
    success,
  };
}

/**
 * Builds a `VisaFlowSummary` from per-flow `VisaFlowResult` entries. The
 * summary is the artifact JSON that downstream gates (`scripts/demo-e2e.ps1`,
 * `scripts/release-readiness.ps1`, `scripts/release-evidence-report.ps1`)
 * consume to decide whether the navigator visa proof has met the contract
 * for the active workflow.
 *
 * The summary is execution-mode-aware. Per `design.md` "Proposed Contract":
 *
 *   - `validationMode` is inferred via `inferNavigatorVisaFlowValidationMode`
 *     from the per-result `executionMode` field.
 *   - `realPlaywrightValidated` follows `design.md` "Real-Playwright
 *     Criteria" and is BYTE-IDENTICAL to today's strict rule
 *     (`totalFlows >= 3 && every counter === totalFlows` over
 *     `succeededFlows`, `persistentSessionCount`, `replayBundleCount`,
 *     `verifiedCount`, `staleRecoveryObservedCount`,
 *     `healedRecoveryObservedCount`, `resumedCheckpointCount`). No
 *     real-Playwright assertion is weakened.
 *   - `simulatedValidated` follows `design.md` "Simulation Criteria":
 *     `totalFlows >= 3 && succeededFlows === totalFlows && every result has
 *     executionMode === "simulated" && finalStatus === "completed" &&
 *     pausedStatus === "paused"`. Simulation criteria DO NOT increment
 *     `persistentSessionCount` or `replayBundleCount` — those counters keep
 *     their existing definition (real persistent-session proof, real replay
 *     bundle proof) and naturally compute to 0 on the simulation lane.
 *   - `strictPersistentSessionValidated` is `true` iff every result has both
 *     `persistentSessionReady === true` and `persistentSessionReleased ===
 *     true`, INDEPENDENT of `validationMode`. Release-strict gates read this
 *     field after Task 3.2 lands so they always require real
 *     persistent-session evidence regardless of the declared mode.
 *   - `validated` (RETAINED for backward compatibility with the existing
 *     artifact consumers) now mirrors the declared validation mode:
 *     `real_playwright` → `realPlaywrightValidated`,
 *     `simulated` → `simulatedValidated`, `mixed`/`unknown` → `false`. PR
 *     Quality may read `validated && validationMode === "simulated"`
 *     honestly; release-strict gates must depend on
 *     `strictPersistentSessionValidated`.
 *   - `executionModeCounts` reports the per-mode tally drawn from the
 *     per-result `executionMode` field; `real_playwright` counts results
 *     with `executionMode === "real_playwright"`, `simulated` counts
 *     `"simulated"`, and `unknown` counts every other value (including
 *     `undefined`, `null`, or out-of-union strings).
 *
 * All existing fields are preserved unchanged in name, type, and meaning.
 * The artifact JSON gains five new fields; no caller's interface is broken.
 */
export function summarizeNavigatorVisaFlowResults(results: VisaFlowResult[]): VisaFlowSummary {
  const totalFlows = results.length;
  const succeededFlows = results.filter((result) => result.success).length;
  const persistentSessionCount = results.filter(
    (result) => result.persistentSessionReady && result.persistentSessionReleased,
  ).length;
  const replayBundleCount = results.filter((result) => result.replayBundlePresent).length;
  const verifiedCount = results.filter((result) => result.verificationState === "verified").length;
  const staleRecoveryObservedCount = results.filter((result) => result.staleRefCount >= 1).length;
  const healedRecoveryObservedCount = results.filter((result) => result.healedRefCount >= 1).length;
  const resumedCheckpointCount = results.filter((result) => result.resumedCheckpointCount >= 1).length;
  const checkpointReadyClearedCount = results.filter((result) => result.checkpointReadyCleared).length;
  const successRate = totalFlows > 0 ? Number((succeededFlows / totalFlows).toFixed(6)) : 0;

  const validationMode = inferNavigatorVisaFlowValidationMode(results);
  const realPlaywrightModeCount = results.filter(
    (result) => result.executionMode === "real_playwright",
  ).length;
  const simulatedModeCount = results.filter(
    (result) => result.executionMode === "simulated",
  ).length;
  const executionModeCounts = {
    real_playwright: realPlaywrightModeCount,
    simulated: simulatedModeCount,
    unknown: totalFlows - realPlaywrightModeCount - simulatedModeCount,
  };

  // Real-Playwright Criteria — BYTE-IDENTICAL to the pre-fix strict rule.
  const realPlaywrightValidated =
    totalFlows >= 3 &&
    succeededFlows === totalFlows &&
    persistentSessionCount === totalFlows &&
    replayBundleCount === totalFlows &&
    verifiedCount === totalFlows &&
    staleRecoveryObservedCount === totalFlows &&
    healedRecoveryObservedCount === totalFlows &&
    resumedCheckpointCount === totalFlows;

  // Simulation Criteria — honest about absence of real persistent session
  // and replay bundle. Does NOT inflate `persistentSessionCount` or
  // `replayBundleCount`; those counters keep their existing definition.
  const simulatedValidated =
    totalFlows >= 3 &&
    succeededFlows === totalFlows &&
    results.every((result) => result.executionMode === "simulated") &&
    results.every((result) => result.finalStatus === "completed") &&
    results.every((result) => result.pausedStatus === "paused");

  // Independent of validationMode: release-strict gates read this field
  // after Task 3.2 lands so they always require real persistent-session
  // evidence regardless of declared mode.
  const strictPersistentSessionValidated =
    totalFlows > 0 &&
    results.every(
      (result) => result.persistentSessionReady === true && result.persistentSessionReleased === true,
    );

  // `validated` mirrors the declared validation mode. Documented in the
  // JSDoc above. Mixed/unknown defaults to false until a deliberate
  // mixed-mode contract is designed (per `design.md` "Mixed Mode").
  let validated: boolean;
  if (validationMode === "real_playwright") {
    validated = realPlaywrightValidated;
  } else if (validationMode === "simulated") {
    validated = simulatedValidated;
  } else {
    validated = false;
  }

  const scenarioNames = results.map((result) => result.name);

  return {
    validated,
    validationMode,
    realPlaywrightValidated,
    simulatedValidated,
    strictPersistentSessionValidated,
    executionModeCounts,
    totalFlows,
    succeededFlows,
    successRate,
    persistentSessionCount,
    replayBundleCount,
    verifiedCount,
    staleRecoveryObservedCount,
    healedRecoveryObservedCount,
    resumedCheckpointCount,
    checkpointReadyClearedCount,
    scenarioNames,
    results,
    summary: `${succeededFlows}/${totalFlows} visa flows passed; persistent=${persistentSessionCount}; verified=${verifiedCount}; staleRecovery=${staleRecoveryObservedCount}; resumed=${resumedCheckpointCount}.`,
  };
}

export function buildConsultationBookingApprovedArtifact(
  summary: VisaFlowSummary,
  navigatorVisaFlowsPath: string | null,
  generatedAt = new Date().toISOString(),
): ConsultationBookingApprovedArtifact | null {
  const bookingResult = summary.results.find((result) => result.name === "booking");
  if (!bookingResult) {
    return null;
  }

  return {
    schemaVersion: "1.0",
    generatedAt,
    artifactType: "consultation_booking_approved",
    product: "AI Action Desk for immigration teams",
    workflow: "consultation_booking",
    scenarioName: "booking",
    status: "approved",
    approvalStatus: "approved",
    approvalBoundaryRespected: true,
    bookingFlowValidated:
      summary.validated &&
      bookingResult.success &&
      bookingResult.verificationState === "verified" &&
      bookingResult.persistentSessionReady &&
      bookingResult.persistentSessionReleased &&
      bookingResult.replayBundlePresent,
    calendarWritebackCompleted: false,
    clientName: "Anna Petrova",
    caseId: "VISA-2048",
    service: "Initial consultation",
    timezone: "Europe/Madrid",
    preferredSlot: "Tomorrow 15:30",
    backupSlot: "Tomorrow 17:00",
    evidence: {
      navigatorVisaFlowsPath,
      latestResultRef: bookingResult.latestResultRef,
      jobId: bookingResult.jobId,
      verificationState: bookingResult.verificationState,
      checkpointCount: bookingResult.checkpointCount,
      resumedCheckpointCount: bookingResult.resumedCheckpointCount,
      replayBundlePresent: bookingResult.replayBundlePresent,
      summary: bookingResult.summary,
    },
  };
}

async function writeOptionalOutput(outputPath: string | null, payload: unknown): Promise<void> {
  if (!outputPath) {
    return;
  }
  const resolvedPath = resolve(outputPath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function runNavigatorVisaFlowsProof(args: ParsedArgs): Promise<VisaFlowSummary> {
  const results: VisaFlowResult[] = [];
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_EXECUTOR_URL: args.uiExecutorBaseUrl,
      UI_NAVIGATOR_APPROVAL_KEYWORDS:
        "payment,pay,card,credential,password,delete,remove,transfer,wire,bank,purchase,visa,relocation,immigration,work permit,residency,submit order",
      UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE: "failed",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      for (const scenario of visaFlowScenarios) {
        results.push(await runScenario(scenario, args.frontendBaseUrl, args.uiExecutorBaseUrl, args.timeoutMs));
      }
    },
  );

  const summary = summarizeNavigatorVisaFlowResults(results);
  await writeOptionalOutput(args.outputPath, summary);
  const consultationBookingApprovedArtifactPath = resolveSiblingOutputPath(
    args.outputPath,
    "consultation-booking-approved.json",
  );
  const consultationBookingApprovedArtifact = buildConsultationBookingApprovedArtifact(
    summary,
    args.outputPath,
  );
  if (consultationBookingApprovedArtifact) {
    await writeOptionalOutput(consultationBookingApprovedArtifactPath, consultationBookingApprovedArtifact);
  }
  return summary;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const summary = await runNavigatorVisaFlowsProof(args);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
