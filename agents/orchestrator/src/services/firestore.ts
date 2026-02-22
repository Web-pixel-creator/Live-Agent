import type { EventEnvelope, OrchestratorIntent, SessionMode } from "@mla/contracts";
import { FieldValue, Firestore, Timestamp } from "@google-cloud/firestore";
import { AnalyticsExporter } from "./analytics-export.js";

type FirestoreState = {
  enabled: boolean;
  ready: boolean;
  reason: string;
};

type RetentionPolicy = {
  eventsDays: number;
  sessionsDays: number;
  runsDays: number;
  negotiationDays: number;
  storyAssetsDays: number;
};

let client: Firestore | null = null;
let initialized = false;
let state: FirestoreState = {
  enabled: false,
  ready: false,
  reason: "not initialized",
};

const KNOWN_INTENTS: readonly OrchestratorIntent[] = [
  "conversation",
  "translation",
  "negotiation",
  "story",
  "ui_task",
];

const retention: RetentionPolicy = {
  eventsDays: parsePositiveDays("FIRESTORE_EVENT_RETENTION_DAYS", 14),
  sessionsDays: parsePositiveDays("FIRESTORE_SESSION_RETENTION_DAYS", 90),
  runsDays: parsePositiveDays("FIRESTORE_RUN_RETENTION_DAYS", 30),
  negotiationDays: parsePositiveDays("FIRESTORE_NEGOTIATION_RETENTION_DAYS", 365),
  storyAssetsDays: parsePositiveDays("FIRESTORE_STORY_ASSET_RETENTION_DAYS", 30),
};
const analytics = new AnalyticsExporter({ serviceName: "orchestrator-firestore" });

function parsePositiveDays(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function shouldEnableFirestore(): boolean {
  if (process.env.FIRESTORE_ENABLED === "true") {
    return true;
  }
  if (process.env.FIRESTORE_ENABLED === "false") {
    return false;
  }
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT);
}

function eventTimestamp(event: EventEnvelope): Timestamp {
  const date = new Date(event.ts);
  if (Number.isNaN(date.getTime())) {
    return Timestamp.now();
  }
  return Timestamp.fromDate(date);
}

function expirationFromNow(days: number): Timestamp {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const now = Date.now();
  return Timestamp.fromDate(new Date(now + days * millisecondsPerDay));
}

function isObjectPayload(event: EventEnvelope): event is EventEnvelope<Record<string, unknown>> {
  return typeof event.payload === "object" && event.payload !== null;
}

function isKnownIntent(value: unknown): value is OrchestratorIntent {
  return typeof value === "string" && KNOWN_INTENTS.includes(value as OrchestratorIntent);
}

function initFirestore(): Firestore | null {
  if (initialized) {
    return client;
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
    client = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      databaseId: process.env.FIRESTORE_DATABASE ?? "(default)",
    });
    state = {
      enabled: true,
      ready: true,
      reason: "initialized",
    };
    return client;
  } catch (error) {
    client = null;
    state = {
      enabled: true,
      ready: false,
      reason: error instanceof Error ? error.message : "unknown Firestore init error",
    };
    return null;
  }
}

function extractRunStatus(event: EventEnvelope): string | undefined {
  if (!isObjectPayload(event)) {
    return undefined;
  }
  const maybeStatus = event.payload.status;
  return typeof maybeStatus === "string" ? maybeStatus : undefined;
}

function extractRoute(event: EventEnvelope): string | undefined {
  if (!isObjectPayload(event)) {
    return undefined;
  }
  const maybeRoute = event.payload.route;
  return typeof maybeRoute === "string" ? maybeRoute : undefined;
}

function extractIntent(event: EventEnvelope): OrchestratorIntent | undefined {
  if (!isObjectPayload(event)) {
    return undefined;
  }

  if (isKnownIntent(event.payload.intent)) {
    return event.payload.intent;
  }

  const output = event.payload.output;
  if (typeof output === "object" && output !== null) {
    const handledIntent = (output as { handledIntent?: unknown }).handledIntent;
    if (isKnownIntent(handledIntent)) {
      return handledIntent;
    }
  }

  return undefined;
}

function mapSessionMode(intent: OrchestratorIntent | undefined, route: string | undefined): SessionMode {
  if (intent === "story" || route === "storyteller-agent") {
    return "story";
  }
  if (intent === "ui_task" || route === "ui-navigator-agent") {
    return "ui";
  }
  return "live";
}

type StoryAssetRef = {
  kind: string;
  ref: string;
};

function extractStoryAssets(event: EventEnvelope): StoryAssetRef[] {
  if (!isObjectPayload(event)) {
    return [];
  }

  const output = event.payload.output;
  if (typeof output !== "object" || output === null) {
    return [];
  }

  const maybeAssets = (output as { assets?: unknown }).assets;
  if (!Array.isArray(maybeAssets)) {
    return [];
  }

  const assets: StoryAssetRef[] = [];
  for (const item of maybeAssets) {
    if (typeof item === "string") {
      assets.push({ kind: "generic", ref: item });
      continue;
    }
    if (typeof item === "object" && item !== null) {
      const typed = item as { kind?: unknown; ref?: unknown; url?: unknown };
      const kind = typeof typed.kind === "string" ? typed.kind : "generic";
      const ref = typeof typed.ref === "string" ? typed.ref : typeof typed.url === "string" ? typed.url : null;
      if (ref) {
        assets.push({ kind, ref });
      }
    }
  }

  return assets;
}

function payloadSizeBytes(payload: unknown): number {
  try {
    const serialized = JSON.stringify(payload);
    return Buffer.byteLength(serialized, "utf8");
  } catch {
    return 0;
  }
}

function emitEventRollup(params: {
  event: EventEnvelope;
  route: string | undefined;
  intent: OrchestratorIntent | undefined;
  mode: SessionMode;
  runStatus: string;
  storage: "firestore" | "fallback";
  writeFailed: boolean;
  errorMessage?: string;
}): void {
  analytics.recordEvent({
    eventType: "orchestrator.event_rollup",
    labels: {
      intent: params.intent ?? "unknown",
      route: params.route ?? "unknown",
      mode: params.mode,
      source: params.event.source,
      eventType: params.event.type,
      storage: params.storage,
      writeFailed: params.writeFailed,
    },
    payload: {
      eventId: params.event.id,
      sessionId: params.event.sessionId,
      runId: params.event.runId ?? null,
      runStatus: params.runStatus,
      ts: params.event.ts,
      payloadBytes: payloadSizeBytes(params.event.payload),
      negotiationEvent: params.intent === "negotiation",
      storyEvent: params.intent === "story" || params.route === "storyteller-agent",
      uiEvent: params.intent === "ui_task" || params.route === "ui-navigator-agent",
      errorMessage: params.errorMessage,
    },
    severity: params.writeFailed ? "ERROR" : "INFO",
  });
}

async function writeFallbackLog(event: EventEnvelope): Promise<void> {
  const compact = {
    id: event.id,
    sessionId: event.sessionId,
    runId: event.runId,
    type: event.type,
    source: event.source,
    ts: event.ts,
    firestore: state,
  };
  console.log("[orchestrator] persistEvent(fallback)", compact);
  const route = extractRoute(event);
  const intent = extractIntent(event);
  emitEventRollup({
    event,
    route,
    intent,
    mode: mapSessionMode(intent, route),
    runStatus: extractRunStatus(event) ?? "accepted",
    storage: "fallback",
    writeFailed: true,
    errorMessage: state.reason,
  });
}

export function getFirestoreState(): FirestoreState {
  initFirestore();
  return state;
}

export async function persistEvent(event: EventEnvelope): Promise<void> {
  const db = initFirestore();
  if (!db) {
    await writeFallbackLog(event);
    return;
  }

  try {
    const batch = db.batch();
    const createdAt = eventTimestamp(event);
    const route = extractRoute(event);
    const intent = extractIntent(event);
    const mode = mapSessionMode(intent, route);
    const runStatus = extractRunStatus(event) ?? "accepted";

    const eventRef = db.collection("events").doc(event.id);
    batch.set(eventRef, {
      ...event,
      createdAt,
      storedAt: FieldValue.serverTimestamp(),
      expireAt: expirationFromNow(retention.eventsDays),
    });

    const sessionRef = db.collection("sessions").doc(event.sessionId);
    batch.set(
      sessionRef,
      {
        sessionId: event.sessionId,
        mode,
        status: "active",
        lastIntent: intent,
        lastRoute: route,
        lastEventType: event.type,
        expireAt: expirationFromNow(retention.sessionsDays),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (event.runId) {
      const runRef = db.collection("agent_runs").doc(event.runId);
      batch.set(
        runRef,
        {
          runId: event.runId,
          sessionId: event.sessionId,
          status: runStatus,
          intent,
          route,
          lastEventType: event.type,
          expireAt: expirationFromNow(retention.runsDays),
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (intent === "negotiation") {
      const negotiationRef = db.collection("negotiation_logs").doc(event.id);
      batch.set(negotiationRef, {
        eventId: event.id,
        sessionId: event.sessionId,
        runId: event.runId ?? null,
        type: event.type,
        source: event.source,
        route,
        createdAt,
        payload: event.payload,
        expireAt: expirationFromNow(retention.negotiationDays),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (route === "storyteller-agent" || intent === "story") {
      const storyAssets = extractStoryAssets(event);
      const storyRef = db.collection("story_assets").doc(event.id);
      batch.set(
        storyRef,
        {
          eventId: event.id,
          sessionId: event.sessionId,
          runId: event.runId ?? null,
          status: runStatus,
          assets: storyAssets,
          createdAt,
          updatedAt: FieldValue.serverTimestamp(),
          expireAt: expirationFromNow(retention.storyAssetsDays),
        },
        { merge: true },
      );
    }

    await batch.commit();
    emitEventRollup({
      event,
      route,
      intent,
      mode,
      runStatus,
      storage: "firestore",
      writeFailed: false,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[orchestrator] Firestore write failed", {
      error: errorMessage,
      eventId: event.id,
      sessionId: event.sessionId,
      runId: event.runId,
    });
    const route = extractRoute(event);
    const intent = extractIntent(event);
    emitEventRollup({
      event,
      route,
      intent,
      mode: mapSessionMode(intent, route),
      runStatus: extractRunStatus(event) ?? "accepted",
      storage: "firestore",
      writeFailed: true,
      errorMessage,
    });
  }
}
