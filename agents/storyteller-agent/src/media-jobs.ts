import { randomUUID } from "node:crypto";

export type StoryMediaJobKind = "video" | "image";

export type StoryMediaJobStatus =
  | "queued"
  | "running"
  | "retry_waiting"
  | "completed"
  | "failed";

export type StoryMediaJob = {
  jobId: string;
  kind: StoryMediaJobKind;
  sessionId: string;
  runId: string;
  assetId: string;
  assetRef: string;
  segmentIndex: number;
  provider: string;
  model: string;
  mode: "fallback" | "simulated";
  status: StoryMediaJobStatus;
  attempts: number;
  maxAttempts: number;
  retryBudgetRemaining: number;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  nextAttemptAt: string | null;
  updatedAt: string;
  error: string | null;
  errorCode: string | null;
  lastWorkerId: string | null;
  deadLettered: boolean;
  executionMs: number | null;
  failureRate: number;
};

export type StoryMediaWorkerSnapshot = {
  runtime: {
    enabled: boolean;
    started: boolean;
    startedAt: string | null;
    concurrency: number;
    pollMs: number;
    maxAttempts: number;
    backoffBaseMs: number;
    backoffMaxMs: number;
  };
  queue: {
    queued: number;
    running: number;
    retryWaiting: number;
    completed: number;
    failed: number;
    deadLetter: number;
    backlog: number;
    oldestQueuedAgeMs: number | null;
  };
  workers: Array<{
    workerId: string;
    activeJobId: string | null;
    processedJobs: number;
    failedJobs: number;
  }>;
  quotas: Array<{
    model: string;
    perWindow: number;
    windowMs: number;
    used: number;
    available: number;
  }>;
};

type CreateMediaJobParams = {
  kind: StoryMediaJobKind;
  sessionId: string;
  runId: string;
  assetId: string;
  assetRef: string;
  segmentIndex: number;
  provider: string;
  model: string;
  mode: "fallback" | "simulated";
  failureRate: number;
};

type CreateVideoMediaJobParams = Omit<CreateMediaJobParams, "kind">;

type WorkerSlot = {
  workerId: string;
  activeJobId: string | null;
  processedJobs: number;
  failedJobs: number;
};

type QuotaRule = {
  perWindow: number;
  windowMs: number;
};

type MediaWorkerConfig = {
  enabled: boolean;
  concurrency: number;
  pollMs: number;
  maxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  retentionMs: number;
  quotaRules: Map<string, QuotaRule>;
  defaultQuotaRule: QuotaRule;
};

const jobs = new Map<string, StoryMediaJob>();
const pendingQueue: string[] = [];
const deadLetterQueue: string[] = [];
const workerSlots: WorkerSlot[] = [];
const quotaLedger = new Map<string, number[]>();

let runtimeStartedAt: string | null = null;
let dispatcherTimer: NodeJS.Timeout | null = null;
let dispatchInProgress = false;

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

function parseQuotaRules(raw: string | undefined): {
  defaultRule: QuotaRule;
  rules: Map<string, QuotaRule>;
} {
  const fallbackDefault: QuotaRule = { perWindow: 2, windowMs: 1000 };
  const input = typeof raw === "string" ? raw.trim() : "";
  if (input.length === 0) {
    return {
      defaultRule: fallbackDefault,
      rules: new Map<string, QuotaRule>([
        ["veo-3.1", { perWindow: 1, windowMs: 1000 }],
        ["imagen-4", { perWindow: 2, windowMs: 1000 }],
      ]),
    };
  }

  const rules = new Map<string, QuotaRule>();
  let defaultRule = fallbackDefault;

  for (const token of input.split(",")) {
    const trimmed = token.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const [modelRaw, specRaw] = trimmed.split("=", 2);
    if (!modelRaw || !specRaw) {
      continue;
    }
    const model = modelRaw.trim().toLowerCase();
    const [countRaw, windowRaw] = specRaw.split("/", 2);
    const perWindow = parsePositiveInt(countRaw, 0);
    const windowMs = parsePositiveInt(windowRaw, 0);
    if (perWindow <= 0 || windowMs <= 0) {
      continue;
    }
    const rule = { perWindow, windowMs };
    if (model === "*" || model === "default") {
      defaultRule = rule;
    } else {
      rules.set(model, rule);
    }
  }

  return { defaultRule, rules };
}

function loadConfig(): MediaWorkerConfig {
  const quota = parseQuotaRules(process.env.STORYTELLER_MEDIA_QUOTA_RULES);
  return {
    enabled: process.env.STORYTELLER_MEDIA_WORKER_ENABLED !== "false",
    concurrency: parsePositiveInt(process.env.STORYTELLER_MEDIA_WORKER_CONCURRENCY, 2),
    pollMs: parsePositiveInt(process.env.STORYTELLER_MEDIA_WORKER_POLL_MS, 120),
    maxAttempts: parsePositiveInt(process.env.STORYTELLER_MEDIA_JOB_MAX_ATTEMPTS, 3),
    backoffBaseMs: parsePositiveInt(process.env.STORYTELLER_MEDIA_JOB_RETRY_BASE_MS, 800),
    backoffMaxMs: parsePositiveInt(process.env.STORYTELLER_MEDIA_JOB_RETRY_MAX_MS, 20000),
    retentionMs: parsePositiveInt(process.env.STORYTELLER_MEDIA_JOB_RETENTION_MS, 3600000),
    quotaRules: quota.rules,
    defaultQuotaRule: quota.defaultRule,
  };
}

const config = loadConfig();

function nowIso(): string {
  return new Date().toISOString();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function cloneJob(job: StoryMediaJob): StoryMediaJob {
  return { ...job };
}

function resolveQuotaRule(model: string): QuotaRule {
  const normalized = model.trim().toLowerCase();
  return config.quotaRules.get(normalized) ?? config.defaultQuotaRule;
}

function pruneQuotaLedger(nowMs: number): void {
  for (const [model, timestamps] of quotaLedger.entries()) {
    const rule = resolveQuotaRule(model);
    const cutoff = nowMs - rule.windowMs;
    const retained = timestamps.filter((value) => value >= cutoff);
    quotaLedger.set(model, retained);
  }
}

function canConsumeQuota(model: string, nowMs: number): boolean {
  const normalized = model.trim().toLowerCase();
  const rule = resolveQuotaRule(normalized);
  const cutoff = nowMs - rule.windowMs;
  const existing = quotaLedger.get(normalized) ?? [];
  const active = existing.filter((value) => value >= cutoff);
  quotaLedger.set(normalized, active);
  return active.length < rule.perWindow;
}

function consumeQuota(model: string, nowMs: number): void {
  const normalized = model.trim().toLowerCase();
  const existing = quotaLedger.get(normalized) ?? [];
  existing.push(nowMs);
  quotaLedger.set(normalized, existing);
}

function terminal(status: StoryMediaJobStatus): boolean {
  return status === "completed" || status === "failed";
}

function removeFromQueue(jobId: string): void {
  const index = pendingQueue.indexOf(jobId);
  if (index >= 0) {
    pendingQueue.splice(index, 1);
  }
}

function sweepExpired(): void {
  const nowMs = Date.now();
  pruneQuotaLedger(nowMs);

  for (const [jobId, job] of jobs.entries()) {
    if (!terminal(job.status)) {
      continue;
    }
    const updatedAtMs = Date.parse(job.updatedAt);
    if (!Number.isFinite(updatedAtMs)) {
      continue;
    }
    if (nowMs - updatedAtMs > config.retentionMs) {
      jobs.delete(jobId);
      removeFromQueue(jobId);
      const deadIndex = deadLetterQueue.indexOf(jobId);
      if (deadIndex >= 0) {
        deadLetterQueue.splice(deadIndex, 1);
      }
      for (const worker of workerSlots) {
        if (worker.activeJobId === jobId) {
          worker.activeJobId = null;
        }
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
        workerId: `story-media-worker-${index + 1}`,
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

function computeBackoffMs(attempts: number): number {
  const exp = Math.max(0, attempts - 1);
  const candidate = config.backoffBaseMs * 2 ** exp;
  return Math.min(config.backoffMaxMs, Math.max(config.backoffBaseMs, candidate));
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  });
}

function simulateRunDelay(job: StoryMediaJob): number {
  const base = job.kind === "video" ? 900 : 450;
  const perSegment = Math.max(0, job.segmentIndex) * (job.kind === "video" ? 120 : 60);
  const jitter = Math.floor(Math.random() * (job.kind === "video" ? 240 : 140));
  return base + perSegment + jitter;
}

async function executeJob(slot: WorkerSlot, jobId: string): Promise<void> {
  const startedAtMs = Date.now();
  const initial = jobs.get(jobId);
  if (!initial) {
    return;
  }

  await sleep(simulateRunDelay(initial));

  const current = jobs.get(jobId);
  if (!current || current.status !== "running") {
    return;
  }

  const failure = current.mode === "simulated" && Math.random() < clamp01(current.failureRate);
  if (!failure) {
    const updated: StoryMediaJob = {
      ...current,
      status: "completed",
      completedAt: nowIso(),
      nextAttemptAt: null,
      retryBudgetRemaining: Math.max(0, current.maxAttempts - current.attempts),
      error: null,
      errorCode: null,
      deadLettered: false,
      executionMs: Math.max(1, Date.now() - startedAtMs),
      updatedAt: nowIso(),
    };
    jobs.set(updated.jobId, updated);
    slot.processedJobs += 1;
    return;
  }

  const executionMs = Math.max(1, Date.now() - startedAtMs);
  const retryBudgetRemaining = Math.max(0, current.maxAttempts - current.attempts);
  if (current.attempts < current.maxAttempts) {
    const backoffMs = computeBackoffMs(current.attempts);
    const nextAttemptAtIso = new Date(Date.now() + backoffMs).toISOString();
    const updated: StoryMediaJob = {
      ...current,
      status: "retry_waiting",
      nextAttemptAt: nextAttemptAtIso,
      retryBudgetRemaining,
      error: "Simulated media generation failure; retry scheduled.",
      errorCode: "MEDIA_JOB_RETRYABLE_FAILURE",
      deadLettered: false,
      executionMs,
      updatedAt: nowIso(),
    };
    jobs.set(updated.jobId, updated);
    pendingQueue.push(updated.jobId);
    slot.failedJobs += 1;
    return;
  }

  const updated: StoryMediaJob = {
    ...current,
    status: "failed",
    completedAt: nowIso(),
    nextAttemptAt: null,
    retryBudgetRemaining: 0,
    error: "Simulated media generation failure; retry budget exhausted.",
    errorCode: "MEDIA_JOB_RETRY_EXHAUSTED",
    deadLettered: true,
    executionMs,
    updatedAt: nowIso(),
  };
  jobs.set(updated.jobId, updated);
  deadLetterQueue.push(updated.jobId);
  slot.failedJobs += 1;
}

function reserveNextRunnableJob(workerId: string): StoryMediaJob | null {
  if (!config.enabled) {
    return null;
  }

  const nowMs = Date.now();
  for (let index = 0; index < pendingQueue.length; index += 1) {
    const jobId = pendingQueue[index];
    const job = jobs.get(jobId);
    if (!job) {
      pendingQueue.splice(index, 1);
      index -= 1;
      continue;
    }

    const runnableStatus = job.status === "queued" || job.status === "retry_waiting";
    if (!runnableStatus) {
      pendingQueue.splice(index, 1);
      index -= 1;
      continue;
    }

    if (job.nextAttemptAt) {
      const nextAttemptMs = Date.parse(job.nextAttemptAt);
      if (Number.isFinite(nextAttemptMs) && nextAttemptMs > nowMs) {
        continue;
      }
    }

    if (!canConsumeQuota(job.model, nowMs)) {
      continue;
    }

    consumeQuota(job.model, nowMs);
    pendingQueue.splice(index, 1);

    const updated: StoryMediaJob = {
      ...job,
      status: "running",
      attempts: job.attempts + 1,
      retryBudgetRemaining: Math.max(0, job.maxAttempts - (job.attempts + 1)),
      startedAt: job.startedAt ?? nowIso(),
      nextAttemptAt: null,
      error: null,
      errorCode: null,
      lastWorkerId: workerId,
      updatedAt: nowIso(),
    };
    jobs.set(jobId, updated);
    return updated;
  }

  return null;
}

async function dispatchLoop(): Promise<void> {
  if (!config.enabled || dispatchInProgress) {
    return;
  }
  dispatchInProgress = true;

  try {
    sweepExpired();
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

function queueLegacyLifecycle(jobId: string): void {
  const queueDelayMs = 120;
  const timer = setTimeout(() => {
    const existing = jobs.get(jobId);
    if (!existing || existing.status !== "queued") {
      return;
    }
    const running: StoryMediaJob = {
      ...existing,
      status: "running",
      attempts: 1,
      retryBudgetRemaining: Math.max(0, existing.maxAttempts - 1),
      startedAt: nowIso(),
      updatedAt: nowIso(),
    };
    jobs.set(jobId, running);

    const runDelay = setTimeout(() => {
      const current = jobs.get(jobId);
      if (!current || current.status !== "running") {
        return;
      }
      if (Math.random() < clamp01(current.failureRate)) {
        const failed: StoryMediaJob = {
          ...current,
          status: "failed",
          completedAt: nowIso(),
          retryBudgetRemaining: 0,
          error: "Simulated media generation failure.",
          errorCode: "MEDIA_JOB_FAILED",
          deadLettered: true,
          updatedAt: nowIso(),
        };
        jobs.set(jobId, failed);
        deadLetterQueue.push(jobId);
        return;
      }
      const completed: StoryMediaJob = {
        ...current,
        status: "completed",
        completedAt: nowIso(),
        retryBudgetRemaining: Math.max(0, current.maxAttempts - current.attempts),
        error: null,
        errorCode: null,
        deadLettered: false,
        updatedAt: nowIso(),
      };
      jobs.set(jobId, completed);
    }, 800 + Math.max(0, existing.segmentIndex) * 90);

    if (typeof runDelay.unref === "function") {
      runDelay.unref();
    }
  }, queueDelayMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

function createMediaJob(params: CreateMediaJobParams): StoryMediaJob {
  sweepExpired();
  const timestamp = nowIso();
  const maxAttempts = Math.max(1, config.maxAttempts);
  const fallbackTerminal = params.mode === "fallback";
  const job: StoryMediaJob = {
    jobId: `${params.kind}-job-${randomUUID()}`,
    kind: params.kind,
    sessionId: params.sessionId,
    runId: params.runId,
    assetId: params.assetId,
    assetRef: params.assetRef,
    segmentIndex: params.segmentIndex,
    provider: params.provider,
    model: params.model,
    mode: params.mode,
    status: fallbackTerminal ? "completed" : "queued",
    attempts: fallbackTerminal ? 1 : 0,
    maxAttempts,
    retryBudgetRemaining: fallbackTerminal ? Math.max(0, maxAttempts - 1) : maxAttempts,
    requestedAt: timestamp,
    startedAt: fallbackTerminal ? timestamp : null,
    completedAt: fallbackTerminal ? timestamp : null,
    nextAttemptAt: null,
    updatedAt: timestamp,
    error: null,
    errorCode: null,
    lastWorkerId: null,
    deadLettered: false,
    executionMs: fallbackTerminal ? 0 : null,
    failureRate: clamp01(params.failureRate),
  };

  jobs.set(job.jobId, job);
  if (params.mode === "simulated") {
    if (config.enabled) {
      ensureRuntimeStarted();
      pendingQueue.push(job.jobId);
      void dispatchLoop();
    } else {
      queueLegacyLifecycle(job.jobId);
    }
  }
  return cloneJob(job);
}

export function createVideoMediaJob(params: CreateVideoMediaJobParams): StoryMediaJob {
  return createMediaJob({
    ...params,
    kind: "video",
  });
}

export function getMediaJobsByIds(jobIds: string[]): StoryMediaJob[] {
  sweepExpired();
  const results: StoryMediaJob[] = [];
  for (const jobId of jobIds) {
    const record = jobs.get(jobId);
    if (record) {
      results.push(cloneJob(record));
    }
  }
  return results;
}

export function getMediaJobQueueSnapshot(): StoryMediaWorkerSnapshot {
  sweepExpired();
  const allJobs = Array.from(jobs.values());
  const queued = allJobs.filter((job) => job.status === "queued").length;
  const running = allJobs.filter((job) => job.status === "running").length;
  const retryWaiting = allJobs.filter((job) => job.status === "retry_waiting").length;
  const completed = allJobs.filter((job) => job.status === "completed").length;
  const failed = allJobs.filter((job) => job.status === "failed").length;
  const deadLetter = allJobs.filter((job) => job.deadLettered).length;

  const oldestQueued = allJobs
    .filter((job) => job.status === "queued" || job.status === "retry_waiting")
    .map((job) => Date.parse(job.requestedAt))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)[0];

  const models = new Set<string>([
    ...Array.from(config.quotaRules.keys()),
    ...Array.from(quotaLedger.keys()),
    ...allJobs.map((job) => job.model.trim().toLowerCase()),
  ]);
  const nowMs = Date.now();
  const quotas = Array.from(models)
    .filter((model) => model.length > 0)
    .sort()
    .map((model) => {
      const rule = resolveQuotaRule(model);
      const cutoff = nowMs - rule.windowMs;
      const used = (quotaLedger.get(model) ?? []).filter((value) => value >= cutoff).length;
      return {
        model,
        perWindow: rule.perWindow,
        windowMs: rule.windowMs,
        used,
        available: Math.max(0, rule.perWindow - used),
      };
    });

  return {
    runtime: {
      enabled: config.enabled,
      started: runtimeStartedAt !== null,
      startedAt: runtimeStartedAt,
      concurrency: config.concurrency,
      pollMs: config.pollMs,
      maxAttempts: config.maxAttempts,
      backoffBaseMs: config.backoffBaseMs,
      backoffMaxMs: config.backoffMaxMs,
    },
    queue: {
      queued,
      running,
      retryWaiting,
      completed,
      failed,
      deadLetter,
      backlog: queued + retryWaiting,
      oldestQueuedAgeMs: Number.isFinite(oldestQueued) ? Math.max(0, nowMs - oldestQueued) : null,
    },
    workers: workerSlots.map((slot) => ({
      workerId: slot.workerId,
      activeJobId: slot.activeJobId,
      processedJobs: slot.processedJobs,
      failedJobs: slot.failedJobs,
    })),
    quotas,
  };
}
