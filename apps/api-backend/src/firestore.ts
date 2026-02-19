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
  updatedAt: string;
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
};

export type ApprovalDecision = "approved" | "rejected";

export type ApprovalRecord = {
  approvalId: string;
  sessionId: string;
  runId: string;
  decision: ApprovalDecision;
  reason: string;
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
    return {
      sessionId: doc.id,
      mode: sanitizeMode(data.mode),
      status: sanitizeStatus(data.status),
      updatedAt: toIso(data.updatedAt),
    };
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
    updatedAt: nowIso,
  };
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): Promise<SessionListItem | null> {
  const nowIso = new Date().toISOString();
  const db = initFirestore();

  if (!db) {
    const existing = inMemorySessions.get(sessionId);
    if (!existing) {
      return null;
    }
    const updated = { ...existing, status, updatedAt: nowIso };
    inMemorySessions.set(sessionId, updated);
    return updated;
  }

  const ref = db.collection("sessions").doc(sessionId);
  const existing = await ref.get();
  if (!existing.exists) {
    return null;
  }

  await ref.set(
    {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const data = (await ref.get()).data() ?? {};
  return {
    sessionId,
    mode: sanitizeMode(data.mode),
    status: sanitizeStatus(data.status),
    updatedAt: toIso(data.updatedAt),
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

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      eventId: doc.id,
      sessionId: typeof data.sessionId === "string" ? data.sessionId : params.sessionId,
      runId: typeof data.runId === "string" ? data.runId : undefined,
      type: typeof data.type === "string" ? data.type : "unknown",
      source: typeof data.source === "string" ? data.source : "unknown",
      createdAt: toIso(data.createdAt),
    };
  });
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

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      approvalId: doc.id,
      sessionId: typeof data.sessionId === "string" ? data.sessionId : "unknown",
      runId: typeof data.runId === "string" ? data.runId : "unknown",
      decision: data.decision === "rejected" ? "rejected" : "approved",
      reason: typeof data.reason === "string" ? data.reason : "",
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
      metadata: data.metadata,
    };
  });
}

export async function recordApprovalDecision(params: {
  approvalId: string;
  sessionId: string;
  runId: string;
  decision: ApprovalDecision;
  reason: string;
  metadata?: unknown;
}): Promise<ApprovalRecord> {
  const nowIso = new Date().toISOString();
  const db = initFirestore();

  if (!db) {
    const existing = inMemoryApprovals.get(params.approvalId);
    const createdAt = existing?.createdAt ?? nowIso;
    const record: ApprovalRecord = {
      approvalId: params.approvalId,
      sessionId: params.sessionId,
      runId: params.runId,
      decision: params.decision,
      reason: params.reason,
      createdAt,
      updatedAt: nowIso,
      metadata: params.metadata,
    };
    inMemoryApprovals.set(params.approvalId, record);
    return record;
  }

  const ref = db.collection("approvals").doc(params.approvalId);
  await ref.set(
    {
      approvalId: params.approvalId,
      sessionId: params.sessionId,
      runId: params.runId,
      decision: params.decision,
      reason: params.reason,
      metadata: params.metadata ?? null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
    },
    { merge: true },
  );

  const data = (await ref.get()).data() ?? {};
  return {
    approvalId: params.approvalId,
    sessionId: typeof data.sessionId === "string" ? data.sessionId : params.sessionId,
    runId: typeof data.runId === "string" ? data.runId : params.runId,
    decision: data.decision === "rejected" ? "rejected" : "approved",
    reason: typeof data.reason === "string" ? data.reason : params.reason,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    metadata: data.metadata,
  };
}
