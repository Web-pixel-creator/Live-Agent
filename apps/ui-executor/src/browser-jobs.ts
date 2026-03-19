import { randomUUID } from "node:crypto";

export type BrowserJobActionType = "navigate" | "click" | "type" | "scroll" | "hotkey" | "wait" | "verify";

export type BrowserJobAction = {
  id: string;
  type: BrowserJobActionType;
  target: string;
  text?: string | null;
  coordinates?: { x: number; y: number } | null;
};

export type BrowserJobContext = {
  goal?: string;
  url?: string;
  summary?: string;
  screenshotRef?: string;
  domSnapshot?: string;
  accessibilityTree?: string;
  markHints?: string[];
  refMap?: Record<string, unknown>;
  deviceNodeId?: string;
  cursor?: { x: number; y: number } | null;
};

export type BrowserJobDeviceNode = {
  nodeId: string;
  displayName: string;
  kind: "desktop" | "mobile";
  platform: string;
  status: "online" | "offline" | "degraded";
  capabilities?: string[];
};

export type BrowserJobSandboxSnapshot = {
  mode: string;
  decision: string;
  violations: string[];
  warnings: string[];
  setupMarkerStatus: string;
};

export type BrowserJobTraceStep = {
  index: number;
  actionId: string;
  actionType: BrowserJobActionType;
  target: string;
  status: "ok" | "retry" | "failed" | "blocked";
  screenshotRef: string;
  notes: string;
  observation?: string | null;
};

export type BrowserJobArtifact = {
  artifactId: string;
  kind: "checkpoint" | "trace" | "result";
  ref: string;
  stepIndex: number | null;
  createdAt: string;
  notes: string;
};

export type BrowserJobCheckpoint = {
  checkpointId: string;
  stepIndex: number;
  status: "ready" | "resumed";
  createdAt: string;
  resumedAt: string | null;
  artifactRef: string;
  notes: string | null;
};

export type BrowserJobReplayVerification = {
  state: "verified" | "partially_verified" | "unverified";
  requested: boolean;
  requestedSteps: number;
  completedVerifySteps: number;
  summary: string;
};

export type BrowserJobReplayStepSummary = {
  index: number;
  actionId: string;
  actionType: BrowserJobActionType;
  target: string;
  status: BrowserJobTraceStep["status"];
  screenshotRef: string;
  notes: string;
  observation: string | null;
};

export type BrowserJobReplayBundle = {
  bundleId: string;
  generatedAt: string;
  status: BrowserJobStatus;
  goal: string | null;
  targetUrl: string | null;
  traceSteps: number;
  completedSteps: number;
  totalSteps: number;
  executedSteps: number;
  screenshotRefs: string[];
  traceArtifactRefs: string[];
  checkpointArtifactRefs: string[];
  resultArtifactRefs: string[];
  latestCheckpointRef: string | null;
  latestResultRef: string | null;
  latestScreenshotRef: string | null;
  verification: BrowserJobReplayVerification;
  stepSummaries: BrowserJobReplayStepSummary[];
};

export type BrowserJobStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type BrowserJobSessionMode = "ephemeral" | "resumable";

export type BrowserJobSessionStatus = "ephemeral" | "pending" | "ready" | "released" | "closed" | "expired";

export type BrowserJobSessionRecord = {
  mode: BrowserJobSessionMode;
  key: string | null;
  persistenceRequested: boolean;
  persistenceEnabled: boolean;
  status: BrowserJobSessionStatus;
  reuseCount: number;
  lastPageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  releasedAt: string | null;
  notes: string[];
};

export type BrowserJobRecord = {
  jobId: string;
  sessionId: string;
  runId: string | null;
  taskId: string | null;
  label: string | null;
  reason: string | null;
  status: BrowserJobStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  currentWorkerId: string | null;
  totalSteps: number;
  executedSteps: number;
  checkpointEverySteps: number | null;
  pauseAfterStep: number | null;
  nextCheckpointStep: number | null;
  lastCheckpointAt: string | null;
  retries: number;
  error: string | null;
  executor: string | null;
  adapterMode: "remote_http";
  adapterNotes: string[];
  deviceNode: BrowserJobDeviceNode | null;
  actionTypes: BrowserJobActionType[];
  trace: BrowserJobTraceStep[];
  artifacts: BrowserJobArtifact[];
  checkpoints: BrowserJobCheckpoint[];
  sandbox: BrowserJobSandboxSnapshot | null;
  session: BrowserJobSessionRecord;
  replayBundle: BrowserJobReplayBundle;
};

type InternalBrowserJob = Omit<BrowserJobRecord, "replayBundle"> & {
  actions: BrowserJobAction[];
  context: BrowserJobContext;
};

type BrowserJobWorkerSlot = {
  workerId: string;
  activeJobId: string | null;
  processedJobs: number;
  failedJobs: number;
};

type BrowserJobConfig = {
  enabled: boolean;
  concurrency: number;
  pollMs: number;
  retentionMs: number;
};

export type BrowserJobRuntimeSnapshot = {
  runtime: {
    enabled: boolean;
    started: boolean;
    startedAt: string | null;
    concurrency: number;
    pollMs: number;
    retentionMs: number;
  };
  queue: {
    total: number;
    queued: number;
    running: number;
    paused: number;
    completed: number;
    failed: number;
    cancelled: number;
    backlog: number;
    checkpointReady: number;
    oldestQueuedAgeMs: number | null;
  };
  workers: Array<{
    workerId: string;
    activeJobId: string | null;
    processedJobs: number;
    failedJobs: number;
  }>;
};

export type BrowserJobListSnapshot = BrowserJobRuntimeSnapshot & {
  jobs: BrowserJobRecord[];
};

export type BrowserJobExecutionInput = {
  jobId: string;
  fromStepIndex: number;
  toStepIndex: number;
  actions: BrowserJobAction[];
  context: BrowserJobContext;
  screenshotSeed: string;
  deviceNode: BrowserJobDeviceNode | null;
  sandbox: BrowserJobSandboxSnapshot | null;
  session?: BrowserJobSessionRecord;
  persistSessionAfterRun?: boolean;
};

export type BrowserJobExecutionResult = {
  trace: BrowserJobTraceStep[];
  finalStatus: "completed" | "failed";
  retries: number;
  executor: string;
  adapterMode: "remote_http";
  adapterNotes: string[];
  deviceNode: BrowserJobDeviceNode | null;
  verification?: BrowserJobReplayVerification | null;
  session?: Partial<BrowserJobSessionRecord> | null;
};

type SubmitBrowserJobParams = {
  sessionId: string;
  runId?: string | null;
  taskId?: string | null;
  label?: string | null;
  reason?: string | null;
  actions: BrowserJobAction[];
  context?: BrowserJobContext;
  deviceNode?: BrowserJobDeviceNode | null;
  checkpointEverySteps?: number | null;
  pauseAfterStep?: number | null;
  sandbox?: BrowserJobSandboxSnapshot | null;
};

type ListBrowserJobsParams = {
  limit?: number;
  status?: BrowserJobStatus | null;
};

const config: BrowserJobConfig = {
  enabled: process.env.UI_EXECUTOR_BROWSER_WORKER_ENABLED !== "false",
  concurrency: parsePositiveInt(process.env.UI_EXECUTOR_BROWSER_WORKER_CONCURRENCY, 1),
  pollMs: parsePositiveInt(process.env.UI_EXECUTOR_BROWSER_WORKER_POLL_MS, 120),
  retentionMs: parsePositiveInt(process.env.UI_EXECUTOR_BROWSER_WORKER_RETENTION_MS, 60 * 60 * 1000),
};

const jobs = new Map<string, InternalBrowserJob>();
const pendingQueue: string[] = [];
const workerSlots: BrowserJobWorkerSlot[] = [];

let runtimeStartedAt: string | null = null;
let dispatcherTimer: NodeJS.Timeout | null = null;
let dispatchInProgress = false;
let runner: ((input: BrowserJobExecutionInput) => Promise<BrowserJobExecutionResult>) | null = null;
let sessionReleaser: ((session: BrowserJobSessionRecord, reason: string) => Promise<void> | void) | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneDeviceNode(node: BrowserJobDeviceNode | null): BrowserJobDeviceNode | null {
  return node
    ? {
        ...node,
        capabilities: Array.isArray(node.capabilities) ? [...node.capabilities] : undefined,
      }
    : null;
}

function cloneBrowserJobSessionRecord(session: BrowserJobSessionRecord): BrowserJobSessionRecord {
  return {
    ...session,
    notes: [...session.notes],
  };
}

function createBrowserJobSessionRecord(jobId: string, params: {
  totalSteps: number;
  executedSteps: number;
  checkpointEverySteps: number | null;
  pauseAfterStep: number | null;
}): BrowserJobSessionRecord {
  const nextCheckpointStep = computeNextCheckpointStep(params);
  const persistenceRequested = typeof nextCheckpointStep === "number" && nextCheckpointStep < params.totalSteps;
  return {
    mode: persistenceRequested ? "resumable" : "ephemeral",
    key: persistenceRequested ? `browser-session-${jobId}` : null,
    persistenceRequested,
    persistenceEnabled: false,
    status: persistenceRequested ? "pending" : "ephemeral",
    reuseCount: 0,
    lastPageUrl: null,
    createdAt: null,
    updatedAt: null,
    releasedAt: null,
    notes: persistenceRequested
      ? ["Resumable browser session requested for checkpointed job."]
      : ["Ephemeral browser session only."],
  };
}

function mergeSessionNotes(existing: string[], additions: string[] | undefined): string[] {
  const merged = [...existing];
  for (const note of additions ?? []) {
    if (typeof note !== "string" || note.trim().length === 0) {
      continue;
    }
    if (!merged.includes(note)) {
      merged.push(note);
    }
  }
  return merged;
}

function applyBrowserJobSessionUpdate(
  current: BrowserJobSessionRecord,
  update: Partial<BrowserJobSessionRecord> | null | undefined,
): BrowserJobSessionRecord {
  if (!update) {
    return cloneBrowserJobSessionRecord(current);
  }
  const now = nowIso();
  const nextStatus = update.status ?? current.status;
  return {
    mode: update.mode ?? current.mode,
    key: Object.prototype.hasOwnProperty.call(update, "key") ? update.key ?? null : current.key,
    persistenceRequested: update.persistenceRequested ?? current.persistenceRequested,
    persistenceEnabled: update.persistenceEnabled ?? current.persistenceEnabled,
    status: nextStatus,
    reuseCount: typeof update.reuseCount === "number" ? Math.max(0, Math.floor(update.reuseCount)) : current.reuseCount,
    lastPageUrl:
      Object.prototype.hasOwnProperty.call(update, "lastPageUrl") ? update.lastPageUrl ?? null : current.lastPageUrl,
    createdAt:
      current.createdAt ??
      (update.persistenceEnabled === true || update.status === "ready" ? now : update.createdAt ?? null),
    updatedAt: now,
    releasedAt:
      nextStatus === "released" || nextStatus === "closed" || nextStatus === "expired"
        ? now
        : current.releasedAt,
    notes: mergeSessionNotes(current.notes, update.notes),
  };
}

function releaseBrowserJobSession(job: InternalBrowserJob, reason: string, status: BrowserJobSessionStatus): void {
  if (!job.session.key || job.session.status === "ephemeral") {
    return;
  }
  if (job.session.status === "released" || job.session.status === "closed" || job.session.status === "expired") {
    return;
  }
  job.session = applyBrowserJobSessionUpdate(job.session, {
    status,
    notes: [reason],
  });
  if (sessionReleaser) {
    const snapshot = cloneBrowserJobSessionRecord(job.session);
    void Promise.resolve(sessionReleaser(snapshot, reason)).catch(() => {});
  }
}

function cloneBrowserJobRecord(job: InternalBrowserJob): BrowserJobRecord {
  return {
    jobId: job.jobId,
    sessionId: job.sessionId,
    runId: job.runId,
    taskId: job.taskId,
    label: job.label,
    reason: job.reason,
    status: job.status,
    requestedAt: job.requestedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    updatedAt: job.updatedAt,
    currentWorkerId: job.currentWorkerId,
    totalSteps: job.totalSteps,
    executedSteps: job.executedSteps,
    checkpointEverySteps: job.checkpointEverySteps,
    pauseAfterStep: job.pauseAfterStep,
    nextCheckpointStep: job.nextCheckpointStep,
    lastCheckpointAt: job.lastCheckpointAt,
    retries: job.retries,
    error: job.error,
    executor: job.executor,
    adapterMode: job.adapterMode,
    adapterNotes: [...job.adapterNotes],
    deviceNode: cloneDeviceNode(job.deviceNode),
    actionTypes: [...job.actionTypes],
    trace: job.trace.map((step) => ({ ...step })),
    artifacts: job.artifacts.map((item) => ({ ...item })),
    checkpoints: job.checkpoints.map((item) => ({ ...item })),
    sandbox: job.sandbox
      ? {
          ...job.sandbox,
          violations: [...job.sandbox.violations],
          warnings: [...job.sandbox.warnings],
        }
      : null,
    session: cloneBrowserJobSessionRecord(job.session),
    replayBundle: buildBrowserJobReplayBundle(job),
  };
}

function buildBrowserJobReplayVerification(job: InternalBrowserJob): BrowserJobReplayVerification {
  const requestedSteps = job.actions.filter((action) => action.type === "verify").length;
  const completedVerifySteps = job.trace.filter((step) => step.actionType === "verify" && step.status === "ok").length;
  const completedSteps = job.trace.filter((step) => step.status === "ok").length;
  const requested = requestedSteps > 0;
  const state: BrowserJobReplayVerification["state"] =
    job.status === "completed" && requested && completedVerifySteps >= requestedSteps
      ? "verified"
      : completedVerifySteps > 0 || completedSteps > 0
        ? "partially_verified"
        : "unverified";

  let summary: string;
  if (state === "verified") {
    summary = `Browser job verified ${completedVerifySteps} post-action step${completedVerifySteps === 1 ? "" : "s"}.`;
  } else if (requested) {
    summary =
      job.status === "paused"
        ? `Browser job paused before all ${requestedSteps} verification step${requestedSteps === 1 ? "" : "s"} completed.`
        : job.status === "completed"
          ? `Browser job completed, but only ${completedVerifySteps} of ${requestedSteps} verification step${requestedSteps === 1 ? "" : "s"} succeeded.`
          : `Browser job has not yet completed all ${requestedSteps} verification step${requestedSteps === 1 ? "" : "s"}.`;
  } else if (completedSteps > 0) {
    summary = "Browser job recorded action evidence without an explicit post-action verification step.";
  } else {
    summary = "Browser job does not yet have replayable verification evidence.";
  }

  return {
    state,
    requested,
    requestedSteps,
    completedVerifySteps,
    summary,
  };
}

function buildBrowserJobReplayBundle(job: InternalBrowserJob): BrowserJobReplayBundle {
  const actionTargetUrl = job.actions.find((action) => action.type === "navigate" && /^https?:\/\//i.test(action.target))?.target ?? null;
  const screenshotRefs = Array.from(
    new Set(
      job.trace
        .map((step) => (typeof step.screenshotRef === "string" ? step.screenshotRef.trim() : ""))
        .filter((value) => value.length > 0),
    ),
  );
  const traceArtifactRefs = job.artifacts.filter((item) => item.kind === "trace").map((item) => item.ref);
  const checkpointArtifactRefs = job.artifacts.filter((item) => item.kind === "checkpoint").map((item) => item.ref);
  const resultArtifactRefs = job.artifacts.filter((item) => item.kind === "result").map((item) => item.ref);
  const latestCheckpointRef = checkpointArtifactRefs.length > 0 ? checkpointArtifactRefs[checkpointArtifactRefs.length - 1] : null;
  const latestResultRef = resultArtifactRefs.length > 0 ? resultArtifactRefs[resultArtifactRefs.length - 1] : null;
  const latestScreenshotRef = screenshotRefs.length > 0 ? screenshotRefs[screenshotRefs.length - 1] : null;
  const completedSteps = job.trace.filter((step) => step.status === "ok").length;

  return {
    bundleId: `replay-${job.jobId}`,
    generatedAt: nowIso(),
    status: job.status,
    goal: typeof job.context.goal === "string" && job.context.goal.trim().length > 0 ? job.context.goal.trim() : null,
    targetUrl:
      typeof job.context.url === "string" && job.context.url.trim().length > 0
        ? job.context.url.trim()
        : job.session.lastPageUrl ?? actionTargetUrl,
    traceSteps: job.trace.length,
    completedSteps,
    totalSteps: job.totalSteps,
    executedSteps: job.executedSteps,
    screenshotRefs,
    traceArtifactRefs,
    checkpointArtifactRefs,
    resultArtifactRefs,
    latestCheckpointRef,
    latestResultRef,
    latestScreenshotRef,
    verification: buildBrowserJobReplayVerification(job),
    stepSummaries: job.trace.map((step) => ({
      index: step.index,
      actionId: step.actionId,
      actionType: step.actionType,
      target: step.target,
      status: step.status,
      screenshotRef: step.screenshotRef,
      notes: step.notes,
      observation: typeof step.observation === "string" ? step.observation : null,
    })),
  };
}

function removeFromPendingQueue(jobId: string): void {
  const index = pendingQueue.indexOf(jobId);
  if (index >= 0) {
    pendingQueue.splice(index, 1);
  }
}

function computeNextCheckpointStep(job: {
  totalSteps: number;
  executedSteps: number;
  checkpointEverySteps: number | null;
  pauseAfterStep: number | null;
}): number | null {
  const remaining = job.totalSteps - job.executedSteps;
  if (remaining <= 0) {
    return null;
  }
  const candidates: number[] = [];
  if (job.checkpointEverySteps && job.checkpointEverySteps > 0) {
    candidates.push(Math.min(job.totalSteps, job.executedSteps + job.checkpointEverySteps));
  }
  if (job.pauseAfterStep && job.pauseAfterStep > job.executedSteps) {
    candidates.push(Math.min(job.totalSteps, job.pauseAfterStep));
  }
  if (candidates.length === 0) {
    return job.totalSteps;
  }
  return Math.min(...candidates);
}

function sweepExpiredJobs(): void {
  const nowMs = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled") {
      continue;
    }
    const updatedAtMs = Date.parse(job.updatedAt);
    if (!Number.isFinite(updatedAtMs)) {
      continue;
    }
    if (nowMs - updatedAtMs <= config.retentionMs) {
      continue;
    }
    releaseBrowserJobSession(job, "Browser job expired from retention window.", "expired");
    jobs.delete(jobId);
    removeFromPendingQueue(jobId);
    for (const worker of workerSlots) {
      if (worker.activeJobId === jobId) {
        worker.activeJobId = null;
      }
    }
  }
}

function ensureRuntimeStarted(): void {
  if (!config.enabled) {
    return;
  }
  if (runtimeStartedAt === null) {
    runtimeStartedAt = nowIso();
  }
  if (workerSlots.length === 0) {
    for (let index = 0; index < config.concurrency; index += 1) {
      workerSlots.push({
        workerId: `browser-worker-${index + 1}`,
        activeJobId: null,
        processedJobs: 0,
        failedJobs: 0,
      });
    }
  }
  if (dispatcherTimer === null) {
    dispatcherTimer = setInterval(() => {
      void dispatchLoop();
    }, config.pollMs);
    if (typeof dispatcherTimer.unref === "function") {
      dispatcherTimer.unref();
    }
  }
}

function reserveNextRunnableJob(workerId: string): InternalBrowserJob | null {
  for (let index = 0; index < pendingQueue.length; index += 1) {
    const jobId = pendingQueue[index];
    const job = jobs.get(jobId);
    if (!job) {
      pendingQueue.splice(index, 1);
      index -= 1;
      continue;
    }
    if (job.status !== "queued") {
      pendingQueue.splice(index, 1);
      index -= 1;
      continue;
    }
    pendingQueue.splice(index, 1);
    job.status = "running";
    job.startedAt = job.startedAt ?? nowIso();
    job.updatedAt = nowIso();
    job.currentWorkerId = workerId;
    job.error = null;
    jobs.set(jobId, job);
    return job;
  }
  return null;
}

function nextScreenshotSeed(job: InternalBrowserJob): string {
  const base = typeof job.context.screenshotRef === "string" && job.context.screenshotRef.trim().length > 0
    ? job.context.screenshotRef.trim()
    : `ui://browser-jobs/${job.jobId}`;
  return `${base}/checkpoint-${job.checkpoints.length + 1}`;
}

function createArtifactRef(job: InternalBrowserJob, kind: BrowserJobArtifact["kind"], suffix: string): string {
  return `ui://browser-jobs/${job.jobId}/${kind}-${suffix}`;
}

function countAttemptedActions(trace: BrowserJobTraceStep[], actions: BrowserJobAction[]): number {
  const seen = new Set<string>(
    trace.map((item) => item.actionId).filter((actionId) => actions.some((action) => action.id === actionId)),
  );
  if (seen.size > 0) {
    return actions.filter((action) => seen.has(action.id)).length;
  }
  return actions.length > 0 ? 1 : 0;
}

async function executeJob(slot: BrowserJobWorkerSlot, jobId: string): Promise<void> {
  const current = jobs.get(jobId);
  if (!current || current.status !== "running" || !runner) {
    return;
  }

  const stopAfterStep = computeNextCheckpointStep(current) ?? current.totalSteps;
  const sliceActions = current.actions.slice(current.executedSteps, stopAfterStep);
  if (sliceActions.length === 0) {
    releaseBrowserJobSession(current, "Browser job finished without remaining steps.", "released");
    current.status = "completed";
    current.completedAt = nowIso();
    current.updatedAt = nowIso();
    current.currentWorkerId = null;
    jobs.set(jobId, current);
    return;
  }

  try {
    const result = await runner({
      jobId,
      fromStepIndex: current.executedSteps,
      toStepIndex: stopAfterStep - 1,
      actions: sliceActions.map((action) => ({
        ...action,
        coordinates: action.coordinates ? { ...action.coordinates } : null,
      })),
        context: {
          ...current.context,
          markHints: Array.isArray(current.context.markHints) ? [...current.context.markHints] : undefined,
          refMap: current.context.refMap && typeof current.context.refMap === "object" ? { ...current.context.refMap } : undefined,
          cursor: current.context.cursor ? { ...current.context.cursor } : null,
        },
      screenshotSeed: nextScreenshotSeed(current),
      deviceNode: cloneDeviceNode(current.deviceNode),
      sandbox: current.sandbox
        ? {
            ...current.sandbox,
            violations: [...current.sandbox.violations],
            warnings: [...current.sandbox.warnings],
          }
        : null,
      session: cloneBrowserJobSessionRecord(current.session),
      persistSessionAfterRun: stopAfterStep < current.totalSteps,
    });

    const latest = jobs.get(jobId);
    if (!latest) {
      return;
    }
    if (latest.status === "cancelled") {
      releaseBrowserJobSession(latest, "Browser job cancelled before worker result was applied.", "closed");
      jobs.set(jobId, latest);
      return;
    }

    const attemptedCount = Math.max(0, Math.min(sliceActions.length, countAttemptedActions(result.trace, sliceActions)));
    const normalizedTrace = result.trace.map((step, index) => ({
      ...step,
      index:
        typeof step.index === "number" && Number.isFinite(step.index)
          ? latest.executedSteps + Math.max(1, Math.floor(step.index))
          : latest.executedSteps + index + 1,
    }));
    latest.trace.push(...normalizedTrace);
    latest.executedSteps = Math.min(latest.totalSteps, latest.executedSteps + attemptedCount);
    latest.retries += Math.max(0, result.retries);
    latest.executor = result.executor;
    latest.adapterMode = result.adapterMode;
    latest.adapterNotes = [...result.adapterNotes];
    latest.deviceNode = cloneDeviceNode(result.deviceNode);
    latest.session = applyBrowserJobSessionUpdate(latest.session, result.session);
    latest.currentWorkerId = null;
    latest.updatedAt = nowIso();

    if (normalizedTrace.length > 0) {
      latest.artifacts.push({
        artifactId: `artifact-${randomUUID()}`,
        kind: "trace",
        ref: createArtifactRef(latest, "trace", String(latest.artifacts.length + 1)),
        stepIndex: latest.executedSteps,
        createdAt: nowIso(),
        notes: `Trace batch covering ${sliceActions.length} planned steps.`,
      });
    }

    if (result.finalStatus === "failed") {
      releaseBrowserJobSession(latest, "Browser job failed and released its persistent session.", "closed");
      latest.status = "failed";
      latest.completedAt = nowIso();
      latest.error = normalizedTrace.find((item) => item.status === "failed")?.notes ?? "browser worker failed";
      slot.failedJobs += 1;
      latest.artifacts.push({
        artifactId: `artifact-${randomUUID()}`,
        kind: "result",
        ref: createArtifactRef(latest, "result", "failed"),
        stepIndex: latest.executedSteps,
        createdAt: nowIso(),
        notes: latest.error,
      });
      jobs.set(jobId, latest);
      return;
    }

    if (latest.executedSteps >= latest.totalSteps) {
      releaseBrowserJobSession(latest, "Browser job completed and released its persistent session.", "released");
      latest.status = "completed";
      latest.completedAt = nowIso();
      latest.error = null;
      slot.processedJobs += 1;
      latest.artifacts.push({
        artifactId: `artifact-${randomUUID()}`,
        kind: "result",
        ref: createArtifactRef(latest, "result", "completed"),
        stepIndex: latest.executedSteps,
        createdAt: nowIso(),
        notes: "Browser worker completed successfully.",
      });
      jobs.set(jobId, latest);
      return;
    }

    latest.status = "paused";
    latest.lastCheckpointAt = nowIso();
    latest.error = null;
    const checkpointArtifactRef = createArtifactRef(latest, "checkpoint", String(latest.checkpoints.length + 1));
    latest.artifacts.push({
      artifactId: `artifact-${randomUUID()}`,
      kind: "checkpoint",
      ref: checkpointArtifactRef,
      stepIndex: latest.executedSteps,
      createdAt: nowIso(),
      notes: `Checkpoint reached after ${latest.executedSteps}/${latest.totalSteps} steps.`,
    });
    latest.checkpoints.push({
      checkpointId: `checkpoint-${randomUUID()}`,
      stepIndex: latest.executedSteps,
      status: "ready",
      createdAt: nowIso(),
      resumedAt: null,
      artifactRef: checkpointArtifactRef,
      notes: `Paused for operator resume after step ${latest.executedSteps}.`,
    });
    latest.nextCheckpointStep = computeNextCheckpointStep(latest);
    jobs.set(jobId, latest);
  } catch (error) {
    const latest = jobs.get(jobId);
    if (!latest || latest.status === "cancelled") {
      return;
    }
    releaseBrowserJobSession(latest, "Browser worker execution threw and released its persistent session.", "closed");
    latest.status = "failed";
    latest.completedAt = nowIso();
    latest.currentWorkerId = null;
    latest.updatedAt = nowIso();
    latest.error = error instanceof Error ? error.message : "browser worker execution failed";
    latest.artifacts.push({
      artifactId: `artifact-${randomUUID()}`,
      kind: "result",
      ref: createArtifactRef(latest, "result", "failed"),
      stepIndex: latest.executedSteps,
      createdAt: nowIso(),
      notes: latest.error,
    });
    slot.failedJobs += 1;
    jobs.set(jobId, latest);
  }
}

async function dispatchLoop(): Promise<void> {
  if (!config.enabled || !runner || dispatchInProgress) {
    return;
  }
  dispatchInProgress = true;
  try {
    sweepExpiredJobs();
    for (const slot of workerSlots) {
      if (slot.activeJobId !== null) {
        continue;
      }
      const nextJob = reserveNextRunnableJob(slot.workerId);
      if (!nextJob) {
        continue;
      }
      slot.activeJobId = nextJob.jobId;
      void executeJob(slot, nextJob.jobId).finally(() => {
        slot.activeJobId = null;
        void dispatchLoop();
      });
    }
  } finally {
    dispatchInProgress = false;
  }
}

export function setBrowserJobRunner(
  value: (input: BrowserJobExecutionInput) => Promise<BrowserJobExecutionResult>,
): void {
  runner = value;
  ensureRuntimeStarted();
  void dispatchLoop();
}

export function setBrowserJobSessionReleaser(
  value: ((session: BrowserJobSessionRecord, reason: string) => Promise<void> | void) | null,
): void {
  sessionReleaser = value;
}

export function submitBrowserJob(params: SubmitBrowserJobParams): BrowserJobRecord {
  sweepExpiredJobs();
  const requestedAt = nowIso();
  const totalSteps = params.actions.length;
  const normalizedCheckpointEverySteps =
    typeof params.checkpointEverySteps === "number" &&
    Number.isFinite(params.checkpointEverySteps) &&
    params.checkpointEverySteps > 0
      ? Math.floor(params.checkpointEverySteps)
      : null;
  const normalizedPauseAfterStep =
    typeof params.pauseAfterStep === "number" && Number.isFinite(params.pauseAfterStep) && params.pauseAfterStep > 0
      ? Math.min(totalSteps, Math.floor(params.pauseAfterStep))
      : null;
  const jobId = `browser-job-${randomUUID()}`;

  const record: InternalBrowserJob = {
    jobId,
    sessionId: params.sessionId,
    runId: params.runId ?? null,
    taskId: params.taskId ?? null,
    label: params.label ?? null,
    reason: params.reason ?? null,
    status: "queued",
    requestedAt,
    startedAt: null,
    completedAt: null,
    updatedAt: requestedAt,
    currentWorkerId: null,
    totalSteps,
    executedSteps: 0,
    checkpointEverySteps: normalizedCheckpointEverySteps,
    pauseAfterStep: normalizedPauseAfterStep,
    nextCheckpointStep: computeNextCheckpointStep({
      totalSteps,
      executedSteps: 0,
      checkpointEverySteps: normalizedCheckpointEverySteps,
      pauseAfterStep: normalizedPauseAfterStep,
    }),
    lastCheckpointAt: null,
    retries: 0,
    error: null,
    executor: null,
    adapterMode: "remote_http",
    adapterNotes: [],
    deviceNode: cloneDeviceNode(params.deviceNode ?? null),
    actionTypes: Array.from(new Set(params.actions.map((action) => action.type))),
    trace: [],
    artifacts: [],
    checkpoints: [],
    sandbox: params.sandbox
      ? {
          ...params.sandbox,
          violations: [...params.sandbox.violations],
          warnings: [...params.sandbox.warnings],
        }
      : null,
    session: createBrowserJobSessionRecord(jobId, {
      totalSteps,
      executedSteps: 0,
      checkpointEverySteps: normalizedCheckpointEverySteps,
      pauseAfterStep: normalizedPauseAfterStep,
    }),
    actions: params.actions.map((action) => ({
      ...action,
      coordinates: action.coordinates ? { ...action.coordinates } : null,
    })),
    context: {
      ...params.context,
      markHints: Array.isArray(params.context?.markHints) ? [...params.context.markHints] : undefined,
      refMap: params.context?.refMap && typeof params.context.refMap === "object" ? { ...params.context.refMap } : undefined,
      cursor: params.context?.cursor ? { ...params.context.cursor } : null,
    },
  };
  jobs.set(record.jobId, record);
  pendingQueue.push(record.jobId);
  const snapshot = cloneBrowserJobRecord(record);
  ensureRuntimeStarted();
  void dispatchLoop();
  return snapshot;
}

export function getBrowserJob(jobId: string): BrowserJobRecord | null {
  sweepExpiredJobs();
  const job = jobs.get(jobId);
  return job ? cloneBrowserJobRecord(job) : null;
}

export function listBrowserJobs(params: ListBrowserJobsParams = {}): BrowserJobRecord[] {
  sweepExpiredJobs();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  return Array.from(jobs.values())
    .filter((job) => (params.status ? job.status === params.status : true))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit)
    .map((job) => cloneBrowserJobRecord(job));
}

export function resumeBrowserJob(jobId: string, reason?: string | null): BrowserJobRecord | null {
  const job = jobs.get(jobId);
  if (!job || job.status !== "paused") {
    return null;
  }
  const latestCheckpoint = [...job.checkpoints].reverse().find((item) => item.status === "ready") ?? null;
  if (latestCheckpoint) {
    latestCheckpoint.status = "resumed";
    latestCheckpoint.resumedAt = nowIso();
    latestCheckpoint.notes = reason ?? latestCheckpoint.notes;
  }
  job.status = "queued";
  job.updatedAt = nowIso();
  job.currentWorkerId = null;
  job.error = null;
  job.nextCheckpointStep = computeNextCheckpointStep(job);
  jobs.set(jobId, job);
  pendingQueue.push(jobId);
  const snapshot = cloneBrowserJobRecord(job);
  void dispatchLoop();
  return snapshot;
}

export function cancelBrowserJob(jobId: string, reason?: string | null): BrowserJobRecord | null {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  removeFromPendingQueue(jobId);
  releaseBrowserJobSession(job, reason ?? "Cancelled by operator", "closed");
  job.status = "cancelled";
  job.completedAt = nowIso();
  job.updatedAt = nowIso();
  job.currentWorkerId = null;
  job.error = reason ?? "Cancelled by operator";
  job.artifacts.push({
    artifactId: `artifact-${randomUUID()}`,
    kind: "result",
    ref: createArtifactRef(job, "result", "cancelled"),
    stepIndex: job.executedSteps,
    createdAt: nowIso(),
    notes: job.error,
  });
  jobs.set(jobId, job);
  return cloneBrowserJobRecord(job);
}

export function getBrowserJobRuntimeSnapshot(): BrowserJobRuntimeSnapshot {
  sweepExpiredJobs();
  const allJobs = Array.from(jobs.values());
  const queued = allJobs.filter((job) => job.status === "queued").length;
  const running = allJobs.filter((job) => job.status === "running").length;
  const paused = allJobs.filter((job) => job.status === "paused").length;
  const completed = allJobs.filter((job) => job.status === "completed").length;
  const failed = allJobs.filter((job) => job.status === "failed").length;
  const cancelled = allJobs.filter((job) => job.status === "cancelled").length;
  const oldestQueued = allJobs
    .filter((job) => job.status === "queued")
    .map((job) => Date.parse(job.requestedAt))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)[0];
  const nowMs = Date.now();
  return {
    runtime: {
      enabled: config.enabled,
      started: runtimeStartedAt !== null,
      startedAt: runtimeStartedAt,
      concurrency: config.concurrency,
      pollMs: config.pollMs,
      retentionMs: config.retentionMs,
    },
    queue: {
      total: allJobs.length,
      queued,
      running,
      paused,
      completed,
      failed,
      cancelled,
      backlog: queued + paused,
      checkpointReady: paused,
      oldestQueuedAgeMs: Number.isFinite(oldestQueued) ? Math.max(0, nowMs - oldestQueued) : null,
    },
    workers: workerSlots.map((worker) => ({
      workerId: worker.workerId,
      activeJobId: worker.activeJobId,
      processedJobs: worker.processedJobs,
      failedJobs: worker.failedJobs,
    })),
  };
}

export function getBrowserJobListSnapshot(params: ListBrowserJobsParams = {}): BrowserJobListSnapshot {
  return {
    ...getBrowserJobRuntimeSnapshot(),
    jobs: listBrowserJobs(params),
  };
}

export function resetBrowserJobRuntimeForTests(): void {
  for (const job of jobs.values()) {
    releaseBrowserJobSession(job, "Browser job runtime reset for tests.", "closed");
  }
  jobs.clear();
  pendingQueue.splice(0, pendingQueue.length);
  workerSlots.splice(0, workerSlots.length);
  runtimeStartedAt = null;
  dispatchInProgress = false;
  runner = null;
  sessionReleaser = null;
  if (dispatcherTimer) {
    clearInterval(dispatcherTimer);
    dispatcherTimer = null;
  }
}
