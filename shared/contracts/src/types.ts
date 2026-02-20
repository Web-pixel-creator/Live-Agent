export type AgentKind =
  | "live-agent"
  | "storyteller-agent"
  | "ui-navigator-agent"
  | "orchestrator"
  | "gateway"
  | "frontend"
  | "tool"
  | "system";

export type SessionMode = "live" | "story" | "ui" | "multi";

export type EventEnvelope<TPayload = unknown> = {
  id: string;
  sessionId: string;
  runId?: string;
  type: string;
  source: AgentKind;
  ts: string;
  payload: TPayload;
};

export type NormalizedError = {
  code: string;
  message: string;
  traceId: string;
  details?: unknown;
};

export type SessionRecord = {
  sessionId: string;
  userId: string;
  mode: SessionMode;
  status: "active" | "paused" | "closed";
  createdAt: string;
  updatedAt: string;
};

export type OrchestratorIntent = "conversation" | "translation" | "negotiation" | "story" | "ui_task";

export type TaskLifecycleStatus =
  | "queued"
  | "running"
  | "pending_approval"
  | "completed"
  | "failed";

export type TaskMetadata = {
  taskId: string;
  status?: TaskLifecycleStatus;
  progressPct?: number;
  stage?: string;
  route?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OrchestratorRequest = EventEnvelope<{
  intent: OrchestratorIntent;
  input: unknown;
  task?: TaskMetadata;
}>;

export type OrchestratorResponse = EventEnvelope<{
  route: "live-agent" | "storyteller-agent" | "ui-navigator-agent";
  status: "accepted" | "completed" | "failed";
  output?: unknown;
  task?: TaskMetadata;
  traceId?: string;
  error?: string | NormalizedError;
}>;
