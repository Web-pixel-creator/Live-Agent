import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type EnvOverrides = Record<string, string | undefined>;

async function withEnv<T>(overrides: EnvOverrides, fn: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function importFreshModule<T>(workspaceRelativePath: string): Promise<T> {
  const absolute = resolve(process.cwd(), workspaceRelativePath);
  const fileUrl = pathToFileURL(absolute).href;
  const uniqueUrl = `${fileUrl}?t=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return (await import(uniqueUrl)) as T;
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 40));
  }
  throw new Error(`condition not satisfied within ${timeoutMs}ms`);
}

test("story-cache builds deterministic keys for semantically identical payloads", { concurrency: false }, async () => {
  const cacheModule = await importFreshModule<{
    buildStoryCacheKey(namespace: string, payload: unknown): string;
  }>("agents/storyteller-agent/src/story-cache.ts");

  const payloadA = {
    style: "cinematic",
    prompt: "A short branchable story",
    context: {
      locale: "en",
      segmentCount: 3,
    },
  };
  const payloadB = {
    context: {
      segmentCount: 3,
      locale: "en",
    },
    prompt: "A short branchable story",
    style: "cinematic",
  };

  const keyA = cacheModule.buildStoryCacheKey("story.plan", payloadA);
  const keyB = cacheModule.buildStoryCacheKey("story.plan", payloadB);
  assert.equal(keyA, keyB);
});

test("story-cache invalidates entries when model fingerprint changes", { concurrency: false }, async () => {
  const cacheModule = await importFreshModule<{
    ensureStoryCachePolicy(params: { modelFingerprint: string; purgeToken?: string | null }): void;
    setInStoryCache<T>(scope: "plan" | "branch" | "asset", key: string, value: T): void;
    getStoryCacheSnapshot(): {
      totals: { entries: number; invalidations: number };
      lastInvalidation: { reason: string | null };
    };
  }>("agents/storyteller-agent/src/story-cache.ts");

  cacheModule.ensureStoryCachePolicy({
    modelFingerprint: "story-cache-v1|planner=gemini-3-pro",
    purgeToken: "unit-token",
  });
  cacheModule.setInStoryCache("plan", "plan:unit-key", { title: "Segment 1" });
  const beforeChange = cacheModule.getStoryCacheSnapshot();
  assert.equal(beforeChange.totals.entries, 1);

  cacheModule.ensureStoryCachePolicy({
    modelFingerprint: "story-cache-v2|planner=gemini-3-pro",
    purgeToken: "unit-token",
  });
  const afterChange = cacheModule.getStoryCacheSnapshot();
  assert.equal(afterChange.totals.entries, 0);
  assert.ok(afterChange.totals.invalidations >= beforeChange.totals.invalidations + 1);
  assert.equal(afterChange.lastInvalidation.reason, "model_fingerprint_changed");
});

test("story-cache invalidates entries when purge token rotates", { concurrency: false }, async () => {
  const cacheModule = await importFreshModule<{
    ensureStoryCachePolicy(params: { modelFingerprint: string; purgeToken?: string | null }): void;
    setInStoryCache<T>(scope: "plan" | "branch" | "asset", key: string, value: T): void;
    getStoryCacheSnapshot(): {
      totals: { entries: number; invalidations: number };
      lastInvalidation: { reason: string | null };
    };
  }>("agents/storyteller-agent/src/story-cache.ts");

  cacheModule.ensureStoryCachePolicy({
    modelFingerprint: "story-cache-v1|planner=gemini-3-pro",
    purgeToken: "token-a",
  });
  cacheModule.setInStoryCache("asset", "asset:unit-key", { ref: "asset://1" });
  const beforeRotation = cacheModule.getStoryCacheSnapshot();
  assert.equal(beforeRotation.totals.entries, 1);

  cacheModule.ensureStoryCachePolicy({
    modelFingerprint: "story-cache-v1|planner=gemini-3-pro",
    purgeToken: "token-b",
  });
  const afterRotation = cacheModule.getStoryCacheSnapshot();
  assert.equal(afterRotation.totals.entries, 0);
  assert.ok(afterRotation.totals.invalidations >= beforeRotation.totals.invalidations + 1);
  assert.equal(afterRotation.lastInvalidation.reason, "manual_purge_token_changed");
});

test("media-jobs fallback mode completes immediately without queueing", { concurrency: false }, async () => {
  await withEnv(
    {
      STORYTELLER_MEDIA_WORKER_ENABLED: "false",
      STORYTELLER_MEDIA_JOB_MAX_ATTEMPTS: "2",
    },
    async () => {
      const jobsModule = await importFreshModule<{
        createVideoMediaJob(params: {
          sessionId: string;
          runId: string;
          assetId: string;
          assetRef: string;
          segmentIndex: number;
          provider: string;
          model: string;
          mode: "fallback" | "simulated";
          failureRate: number;
        }): {
          jobId: string;
          status: string;
          attempts: number;
          retryBudgetRemaining: number;
          executionMs: number | null;
        };
        getMediaJobQueueSnapshot(): {
          queue: { backlog: number };
          runtime: { enabled: boolean };
        };
      }>("agents/storyteller-agent/src/media-jobs.ts");

      const created = jobsModule.createVideoMediaJob({
        sessionId: "session-fallback",
        runId: "run-fallback",
        assetId: "asset-fallback",
        assetRef: "asset://fallback",
        segmentIndex: 0,
        provider: "veo",
        model: "veo-3.1",
        mode: "fallback",
        failureRate: 1,
      });

      assert.equal(created.status, "completed");
      assert.equal(created.attempts, 1);
      assert.equal(created.retryBudgetRemaining, 1);
      assert.equal(created.executionMs, 0);

      const queueSnapshot = jobsModule.getMediaJobQueueSnapshot();
      assert.equal(queueSnapshot.runtime.enabled, false);
      assert.equal(queueSnapshot.queue.backlog, 0);
    },
  );
});

test("media-jobs simulated mode uses worker queue, quota ledger, and completes", { concurrency: false }, async () => {
  await withEnv(
    {
      STORYTELLER_MEDIA_WORKER_ENABLED: "true",
      STORYTELLER_MEDIA_WORKER_CONCURRENCY: "1",
      STORYTELLER_MEDIA_WORKER_POLL_MS: "20",
      STORYTELLER_MEDIA_JOB_MAX_ATTEMPTS: "2",
      STORYTELLER_MEDIA_JOB_RETRY_BASE_MS: "20",
      STORYTELLER_MEDIA_JOB_RETRY_MAX_MS: "40",
      STORYTELLER_MEDIA_QUOTA_RULES: "veo-3.1=1/60000",
    },
    async () => {
      const jobsModule = await importFreshModule<{
        createVideoMediaJob(params: {
          sessionId: string;
          runId: string;
          assetId: string;
          assetRef: string;
          segmentIndex: number;
          provider: string;
          model: string;
          mode: "fallback" | "simulated";
          failureRate: number;
        }): {
          jobId: string;
          status: string;
        };
        getMediaJobsByIds(jobIds: string[]): Array<{
          jobId: string;
          status: string;
          attempts: number;
          deadLettered: boolean;
          lastWorkerId: string | null;
        }>;
        getMediaJobQueueSnapshot(): {
          quotas: Array<{
            model: string;
            used: number;
            available: number;
            perWindow: number;
            windowMs: number;
          }>;
        };
      }>("agents/storyteller-agent/src/media-jobs.ts");

      const created = jobsModule.createVideoMediaJob({
        sessionId: "session-simulated",
        runId: "run-simulated",
        assetId: "asset-simulated",
        assetRef: "asset://simulated",
        segmentIndex: 1,
        provider: "veo",
        model: "veo-3.1",
        mode: "simulated",
        failureRate: 0,
      });

      assert.equal(created.status, "queued");

      await waitFor(() => {
        const records = jobsModule.getMediaJobsByIds([created.jobId]);
        return records.length === 1 && records[0].status === "completed";
      }, 6000);

      const completed = jobsModule.getMediaJobsByIds([created.jobId])[0];
      assert.equal(completed.status, "completed");
      assert.ok(completed.attempts >= 1);
      assert.equal(completed.deadLettered, false);
      assert.ok(typeof completed.lastWorkerId === "string" && completed.lastWorkerId.length > 0);

      const queueSnapshot = jobsModule.getMediaJobQueueSnapshot();
      const quota = queueSnapshot.quotas.find((item) => item.model === "veo-3.1");
      assert.ok(quota, "expected veo-3.1 quota visibility");
      assert.equal(quota?.perWindow, 1);
      assert.equal(quota?.windowMs, 60000);
      assert.ok((quota?.used ?? 0) >= 1);
      assert.ok((quota?.available ?? 0) >= 0);
    },
  );
});

test("media-jobs exhaust retry budget and dead-letter failed jobs", { concurrency: false }, async () => {
  await withEnv(
    {
      STORYTELLER_MEDIA_WORKER_ENABLED: "true",
      STORYTELLER_MEDIA_WORKER_CONCURRENCY: "1",
      STORYTELLER_MEDIA_WORKER_POLL_MS: "20",
      STORYTELLER_MEDIA_JOB_MAX_ATTEMPTS: "2",
      STORYTELLER_MEDIA_JOB_RETRY_BASE_MS: "20",
      STORYTELLER_MEDIA_JOB_RETRY_MAX_MS: "40",
      STORYTELLER_MEDIA_QUOTA_RULES: "veo-3.1=2/60000",
    },
    async () => {
      const jobsModule = await importFreshModule<{
        createVideoMediaJob(params: {
          sessionId: string;
          runId: string;
          assetId: string;
          assetRef: string;
          segmentIndex: number;
          provider: string;
          model: string;
          mode: "fallback" | "simulated";
          failureRate: number;
        }): {
          jobId: string;
          status: string;
        };
        getMediaJobsByIds(jobIds: string[]): Array<{
          jobId: string;
          status: string;
          attempts: number;
          deadLettered: boolean;
          retryBudgetRemaining: number;
          errorCode: string | null;
        }>;
        getMediaJobQueueSnapshot(): {
          queue: {
            deadLetter: number;
            failed: number;
          };
        };
      }>("agents/storyteller-agent/src/media-jobs.ts");

      const created = jobsModule.createVideoMediaJob({
        sessionId: "session-fail",
        runId: "run-fail",
        assetId: "asset-fail",
        assetRef: "asset://fail",
        segmentIndex: 2,
        provider: "veo",
        model: "veo-3.1",
        mode: "simulated",
        failureRate: 1,
      });

      assert.equal(created.status, "queued");

      await waitFor(() => {
        const records = jobsModule.getMediaJobsByIds([created.jobId]);
        return records.length === 1 && records[0].status === "failed";
      }, 8000);

      const failed = jobsModule.getMediaJobsByIds([created.jobId])[0];
      assert.equal(failed.status, "failed");
      assert.equal(failed.attempts, 2);
      assert.equal(failed.deadLettered, true);
      assert.equal(failed.retryBudgetRemaining, 0);
      assert.equal(failed.errorCode, "MEDIA_JOB_RETRY_EXHAUSTED");

      const queueSnapshot = jobsModule.getMediaJobQueueSnapshot();
      assert.ok(queueSnapshot.queue.failed >= 1);
      assert.ok(queueSnapshot.queue.deadLetter >= 1);
    },
  );
});

