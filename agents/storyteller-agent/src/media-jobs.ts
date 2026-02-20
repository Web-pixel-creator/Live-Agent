import { randomUUID } from "node:crypto";

export type StoryMediaJobKind = "video";

export type StoryMediaJobStatus = "queued" | "running" | "completed" | "failed";

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
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  error: string | null;
};

type CreateVideoMediaJobParams = {
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

const jobs = new Map<string, StoryMediaJob>();

const RETENTION_MS = (() => {
  const parsed = Number(process.env.STORYTELLER_MEDIA_JOB_RETENTION_MS ?? "3600000");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 3600000;
  }
  return Math.floor(parsed);
})();

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

function sweepExpired(): void {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    const terminal = job.status === "completed" || job.status === "failed";
    if (!terminal) {
      continue;
    }
    const updatedAtMs = Date.parse(job.updatedAt);
    if (!Number.isFinite(updatedAtMs)) {
      continue;
    }
    if (now - updatedAtMs > RETENTION_MS) {
      jobs.delete(jobId);
    }
  }
}

function updateJob(
  jobId: string,
  patch: Partial<Pick<StoryMediaJob, "status" | "attempts" | "startedAt" | "completedAt" | "error">>,
): void {
  const existing = jobs.get(jobId);
  if (!existing) {
    return;
  }
  const next: StoryMediaJob = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };
  jobs.set(jobId, next);
}

function scheduleSimulatedLifecycle(job: StoryMediaJob, failureRate: number): void {
  const queueDelayMs = 120 + job.segmentIndex * 35;
  const runDelayMs = 900 + job.segmentIndex * 110;

  setTimeout(() => {
    updateJob(job.jobId, {
      status: "running",
      startedAt: nowIso(),
      attempts: 1,
      error: null,
    });
  }, queueDelayMs);

  setTimeout(() => {
    if (Math.random() < clamp01(failureRate)) {
      updateJob(job.jobId, {
        status: "failed",
        completedAt: nowIso(),
        error: "Simulated Veo generation failure",
      });
      return;
    }
    updateJob(job.jobId, {
      status: "completed",
      completedAt: nowIso(),
      error: null,
    });
  }, queueDelayMs + runDelayMs);
}

export function createVideoMediaJob(params: CreateVideoMediaJobParams): StoryMediaJob {
  sweepExpired();
  const timestamp = nowIso();
  const job: StoryMediaJob = {
    jobId: `video-job-${randomUUID()}`,
    kind: "video",
    sessionId: params.sessionId,
    runId: params.runId,
    assetId: params.assetId,
    assetRef: params.assetRef,
    segmentIndex: params.segmentIndex,
    provider: params.provider,
    model: params.model,
    mode: params.mode,
    status: params.mode === "fallback" ? "completed" : "queued",
    attempts: params.mode === "fallback" ? 1 : 0,
    requestedAt: timestamp,
    startedAt: params.mode === "fallback" ? timestamp : null,
    completedAt: params.mode === "fallback" ? timestamp : null,
    updatedAt: timestamp,
    error: null,
  };

  jobs.set(job.jobId, job);
  if (params.mode === "simulated") {
    scheduleSimulatedLifecycle(job, params.failureRate);
  }

  return cloneJob(job);
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
