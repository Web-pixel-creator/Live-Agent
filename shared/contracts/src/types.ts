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
export type ConversationScope = "default" | "none";

export type EventEnvelope<TPayload = unknown> = {
  id: string;
  userId?: string;
  sessionId: string;
  runId?: string;
  conversation?: ConversationScope;
  metadata?: Record<string, unknown>;
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

export type ApiErrorResponse = {
  ok: false;
  error: NormalizedError;
  service?: string;
  runtime?: unknown;
};

export type SessionRecord = {
  sessionId: string;
  userId: string;
  mode: SessionMode;
  status: "active" | "paused" | "closed";
  createdAt: string;
  updatedAt: string;
};

export type OrchestratorIntent =
  | "conversation"
  | "translation"
  | "negotiation"
  | "research"
  | "story"
  | "ui_task";

export const LIVE_CONNECTION_MODES = ["relay", "direct_live"] as const;

export type LiveConnectionMode = (typeof LIVE_CONNECTION_MODES)[number];

export const LIVE_CAPABILITY_FLAGS = [
  "audioInput",
  "audioOutput",
  "videoInput",
  "screenInput",
  "toolCalls",
  "interruptions",
  "translation",
  "reconnectSupported",
] as const;

export type LiveCapabilityFlag = (typeof LIVE_CAPABILITY_FLAGS)[number];

export type LiveCapabilitiesSnapshot = Record<LiveCapabilityFlag, boolean>;

export type LiveSessionTokenRequest = {
  preferredMode?: LiveConnectionMode | null;
  intent?: OrchestratorIntent | null;
  audio?: boolean;
  video?: boolean;
  screen?: boolean;
  toolsRequired?: boolean;
};

export type LiveSessionTokenResponse = {
  provider: string;
  model: string;
  connectionMode: LiveConnectionMode;
  expiresAt: string | null;
  sessionToken: string | null;
  sessionId: string;
  capabilities: LiveCapabilitiesSnapshot;
  fallbackMode: LiveConnectionMode | null;
  warnings: string[];
};

export type LiveRuntimeStatus = {
  preferredMode: LiveConnectionMode;
  activeMode: LiveConnectionMode;
  provider: string | null;
  model: string | null;
  ephemeralTokensSupported: boolean;
  fallbackAvailable: boolean;
  lastFallbackReason: string | null;
  capabilities: LiveCapabilitiesSnapshot;
};

export type RuntimeLiveSessionEventIngestRequest = {
  id?: string;
  userId?: string;
  sessionId: string;
  runId?: string;
  conversation?: ConversationScope;
  source?: "direct_live";
  type: string;
  ts?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type RuntimeLiveSessionEventIngestResponse = {
  accepted: true;
  eventId: string;
  sessionId: string;
  runId?: string;
  source: "direct_live";
  createdAt: string;
};

export type TaskLifecycleStatus =
  | "queued"
  | "running"
  | "pending_approval"
  | "completed"
  | "failed";

export const UI_VERIFICATION_STATES = [
  "verified",
  "partially_verified",
  "unverified",
  "blocked_pending_approval",
] as const;

export type UiVerificationState = (typeof UI_VERIFICATION_STATES)[number];

export const UI_FAILURE_CLASSES = [
  "approval_required",
  "approval_rejected",
  "damage_control_blocked",
  "device_node_unavailable",
  "execution_failed",
  "loop_detected",
  "missing_grounding",
  "sandbox_blocked",
  "stale_grounding",
  "verification_failed",
  "visual_regression",
] as const;

export type UiFailureClass = (typeof UI_FAILURE_CLASSES)[number];

export type UiVerificationEvidence = {
  traceSteps: number;
  completedSteps: number;
  plannedVerifySteps: number;
  verifySteps: number;
  verificationRequested: boolean;
  blockedSteps: number;
  screenshotRefs: string[];
  groundingSignals: {
    screenshotRefProvided: boolean;
    domSnapshotProvided: boolean;
    accessibilityTreeProvided: boolean;
    markHintsCount: number;
    refMapCount: number;
    actionableRefIds: string[];
    staleRefTargets: string[];
  };
  visualChecks: number;
  visualRegressions: number;
};

export type UiVerificationOutcome = {
  state: UiVerificationState;
  failureClass: UiFailureClass | null;
  summary: string;
  recoveryHint: string | null;
  evidence: UiVerificationEvidence;
};

export type UiPlannerVerification = {
  required: boolean;
  targetState: UiVerificationState;
  checkpoints: string[];
  approvalSensitive: boolean;
  groundingReady: boolean;
};

export type TaskMetadata = {
  taskId: string;
  status?: TaskLifecycleStatus;
  progressPct?: number;
  stage?: string;
  route?: string | null;
  createdAt?: string;
  updatedAt?: string;
  verificationState?: UiVerificationState;
  verificationFailureClass?: UiFailureClass | null;
  verificationSummary?: string;
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
