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

export type EvidenceSignatureStatus = "signed" | "unsigned";

export type EvidenceSignature = {
  schemaVersion: 1;
  status: EvidenceSignatureStatus;
  algorithm: "ed25519-sha256";
  canonicalization: "json-stable-v1";
  payloadHash: string;
  signature: string | null;
  keyId: string | null;
  signerId: string;
  signedAt: string;
};

export const CASE_WIKI_AUDIT_SOURCES = [
  "approval",
  "operator_note",
  "workflow",
  "runtime",
] as const;

export type CaseWikiAuditSource = (typeof CASE_WIKI_AUDIT_SOURCES)[number];

export type CaseWikiAuditEntry = {
  id: string;
  ts: string;
  actor: string | null;
  source: CaseWikiAuditSource;
  action: string;
  field: string | null;
  summary: string;
  reason: string | null;
  oldValue: string | null;
  newValue: string | null;
  sourceRefs: string[];
};

export const CASE_WIKI_COMPLIANCE_TEMPLATES = ["baseline", "strict", "regulated"] as const;

export type CaseWikiComplianceTemplate = (typeof CASE_WIKI_COMPLIANCE_TEMPLATES)[number];

export const CASE_WIKI_COMPLIANCE_SOURCES = ["template_default", "tenant_override"] as const;

export type CaseWikiComplianceSource = (typeof CASE_WIKI_COMPLIANCE_SOURCES)[number];

export const CASE_WIKI_PII_REDACTION_LEVELS = ["standard", "high"] as const;

export type CaseWikiPiiRedactionLevel = (typeof CASE_WIKI_PII_REDACTION_LEVELS)[number];

export const CASE_WIKI_EVIDENCE_SIGNING_KEY_STATES = ["missing", "loaded", "invalid"] as const;

export type CaseWikiEvidenceSigningKeyState = (typeof CASE_WIKI_EVIDENCE_SIGNING_KEY_STATES)[number];

export const CASE_WIKI_COMPLIANCE_ENFORCEMENT_STATUSES = ["pass", "warn", "fail"] as const;

export type CaseWikiComplianceEnforcementStatus =
  (typeof CASE_WIKI_COMPLIANCE_ENFORCEMENT_STATUSES)[number];

export const CASE_WIKI_COMPLIANCE_SNAPSHOT_MODES = ["compiled_operator_safe", "raw_ref_review"] as const;

export type CaseWikiComplianceSnapshotMode = (typeof CASE_WIKI_COMPLIANCE_SNAPSHOT_MODES)[number];

export type CaseWikiComplianceEnforcement = {
  status: CaseWikiComplianceEnforcementStatus;
  snapshotMode: CaseWikiComplianceSnapshotMode;
  rawRefCount: number;
  rawRefsPreview: string[];
  redactionRequired: boolean;
  redactionSatisfied: boolean;
  signingRequired: boolean;
  observedSignatureStatus: EvidenceSignatureStatus;
  signatureSatisfied: boolean;
  exportReady: boolean;
  blockingReasons: string[];
  summary: string;
};

export type CaseWikiComplianceSummary = {
  templateId: CaseWikiComplianceTemplate;
  requestedTemplateId: string;
  fallbackApplied: boolean;
  source: CaseWikiComplianceSource;
  controls: {
    piiRedactionLevel: CaseWikiPiiRedactionLevel;
    crossTenantAdminOnly: boolean;
    approvalSlaEnforced: boolean;
    auditTrailRequired: boolean;
  };
  retention: {
    rawMediaDays: number;
    auditLogsDays: number;
    eventsDays: number;
    sessionsDays: number;
  };
  evidenceSigning: {
    enabled: boolean;
    keyState: CaseWikiEvidenceSigningKeyState;
    expectedSignatureStatus: EvidenceSignatureStatus;
    signerId: string;
    keyId: string | null;
  };
  enforcement: CaseWikiComplianceEnforcement;
  summary: string;
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
  remediationDraft: CaseWikiRemediationDraft | null;
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

export type CaseWikiDefaultFocusSource = "highlight" | "focusPack" | "evidencePack";

export type CaseWikiDefaultFocus = CaseWikiFocusPackItem & {
  source: CaseWikiDefaultFocusSource;
};

export type CaseWikiPreviewPack = {
  packValue: string | null;
  refsValue: string | null;
  proofsSummary: string | null;
  questionsSummary: string | null;
  drilldownValue: string | null;
  handoffValue: string | null;
};

export type CaseWikiCostSummary = {
  status: "observed" | "missing";
  source: "operator_summary" | "case_wiki";
  summaryStatus: string;
  summarySource: string;
  summaryAuthority: string;
  aggregationMode: string;
  estimationMode: "tokens_only" | "token_rate_estimate" | "runtime_rate_estimate";
  observationMode: "usage_rollup" | "event_span_estimate";
  pricingConfigured: boolean;
  currency: "USD";
  inputTokens: number;
  outputTokens: number;
  derivedTotalTokens: number;
  totalTokens: number;
  tokenConsistency: boolean;
  tokenDriftTokens: number;
  inputUsd: number;
  outputUsd: number;
  liveUsd: number;
  uiExecutorUsd: number;
  storageUsd: number;
  totalUsd: number;
  liveMinutes: number;
  uiExecutorMinutes: number;
  storageMb: number;
  pricePer1kInputUsd: number;
  pricePer1kOutputUsd: number;
  pricePerLiveMinuteUsd: number;
  pricePerUiExecutorMinuteUsd: number;
  pricePerStorageMbUsd: number;
  models: string[];
  uniqueModels: number;
  unknownSourceCount: number;
  latestSeenAt: string | null;
  sourceRefs: string[];
  validated: boolean;
};

export type CaseWikiWorkspacePack = {
  defaultFocus: CaseWikiDefaultFocus | null;
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
  questionsValue: string | null;
  timelineValue: string | null;
  drilldownValue: string | null;
  handoffValue: string | null;
  costValue?: string | null;
  costSummary?: CaseWikiCostSummary | null;
};

export type CaseWikiOperatorOverviewPreview = {
  caseId: string;
  sessionId: string | null;
  schemaVersion: 1;
  generatedAt: string;
  overview: {
    title: string | null;
    status: CaseWikiStatus | null;
    currentStage: string | null;
    customerGoal: string | null;
    summary: string | null;
    missingEvidenceSummary: string | null;
    contradictionsSummary: string | null;
  } | null;
  recommendedNextAction: {
    type: CaseWikiNextActionType | null;
    title: string | null;
    owner: string | null;
    summary: string | null;
  } | null;
  counts: {
    entities: number;
    proofs: number;
    openQuestions: number;
    timeline: number;
  };
};

export type CaseWikiOperatorEvidencePreview = {
  topProof: {
    status: CaseWikiProofStatus | null;
    statement: string | null;
    evidenceSummary: string | null;
    contradictionNote: string | null;
    sourceRefs: string[];
  } | null;
  topEntity: {
    kind: CaseWikiEntityKind | null;
    label: string | null;
    role: string | null;
    summary: string | null;
    sourceRefs: string[];
  } | null;
  evidencePack: CaseWikiEvidencePack | null;
  previewPack: CaseWikiPreviewPack | null;
  handoffPack: CaseWikiHandoffPack | null;
  detailPack: CaseWikiDetailPack | null;
  recommendedNextAction: {
    type: CaseWikiNextActionType | null;
    title: string | null;
    owner: string | null;
    summary: string | null;
  } | null;
};

export type CaseWikiOperatorQuestionsPreview = {
  totalQuestions: number;
  blockingQuestions: number;
  items: Array<{
    id: string | null;
    priority: CaseWikiPriority | null;
    blocking: boolean;
    owner: string | null;
    question: string | null;
    suggestedNextStep: string | null;
    sourceRefs: string[];
  }>;
};

export type CaseWikiOperatorTimelinePreview = {
  totalEntries: number;
  latestEntries: Array<{
    ts: string | null;
    kind: CaseWikiTimelineEntryKind | null;
    title: string | null;
    summary: string | null;
    status: string | null;
    sourceRefs: string[];
  }>;
};

export type CaseWikiOperatorAuditPreview = {
  totalEntries: number;
  latestEntries: Array<{
    id: string | null;
    ts: string | null;
    actor: string | null;
    source: CaseWikiAuditSource | null;
    action: string | null;
    field: string | null;
    summary: string | null;
    reason: string | null;
    oldValue: string | null;
    newValue: string | null;
    sourceRefs: string[];
  }>;
};

export const CASE_WIKI_REMEDIATION_KINDS = [
  "customer_message",
  "approval_brief",
  "workflow_resume",
  "operator_brief",
] as const;

export type CaseWikiRemediationKind = (typeof CASE_WIKI_REMEDIATION_KINDS)[number];

export type CaseWikiRemediationDraft = {
  kind: CaseWikiRemediationKind;
  actionType: CaseWikiNextActionType | null;
  title: string;
  targetLabel: string | null;
  owner: string | null;
  dueBy: string | null;
  summary: string;
  body: string;
  checklist: string[];
  sourceRefs: string[];
};

export type CaseWikiOperatorRemediationPreview = {
  focusKind: CaseWikiRoutingFocusKind | null;
  focusId: string | null;
  focusLabel: string | null;
  draft: CaseWikiRemediationDraft | null;
};

export type CaseWikiOperatorPreviewPack = {
  overview: CaseWikiOperatorOverviewPreview;
  evidence: CaseWikiOperatorEvidencePreview;
  questions: CaseWikiOperatorQuestionsPreview;
  remediation: CaseWikiOperatorRemediationPreview;
  timeline: CaseWikiOperatorTimelinePreview;
  audit: CaseWikiOperatorAuditPreview;
  compliance: CaseWikiComplianceSummary;
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
  compliance: CaseWikiComplianceSummary;
  evidenceSignature?: EvidenceSignature;
  handoffPack: CaseWikiHandoffPack;
  detailPack: CaseWikiDetailPack;
  routingPack: CaseWikiRoutingPack;
  actionPack: CaseWikiActionPack;
  focusPack: CaseWikiFocusPack;
  previewPack: CaseWikiPreviewPack;
  workspacePack: CaseWikiWorkspacePack;
  operatorPreviewPack: CaseWikiOperatorPreviewPack;
  entities: CaseWikiEntity[];
  timeline: CaseWikiTimelineEntry[];
  auditLog: CaseWikiAuditEntry[];
  proofs: CaseWikiProof[];
  openQuestions: CaseWikiOpenQuestion[];
  recommendedNextAction: CaseWikiNextAction | null;
};

export const RUNTIME_OPERATOR_QUEUE_TONES = ["neutral", "ok", "watch", "fail", "stale"] as const;

export type RuntimeOperatorQueueTone = (typeof RUNTIME_OPERATOR_QUEUE_TONES)[number];

export const RUNTIME_OPERATOR_QUEUE_PRIORITIES = ["critical", "high", "medium"] as const;

export type RuntimeOperatorQueuePriority = (typeof RUNTIME_OPERATOR_QUEUE_PRIORITIES)[number];

export const RUNTIME_OPERATOR_QUEUE_ACTION_IDS = [
  "refresh_summary",
  "open_quick_start",
  "open_playbook",
  "open_workflow_control",
  "open_case_wiki_remediation",
  "copy_case_wiki_remediation_draft",
  "run_runtime_guardrail_path",
  "show_all_cards",
  "full_ops_view",
  "open_device_nodes",
  "run_negotiation",
  "run_story",
  "run_ui_task",
  "saved_view_incidents",
  "saved_view_runtime",
  "saved_view_approvals",
  "saved_view_audit",
  "jump_status_card",
] as const;

export type RuntimeOperatorQueueActionId = (typeof RUNTIME_OPERATOR_QUEUE_ACTION_IDS)[number];

export type RuntimeOperatorQueueAction = {
  label: string;
  actionId: RuntimeOperatorQueueActionId;
  kind?: "secondary";
  shortLabel?: string | null;
  targetStatusId?: string | null;
};

export type RuntimeOperatorQueueFocus = {
  kind: CaseWikiRoutingFocusKind | null;
  id: string | null;
  label: string | null;
  summary: string | null;
};

export type RuntimeOperatorQueueQuestionPreview = {
  id: string | null;
  priority: CaseWikiPriority | null;
  blocking: boolean;
  owner: string | null;
  question: string | null;
  suggestedNextStep: string | null;
};

export type RuntimeOperatorQueueRoutePreview = {
  lane: CaseWikiRoutingLane | null;
  owner: string | null;
  priority: CaseWikiPriority | null;
  status: string | null;
  blocking: boolean;
  approvalRequired: boolean;
  dueBy: string | null;
  summary: string | null;
};

export type RuntimeOperatorQueueNextActionPreview = {
  type: CaseWikiNextActionType | null;
  title: string | null;
  owner: string | null;
  summary: string | null;
  dueBy: string | null;
  blocking: boolean;
};

export type RuntimeOperatorQueueCompliancePreview = {
  templateId: CaseWikiComplianceTemplate;
  piiRedactionLevel: CaseWikiPiiRedactionLevel;
  expectedSignatureStatus: EvidenceSignatureStatus;
  enforcementStatus: CaseWikiComplianceEnforcementStatus;
  exportReady: boolean;
  blockingReasons: string[];
};

export type RuntimeOperatorQueueItem = {
  id: string;
  key: string;
  source: "case_wiki";
  generatedAt: string;
  caseId: string;
  sessionId: string | null;
  tone: RuntimeOperatorQueueTone;
  priority: RuntimeOperatorQueuePriority;
  blocking: boolean;
  kicker: string;
  title: string;
  meta: string;
  focus: RuntimeOperatorQueueFocus | null;
  question: RuntimeOperatorQueueQuestionPreview | null;
  route: RuntimeOperatorQueueRoutePreview | null;
  remediation: CaseWikiOperatorRemediationPreview | null;
  recommendedNextAction: RuntimeOperatorQueueNextActionPreview | null;
  compliance: RuntimeOperatorQueueCompliancePreview;
  primary: RuntimeOperatorQueueAction | null;
  secondary: RuntimeOperatorQueueAction | null;
  sourceRefs: string[];
};

export type RuntimeOperatorQueueSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  tenantId: string;
  totalItems: number;
  blockingItems: number;
  items: RuntimeOperatorQueueItem[];
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
    healedRefTargets: string[];
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
