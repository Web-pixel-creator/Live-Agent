import { FieldValue, Firestore, Timestamp } from "@google-cloud/firestore";

export type FirestoreState = {
  enabled: boolean;
  ready: boolean;
  reason: string;
};

export type SessionMode = "live" | "story" | "ui" | "multi";
export type SessionStatus = "active" | "paused" | "closed";

export type SessionListItem = {
  sessionId: string;
  mode: SessionMode;
  status: SessionStatus;
  version: number;
  lastMutationId: string | null;
  updatedAt: string;
};

export type SessionUpdateResult =
  | {
      outcome: "updated" | "idempotent_replay";
      session: SessionListItem;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "version_conflict";
      session: SessionListItem;
      expectedVersion: number;
      actualVersion: number;
    };

export type RunListItem = {
  runId: string;
  sessionId: string;
  status: string;
  route?: string;
  updatedAt: string;
};

export type EventListItem = {
  eventId: string;
  sessionId: string;
  runId?: string;
  type: string;
  source: string;
  createdAt: string;
  route?: string;
  status?: string;
  intent?: string;
  traceId?: string;
  approvalId?: string;
  approvalStatus?: string;
  delegatedRoute?: string;
  traceSteps?: number;
  screenshotRefs?: number;
  hasVisualTesting?: boolean;
  hasError?: boolean;
};

export type ApprovalStatus = "pending" | "approved" | "rejected" | "timeout";

export type ApprovalDecision = "approved" | "rejected";

export type ApprovalAuditEntry = {
  ts: string;
  actor: string;
  action: string;
  reason?: string;
  metadata?: unknown;
};

export type ApprovalRecord = {
  approvalId: string;
  sessionId: string;
  runId: string;
  status: ApprovalStatus;
  decision: ApprovalDecision | null;
  reason: string;
  requestedAt: string;
  softDueAt: string;
  hardDueAt: string;
  resolvedAt: string | null;
  softReminderSentAt: string | null;
  auditLog: ApprovalAuditEntry[];
  createdAt: string;
  updatedAt: string;
  metadata?: unknown;
};

let firestoreClient: Firestore | null = null;
let initialized = false;
let state: FirestoreState = {
  enabled: false,
  ready: false,
  reason: "not initialized",
};

const inMemorySessions = new Map<string, SessionListItem>();
const inMemoryApprovals = new Map<string, ApprovalRecord>();
const DEFAULT_APPROVAL_SOFT_TIMEOUT_MS = 60 * 1000;
const DEFAULT_APPROVAL_HARD_TIMEOUT_MS = 5 * 60 * 1000;

function shouldEnableFirestore(): boolean {
  if (process.env.FIRESTORE_ENABLED === "true") {
    return true;
  }
  if (process.env.FIRESTORE_ENABLED === "false") {
    return false;
  }
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT);
}

function initFirestore(): Firestore | null {
  if (initialized) {
    return firestoreClient;
  }

  initialized = true;
  if (!shouldEnableFirestore()) {
    state = {
      enabled: false,
      ready: false,
      reason: "FIRESTORE_ENABLED=false and GOOGLE_CLOUD_PROJECT not set",
    };
    return null;
  }

  try {
    firestoreClient = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      databaseId: process.env.FIRESTORE_DATABASE ?? "(default)",
    });
    state = {
      enabled: true,
      ready: true,
      reason: "initialized",
    };
    return firestoreClient;
  } catch (error) {
    firestoreClient = null;
    state = {
      enabled: true,
      ready: false,
      reason: error instanceof Error ? error.message : "unknown Firestore init error",
    };
    return null;
  }
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return new Date().toISOString();
}

function sanitizeMode(raw: unknown): SessionMode {
  return raw === "story" || raw === "ui" || raw === "multi" ? raw : "live";
}

function sanitizeStatus(raw: unknown): SessionStatus {
  return raw === "paused" || raw === "closed" ? raw : "active";
}

function sanitizeVersion(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.floor(parsed);
    }
  }
  return 1;
}

function normalizeMutationId(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim();
  if (normalized.length === 0) {
    return null;
  }
  return normalized.slice(0, 128);
}

function normalizeApprovalStatus(raw: unknown): ApprovalStatus {
  if (raw === "approved" || raw === "rejected" || raw === "timeout") {
    return raw;
  }
  if (raw === "pending") {
    return "pending";
  }
  return "pending";
}

function normalizeApprovalDecision(raw: unknown): ApprovalDecision | null {
  if (raw === "approved" || raw === "rejected") {
    return raw;
  }
  return null;
}

function createApprovalAuditEntry(params: {
  actor: string;
  action: string;
  reason?: string;
  metadata?: unknown;
  ts?: string;
}): ApprovalAuditEntry {
  const entry: ApprovalAuditEntry = {
    ts: params.ts ?? new Date().toISOString(),
    actor: params.actor,
    action: params.action,
  };
  if (params.reason && params.reason.trim().length > 0) {
    entry.reason = params.reason.trim();
  }
  if (params.metadata !== undefined) {
    entry.metadata = params.metadata;
  }
  return entry;
}

function parseAuditLog(raw: unknown): ApprovalAuditEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const entries: ApprovalAuditEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const typed = item as {
      ts?: unknown;
      actor?: unknown;
      action?: unknown;
      reason?: unknown;
      metadata?: unknown;
    };
    const ts = toIso(typed.ts);
    const actor = typeof typed.actor === "string" && typed.actor.trim().length > 0 ? typed.actor.trim() : "unknown";
    const action = typeof typed.action === "string" && typed.action.trim().length > 0 ? typed.action.trim() : "event";
    const entry: ApprovalAuditEntry = {
      ts,
      actor,
      action,
    };
    if (typeof typed.reason === "string" && typed.reason.trim().length > 0) {
      entry.reason = typed.reason.trim();
    }
    if (typed.metadata !== undefined) {
      entry.metadata = typed.metadata;
    }
    entries.push(entry);
  }
  return entries.slice(-50);
}

function addAuditEntry(log: ApprovalAuditEntry[], entry: ApprovalAuditEntry): ApprovalAuditEntry[] {
  return [...log, entry].slice(-50);
}

function dueAtIso(baseIso: string, deltaMs: number): string {
  const baseMs = Date.parse(baseIso);
  const safeBaseMs = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(safeBaseMs + deltaMs).toISOString();
}

function mapApprovalRecord(docId: string, raw: Record<string, unknown>): ApprovalRecord {
  const requestedAt = toIso(raw.requestedAt ?? raw.createdAt);
  const softDueAt = toIso(raw.softDueAt ?? dueAtIso(requestedAt, DEFAULT_APPROVAL_SOFT_TIMEOUT_MS));
  const hardDueAt = toIso(raw.hardDueAt ?? dueAtIso(requestedAt, DEFAULT_APPROVAL_HARD_TIMEOUT_MS));
  const status = normalizeApprovalStatus(raw.status ?? raw.decision);
  const decision = normalizeApprovalDecision(raw.decision);
  const resolvedAtRaw = raw.resolvedAt ?? (status === "pending" ? null : raw.updatedAt ?? raw.createdAt);
  const resolvedAt = resolvedAtRaw ? toIso(resolvedAtRaw) : null;
  const softReminderSentAtRaw = raw.softReminderSentAt;
  const softReminderSentAt = softReminderSentAtRaw ? toIso(softReminderSentAtRaw) : null;
  const auditLog = parseAuditLog(raw.auditLog);
  const reason = typeof raw.reason === "string" ? raw.reason : status === "pending" ? "Awaiting approval decision" : "";

  return {
    approvalId: docId,
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : "unknown",
    runId: typeof raw.runId === "string" ? raw.runId : "unknown",
    status,
    decision,
    reason,
    requestedAt,
    softDueAt,
    hardDueAt,
    resolvedAt,
    softReminderSentAt,
    auditLog,
    createdAt: toIso(raw.createdAt ?? requestedAt),
    updatedAt: toIso(raw.updatedAt ?? requestedAt),
    metadata: raw.metadata,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  return normalized;
}

function toNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function mapEventRecord(docId: string, raw: Record<string, unknown>, fallbackSessionId?: string): EventListItem {
  const payload = asRecord(raw.payload);
  const output = payload ? asRecord(payload.output) : null;
  const execution = output ? asRecord(output.execution) : null;
  const approval = output ? asRecord(output.approval) : null;
  const delegation = output ? asRecord(output.delegation) : null;
  const visualTesting = output ? asRecord(output.visualTesting) : null;

  const intent =
    toNonEmptyString(payload?.intent) ??
    toNonEmptyString(output?.handledIntent) ??
    undefined;
  const route = toNonEmptyString(payload?.route) ?? undefined;
  const status = toNonEmptyString(payload?.status) ?? undefined;
  const traceId =
    toNonEmptyString(payload?.traceId) ??
    toNonEmptyString(output?.traceId) ??
    undefined;
  const approvalId =
    toNonEmptyString(output?.approvalId) ??
    toNonEmptyString(approval?.approvalId) ??
    undefined;
  const approvalStatus =
    toNonEmptyString(approval?.decision) ??
    (output?.approvalRequired === true ? "pending" : null) ??
    undefined;
  const delegatedRoute = toNonEmptyString(delegation?.delegatedRoute) ?? undefined;

  let traceSteps: number | undefined;
  let screenshotRefs: number | undefined;
  const trace = execution?.trace;
  if (Array.isArray(trace)) {
    traceSteps = trace.length;
    let screenshotCount = 0;
    for (const step of trace) {
      if (!asRecord(step)) {
        continue;
      }
      const screenshotRef = toNonEmptyString(step.screenshotRef);
      if (screenshotRef) {
        screenshotCount += 1;
      }
    }
    screenshotRefs = screenshotCount;
  } else {
    traceSteps = toNonNegativeInt(execution?.traceSteps) ?? undefined;
    screenshotRefs = toNonNegativeInt(execution?.screenshotRefs) ?? undefined;
  }

  const hasVisualTesting = visualTesting !== null ? true : undefined;
  const hasError = Boolean(payload?.error) || status === "failed" || raw.type === "gateway.error";

  return {
    eventId: docId,
    sessionId:
      toNonEmptyString(raw.sessionId) ??
      toNonEmptyString(fallbackSessionId) ??
      "unknown",
    runId: toNonEmptyString(raw.runId) ?? undefined,
    type: toNonEmptyString(raw.type) ?? "unknown",
    source: toNonEmptyString(raw.source) ?? "unknown",
    createdAt: toIso(raw.createdAt),
    route,
    status,
    intent,
    traceId,
    approvalId,
    approvalStatus,
    delegatedRoute,
    traceSteps,
    screenshotRefs,
    hasVisualTesting,
    hasError,
  };
}

function ensurePendingLifecycle(params: {
  existing: ApprovalRecord | null;
  approvalId: string;
  sessionId: string;
  runId: string;
  metadata?: unknown;
  softTimeoutMs: number;
  hardTimeoutMs: number;
  actor: string;
  actionType: string;
  requestedAtIso?: string;
}): ApprovalRecord {
  const nowIso = new Date().toISOString();
  const requestedAt = params.existing?.requestedAt ?? params.requestedAtIso ?? nowIso;
  const createdAt = params.existing?.createdAt ?? nowIso;
  const softDueAt = params.existing?.softDueAt ?? dueAtIso(requestedAt, params.softTimeoutMs);
  const hardDueAt = params.existing?.hardDueAt ?? dueAtIso(requestedAt, params.hardTimeoutMs);
  const existingAudit = params.existing?.auditLog ?? [];

  return {
    approvalId: params.approvalId,
    sessionId: params.sessionId,
    runId: params.runId,
    status: "pending",
    decision: null,
    reason: "Awaiting approval decision",
    requestedAt,
    softDueAt,
    hardDueAt,
    resolvedAt: null,
    softReminderSentAt: params.existing?.softReminderSentAt ?? null,
    auditLog: addAuditEntry(
      existingAudit,
      createApprovalAuditEntry({
        actor: params.actor,
        action: "pending_registered",
        reason: params.actionType,
        metadata: params.metadata,
      }),
    ),
    createdAt,
    updatedAt: nowIso,
    metadata: params.metadata ?? params.existing?.metadata,
  };
}

function mapSessionRecord(sessionId: string, raw: Record<string, unknown>): SessionListItem {
  return {
    sessionId,
    mode: sanitizeMode(raw.mode),
    status: sanitizeStatus(raw.status),
    version: sanitizeVersion(raw.version),
    lastMutationId: normalizeMutationId(raw.lastMutationId),
    updatedAt: toIso(raw.updatedAt),
  };
}

export function getFirestoreState(): FirestoreState {
  initFirestore();
  return state;
}

export async function listSessions(limit: number): Promise<SessionListItem[]> {
  const db = initFirestore();
  if (!db) {
    return Array.from(inMemorySessions.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  const snapshot = await db
    .collection("sessions")
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return mapSessionRecord(doc.id, data);
  });
}

export async function createSession(params: {
  userId: string;
  mode: SessionMode;
}): Promise<SessionListItem> {
  const nowIso = new Date().toISOString();
  const db = initFirestore();

  if (!db) {
    const sessionId = `local-${Date.now()}`;
    const created: SessionListItem = {
      sessionId,
      mode: params.mode,
      status: "active",
      version: 1,
      lastMutationId: null,
      updatedAt: nowIso,
    };
    inMemorySessions.set(sessionId, created);
    return created;
  }

  const ref = db.collection("sessions").doc();
  await ref.set(
    {
      sessionId: ref.id,
      userId: params.userId,
      mode: params.mode,
      status: "active",
      version: 1,
      lastMutationId: null,
      lastMutationStatus: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromDate(
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      ),
    },
    { merge: true },
  );

  return {
    sessionId: ref.id,
    mode: params.mode,
    status: "active",
    version: 1,
    lastMutationId: null,
    updatedAt: nowIso,
  };
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  options?: {
    expectedVersion?: number | null;
    idempotencyKey?: string | null;
  },
): Promise<SessionUpdateResult> {
  const nowIso = new Date().toISOString();
  const db = initFirestore();
  const expectedVersion =
    typeof options?.expectedVersion === "number" && Number.isFinite(options.expectedVersion) && options.expectedVersion >= 1
      ? Math.floor(options.expectedVersion)
      : null;
  const idempotencyKey = normalizeMutationId(options?.idempotencyKey);

  if (!db) {
    const existing = inMemorySessions.get(sessionId);
    if (!existing) {
      return {
        outcome: "not_found",
      };
    }
    if (idempotencyKey && existing.lastMutationId === idempotencyKey && existing.status === status) {
      return {
        outcome: "idempotent_replay",
        session: existing,
      };
    }
    if (expectedVersion !== null && existing.version !== expectedVersion) {
      return {
        outcome: "version_conflict",
        session: existing,
        expectedVersion,
        actualVersion: existing.version,
      };
    }
    const updated = {
      ...existing,
      status,
      version: existing.version + 1,
      lastMutationId: idempotencyKey,
      updatedAt: nowIso,
    };
    inMemorySessions.set(sessionId, updated);
    return {
      outcome: "updated",
      session: updated,
    };
  }

  const ref = db.collection("sessions").doc(sessionId);
  const transactionResult = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      return {
        outcome: "not_found" as const,
      };
    }

    const data = snapshot.data() ?? {};
    const existing = mapSessionRecord(sessionId, data);

    if (idempotencyKey && existing.lastMutationId === idempotencyKey && existing.status === status) {
      return {
        outcome: "idempotent_replay" as const,
        session: existing,
      };
    }
    if (expectedVersion !== null && existing.version !== expectedVersion) {
      return {
        outcome: "version_conflict" as const,
        session: existing,
        expectedVersion,
        actualVersion: existing.version,
      };
    }

    transaction.set(
      ref,
      {
        status,
        version: existing.version + 1,
        lastMutationId: idempotencyKey,
        lastMutationStatus: status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      outcome: "updated" as const,
    };
  });

  if (transactionResult.outcome === "not_found") {
    return transactionResult;
  }
  if (transactionResult.outcome === "idempotent_replay") {
    return transactionResult;
  }
  if (transactionResult.outcome === "version_conflict") {
    return transactionResult;
  }

  const updatedSnapshot = await ref.get();
  const updatedData = updatedSnapshot.data() ?? {};
  return {
    outcome: "updated",
    session: mapSessionRecord(sessionId, updatedData),
  };
}

export async function listRuns(limit: number): Promise<RunListItem[]> {
  const db = initFirestore();
  if (!db) {
    return [];
  }

  const snapshot = await db
    .collection("agent_runs")
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      runId: doc.id,
      sessionId: typeof data.sessionId === "string" ? data.sessionId : "unknown",
      status: typeof data.status === "string" ? data.status : "accepted",
      route: typeof data.route === "string" ? data.route : undefined,
      updatedAt: toIso(data.updatedAt),
    };
  });
}

export async function listEvents(params: {
  sessionId: string;
  limit: number;
}): Promise<EventListItem[]> {
  const db = initFirestore();
  if (!db) {
    return [];
  }

  const snapshot = await db
    .collection("events")
    .where("sessionId", "==", params.sessionId)
    .orderBy("createdAt", "desc")
    .limit(params.limit)
    .get();

  return snapshot.docs.map((doc) =>
    mapEventRecord(doc.id, doc.data() as Record<string, unknown>, params.sessionId),
  );
}

export async function listRecentEvents(limit: number): Promise<EventListItem[]> {
  const db = initFirestore();
  if (!db) {
    return [];
  }

  const snapshot = await db
    .collection("events")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => mapEventRecord(doc.id, doc.data() as Record<string, unknown>));
}

export async function listApprovals(params: {
  limit: number;
  sessionId?: string;
}): Promise<ApprovalRecord[]> {
  const db = initFirestore();
  if (!db) {
    const values = Array.from(inMemoryApprovals.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    if (!params.sessionId) {
      return values.slice(0, params.limit);
    }
    return values.filter((item) => item.sessionId === params.sessionId).slice(0, params.limit);
  }

  let query = db.collection("approvals").orderBy("updatedAt", "desc");
  if (params.sessionId) {
    query = query.where("sessionId", "==", params.sessionId);
  }
  const snapshot = await query.limit(params.limit).get();

  return snapshot.docs.map((doc) => mapApprovalRecord(doc.id, doc.data() as Record<string, unknown>));
}

export type ApprovalSweepResult = {
  scanned: number;
  softReminders: number;
  hardTimeouts: number;
  updatedApprovalIds: string[];
};

export async function upsertPendingApproval(params: {
  approvalId: string;
  sessionId: string;
  runId: string;
  actionType: string;
  metadata?: unknown;
  actor?: string;
  softTimeoutMs?: number;
  hardTimeoutMs?: number;
  requestedAtIso?: string;
}): Promise<ApprovalRecord> {
  const softTimeoutMs = Math.max(1000, params.softTimeoutMs ?? DEFAULT_APPROVAL_SOFT_TIMEOUT_MS);
  const hardTimeoutMs = Math.max(softTimeoutMs + 1000, params.hardTimeoutMs ?? DEFAULT_APPROVAL_HARD_TIMEOUT_MS);
  const actor = params.actor ?? "system";
  const db = initFirestore();

  if (!db) {
    const existing = inMemoryApprovals.get(params.approvalId) ?? null;
    if (existing && existing.status !== "pending") {
      return existing;
    }
    const pending = ensurePendingLifecycle({
      existing,
      approvalId: params.approvalId,
      sessionId: params.sessionId,
      runId: params.runId,
      metadata: params.metadata,
      softTimeoutMs,
      hardTimeoutMs,
      actor,
      actionType: params.actionType,
      requestedAtIso: params.requestedAtIso,
    });
    inMemoryApprovals.set(params.approvalId, pending);
    return pending;
  }

  const ref = db.collection("approvals").doc(params.approvalId);
  const snapshot = await ref.get();
  const existing = snapshot.exists ? mapApprovalRecord(ref.id, snapshot.data() as Record<string, unknown>) : null;
  if (existing && existing.status !== "pending") {
    return existing;
  }

  const pending = ensurePendingLifecycle({
    existing,
    approvalId: params.approvalId,
    sessionId: params.sessionId,
    runId: params.runId,
    metadata: params.metadata,
    softTimeoutMs,
    hardTimeoutMs,
    actor,
    actionType: params.actionType,
    requestedAtIso: params.requestedAtIso,
  });

  await ref.set(
    {
      approvalId: pending.approvalId,
      sessionId: pending.sessionId,
      runId: pending.runId,
      status: pending.status,
      decision: pending.decision,
      reason: pending.reason,
      requestedAt: pending.requestedAt,
      softDueAt: pending.softDueAt,
      hardDueAt: pending.hardDueAt,
      resolvedAt: pending.resolvedAt,
      softReminderSentAt: pending.softReminderSentAt,
      auditLog: pending.auditLog,
      metadata: pending.metadata ?? null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: snapshot.exists ? (snapshot.data()?.createdAt ?? FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
    },
    { merge: true },
  );

  const stored = await ref.get();
  return mapApprovalRecord(ref.id, (stored.data() ?? {}) as Record<string, unknown>);
}

export async function recordApprovalDecision(params: {
  approvalId: string;
  sessionId: string;
  runId: string;
  decision: ApprovalDecision;
  reason: string;
  metadata?: unknown;
  actor?: string;
}): Promise<ApprovalRecord> {
  const nowIso = new Date().toISOString();
  const actor = params.actor ?? "operator";
  const db = initFirestore();

  if (!db) {
    const existing = inMemoryApprovals.get(params.approvalId) ?? null;
    const pending = existing
      ? existing
      : await upsertPendingApproval({
          approvalId: params.approvalId,
          sessionId: params.sessionId,
          runId: params.runId,
          actionType: "ui_task",
          metadata: params.metadata,
          actor: "system",
        });
    if (pending.status === "timeout") {
      return pending;
    }
    const next: ApprovalRecord = {
      ...pending,
      status: params.decision,
      decision: params.decision,
      reason: params.reason,
      resolvedAt: nowIso,
      updatedAt: nowIso,
      metadata: params.metadata ?? pending.metadata,
      auditLog: addAuditEntry(
        pending.auditLog,
        createApprovalAuditEntry({
          actor,
          action: `decision_${params.decision}`,
          reason: params.reason,
          metadata: params.metadata,
          ts: nowIso,
        }),
      ),
    };
    inMemoryApprovals.set(params.approvalId, next);
    return next;
  }

  const ref = db.collection("approvals").doc(params.approvalId);
  const snapshot = await ref.get();
  const pending = snapshot.exists
    ? mapApprovalRecord(ref.id, snapshot.data() as Record<string, unknown>)
    : await upsertPendingApproval({
        approvalId: params.approvalId,
        sessionId: params.sessionId,
        runId: params.runId,
        actionType: "ui_task",
        metadata: params.metadata,
        actor: "system",
      });

  if (pending.status === "timeout") {
    return pending;
  }

  const auditLog = addAuditEntry(
    pending.auditLog,
    createApprovalAuditEntry({
      actor,
      action: `decision_${params.decision}`,
      reason: params.reason,
      metadata: params.metadata,
      ts: nowIso,
    }),
  );

  await ref.set(
    {
      approvalId: params.approvalId,
      sessionId: params.sessionId,
      runId: params.runId,
      status: params.decision,
      decision: params.decision,
      reason: params.reason,
      requestedAt: pending.requestedAt,
      softDueAt: pending.softDueAt,
      hardDueAt: pending.hardDueAt,
      resolvedAt: nowIso,
      auditLog,
      metadata: params.metadata ?? pending.metadata ?? null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: snapshot.exists ? (snapshot.data()?.createdAt ?? FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
    },
    { merge: true },
  );

  const stored = await ref.get();
  return mapApprovalRecord(ref.id, (stored.data() ?? {}) as Record<string, unknown>);
}

export async function sweepApprovalTimeouts(params: {
  nowIso?: string;
  limit?: number;
}): Promise<ApprovalSweepResult> {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const limit = Math.max(1, Math.min(1000, params.limit ?? 200));
  const result: ApprovalSweepResult = {
    scanned: 0,
    softReminders: 0,
    hardTimeouts: 0,
    updatedApprovalIds: [],
  };
  const db = initFirestore();

  if (!db) {
    for (const [approvalId, approval] of inMemoryApprovals.entries()) {
      if (result.scanned >= limit) {
        break;
      }
      if (approval.status !== "pending") {
        continue;
      }
      result.scanned += 1;
      const softDueMs = Date.parse(approval.softDueAt);
      const hardDueMs = Date.parse(approval.hardDueAt);
      let next = approval;

      if (Number.isFinite(softDueMs) && nowMs >= softDueMs && !approval.softReminderSentAt) {
        next = {
          ...next,
          softReminderSentAt: nowIso,
          updatedAt: nowIso,
          auditLog: addAuditEntry(
            next.auditLog,
            createApprovalAuditEntry({
              actor: "system",
              action: "soft_timeout_reminder",
              reason: "Approval is still pending after soft timeout threshold",
              ts: nowIso,
            }),
          ),
        };
        result.softReminders += 1;
      }

      if (Number.isFinite(hardDueMs) && nowMs >= hardDueMs) {
        next = {
          ...next,
          status: "timeout",
          decision: null,
          reason: "Approval timed out by SLA hard timeout policy",
          resolvedAt: nowIso,
          updatedAt: nowIso,
          auditLog: addAuditEntry(
            next.auditLog,
            createApprovalAuditEntry({
              actor: "system",
              action: "hard_timeout_auto_reject",
              reason: "Approval reached hard timeout and was auto-closed",
              ts: nowIso,
            }),
          ),
        };
        result.hardTimeouts += 1;
      }

      if (next !== approval) {
        inMemoryApprovals.set(approvalId, next);
        result.updatedApprovalIds.push(approvalId);
      }
    }
    return result;
  }

  const snapshot = await db
    .collection("approvals")
    .where("status", "==", "pending")
    .limit(limit)
    .get();

  for (const doc of snapshot.docs) {
    const approval = mapApprovalRecord(doc.id, doc.data() as Record<string, unknown>);
    result.scanned += 1;
    const softDueMs = Date.parse(approval.softDueAt);
    const hardDueMs = Date.parse(approval.hardDueAt);
    let changed = false;
    let status: ApprovalStatus = approval.status;
    let decision = approval.decision;
    let reason = approval.reason;
    let resolvedAt = approval.resolvedAt;
    let softReminderSentAt = approval.softReminderSentAt;
    let auditLog = approval.auditLog;

    if (Number.isFinite(softDueMs) && nowMs >= softDueMs && !softReminderSentAt) {
      softReminderSentAt = nowIso;
      auditLog = addAuditEntry(
        auditLog,
        createApprovalAuditEntry({
          actor: "system",
          action: "soft_timeout_reminder",
          reason: "Approval is still pending after soft timeout threshold",
          ts: nowIso,
        }),
      );
      changed = true;
      result.softReminders += 1;
    }

    if (Number.isFinite(hardDueMs) && nowMs >= hardDueMs) {
      status = "timeout";
      decision = null;
      reason = "Approval timed out by SLA hard timeout policy";
      resolvedAt = nowIso;
      auditLog = addAuditEntry(
        auditLog,
        createApprovalAuditEntry({
          actor: "system",
          action: "hard_timeout_auto_reject",
          reason: "Approval reached hard timeout and was auto-closed",
          ts: nowIso,
        }),
      );
      changed = true;
      result.hardTimeouts += 1;
    }

    if (!changed) {
      continue;
    }

    await doc.ref.set(
      {
        status,
        decision,
        reason,
        resolvedAt,
        softReminderSentAt,
        auditLog,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    result.updatedApprovalIds.push(doc.id);
  }

  return result;
}
