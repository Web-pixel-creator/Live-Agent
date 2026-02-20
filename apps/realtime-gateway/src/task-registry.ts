import { randomUUID } from "node:crypto";

export type TaskStatus = "queued" | "running" | "pending_approval" | "completed" | "failed";

export type TaskRecord = {
  taskId: string;
  sessionId: string;
  runId: string | null;
  intent: string | null;
  route: string | null;
  status: TaskStatus;
  progressPct: number;
  stage: string;
  createdAt: string;
  updatedAt: string;
  source: "gateway";
  error: string | null;
};

type StartTaskParams = {
  taskId?: string;
  sessionId: string;
  runId?: string | null;
  intent?: string | null;
  route?: string | null;
  stage?: string;
};

type UpdateTaskParams = {
  status?: TaskStatus;
  progressPct?: number;
  stage?: string;
  route?: string | null;
  error?: string | null;
};

type TaskRegistryConfig = {
  completedRetentionMs: number;
  maxEntries: number;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.floor(value)));
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function normalizeTaskId(taskId: string | undefined): string {
  if (typeof taskId === "string" && taskId.trim().length > 0) {
    return taskId.trim();
  }
  return `task-${randomUUID()}`;
}

function isTerminal(status: TaskStatus): boolean {
  return status === "completed" || status === "failed";
}

export class TaskRegistry {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly completedRetentionMs: number;
  private readonly maxEntries: number;

  constructor(config: TaskRegistryConfig) {
    this.completedRetentionMs = Math.max(1000, config.completedRetentionMs);
    this.maxEntries = Math.max(50, config.maxEntries);
  }

  private cleanupExpired(nowMs: number): void {
    for (const [taskId, task] of this.tasks.entries()) {
      if (!isTerminal(task.status)) {
        continue;
      }
      const ageMs = nowMs - Date.parse(task.updatedAt);
      if (Number.isFinite(ageMs) && ageMs > this.completedRetentionMs) {
        this.tasks.delete(taskId);
      }
    }
  }

  private enforceMaxEntries(nowMs: number): void {
    if (this.tasks.size <= this.maxEntries) {
      return;
    }
    const entries = [...this.tasks.values()].sort(
      (left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt),
    );
    const overflow = this.tasks.size - this.maxEntries;
    for (let index = 0; index < overflow && index < entries.length; index += 1) {
      const candidate = entries[index];
      if (!candidate) {
        break;
      }
      if (!isTerminal(candidate.status)) {
        continue;
      }
      this.tasks.delete(candidate.taskId);
    }
    this.cleanupExpired(nowMs);
  }

  private runMaintenance(): void {
    const nowMs = Date.now();
    this.cleanupExpired(nowMs);
    this.enforceMaxEntries(nowMs);
  }

  startTask(params: StartTaskParams): TaskRecord {
    const now = toIsoNow();
    const taskId = normalizeTaskId(params.taskId);
    const existing = this.tasks.get(taskId);
    if (existing) {
      const updated: TaskRecord = {
        ...existing,
        status: existing.status === "completed" || existing.status === "failed" ? "running" : existing.status,
        progressPct: existing.status === "completed" || existing.status === "failed" ? 0 : existing.progressPct,
        stage: params.stage ?? "received",
        sessionId: params.sessionId,
        runId: params.runId ?? existing.runId,
        intent: params.intent ?? existing.intent,
        route: params.route ?? existing.route,
        updatedAt: now,
        error: null,
      };
      this.tasks.set(taskId, updated);
      this.runMaintenance();
      return updated;
    }

    const created: TaskRecord = {
      taskId,
      sessionId: params.sessionId,
      runId: params.runId ?? null,
      intent: params.intent ?? null,
      route: params.route ?? null,
      status: "queued",
      progressPct: 0,
      stage: params.stage ?? "received",
      createdAt: now,
      updatedAt: now,
      source: "gateway",
      error: null,
    };
    this.tasks.set(taskId, created);
    this.runMaintenance();
    return created;
  }

  updateTask(taskId: string, params: UpdateTaskParams): TaskRecord | null {
    const existing = this.tasks.get(taskId);
    if (!existing) {
      return null;
    }
    const nextStatus = params.status ?? existing.status;
    const updated: TaskRecord = {
      ...existing,
      status: nextStatus,
      progressPct:
        typeof params.progressPct === "number"
          ? clampPercent(params.progressPct)
          : isTerminal(nextStatus)
            ? 100
            : existing.progressPct,
      stage: params.stage ?? existing.stage,
      route: params.route ?? existing.route,
      updatedAt: toIsoNow(),
      error: params.error ?? existing.error,
    };
    this.tasks.set(taskId, updated);
    this.runMaintenance();
    return updated;
  }

  getTask(taskId: string): TaskRecord | null {
    const found = this.tasks.get(taskId);
    return found ? { ...found } : null;
  }

  listActive(params?: { sessionId?: string; limit?: number }): TaskRecord[] {
    const sessionId = params?.sessionId;
    const limit = Math.max(1, Math.min(500, params?.limit ?? 100));
    const values = [...this.tasks.values()]
      .filter((task) => !isTerminal(task.status))
      .filter((task) => (sessionId ? task.sessionId === sessionId : true))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit)
      .map((task) => ({ ...task }));
    return values;
  }
}

