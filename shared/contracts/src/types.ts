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

export const CASE_WIKI_STATUSES = [
  "active",
  "waiting_on_customer",
  "waiting_on_operator",
  "blocked",
  "resolved",
] as const;

export type CaseWikiStatus = (typeof CASE_WIKI_STATUSES)[number];

export const CASE_WIKI_ENTITY_KINDS = [
  "person",
  "company",
  "document",
  "appointment",
  "policy",
  "requirement",
  "task",
  "location",
  "system",
  "case",
] as const;

export type CaseWikiEntityKind = (typeof CASE_WIKI_ENTITY_KINDS)[number];

export const CASE_WIKI_TIMELINE_ENTRY_KINDS = [
  "session",
  "operator_note",
  "approval",
  "workflow",
  "document",
  "task",
  "system",
] as const;

export type CaseWikiTimelineEntryKind = (typeof CASE_WIKI_TIMELINE_ENTRY_KINDS)[number];

export const CASE_WIKI_PROOF_STATUSES = ["confirmed", "pending", "contradicted", "missing"] as const;

export type CaseWikiProofStatus = (typeof CASE_WIKI_PROOF_STATUSES)[number];

export const CASE_WIKI_PRIORITIES = ["low", "medium", "high"] as const;

export type CaseWikiPriority = (typeof CASE_WIKI_PRIORITIES)[number];

export const CASE_WIKI_NEXT_ACTION_TYPES = [
  "operator_followup",
  "approval_request",
  "document_request",
  "workflow_resume",
  "ui_task",
  "live_followup",
] as const;

export type CaseWikiNextActionType = (typeof CASE_WIKI_NEXT_ACTION_TYPES)[number];

export const CASE_WIKI_ROUTING_FOCUS_KINDS = ["proof", "question"] as const;

export type CaseWikiRoutingFocusKind = (typeof CASE_WIKI_ROUTING_FOCUS_KINDS)[number];

export const CASE_WIKI_ROUTING_LANES = [
  "approval_queue",
  "customer_followup",
  "workflow_resume",
  "ui_task",
  "live_followup",
  "operator_followup",
] as const;

export type CaseWikiRoutingLane = (typeof CASE_WIKI_ROUTING_LANES)[number];

export const CASE_WIKI_ROUTING_ACTION_IDS = [
  "open_workflow_control",
  "run_negotiation",
  "run_ui_task",
  "refresh_summary",
] as const;

export type CaseWikiRoutingActionId = (typeof CASE_WIKI_ROUTING_ACTION_IDS)[number];

export type CaseWikiOverview = {
  title: string;
  summary: string;
  status: CaseWikiStatus;
  customerGoal: string | null;
  currentStage: string | null;
  lastMeaningfulUpdateAt: string | null;
  activeLanguage: string | null;
  missingEvidenceSummary: string | null;
  contradictionsSummary: string | null;
};

export type CaseWikiEntity = {
  id: string;
  kind: CaseWikiEntityKind;
  label: string;
  role: string | null;
  description: string | null;
  confidence: number | null;
  sourceRefs: string[];
};

export type CaseWikiTimelineEntry = {
  id: string;
  kind: CaseWikiTimelineEntryKind;
  ts: string;
  title: string;
  summary: string;
  status: string | null;
  sourceRefs: string[];
};

export type CaseWikiProof = {
  id: string;
  statement: string;
  status: CaseWikiProofStatus;
  confidence: number | null;
  evidenceSummary: string | null;
  contradictionNote: string | null;
  sourceRefs: string[];
};

export type CaseWikiOpenQuestion = {
  id: string;
  question: string;
  priority: CaseWikiPriority;
  blocking: boolean;
  owner: string | null;
  suggestedNextStep: string | null;
  sourceRefs: string[];
};

export type CaseWikiNextAction = {
  type: CaseWikiNextActionType;
  title: string;
  summary: string;
  owner: string | null;
  dueBy: string | null;
  blocking: boolean;
  relatedQuestionIds: string[];
  sourceRefs: string[];
};

export type CaseWikiHighlights = {
  topProof: CaseWikiProof | null;
  topEntity: CaseWikiEntity | null;
  topBlockingQuestion: CaseWikiOpenQuestion | null;
};

export type CaseWikiEvidencePack = {
  proofs: CaseWikiProof[];
  entities: CaseWikiEntity[];
  questions: CaseWikiOpenQuestion[];
  sourceRefs: string[];
};

export const CASE_WIKI_DETAIL_BADGE_TONES = ["neutral", "ok", "watch"] as const;

export type CaseWikiDetailBadgeTone = (typeof CASE_WIKI_DETAIL_BADGE_TONES)[number];

export type CaseWikiDetailBadge = {
  tone: CaseWikiDetailBadgeTone;
  label: string;
};

export type CaseWikiDetailPackItem = {
  focusKind: CaseWikiRoutingFocusKind;
  focusId: string;
  focusLabel: string;
  title: string;
  meta: string;
  body: string;
  badges: CaseWikiDetailBadge[];
  sourceRefs: string[];
};

export type CaseWikiDetailPack = {
  proofs: CaseWikiDetailPackItem[];
  questions: CaseWikiDetailPackItem[];
};

export type CaseWikiActionPackItem = {
  focusKind: CaseWikiRoutingFocusKind;
  focusId: string;
  focusLabel: string;
  title: string;
  handoffText: string;
  refs: string[];
  refsText: string | null;
  focusSummary: string | null;
};

export type CaseWikiActionPack = {
  proofs: CaseWikiActionPackItem[];
  questions: CaseWikiActionPackItem[];
};

export type CaseWikiFocusPackItem = {
  focusKind: CaseWikiRoutingFocusKind;
  focusId: string;
  focusLabel: string;
  chipTitle: string | null;
  focusSummary: string | null;
  drilldown: string | null;
  handoffPreview: string | null;
};

export type CaseWikiFocusPack = {
  proofs: CaseWikiFocusPackItem[];
  questions: CaseWikiFocusPackItem[];
};

export type CaseWikiPreviewPack = {
  packValue: string | null;
  refsValue: string | null;
  proofsSummary: string | null;
  questionsSummary: string | null;
  drilldownValue: string | null;
  handoffValue: string | null;
};

export type CaseWikiWorkspacePack = {
  statusValue: string | null;
  summaryValue: string | null;
  blockerValue: string | null;
  nextActionValue: string | null;
  proofTitle: string | null;
  proofSummary: string | null;
  entityTitle: string | null;
  entitySummary: string | null;
  packValue: string | null;
  refsValue: string | null;
  drilldownValue: string | null;
  handoffValue: string | null;
};

export type CaseWikiRoutingRoute = {
  lane: CaseWikiRoutingLane;
  owner: string | null;
  priority: CaseWikiPriority;
  status: string | null;
  blocking: boolean;
  approvalRequired: boolean;
  dueBy: string | null;
  summary: string;
};

export type CaseWikiRoutingCTA = {
  actionId: CaseWikiRoutingActionId;
  label: string;
  hint: string;
  owner: string | null;
  lane: CaseWikiRoutingLane;
  approvalRequired: boolean;
  blocking: boolean;
  summary: string;
};

export type CaseWikiRoutingPackItem = {
  focusKind: CaseWikiRoutingFocusKind;
  focusId: string;
  focusLabel: string;
  route: CaseWikiRoutingRoute;
  cta: CaseWikiRoutingCTA;
  sourceRefs: string[];
  relatedQuestionIds: string[];
  nextAction: CaseWikiNextAction | null;
};

export type CaseWikiRoutingPack = {
  proofs: CaseWikiRoutingPackItem[];
  questions: CaseWikiRoutingPackItem[];
};

export type CaseWikiHandoffDetail = {
  status: string | null;
  confidence: number | null;
  evidenceSummary: string | null;
  contradictionNote: string | null;
  priority: CaseWikiPriority | null;
  blocking: boolean | null;
  owner: string | null;
  suggestedNextStep: string | null;
};

export type CaseWikiHandoffPackItem = {
  focusKind: CaseWikiRoutingFocusKind;
  focusId: string;
  focusLabel: string;
  handoff: string;
  detail: CaseWikiHandoffDetail;
  sourceRefs: string[];
  nextAction: CaseWikiNextAction | null;
};

export type CaseWikiHandoffPack = {
  proofs: CaseWikiHandoffPackItem[];
  questions: CaseWikiHandoffPackItem[];
};

export type RuntimeCaseWikiNoteRequest = {
  sessionId: string;
  runId?: string;
  userId?: string;
  title?: string;
  note: string;
  priority?: CaseWikiPriority;
  blocking?: boolean;
  owner?: string;
  suggestedNextStep?: string;
  ts?: string;
};

export type RuntimeCaseWikiNoteResponse = {
  accepted: true;
  eventId: string;
  sessionId: string;
  runId: string | null;
  source: "operator";
  kind: "operator_note";
  createdAt: string;
};

export type CaseWiki = {
  schemaVersion: 1;
  caseId: string;
  sessionId: string | null;
  userId: string | null;
  generatedAt: string;
  overview: CaseWikiOverview;
  highlights: CaseWikiHighlights;
  evidencePack: CaseWikiEvidencePack;
  handoffPack: CaseWikiHandoffPack;
  detailPack: CaseWikiDetailPack;
  routingPack: CaseWikiRoutingPack;
  actionPack: CaseWikiActionPack;
  focusPack: CaseWikiFocusPack;
  previewPack: CaseWikiPreviewPack;
  workspacePack: CaseWikiWorkspacePack;
  entities: CaseWikiEntity[];
  timeline: CaseWikiTimelineEntry[];
  proofs: CaseWikiProof[];
  openQuestions: CaseWikiOpenQuestion[];
  recommendedNextAction: CaseWikiNextAction | null;
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
