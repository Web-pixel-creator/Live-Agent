import { prepareAssistantStreamChunk, resolveAssistantFinalizeDelay } from "./streaming-text.js";
import { resolveAssistantActivityStatus } from "./assistant-activity.js";

const state = {
  ws: null,
  connectionStatus: "disconnected",
  wsUrl: "ws://localhost:8080/realtime",
  apiBaseUrl: "http://localhost:8081",
  userId: "",
  sessionId: "",
  runId: null,
  sessionState: "-",
  mode: "voice",
  themeMode: "dark",
  pttEnabled: false,
  pttPressed: false,
  fallbackAsset: false,
  storyTimelineTitle: null,
  storyTimelineSegments: [],
  storyTimelineSelectedIndex: 0,
  storyTimelinePendingJobs: 0,
  pendingApproval: null,
  audioContext: null,
  nextPlayTime: 0,
  assistantPlaybackTurnId: null,
  assistantPlaybackStartedAtMs: null,
  assistantPlaybackScheduledMs: 0,
  assistantAudioChunks: [],
  assistantAudioBytesTotal: 0,
  assistantAudioSampleRate: 16000,
  assistantAudioTrimmed: false,
  micContext: null,
  micStream: null,
  micProcessor: null,
  micGain: null,
  assistantStreamEntry: null,
  assistantStreamBody: null,
  assistantStreamText: "",
  assistantStreamFlushTimer: null,
  assistantSpeakingResetTimer: null,
  assistantIsStreaming: false,
  assistantIsSpeaking: false,
  assistantStreamIdleFinalizeMs: 500,
  assistantStreamPunctuationFinalizeMs: 160,
  taskRecords: new Map(),
  deviceNodes: new Map(),
  selectedDeviceNodeId: null,
  pendingClientEvents: new Map(),
  operatorGatewayErrorSnapshot: null,
  operatorTurnTruncationSnapshot: null,
  operatorTurnDeleteSnapshot: null,
  operatorDamageControlSnapshot: null,
  operatorCardsCollapsed: false,
  operatorBoardMode: "demo",
  operatorFocusCriticalOnly: false,
  operatorIssuesOnly: false,
  operatorSummaryUserRefreshed: false,
  exportHistory: [],
};

const PENDING_CLIENT_EVENT_MAX_AGE_MS = 2 * 60 * 1000;
const THEME_STORAGE_KEY = "mla.demoFrontend.themeMode";
const MAX_ASSISTANT_AUDIO_EXPORT_BYTES = 32 * 1024 * 1024;
const BG_VIDEO_LOOP_BLEND_SECONDS = 1.2;
const BG_VIDEO_LOOP_RESET_SECONDS = 0.3;
const BG_VIDEO_LOOP_TRANSITION_CLASS = "bg-video-loop-transition";
const OPERATOR_SIGNAL_FLASH_MS = 1200;
const EXPORT_HISTORY_LIMIT = 3;
const DEVICE_NODE_STALE_AGE_MS = 5 * 60 * 1000;
const STORY_EMPTY_STATE_PROMPT =
  "story: Build a 4-scene launch-day narrative with one hero image cue, one short video cue, and concise voiceover.";

const el = {
  backgroundVideo: document.getElementById("backgroundVideo"),
  wsUrl: document.getElementById("wsUrl"),
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  userId: document.getElementById("userId"),
  sessionId: document.getElementById("sessionId"),
  targetLanguage: document.getElementById("targetLanguage"),
  connectionStatus: document.getElementById("connectionStatus"),
  assistantStreamStatus: document.getElementById("assistantStreamStatus"),
  runId: document.getElementById("runId"),
  currentUserId: document.getElementById("currentUserId"),
  sessionState: document.getElementById("sessionState"),
  modeStatus: document.getElementById("modeStatus"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  exportMenu: document.getElementById("exportMenu"),
  exportMenuSummaryIcon: document.getElementById("exportMenuSummaryIcon"),
  exportMenuSummaryLabel: document.getElementById("exportMenuSummaryLabel"),
  exportMenuMeta: document.getElementById("exportMenuMeta"),
  exportMenuHistory: document.getElementById("exportMenuHistory"),
  exportMarkdownBtn: document.getElementById("exportMarkdownBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  exportAudioBtn: document.getElementById("exportAudioBtn"),
  exportStatus: document.getElementById("exportStatus"),
  pttToggleBtn: document.getElementById("pttToggleBtn"),
  pttHoldBtn: document.getElementById("pttHoldBtn"),
  pttStatus: document.getElementById("pttStatus"),
  imageInput: document.getElementById("imageInput"),
  audioInput: document.getElementById("audioInput"),
  liveSetupModel: document.getElementById("liveSetupModel"),
  liveSetupVoice: document.getElementById("liveSetupVoice"),
  liveSetupActivityHandling: document.getElementById("liveSetupActivityHandling"),
  liveSetupInstruction: document.getElementById("liveSetupInstruction"),
  applyLiveSetupBtn: document.getElementById("applyLiveSetupBtn"),
  sendImageBtn: document.getElementById("sendImageBtn"),
  approvalId: document.getElementById("approvalId"),
  approvalReason: document.getElementById("approvalReason"),
  approvalStatus: document.getElementById("approvalStatus"),
  intent: document.getElementById("intent"),
  message: document.getElementById("message"),
  uiTaskUrl: document.getElementById("uiTaskUrl"),
  uiTaskDeviceNodeId: document.getElementById("uiTaskDeviceNodeId"),
  uiTaskScreenshotRef: document.getElementById("uiTaskScreenshotRef"),
  uiTaskDomSnapshot: document.getElementById("uiTaskDomSnapshot"),
  uiTaskAccessibilityTree: document.getElementById("uiTaskAccessibilityTree"),
  uiTaskMarkHints: document.getElementById("uiTaskMarkHints"),
  uiTaskFields: document.getElementById("uiTaskFields"),
  uiTaskAdvancedSection: document.getElementById("uiTaskAdvancedSection"),
  sendConversationItemBtn: document.getElementById("sendConversationItemBtn"),
  sendConversationDeleteBtn: document.getElementById("sendConversationDeleteBtn"),
  transcript: document.getElementById("transcript"),
  events: document.getElementById("events"),
  targetPrice: document.getElementById("targetPrice"),
  targetDelivery: document.getElementById("targetDelivery"),
  targetSla: document.getElementById("targetSla"),
  currentPrice: document.getElementById("currentPrice"),
  currentDelivery: document.getElementById("currentDelivery"),
  currentSla: document.getElementById("currentSla"),
  finalPrice: document.getElementById("finalPrice"),
  finalDelivery: document.getElementById("finalDelivery"),
  finalSla: document.getElementById("finalSla"),
  constraintStatus: document.getElementById("constraintStatus"),
  kpiPriceDelta: document.getElementById("kpiPriceDelta"),
  kpiDeliveryDelta: document.getElementById("kpiDeliveryDelta"),
  kpiSlaDelta: document.getElementById("kpiSlaDelta"),
  kpiConstraintSource: document.getElementById("kpiConstraintSource"),
  fallbackAssetStatus: document.getElementById("fallbackAssetStatus"),
  storyTimelineTitle: document.getElementById("storyTimelineTitle"),
  storyTimelineCount: document.getElementById("storyTimelineCount"),
  storyTimelinePendingJobs: document.getElementById("storyTimelinePendingJobs"),
  storyTimelineMode: document.getElementById("storyTimelineMode"),
  storyTimelineAssetMix: document.getElementById("storyTimelineAssetMix"),
  storyTimelineProgressHint: document.getElementById("storyTimelineProgressHint"),
  storyTimelineProgressLabel: document.getElementById("storyTimelineProgressLabel"),
  storyTimelineProgressTrack: document.getElementById("storyTimelineProgressTrack"),
  storyTimelineProgressBar: document.getElementById("storyTimelineProgressBar"),
  storyTimelineScrubber: document.getElementById("storyTimelineScrubber"),
  storyTimelineSelect: document.getElementById("storyTimelineSelect"),
  storyTimelinePosition: document.getElementById("storyTimelinePosition"),
  storyTimelinePreview: document.getElementById("storyTimelinePreview"),
  storyTimelineList: document.getElementById("storyTimelineList"),
  activeTaskCount: document.getElementById("activeTaskCount"),
  tasks: document.getElementById("tasks"),
  operatorRole: document.getElementById("operatorRole"),
  operatorTaskId: document.getElementById("operatorTaskId"),
  operatorTargetService: document.getElementById("operatorTargetService"),
  operatorDemoViewBtn: document.getElementById("operatorDemoViewBtn"),
  operatorFullOpsViewBtn: document.getElementById("operatorFullOpsViewBtn"),
  operatorBoardModeHint: document.getElementById("operatorBoardModeHint"),
  operatorModeBanner: document.getElementById("operatorModeBanner"),
  operatorModeBadge: document.getElementById("operatorModeBadge"),
  operatorModeCopy: document.getElementById("operatorModeCopy"),
  operatorSummaryGuide: document.getElementById("operatorSummaryGuide"),
  operatorSummaryGuideTitle: document.getElementById("operatorSummaryGuideTitle"),
  operatorSummaryGuideHint: document.getElementById("operatorSummaryGuideHint"),
  operatorSummaryGuideRefreshBtn: document.getElementById("operatorSummaryGuideRefreshBtn"),
  operatorResetViewBtn: document.getElementById("operatorResetViewBtn"),
  operatorFocusCriticalBtn: document.getElementById("operatorFocusCriticalBtn"),
  operatorIssuesOnlyBtn: document.getElementById("operatorIssuesOnlyBtn"),
  operatorCollapseAllBtn: document.getElementById("operatorCollapseAllBtn"),
  operatorExpandAllBtn: document.getElementById("operatorExpandAllBtn"),
  operatorTriageTotal: document.getElementById("operatorTriageTotal"),
  operatorTriageVisible: document.getElementById("operatorTriageVisible"),
  operatorTriageFail: document.getElementById("operatorTriageFail"),
  operatorTriageNeutral: document.getElementById("operatorTriageNeutral"),
  operatorTriageOk: document.getElementById("operatorTriageOk"),
  operatorTriageHidden: document.getElementById("operatorTriageHidden"),
  operatorSignalBridge: document.getElementById("operatorSignalBridge"),
  operatorSignalQueue: document.getElementById("operatorSignalQueue"),
  operatorSignalApprovals: document.getElementById("operatorSignalApprovals"),
  operatorSignalStartup: document.getElementById("operatorSignalStartup"),
  operatorSignalUiExecutor: document.getElementById("operatorSignalUiExecutor"),
  operatorSignalDeviceNodes: document.getElementById("operatorSignalDeviceNodes"),
  operatorHealthBoard: document.getElementById("operatorHealthBoard"),
  operatorSummary: document.getElementById("operatorSummary"),
  operatorHealthStatus: document.getElementById("operatorHealthStatus"),
  operatorHealthState: document.getElementById("operatorHealthState"),
  operatorHealthLastEventType: document.getElementById("operatorHealthLastEventType"),
  operatorHealthLastEventAt: document.getElementById("operatorHealthLastEventAt"),
  operatorHealthHint: document.getElementById("operatorHealthHint"),
  operatorHealthDegraded: document.getElementById("operatorHealthDegraded"),
  operatorHealthRecovered: document.getElementById("operatorHealthRecovered"),
  operatorHealthWatchdogReconnects: document.getElementById("operatorHealthWatchdogReconnects"),
  operatorHealthErrors: document.getElementById("operatorHealthErrors"),
  operatorHealthUnavailable: document.getElementById("operatorHealthUnavailable"),
  operatorHealthConnectTimeouts: document.getElementById("operatorHealthConnectTimeouts"),
  operatorHealthProbes: document.getElementById("operatorHealthProbes"),
  operatorHealthPingSent: document.getElementById("operatorHealthPingSent"),
  operatorHealthPongs: document.getElementById("operatorHealthPongs"),
  operatorHealthPingErrors: document.getElementById("operatorHealthPingErrors"),
  operatorHealthProbeSuccess: document.getElementById("operatorHealthProbeSuccess"),
  operatorUiExecutorStatus: document.getElementById("operatorUiExecutorStatus"),
  operatorUiExecutorState: document.getElementById("operatorUiExecutorState"),
  operatorUiExecutorHealthy: document.getElementById("operatorUiExecutorHealthy"),
  operatorUiExecutorProfile: document.getElementById("operatorUiExecutorProfile"),
  operatorUiExecutorVersion: document.getElementById("operatorUiExecutorVersion"),
  operatorUiExecutorLastAction: document.getElementById("operatorUiExecutorLastAction"),
  operatorUiExecutorLastOutcome: document.getElementById("operatorUiExecutorLastOutcome"),
  operatorUiExecutorHint: document.getElementById("operatorUiExecutorHint"),
  operatorDeviceNodesStatus: document.getElementById("operatorDeviceNodesStatus"),
  operatorDeviceNodesTotal: document.getElementById("operatorDeviceNodesTotal"),
  operatorDeviceNodesOnline: document.getElementById("operatorDeviceNodesOnline"),
  operatorDeviceNodesDegraded: document.getElementById("operatorDeviceNodesDegraded"),
  operatorDeviceNodesOffline: document.getElementById("operatorDeviceNodesOffline"),
  operatorDeviceNodesStale: document.getElementById("operatorDeviceNodesStale"),
  operatorDeviceNodesMissingHeartbeat: document.getElementById("operatorDeviceNodesMissingHeartbeat"),
  operatorDeviceNodesMaxAge: document.getElementById("operatorDeviceNodesMaxAge"),
  operatorDeviceNodesHint: document.getElementById("operatorDeviceNodesHint"),
  operatorDeviceNodeUpdatesStatus: document.getElementById("operatorDeviceNodeUpdatesStatus"),
  operatorDeviceNodeUpdatesTotal: document.getElementById("operatorDeviceNodeUpdatesTotal"),
  operatorDeviceNodeUpdatesUpsert: document.getElementById("operatorDeviceNodeUpdatesUpsert"),
  operatorDeviceNodeUpdatesHeartbeat: document.getElementById("operatorDeviceNodeUpdatesHeartbeat"),
  operatorDeviceNodeUpdatesUniqueNodes: document.getElementById("operatorDeviceNodeUpdatesUniqueNodes"),
  operatorDeviceNodeUpdatesLatest: document.getElementById("operatorDeviceNodeUpdatesLatest"),
  operatorDeviceNodeUpdatesSeenAt: document.getElementById("operatorDeviceNodeUpdatesSeenAt"),
  operatorDeviceNodeUpdatesHint: document.getElementById("operatorDeviceNodeUpdatesHint"),
  operatorTraceStatus: document.getElementById("operatorTraceStatus"),
  operatorTraceRuns: document.getElementById("operatorTraceRuns"),
  operatorTraceEvents: document.getElementById("operatorTraceEvents"),
  operatorTraceUiRuns: document.getElementById("operatorTraceUiRuns"),
  operatorTraceApprovals: document.getElementById("operatorTraceApprovals"),
  operatorTraceSteps: document.getElementById("operatorTraceSteps"),
  operatorTraceScreenshots: document.getElementById("operatorTraceScreenshots"),
  operatorTraceTopRoute: document.getElementById("operatorTraceTopRoute"),
  operatorTraceTopStatus: document.getElementById("operatorTraceTopStatus"),
  operatorTraceHint: document.getElementById("operatorTraceHint"),
  operatorApprovalsStatus: document.getElementById("operatorApprovalsStatus"),
  operatorApprovalsTotal: document.getElementById("operatorApprovalsTotal"),
  operatorApprovalsPending: document.getElementById("operatorApprovalsPending"),
  operatorApprovalsApproved: document.getElementById("operatorApprovalsApproved"),
  operatorApprovalsRejected: document.getElementById("operatorApprovalsRejected"),
  operatorApprovalsTimeout: document.getElementById("operatorApprovalsTimeout"),
  operatorApprovalsPendingFromTasks: document.getElementById("operatorApprovalsPendingFromTasks"),
  operatorApprovalsSla: document.getElementById("operatorApprovalsSla"),
  operatorApprovalsLatest: document.getElementById("operatorApprovalsLatest"),
  operatorApprovalsHint: document.getElementById("operatorApprovalsHint"),
  operatorLifecycleStatus: document.getElementById("operatorLifecycleStatus"),
  operatorLifecycleReady: document.getElementById("operatorLifecycleReady"),
  operatorLifecycleDraining: document.getElementById("operatorLifecycleDraining"),
  operatorLifecycleUnknown: document.getElementById("operatorLifecycleUnknown"),
  operatorLifecycleLastChange: document.getElementById("operatorLifecycleLastChange"),
  operatorLifecycleDrainingServices: document.getElementById("operatorLifecycleDrainingServices"),
  operatorLifecycleHint: document.getElementById("operatorLifecycleHint"),
  operatorTaskQueueStatus: document.getElementById("operatorTaskQueueStatus"),
  operatorTaskQueueTotal: document.getElementById("operatorTaskQueueTotal"),
  operatorTaskQueueQueued: document.getElementById("operatorTaskQueueQueued"),
  operatorTaskQueueRunning: document.getElementById("operatorTaskQueueRunning"),
  operatorTaskQueuePendingApproval: document.getElementById("operatorTaskQueuePendingApproval"),
  operatorTaskQueueStale: document.getElementById("operatorTaskQueueStale"),
  operatorTaskQueueMaxAge: document.getElementById("operatorTaskQueueMaxAge"),
  operatorTaskQueueOldest: document.getElementById("operatorTaskQueueOldest"),
  operatorTaskQueueHint: document.getElementById("operatorTaskQueueHint"),
  operatorGatewayErrorStatus: document.getElementById("operatorGatewayErrorStatus"),
  operatorGatewayErrorSource: document.getElementById("operatorGatewayErrorSource"),
  operatorGatewayErrorCode: document.getElementById("operatorGatewayErrorCode"),
  operatorGatewayErrorTraceId: document.getElementById("operatorGatewayErrorTraceId"),
  operatorGatewayErrorClientEventId: document.getElementById("operatorGatewayErrorClientEventId"),
  operatorGatewayErrorClientEventType: document.getElementById("operatorGatewayErrorClientEventType"),
  operatorGatewayErrorConversation: document.getElementById("operatorGatewayErrorConversation"),
  operatorGatewayErrorLatency: document.getElementById("operatorGatewayErrorLatency"),
  operatorGatewayErrorSeenAt: document.getElementById("operatorGatewayErrorSeenAt"),
  operatorGatewayErrorHint: document.getElementById("operatorGatewayErrorHint"),
  operatorTurnTruncationStatus: document.getElementById("operatorTurnTruncationStatus"),
  operatorTurnTruncationTotal: document.getElementById("operatorTurnTruncationTotal"),
  operatorTurnTruncationRuns: document.getElementById("operatorTurnTruncationRuns"),
  operatorTurnTruncationSessions: document.getElementById("operatorTurnTruncationSessions"),
  operatorTurnTruncationTurnId: document.getElementById("operatorTurnTruncationTurnId"),
  operatorTurnTruncationReason: document.getElementById("operatorTurnTruncationReason"),
  operatorTurnTruncationAudioEndMs: document.getElementById("operatorTurnTruncationAudioEndMs"),
  operatorTurnTruncationContentIndex: document.getElementById("operatorTurnTruncationContentIndex"),
  operatorTurnTruncationSeenAt: document.getElementById("operatorTurnTruncationSeenAt"),
  operatorTurnTruncationHint: document.getElementById("operatorTurnTruncationHint"),
  operatorTurnDeleteStatus: document.getElementById("operatorTurnDeleteStatus"),
  operatorTurnDeleteTotal: document.getElementById("operatorTurnDeleteTotal"),
  operatorTurnDeleteRuns: document.getElementById("operatorTurnDeleteRuns"),
  operatorTurnDeleteSessions: document.getElementById("operatorTurnDeleteSessions"),
  operatorTurnDeleteTurnId: document.getElementById("operatorTurnDeleteTurnId"),
  operatorTurnDeleteReason: document.getElementById("operatorTurnDeleteReason"),
  operatorTurnDeleteScope: document.getElementById("operatorTurnDeleteScope"),
  operatorTurnDeleteSeenAt: document.getElementById("operatorTurnDeleteSeenAt"),
  operatorTurnDeleteHint: document.getElementById("operatorTurnDeleteHint"),
  operatorDamageControlStatus: document.getElementById("operatorDamageControlStatus"),
  operatorDamageControlTotal: document.getElementById("operatorDamageControlTotal"),
  operatorDamageControlRuns: document.getElementById("operatorDamageControlRuns"),
  operatorDamageControlSessions: document.getElementById("operatorDamageControlSessions"),
  operatorDamageControlVerdicts: document.getElementById("operatorDamageControlVerdicts"),
  operatorDamageControlLatest: document.getElementById("operatorDamageControlLatest"),
  operatorDamageControlRuleIds: document.getElementById("operatorDamageControlRuleIds"),
  operatorDamageControlSeenAt: document.getElementById("operatorDamageControlSeenAt"),
  operatorDamageControlHint: document.getElementById("operatorDamageControlHint"),
  operatorSkillsRegistryStatus: document.getElementById("operatorSkillsRegistryStatus"),
  operatorSkillsRegistryTotal: document.getElementById("operatorSkillsRegistryTotal"),
  operatorSkillsRegistrySkills: document.getElementById("operatorSkillsRegistrySkills"),
  operatorSkillsRegistryOutcomes: document.getElementById("operatorSkillsRegistryOutcomes"),
  operatorSkillsRegistryLifecycle: document.getElementById("operatorSkillsRegistryLifecycle"),
  operatorSkillsRegistryConflicts: document.getElementById("operatorSkillsRegistryConflicts"),
  operatorSkillsRegistryLatest: document.getElementById("operatorSkillsRegistryLatest"),
  operatorSkillsRegistrySeenAt: document.getElementById("operatorSkillsRegistrySeenAt"),
  operatorSkillsRegistryHint: document.getElementById("operatorSkillsRegistryHint"),
  operatorPluginMarketplaceStatus: document.getElementById("operatorPluginMarketplaceStatus"),
  operatorPluginMarketplaceTotal: document.getElementById("operatorPluginMarketplaceTotal"),
  operatorPluginMarketplacePlugins: document.getElementById("operatorPluginMarketplacePlugins"),
  operatorPluginMarketplaceOutcomes: document.getElementById("operatorPluginMarketplaceOutcomes"),
  operatorPluginMarketplaceSigning: document.getElementById("operatorPluginMarketplaceSigning"),
  operatorPluginMarketplacePermissions: document.getElementById("operatorPluginMarketplacePermissions"),
  operatorPluginMarketplaceLifecycle: document.getElementById("operatorPluginMarketplaceLifecycle"),
  operatorPluginMarketplaceConflicts: document.getElementById("operatorPluginMarketplaceConflicts"),
  operatorPluginMarketplaceLatest: document.getElementById("operatorPluginMarketplaceLatest"),
  operatorPluginMarketplaceSeenAt: document.getElementById("operatorPluginMarketplaceSeenAt"),
  operatorPluginMarketplaceHint: document.getElementById("operatorPluginMarketplaceHint"),
  operatorGovernancePolicyStatus: document.getElementById("operatorGovernancePolicyStatus"),
  operatorGovernancePolicyTotal: document.getElementById("operatorGovernancePolicyTotal"),
  operatorGovernancePolicyTenants: document.getElementById("operatorGovernancePolicyTenants"),
  operatorGovernancePolicyOutcomes: document.getElementById("operatorGovernancePolicyOutcomes"),
  operatorGovernancePolicyLifecycle: document.getElementById("operatorGovernancePolicyLifecycle"),
  operatorGovernancePolicyConflicts: document.getElementById("operatorGovernancePolicyConflicts"),
  operatorGovernancePolicyLatest: document.getElementById("operatorGovernancePolicyLatest"),
  operatorGovernancePolicySeenAt: document.getElementById("operatorGovernancePolicySeenAt"),
  operatorGovernancePolicyHint: document.getElementById("operatorGovernancePolicyHint"),
  operatorAgentUsageStatus: document.getElementById("operatorAgentUsageStatus"),
  operatorAgentUsageTotal: document.getElementById("operatorAgentUsageTotal"),
  operatorAgentUsageRuns: document.getElementById("operatorAgentUsageRuns"),
  operatorAgentUsageSessions: document.getElementById("operatorAgentUsageSessions"),
  operatorAgentUsageCalls: document.getElementById("operatorAgentUsageCalls"),
  operatorAgentUsageTokens: document.getElementById("operatorAgentUsageTokens"),
  operatorAgentUsageModels: document.getElementById("operatorAgentUsageModels"),
  operatorAgentUsageSource: document.getElementById("operatorAgentUsageSource"),
  operatorAgentUsageSeenAt: document.getElementById("operatorAgentUsageSeenAt"),
  operatorAgentUsageHint: document.getElementById("operatorAgentUsageHint"),
  operatorCostEstimateStatus: document.getElementById("operatorCostEstimateStatus"),
  operatorCostEstimateCurrency: document.getElementById("operatorCostEstimateCurrency"),
  operatorCostEstimateMode: document.getElementById("operatorCostEstimateMode"),
  operatorCostEstimateSource: document.getElementById("operatorCostEstimateSource"),
  operatorCostEstimateTokens: document.getElementById("operatorCostEstimateTokens"),
  operatorCostEstimateInputUsd: document.getElementById("operatorCostEstimateInputUsd"),
  operatorCostEstimateOutputUsd: document.getElementById("operatorCostEstimateOutputUsd"),
  operatorCostEstimateTotalUsd: document.getElementById("operatorCostEstimateTotalUsd"),
  operatorCostEstimateRates: document.getElementById("operatorCostEstimateRates"),
  operatorCostEstimateSeenAt: document.getElementById("operatorCostEstimateSeenAt"),
  operatorCostEstimateHint: document.getElementById("operatorCostEstimateHint"),
  operatorStartupStatus: document.getElementById("operatorStartupStatus"),
  operatorStartupTotal: document.getElementById("operatorStartupTotal"),
  operatorStartupBlocking: document.getElementById("operatorStartupBlocking"),
  operatorStartupLastType: document.getElementById("operatorStartupLastType"),
  operatorStartupLastService: document.getElementById("operatorStartupLastService"),
  operatorStartupLastCheckedAt: document.getElementById("operatorStartupLastCheckedAt"),
  operatorStartupHint: document.getElementById("operatorStartupHint"),
  deviceNodeId: document.getElementById("deviceNodeId"),
  deviceNodeDisplayName: document.getElementById("deviceNodeDisplayName"),
  deviceNodeKind: document.getElementById("deviceNodeKind"),
  deviceNodePlatform: document.getElementById("deviceNodePlatform"),
  deviceNodeExecutorUrl: document.getElementById("deviceNodeExecutorUrl"),
  deviceNodeStatus: document.getElementById("deviceNodeStatus"),
  deviceNodeTrustLevel: document.getElementById("deviceNodeTrustLevel"),
  deviceNodeExpectedVersion: document.getElementById("deviceNodeExpectedVersion"),
  deviceNodeCapabilities: document.getElementById("deviceNodeCapabilities"),
  deviceNodeMetadata: document.getElementById("deviceNodeMetadata"),
  deviceNodeConflictBtn: document.getElementById("deviceNodeConflictBtn"),
  deviceNodeCount: document.getElementById("deviceNodeCount"),
  deviceNodeFleetTotal: document.getElementById("deviceNodeFleetTotal"),
  deviceNodeFleetOnline: document.getElementById("deviceNodeFleetOnline"),
  deviceNodeFleetOnlinePct: document.getElementById("deviceNodeFleetOnlinePct"),
  deviceNodeFleetDegraded: document.getElementById("deviceNodeFleetDegraded"),
  deviceNodeFleetDegradedPct: document.getElementById("deviceNodeFleetDegradedPct"),
  deviceNodeFleetOffline: document.getElementById("deviceNodeFleetOffline"),
  deviceNodeFleetOfflinePct: document.getElementById("deviceNodeFleetOfflinePct"),
  deviceNodeFleetStale: document.getElementById("deviceNodeFleetStale"),
  deviceNodeFleetStalePct: document.getElementById("deviceNodeFleetStalePct"),
  deviceNodeSelectedStatus: document.getElementById("deviceNodeSelectedStatus"),
  deviceNodeSelectedVersion: document.getElementById("deviceNodeSelectedVersion"),
  deviceNodeSelectedLastSeen: document.getElementById("deviceNodeSelectedLastSeen"),
  deviceNodeListHint: document.getElementById("deviceNodeListHint"),
  deviceNodeList: document.getElementById("deviceNodeList"),
};

const tabButtons = Array.from(document.querySelectorAll(".tab-btn[data-tab-target]"));
const tabContents = Array.from(document.querySelectorAll(".tab-content[data-tab]"));
const DEFAULT_TAB_ID = "live-negotiator";
const customSelectShells = new Set();
const CUSTOM_SELECT_EXCLUDE_IDS = new Set(["storyTimelineSelect"]);
const CUSTOM_SELECT_OPTION_DESCRIPTIONS = {
  intent: {
    negotiation: "Price, delivery and SLA negotiation flow.",
    translation: "Realtime translation with language target.",
    conversation: "General assistant conversation lane.",
    story: "Creative storyteller pipeline.",
    ui_task: "Grounded UI task with device node controls.",
  },
  liveSetupActivityHandling: {
    "": "Use service default interrupt policy.",
    INTERRUPT_AND_RESUME: "Pause then resume assistant after interruption.",
    NO_INTERRUPTION: "Keep assistant uninterrupted while user speaks.",
  },
  operatorRole: {
    operator: "Operate runtime controls and refresh evidence.",
    admin: "Full control for failover and task actions.",
    viewer: "Read-only observation mode for judges.",
  },
  deviceNodeKind: {
    desktop: "Desktop execution node for primary flows.",
    mobile: "Mobile execution node for responsive checks.",
  },
  deviceNodeStatus: {
    online: "Node is healthy and ready to execute.",
    degraded: "Node is available with reduced health.",
    offline: "Node is not available for execution.",
  },
  deviceNodeTrustLevel: {
    reviewed: "Reviewed node with standard trust level.",
    trusted: "High-trust node for critical actions.",
    untrusted: "Restricted node, additional guardrails apply.",
  },
};

const OPERATOR_SIGNAL_STATUS_MIRROR_IDS = {
  operatorHealthStatus: "operatorSignalBridge",
  operatorTaskQueueStatus: "operatorSignalQueue",
  operatorApprovalsStatus: "operatorSignalApprovals",
  operatorStartupStatus: "operatorSignalStartup",
  operatorUiExecutorStatus: "operatorSignalUiExecutor",
  operatorDeviceNodesStatus: "operatorSignalDeviceNodes",
};

function nowLabel() {
  return new Date().toLocaleTimeString();
}

function makeId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeThemeMode(value) {
  return value === "light" ? "light" : "dark";
}

function readStoredThemeMode() {
  try {
    const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
    return normalizeThemeMode(stored);
  } catch {
    return "dark";
  }
}

function applyThemeMode(themeMode, options = {}) {
  const normalizedMode = normalizeThemeMode(themeMode);
  const persist = options.persist === true;
  const announce = options.announce === true;
  state.themeMode = normalizedMode;
  document.documentElement.setAttribute("data-theme", normalizedMode);
  if (el.themeToggleBtn) {
    el.themeToggleBtn.textContent =
      normalizedMode === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme";
  }
  if (persist) {
    try {
      window.localStorage?.setItem(THEME_STORAGE_KEY, normalizedMode);
    } catch {
      /* no-op on storage failures */
    }
  }
  if (announce) {
    appendTranscript("system", `Theme switched to ${normalizedMode}`);
  }
}

function toggleThemeMode() {
  const nextMode = state.themeMode === "dark" ? "light" : "dark";
  applyThemeMode(nextMode, { persist: true, announce: true });
}

function initBackgroundVideoLoopBlend() {
  const backgroundVideo = el.backgroundVideo;
  if (!(backgroundVideo instanceof HTMLVideoElement)) {
    return;
  }

  let transitionActive = false;
  let transitionExitTimer = null;

  const clearTransitionExitTimer = () => {
    if (transitionExitTimer !== null) {
      window.clearTimeout(transitionExitTimer);
      transitionExitTimer = null;
    }
  };

  const leaveTransition = () => {
    transitionActive = false;
    document.body.classList.remove(BG_VIDEO_LOOP_TRANSITION_CLASS);
  };

  const scheduleTransitionExit = (delayMs = 120) => {
    clearTransitionExitTimer();
    transitionExitTimer = window.setTimeout(() => {
      leaveTransition();
    }, delayMs);
  };

  const enterTransition = () => {
    if (transitionActive) {
      return;
    }
    transitionActive = true;
    clearTransitionExitTimer();
    document.body.classList.add(BG_VIDEO_LOOP_TRANSITION_CLASS);
  };

  const syncLoopDurationVariable = () => {
    const loopDurationSeconds = Number(backgroundVideo.duration);
    if (!Number.isFinite(loopDurationSeconds) || loopDurationSeconds <= 0) {
      return;
    }
    const normalizedDuration = Math.max(1, loopDurationSeconds).toFixed(3);
    document.documentElement.style.setProperty("--bg-video-loop-duration", `${normalizedDuration}s`);
  };

  const handleVideoTimeUpdate = () => {
    const loopDurationSeconds = Number(backgroundVideo.duration);
    const currentTimeSeconds = Number(backgroundVideo.currentTime);
    if (
      !Number.isFinite(loopDurationSeconds) ||
      loopDurationSeconds <= 0 ||
      !Number.isFinite(currentTimeSeconds)
    ) {
      return;
    }

    const remainingSeconds = loopDurationSeconds - currentTimeSeconds;
    if (remainingSeconds <= BG_VIDEO_LOOP_BLEND_SECONDS && remainingSeconds >= 0) {
      enterTransition();
      return;
    }

    if (transitionActive && currentTimeSeconds <= BG_VIDEO_LOOP_RESET_SECONDS) {
      scheduleTransitionExit(260);
      return;
    }

    if (transitionActive && remainingSeconds > BG_VIDEO_LOOP_BLEND_SECONDS) {
      scheduleTransitionExit(300);
    }
  };

  backgroundVideo.addEventListener("loadedmetadata", syncLoopDurationVariable);
  backgroundVideo.addEventListener("timeupdate", handleVideoTimeUpdate);
  backgroundVideo.addEventListener("seeked", () => {
    scheduleTransitionExit(260);
  });
  backgroundVideo.addEventListener("playing", () => {
    scheduleTransitionExit(300);
  });
  backgroundVideo.addEventListener("pause", () => {
    clearTransitionExitTimer();
    leaveTransition();
  });

  syncLoopDurationVariable();
}

function setActiveTab(tabId) {
  closeAllCustomSelectMenus();

  const requestedTabId = typeof tabId === "string" ? tabId.trim() : "";
  const resolvedTabId = tabContents.some((section) => section.dataset.tab === requestedTabId)
    ? requestedTabId
    : DEFAULT_TAB_ID;

  for (const section of tabContents) {
    const isActive = section.dataset.tab === resolvedTabId;
    section.classList.toggle("active", isActive);
    section.setAttribute("aria-hidden", isActive ? "false" : "true");
  }

  for (const button of tabButtons) {
    const isActive = (button.dataset.tabTarget ?? "") === resolvedTabId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  }
}

function setUiTaskFieldsVisibility() {
  if (!el.uiTaskFields || !el.intent) {
    return;
  }
  const isUiTaskIntent = el.intent.value === "ui_task";
  el.uiTaskFields.hidden = !isUiTaskIntent;
  el.uiTaskFields.setAttribute("aria-hidden", isUiTaskIntent ? "false" : "true");
  if (el.uiTaskAdvancedSection) {
    el.uiTaskAdvancedSection.hidden = !isUiTaskIntent;
    el.uiTaskAdvancedSection.setAttribute("aria-hidden", isUiTaskIntent ? "false" : "true");
    el.uiTaskAdvancedSection.open = isUiTaskIntent;
  }
}

function closeAllCustomSelectMenus(exceptShell = null) {
  for (const shell of customSelectShells) {
    if (!(shell instanceof HTMLElement)) {
      continue;
    }
    if (exceptShell && shell === exceptShell) {
      continue;
    }
    shell.classList.remove("is-open");
    const trigger = shell.querySelector(".select-trigger");
    if (trigger instanceof HTMLButtonElement) {
      trigger.setAttribute("aria-expanded", "false");
    }
  }
}

function syncCustomSelectControl(select) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const shell = select.closest(".select-shell");
  const sync = shell?.__syncCustomSelect;
  if (typeof sync === "function") {
    sync();
  }
}

function syncAllCustomSelectControls() {
  for (const shell of customSelectShells) {
    if (!(shell instanceof HTMLElement)) {
      continue;
    }
    const sync = shell.__syncCustomSelect;
    if (typeof sync === "function") {
      sync();
    }
  }
}

function getCustomSelectOptionDescription(selectId, optionValue) {
  const normalizedSelectId = typeof selectId === "string" ? selectId.trim() : "";
  if (!normalizedSelectId) {
    return "";
  }
  const descriptions = CUSTOM_SELECT_OPTION_DESCRIPTIONS[normalizedSelectId];
  if (!descriptions || typeof descriptions !== "object") {
    return "";
  }
  const normalizedValue = optionValue ?? "";
  const description = descriptions[normalizedValue];
  return typeof description === "string" ? description : "";
}

function ensureCustomSelectDismissHandlers() {
  if (ensureCustomSelectDismissHandlers.bound === true) {
    return;
  }
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    for (const shell of customSelectShells) {
      if (shell instanceof HTMLElement && shell.contains(target)) {
        return;
      }
    }
    closeAllCustomSelectMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllCustomSelectMenus();
    }
  });
  ensureCustomSelectDismissHandlers.bound = true;
}
ensureCustomSelectDismissHandlers.bound = false;

function createCustomSelect(select) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  if (CUSTOM_SELECT_EXCLUDE_IDS.has(select.id)) {
    return;
  }
  if (select.dataset.customSelectEnhanced === "true") {
    return;
  }

  select.dataset.customSelectEnhanced = "true";
  select.classList.add("select-native-enhanced");

  const parent = select.parentElement;
  if (!parent) {
    return;
  }

  const shell = document.createElement("div");
  shell.className = "select-shell";
  parent.insertBefore(shell, select);
  shell.appendChild(select);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  shell.appendChild(trigger);

  const menu = document.createElement("div");
  menu.className = "select-menu";
  menu.setAttribute("role", "listbox");
  const menuId = `${select.id || `select-${makeId()}`}-menu`;
  menu.id = menuId;
  trigger.setAttribute("aria-controls", menuId);
  shell.appendChild(menu);

  const syncCustomSelect = () => {
    const selectedOption = select.options[select.selectedIndex] ?? null;
    const selectedText =
      selectedOption?.textContent?.trim() ??
      selectedOption?.label?.trim() ??
      selectedOption?.value ??
      "";
    trigger.textContent = selectedText || "Select option";
    trigger.disabled = select.disabled;
    trigger.setAttribute("aria-disabled", select.disabled ? "true" : "false");

    menu.innerHTML = "";
    for (const option of Array.from(select.options)) {
      const optionButton = document.createElement("button");
      optionButton.type = "button";
      optionButton.className = "select-option";
      optionButton.setAttribute("role", "option");
      optionButton.dataset.value = option.value;
      optionButton.setAttribute("aria-selected", option.selected ? "true" : "false");
      optionButton.disabled = option.disabled;
      if (option.selected) {
        optionButton.classList.add("is-selected");
      }

      const optionLabel = document.createElement("span");
      optionLabel.className = "select-option-label";
      optionLabel.textContent = option.textContent?.trim() || option.value;
      optionButton.appendChild(optionLabel);

      const optionDescription = getCustomSelectOptionDescription(select.id, option.value);
      if (optionDescription) {
        const optionHint = document.createElement("small");
        optionHint.textContent = optionDescription;
        optionButton.appendChild(optionHint);
      }

      optionButton.addEventListener("click", () => {
        if (option.disabled) {
          return;
        }
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncCustomSelect();
        closeAllCustomSelectMenus();
      });

      menu.appendChild(optionButton);
    }
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    if (trigger.disabled) {
      return;
    }
    const willOpen = !shell.classList.contains("is-open");
    closeAllCustomSelectMenus(willOpen ? shell : null);
    shell.classList.toggle("is-open", willOpen);
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");

    if (willOpen) {
      const selectedOptionNode = menu.querySelector(".select-option.is-selected");
      if (selectedOptionNode instanceof HTMLButtonElement) {
        selectedOptionNode.focus();
      }
    }
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      trigger.click();
    }
  });

  select.addEventListener("change", syncCustomSelect);

  const observer = new MutationObserver(() => {
    syncCustomSelect();
  });
  observer.observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "label"],
  });

  shell.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllCustomSelectMenus();
      trigger.focus();
    }
  });

  shell.__syncCustomSelect = syncCustomSelect;
  customSelectShells.add(shell);
  ensureCustomSelectDismissHandlers();
  syncCustomSelect();
}

function enhanceSelectControls() {
  const selects = document.querySelectorAll("select");
  for (const node of selects) {
    if (node instanceof HTMLSelectElement) {
      createCustomSelect(node);
    }
  }
}

function setOperatorGroupCollapsed(group, collapsed) {
  if (!(group instanceof HTMLElement)) {
    return;
  }
  const isCollapsed = collapsed === true;
  group.classList.toggle("is-collapsed", isCollapsed);
  const toggle = group.querySelector("[data-operator-group-toggle]");
  if (toggle instanceof HTMLButtonElement) {
    toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    toggle.textContent = isCollapsed ? "Expand" : "Collapse";
  }
}

function getVisibleOperatorGroups() {
  return Array.from(document.querySelectorAll(".operator-health-group")).filter(
    (group) => !group.classList.contains("operator-health-group-hidden"),
  );
}

function applyOperatorDefaultGroupFocus() {
  if (state.operatorSummaryUserRefreshed === true) {
    return;
  }
  const visibleGroups = getVisibleOperatorGroups();
  if (visibleGroups.length === 0) {
    return;
  }
  for (const group of visibleGroups) {
    const key = group.getAttribute("data-operator-group");
    setOperatorGroupCollapsed(group, key !== "bridge-safety");
  }
}

function syncOperatorCollapseActionButtons() {
  const groups = getVisibleOperatorGroups();
  if (groups.length === 0) {
    state.operatorCardsCollapsed = false;
    if (el.operatorHealthBoard) {
      el.operatorHealthBoard.classList.remove("is-collapsed");
    }
    if (el.operatorCollapseAllBtn) {
      el.operatorCollapseAllBtn.disabled = true;
    }
    if (el.operatorExpandAllBtn) {
      el.operatorExpandAllBtn.disabled = true;
    }
    return;
  }

  const allCollapsed = groups.every((group) => group.classList.contains("is-collapsed"));
  const allExpanded = groups.every((group) => !group.classList.contains("is-collapsed"));
  state.operatorCardsCollapsed = allCollapsed;
  if (el.operatorHealthBoard) {
    el.operatorHealthBoard.classList.toggle("is-collapsed", state.operatorCardsCollapsed);
  }
  if (el.operatorCollapseAllBtn) {
    el.operatorCollapseAllBtn.disabled = allCollapsed;
  }
  if (el.operatorExpandAllBtn) {
    el.operatorExpandAllBtn.disabled = allExpanded;
  }
}

function setAllOperatorGroupsCollapsed(collapsed) {
  const groups = document.querySelectorAll(".operator-health-group");
  for (const group of groups) {
    setOperatorGroupCollapsed(group, collapsed);
  }
}

function setOperatorCardsCollapsed(collapsed) {
  state.operatorCardsCollapsed = collapsed === true;
  if (el.operatorHealthBoard) {
    el.operatorHealthBoard.classList.toggle("is-collapsed", state.operatorCardsCollapsed);
  }
  setAllOperatorGroupsCollapsed(state.operatorCardsCollapsed);
  syncOperatorCollapseActionButtons();
}

function isOperatorCriticalCard(card) {
  return card instanceof HTMLElement && card.hasAttribute("data-operator-critical");
}

function setOperatorFocusCriticalMode(enabled) {
  state.operatorFocusCriticalOnly = enabled === true;
  if (el.operatorHealthBoard) {
    el.operatorHealthBoard.classList.toggle("is-focus-critical", state.operatorFocusCriticalOnly);
  }
  if (el.operatorFocusCriticalBtn) {
    el.operatorFocusCriticalBtn.classList.toggle("is-active", state.operatorFocusCriticalOnly);
    el.operatorFocusCriticalBtn.setAttribute("aria-pressed", state.operatorFocusCriticalOnly ? "true" : "false");
    el.operatorFocusCriticalBtn.textContent = state.operatorFocusCriticalOnly ? "Show All Cards" : "Focus Critical";
  }
  applyOperatorCardsVisibility();
}

function setOperatorIssuesOnlyMode(enabled) {
  state.operatorIssuesOnly = enabled === true;
  if (el.operatorIssuesOnlyBtn) {
    el.operatorIssuesOnlyBtn.classList.toggle("is-active", state.operatorIssuesOnly);
    el.operatorIssuesOnlyBtn.setAttribute("aria-pressed", state.operatorIssuesOnly ? "true" : "false");
    el.operatorIssuesOnlyBtn.textContent = state.operatorIssuesOnly ? "Show All Statuses" : "Issues Only";
  }
  applyOperatorCardsVisibility();
}

function normalizeOperatorBoardMode(value) {
  return value === "full" ? "full" : "demo";
}

function syncOperatorBoardModeButtons() {
  const mode = normalizeOperatorBoardMode(state.operatorBoardMode);
  const isDemo = mode === "demo";
  if (el.operatorDemoViewBtn) {
    el.operatorDemoViewBtn.classList.toggle("is-active", isDemo);
    el.operatorDemoViewBtn.setAttribute("aria-pressed", isDemo ? "true" : "false");
  }
  if (el.operatorFullOpsViewBtn) {
    el.operatorFullOpsViewBtn.classList.toggle("is-active", !isDemo);
    el.operatorFullOpsViewBtn.setAttribute("aria-pressed", !isDemo ? "true" : "false");
  }
  if (el.operatorHealthBoard) {
    el.operatorHealthBoard.classList.toggle("is-demo-view", isDemo);
    el.operatorHealthBoard.classList.toggle("is-full-ops-view", !isDemo);
  }
  if (el.operatorBoardModeHint) {
    el.operatorBoardModeHint.textContent = isDemo
      ? "Demo View keeps six judge-facing cards visible by default and still surfaces new failures."
      : "Full Ops View shows the full diagnostics board (all cards and lanes).";
  }
  if (el.operatorModeBanner) {
    el.operatorModeBanner.classList.toggle("is-demo", isDemo);
    el.operatorModeBanner.classList.toggle("is-full-ops", !isDemo);
  }
  setStatusPill(el.operatorModeBadge, isDemo ? "demo_view" : "full_ops_view", isDemo ? "ok" : "neutral");
  if (el.operatorModeCopy) {
    el.operatorModeCopy.textContent = isDemo
      ? "Critical-first board for judge walkthroughs."
      : "Full diagnostics board with all lanes and evidence cards visible.";
  }
  syncOperatorSummaryGuide();
}

function syncOperatorSummaryGuide() {
  if (!(el.operatorSummaryGuide instanceof HTMLElement)) {
    return;
  }
  const isDemo = normalizeOperatorBoardMode(state.operatorBoardMode) === "demo";
  const hasManualRefresh = state.operatorSummaryUserRefreshed === true;

  el.operatorSummaryGuide.classList.toggle("is-hidden", hasManualRefresh);
  el.operatorSummaryGuide.classList.toggle("is-full-ops", !isDemo);

  if (el.operatorSummaryGuideTitle) {
    el.operatorSummaryGuideTitle.textContent = isDemo
      ? "Ready for first evidence refresh"
      : "Diagnostics board is waiting for first refresh";
  }
  if (el.operatorSummaryGuideHint) {
    el.operatorSummaryGuideHint.textContent = isDemo
      ? "Click `Refresh Summary` once to hydrate diagnostics cards and unlock full triage context."
      : "Run one refresh to hydrate all ops widgets before deep triage in Full Ops View.";
  }
}

function setOperatorBoardMode(mode, options = {}) {
  const nextMode = normalizeOperatorBoardMode(mode);
  const syncPresets = options && options.syncPresets === false ? false : true;
  state.operatorBoardMode = nextMode;
  syncOperatorBoardModeButtons();

  if (!syncPresets) {
    return;
  }

  setOperatorCardsCollapsed(false);
  setOperatorIssuesOnlyMode(false);
  setOperatorFocusCriticalMode(nextMode === "demo");

  if (nextMode === "demo") {
    const groups = Array.from(document.querySelectorAll(".operator-health-group"));
    for (const group of groups) {
      const key = group.getAttribute("data-operator-group");
      setOperatorGroupCollapsed(group, key !== "bridge-safety");
    }
    syncOperatorCollapseActionButtons();
  } else {
    setAllOperatorGroupsCollapsed(false);
    syncOperatorCollapseActionButtons();
  }
  applyOperatorCardsVisibility();
}

function readOperatorStatusVariant(statusNode) {
  if (!(statusNode instanceof HTMLElement)) {
    return "neutral";
  }
  if (statusNode.classList.contains("status-fail")) {
    return "fail";
  }
  if (statusNode.classList.contains("status-ok")) {
    return "ok";
  }
  return "neutral";
}

function refreshOperatorTriageSummary() {
  const cards = Array.from(document.querySelectorAll(".operator-health-card"));
  let visible = 0;
  let hidden = 0;
  let fail = 0;
  let neutral = 0;
  let ok = 0;

  for (const card of cards) {
    const group = card.closest(".operator-health-group");
    const isGroupHidden = group instanceof HTMLElement && group.classList.contains("operator-health-group-hidden");
    const isHidden = card.classList.contains("operator-health-card-hidden") || isGroupHidden;
    if (isHidden) {
      hidden += 1;
      continue;
    }

    visible += 1;
    const statusNode = card.querySelector(".status-pill");
    const variant = readOperatorStatusVariant(statusNode);
    if (variant === "fail") {
      fail += 1;
      continue;
    }
    if (variant === "ok") {
      ok += 1;
      continue;
    }
    neutral += 1;
  }

  setText(el.operatorTriageTotal, String(cards.length));
  setText(el.operatorTriageVisible, String(visible));
  setText(el.operatorTriageFail, String(fail));
  setText(el.operatorTriageNeutral, String(neutral));
  setText(el.operatorTriageOk, String(ok));
  setText(el.operatorTriageHidden, String(hidden));
}

function refreshOperatorGroupMetrics() {
  const groups = Array.from(document.querySelectorAll(".operator-health-group"));
  for (const group of groups) {
    const metricsNode = group.querySelector("[data-operator-group-metrics]");
    if (!(metricsNode instanceof HTMLElement)) {
      continue;
    }

    const cards = Array.from(group.querySelectorAll(".operator-health-card"));
    const isGroupHidden = group.classList.contains("operator-health-group-hidden");
    let visible = 0;
    let hidden = 0;
    let fail = 0;
    let neutral = 0;
    let ok = 0;

    for (const card of cards) {
      const isHidden = isGroupHidden || card.classList.contains("operator-health-card-hidden");
      if (isHidden) {
        hidden += 1;
        continue;
      }
      visible += 1;
      const statusNode = card.querySelector(".status-pill");
      const variant = readOperatorStatusVariant(statusNode);
      if (variant === "fail") {
        fail += 1;
        continue;
      }
      if (variant === "ok") {
        ok += 1;
        continue;
      }
      neutral += 1;
    }

    metricsNode.textContent = `visible ${visible} | fail ${fail} | neutral ${neutral} | ok ${ok} | hidden ${hidden}`;
    metricsNode.classList.toggle("is-has-fail", fail > 0);
    metricsNode.classList.toggle("is-all-ok", fail === 0 && neutral === 0 && ok > 0);
  }
}

function resetOperatorBoardView() {
  setOperatorBoardMode("demo", { syncPresets: false });
  setOperatorCardsCollapsed(false);
  setOperatorIssuesOnlyMode(false);
  setOperatorFocusCriticalMode(true);
  const groups = Array.from(document.querySelectorAll(".operator-health-group"));
  for (const group of groups) {
    const key = group.getAttribute("data-operator-group");
    setOperatorGroupCollapsed(group, key !== "bridge-safety");
  }
  syncOperatorCollapseActionButtons();
  applyOperatorCardsVisibility();
}

function getOperatorCardByStatusId(statusId) {
  if (typeof statusId !== "string" || statusId.trim().length === 0) {
    return null;
  }
  const statusNode = document.getElementById(statusId.trim());
  if (!(statusNode instanceof HTMLElement)) {
    return null;
  }
  const card = statusNode.closest(".operator-health-card");
  return card instanceof HTMLElement ? card : null;
}

function jumpToOperatorStatusCard(statusId) {
  const card = getOperatorCardByStatusId(statusId);
  if (!(card instanceof HTMLElement)) {
    return;
  }
  if (state.operatorIssuesOnly) {
    setOperatorIssuesOnlyMode(false);
  }
  const group = card.closest(".operator-health-group");
  if (group instanceof HTMLElement) {
    setOperatorGroupCollapsed(group, false);
    syncOperatorCollapseActionButtons();
  }
  card.classList.remove("operator-health-card-flash");
  card.classList.add("operator-health-card-flash");
  setTimeout(() => {
    card.classList.remove("operator-health-card-flash");
  }, OPERATOR_SIGNAL_FLASH_MS);
  card.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}

function isOperatorPlaceholderStatusText(value) {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "no_data" || normalized === "summary_error";
}

function resolveStatusPillDisplayText(value) {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "no_data") {
    return "awaiting_refresh";
  }
  if (normalized === "summary_error") {
    return "refresh_failed";
  }
  return value;
}

function isOperatorDemoEssentialCard(card) {
  return card instanceof HTMLElement && card.hasAttribute("data-operator-demo-essential");
}

function applyOperatorCardVisibility(card) {
  if (!card) {
    return;
  }
  const statusNode = card.querySelector(".status-pill");
  if (!statusNode) {
    card.classList.remove("operator-health-card-hidden");
    return;
  }
  const shouldHide =
    state.operatorSummaryUserRefreshed !== true &&
    isOperatorPlaceholderStatusText(
      statusNode instanceof HTMLElement ? (statusNode.dataset.statusCode ?? statusNode.textContent ?? "") : statusNode.textContent ?? "",
    );
  if (state.operatorFocusCriticalOnly === true && !isOperatorCriticalCard(card)) {
    card.classList.toggle("operator-health-card-hidden", true);
    return;
  }
  if (state.operatorIssuesOnly && statusNode.classList.contains("status-ok")) {
    card.classList.toggle("operator-health-card-hidden", true);
    return;
  }

  if (state.operatorBoardMode === "demo" && state.operatorFocusCriticalOnly === true && !isOperatorDemoEssentialCard(card)) {
    const variant = readOperatorStatusVariant(statusNode);
    if (variant !== "fail") {
      card.classList.toggle("operator-health-card-hidden", true);
      return;
    }
  }

  card.classList.toggle("operator-health-card-hidden", shouldHide);
}

function applyOperatorGroupVisibility(group) {
  if (!group) {
    return;
  }
  const cards = Array.from(group.querySelectorAll(".operator-health-card"));
  const hasVisibleCards = cards.some((card) => !card.classList.contains("operator-health-card-hidden"));
  group.classList.toggle("operator-health-group-hidden", !hasVisibleCards);
}

function applyOperatorCardsVisibility() {
  const cards = document.querySelectorAll(".operator-health-card");
  for (const card of cards) {
    applyOperatorCardVisibility(card);
  }
  const groups = document.querySelectorAll(".operator-health-group");
  for (const group of groups) {
    applyOperatorGroupVisibility(group);
  }
  applyOperatorDefaultGroupFocus();
  syncOperatorCollapseActionButtons();
  refreshOperatorTriageSummary();
  refreshOperatorGroupMetrics();
}

function toConversationScope(value) {
  return value === "none" ? "none" : "default";
}

function toEnvelopeOptions(runOrOptions) {
  if (typeof runOrOptions === "string" || runOrOptions === null || runOrOptions === undefined) {
    return {
      runId: runOrOptions ?? state.runId,
      conversation: "default",
      metadata: {},
    };
  }
  if (typeof runOrOptions !== "object") {
    return {
      runId: state.runId,
      conversation: "default",
      metadata: {},
    };
  }

  const runId =
    typeof runOrOptions.runId === "string" || runOrOptions.runId === null || runOrOptions.runId === undefined
      ? runOrOptions.runId
      : state.runId;
  const conversation = toConversationScope(runOrOptions.conversation);
  const metadata =
    runOrOptions.metadata && typeof runOrOptions.metadata === "object" && !Array.isArray(runOrOptions.metadata)
      ? runOrOptions.metadata
      : {};

  return {
    runId: runId ?? state.runId,
    conversation,
    metadata,
  };
}

function setConnectionStatus(text) {
  const normalized = typeof text === "string" ? text : "disconnected";
  state.connectionStatus = normalized;
  let variant = "neutral";
  if (normalized === "connected") {
    variant = "ok";
  } else if (normalized === "disconnected" || normalized === "error") {
    variant = "fail";
  }
  setStatusPill(el.connectionStatus, normalized, variant);
  renderAssistantActivityStatus();
}

function resolveSessionStateVariant(text) {
  const normalized = typeof text === "string" ? text.trim().toLowerCase() : "";
  if (!normalized || normalized === "-" || normalized === "idle" || normalized === "unknown") {
    return "neutral";
  }
  if (
    normalized.includes("ready") ||
    normalized.includes("active") ||
    normalized.includes("running") ||
    normalized.includes("connected")
  ) {
    return "ok";
  }
  if (
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("disconnect") ||
    normalized.includes("timeout") ||
    normalized.includes("drain")
  ) {
    return "fail";
  }
  return "neutral";
}

function setSessionState(text) {
  const normalized = typeof text === "string" && text.trim().length > 0 ? text.trim() : "-";
  state.sessionState = normalized;
  setStatusPill(el.sessionState, normalized, resolveSessionStateVariant(normalized));
}

function resolveModeStatusVariant(mode) {
  const normalized = typeof mode === "string" ? mode.trim().toLowerCase() : "";
  if (normalized === "voice") {
    return "ok";
  }
  return "neutral";
}

function setMode(mode) {
  const normalized = typeof mode === "string" && mode.trim().length > 0 ? mode.trim() : "voice";
  state.mode = normalized;
  setStatusPill(el.modeStatus, normalized, resolveModeStatusVariant(normalized));
}

function setPttStatus(text, variant = "neutral") {
  if (!el.pttStatus) {
    return;
  }
  setStatusPill(el.pttStatus, text, variant);
}

function resetPlaybackTracking() {
  state.assistantPlaybackTurnId = null;
  state.assistantPlaybackStartedAtMs = null;
  state.assistantPlaybackScheduledMs = 0;
}

function estimateAssistantPlaybackMs() {
  if (!state.assistantPlaybackStartedAtMs || state.assistantPlaybackScheduledMs <= 0) {
    return 0;
  }
  const elapsedMs = Math.max(0, Date.now() - state.assistantPlaybackStartedAtMs);
  return Math.min(Math.floor(elapsedMs), Math.floor(state.assistantPlaybackScheduledMs));
}

function normalizeApiBaseUrl(value) {
  if (typeof value !== "string") {
    return state.apiBaseUrl;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return state.apiBaseUrl;
  }
  return trimmed.replace(/\/+$/, "");
}

async function loadRuntimeConfig() {
  try {
    const response = await fetch("/config.json", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    const runtime = payload && typeof payload.runtime === "object" ? payload.runtime : null;
    if (!runtime) {
      return null;
    }
    const wsUrl = typeof runtime.wsUrl === "string" && runtime.wsUrl.trim().length > 0 ? runtime.wsUrl.trim() : null;
    const apiBaseUrl =
      typeof runtime.apiBaseUrl === "string" && runtime.apiBaseUrl.trim().length > 0 ? runtime.apiBaseUrl.trim() : null;
    if (!wsUrl && !apiBaseUrl) {
      return null;
    }
    return {
      wsUrl,
      apiBaseUrl,
    };
  } catch {
    return null;
  }
}

function toOptionalText(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeDeviceNode(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const nodeId = toOptionalText(value.nodeId);
  if (!nodeId) {
    return null;
  }
  const status = toOptionalText(value.status) ?? "online";
  const kind = toOptionalText(value.kind) ?? "desktop";
  const displayName = toOptionalText(value.displayName) ?? nodeId;
  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  return {
    nodeId,
    displayName,
    kind,
    platform: toOptionalText(value.platform) ?? "unknown",
    executorUrl: toOptionalText(value.executorUrl),
    status,
    trustLevel: toOptionalText(value.trustLevel) ?? "reviewed",
    version: typeof value.version === "number" ? value.version : null,
    lastSeenAt: toOptionalText(value.lastSeenAt),
    updatedAt: toOptionalText(value.updatedAt),
    capabilities,
  };
}

function parseCapabilitiesCsv(value) {
  if (typeof value !== "string") {
    return [];
  }
  const seen = new Set();
  const deduped = [];
  for (const item of value.split(",")) {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function parseOptionalMetadataJson(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return JSON.parse(value);
}

function appendEntry(container, kind, title, message) {
  const entry = document.createElement("div");
  entry.className = `entry ${kind}`;
  const titleNode = document.createElement("small");
  titleNode.textContent = `${nowLabel()} - ${title}`;
  const bodyNode = document.createElement("div");
  bodyNode.textContent = message;
  entry.appendChild(titleNode);
  entry.appendChild(bodyNode);
  container.prepend(entry);
  return entry;
}

function clearAssistantStreamFlushTimer() {
  if (state.assistantStreamFlushTimer === null) {
    return;
  }
  window.clearTimeout(state.assistantStreamFlushTimer);
  state.assistantStreamFlushTimer = null;
}

function clearAssistantSpeakingResetTimer() {
  if (state.assistantSpeakingResetTimer === null) {
    return;
  }
  window.clearTimeout(state.assistantSpeakingResetTimer);
  state.assistantSpeakingResetTimer = null;
}

function scheduleAssistantSpeakingReset() {
  clearAssistantSpeakingResetTimer();
  const audioContext = state.audioContext;
  if (!audioContext) {
    state.assistantIsSpeaking = false;
    renderAssistantActivityStatus();
    return;
  }

  const remainingMs = Math.max(0, (state.nextPlayTime - audioContext.currentTime) * 1000);
  if (remainingMs <= 10) {
    state.assistantIsSpeaking = false;
    renderAssistantActivityStatus();
    return;
  }

  const delayMs = Math.min(Math.max(Math.ceil(remainingMs + 30), 40), 2000);
  state.assistantSpeakingResetTimer = window.setTimeout(() => {
    state.assistantSpeakingResetTimer = null;
    scheduleAssistantSpeakingReset();
  }, delayMs);
}

function finalizeAssistantStreamEntry() {
  clearAssistantStreamFlushTimer();

  const entry = state.assistantStreamEntry;
  const body = state.assistantStreamBody;
  const text = state.assistantStreamText.trim();
  if (entry && body) {
    if (text.length > 0) {
      body.textContent = text;
    } else {
      entry.remove();
    }
  }

  state.assistantStreamEntry = null;
  state.assistantStreamBody = null;
  state.assistantStreamText = "";
  state.assistantIsStreaming = false;
  renderAssistantActivityStatus();
}

function scheduleAssistantStreamFinalize(delayMs) {
  const finalDelayMs = Number.isFinite(delayMs) && delayMs > 0
    ? Math.floor(delayMs)
    : state.assistantStreamIdleFinalizeMs;
  clearAssistantStreamFlushTimer();
  state.assistantStreamFlushTimer = window.setTimeout(() => {
    finalizeAssistantStreamEntry();
  }, finalDelayMs);
}

function ensureAssistantStreamEntry() {
  if (
    state.assistantStreamEntry &&
    state.assistantStreamBody &&
    state.assistantStreamEntry.isConnected
  ) {
    return;
  }
  const entry = appendEntry(el.transcript, "system", "assistant", "");
  const body = entry.lastElementChild;
  if (!(body instanceof HTMLDivElement)) {
    return;
  }
  state.assistantStreamEntry = entry;
  state.assistantStreamBody = body;
  state.assistantStreamText = "";
}

function appendAssistantStreamingText(text) {
  if (typeof text !== "string" || text.length === 0) {
    return;
  }
  ensureAssistantStreamEntry();
  if (!state.assistantStreamBody) {
    return;
  }
  const chunk = prepareAssistantStreamChunk(state.assistantStreamText, text);
  if (chunk.length === 0) {
    return;
  }
  state.assistantStreamText += chunk;
  state.assistantIsStreaming = true;
  state.assistantStreamBody.textContent = state.assistantStreamText;
  renderAssistantActivityStatus();
  updateOfferFromText(chunk, false);
  evaluateConstraints();
  const finalizeDelayMs = resolveAssistantFinalizeDelay(
    chunk,
    state.assistantStreamIdleFinalizeMs,
    state.assistantStreamPunctuationFinalizeMs,
  );
  scheduleAssistantStreamFinalize(finalizeDelayMs);
}

function appendTranscript(role, text) {
  finalizeAssistantStreamEntry();
  appendEntry(el.transcript, role === "error" ? "error" : "system", role, text);
}

function appendEvent(type, text) {
  appendEntry(el.events, "system", type, text);
}

function resolveExportStatusKind(statusText) {
  const normalized = typeof statusText === "string" ? statusText.trim().toLowerCase() : "";
  if (normalized.startsWith("markdown exported")) {
    return "markdown";
  }
  if (normalized.startsWith("json exported")) {
    return "json";
  }
  if (normalized.startsWith("audio exported")) {
    return "audio";
  }
  if (normalized.startsWith("audio export skipped")) {
    return "skipped";
  }
  if (normalized === "idle") {
    return "idle";
  }
  return "other";
}

function resolveExportMenuSummaryLabel(statusText) {
  const kind = resolveExportStatusKind(statusText);
  if (kind === "markdown") {
    return "Export Session - Markdown";
  }
  if (kind === "json") {
    return "Export Session - JSON";
  }
  if (kind === "audio") {
    return "Export Session - Audio";
  }
  if (kind === "skipped") {
    return "Export Session - No Audio";
  }
  return "Export Session";
}

function resolveExportMenuSummaryIcon(statusText) {
  const kind = resolveExportStatusKind(statusText);
  if (kind === "markdown") {
    return "MD";
  }
  if (kind === "json") {
    return "JS";
  }
  if (kind === "audio") {
    return "WAV";
  }
  if (kind === "skipped") {
    return "SKIP";
  }
  return "DL";
}

function resolveExportStatusStripLabel(statusText) {
  const kind = resolveExportStatusKind(statusText);
  if (kind === "markdown") {
    return "exported markdown";
  }
  if (kind === "json") {
    return "exported json";
  }
  if (kind === "audio") {
    return "exported audio";
  }
  if (kind === "skipped") {
    return "no audio";
  }
  if (kind === "idle") {
    return "idle";
  }
  const normalized = typeof statusText === "string" ? statusText.trim() : "";
  if (normalized.length === 0) {
    return "idle";
  }
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

function shouldTrackExportStatus(statusText) {
  const kind = resolveExportStatusKind(statusText);
  return kind === "markdown" || kind === "json" || kind === "audio" || kind === "skipped";
}

function extractExportHistoryFileLabel(statusText) {
  if (typeof statusText !== "string") {
    return "";
  }
  const match = statusText.match(/\(([^()]+)\)\s*$/);
  if (!match || typeof match[1] !== "string") {
    return "";
  }
  return match[1].trim();
}

function formatExportHistoryTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    return "--:--:--";
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function renderExportMenuHistory() {
  if (!(el.exportMenuHistory instanceof HTMLElement)) {
    return;
  }
  el.exportMenuHistory.innerHTML = "";
  const history = Array.isArray(state.exportHistory) ? state.exportHistory : [];
  if (history.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "export-menu-history-empty";
    emptyItem.textContent = "No exports yet";
    el.exportMenuHistory.appendChild(emptyItem);
    return;
  }
  for (const item of history.slice(0, EXPORT_HISTORY_LIMIT)) {
    const historyItem = document.createElement("li");
    historyItem.className = "export-menu-history-item";
    if (typeof item.kind === "string" && item.kind.trim().length > 0) {
      historyItem.classList.add("is-" + item.kind);
    }

    const badge = document.createElement("span");
    badge.className = "export-menu-history-badge";
    badge.textContent = typeof item.badge === "string" && item.badge.trim().length > 0 ? item.badge : "LOG";
    historyItem.appendChild(badge);

    const main = document.createElement("div");
    main.className = "export-menu-history-main";

    const fileLabel = document.createElement("span");
    fileLabel.className = "export-menu-history-file";
    fileLabel.textContent =
      typeof item.label === "string" && item.label.trim().length > 0 ? item.label : "export status updated";

    const timeLabel = document.createElement("span");
    timeLabel.className = "export-menu-history-time";
    timeLabel.textContent = formatExportHistoryTime(item.recordedAt);

    main.append(fileLabel, timeLabel);
    historyItem.appendChild(main);
    el.exportMenuHistory.appendChild(historyItem);
  }
}

function pushExportHistory(statusText) {
  if (!shouldTrackExportStatus(statusText)) {
    return;
  }
  const normalized = typeof statusText === "string" ? statusText.trim() : "";
  if (normalized.length === 0) {
    return;
  }
  const last = Array.isArray(state.exportHistory) && state.exportHistory.length > 0 ? state.exportHistory[0] : null;
  if (last && typeof last.status === "string" && last.status === normalized) {
    return;
  }
  const kind = resolveExportStatusKind(normalized);
  const badge =
    kind === "markdown" ? "MD" : kind === "json" ? "JS" : kind === "audio" ? "WAV" : kind === "skipped" ? "SKIP" : "LOG";
  const label = extractExportHistoryFileLabel(normalized) || normalized;
  state.exportHistory = [
    {
      kind,
      badge,
      label,
      status: normalized,
      recordedAt: Date.now(),
    },
    ...state.exportHistory,
  ].slice(0, EXPORT_HISTORY_LIMIT);
  renderExportMenuHistory();
}

function setExportStatus(text) {
  const normalized = typeof text === "string" && text.trim().length > 0 ? text.trim() : "idle";
  if (!el.exportStatus) {
    return;
  }
  const stripLabel = resolveExportStatusStripLabel(normalized);
  let variant = "neutral";
  const exportKind = resolveExportStatusKind(normalized);
  if (exportKind === "markdown" || exportKind === "json" || exportKind === "audio") {
    variant = "ok";
  }
  setStatusPill(el.exportStatus, stripLabel, variant);
  el.exportStatus.title = normalized;
  if (el.exportMenuSummaryIcon) {
    el.exportMenuSummaryIcon.textContent = resolveExportMenuSummaryIcon(normalized);
    el.exportMenuSummaryIcon.setAttribute("data-export-kind", exportKind);
  }
  if (el.exportMenuSummaryLabel) {
    el.exportMenuSummaryLabel.textContent = resolveExportMenuSummaryLabel(normalized);
  }
  if (el.exportMenuMeta) {
    el.exportMenuMeta.textContent = "Last export: " + normalized;
  }
  pushExportHistory(normalized);
}

function normalizeStoryTimelineSegment(value, fallbackIndex) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const rawIndex =
    typeof value.index === "number" && Number.isFinite(value.index) ? Math.floor(value.index) : fallbackIndex + 1;
  const index = Math.max(1, rawIndex);
  const text = toOptionalText(value.text) ?? "";
  return {
    index,
    text,
    imageRef: toOptionalText(value.imageRef),
    videoRef: toOptionalText(value.videoRef),
    videoStatus: toOptionalText(value.videoStatus),
    audioRef: toOptionalText(value.audioRef),
  };
}

function getStoryTimelineSelectedSegment() {
  const count = state.storyTimelineSegments.length;
  if (count === 0) {
    return null;
  }
  const selected =
    typeof state.storyTimelineSelectedIndex === "number" && Number.isFinite(state.storyTimelineSelectedIndex)
      ? Math.max(1, Math.min(count, Math.floor(state.storyTimelineSelectedIndex)))
      : 1;
  state.storyTimelineSelectedIndex = selected;
  return state.storyTimelineSegments[selected - 1] ?? null;
}

function compactStoryAssetRef(ref) {
  if (typeof ref !== "string") {
    return "";
  }
  const value = ref.trim();
  if (value.length <= 42) {
    return value;
  }
  return `${value.slice(0, 39)}...`;
}

function buildStoryAssetPill(text, toneClass) {
  const pill = document.createElement("span");
  pill.className = "story-asset-pill";
  if (typeof toneClass === "string" && toneClass.trim().length > 0) {
    pill.classList.add(toneClass.trim());
  }
  pill.textContent = text;
  return pill;
}

function resolveStoryVideoStatusVariant(videoStatus) {
  const value = toOptionalText(videoStatus);
  if (!value) {
    return "status-neutral";
  }
  const lowered = value.toLowerCase();
  if (lowered.includes("ready") || lowered.includes("complete") || lowered.includes("done")) {
    return "status-ok";
  }
  if (lowered.includes("fail") || lowered.includes("error")) {
    return "status-fail";
  }
  return "status-neutral";
}

function openLiveNegotiatorFromStoryEmptyState() {
  setActiveTab("live-negotiator");
  if (el.intent) {
    el.intent.value = "story";
    syncCustomSelectControl(el.intent);
    setUiTaskFieldsVisibility();
  }
  if (el.message instanceof HTMLElement) {
    window.requestAnimationFrame(() => {
      el.message.focus();
    });
  }
}

function applyStoryPromptTemplateFromStoryEmptyState() {
  setActiveTab("live-negotiator");
  if (el.intent) {
    el.intent.value = "story";
    syncCustomSelectControl(el.intent);
    setUiTaskFieldsVisibility();
  }
  if (el.message instanceof HTMLTextAreaElement) {
    el.message.value = STORY_EMPTY_STATE_PROMPT;
    window.requestAnimationFrame(() => {
      el.message.focus();
      const caret = el.message.value.length;
      el.message.setSelectionRange(caret, caret);
    });
  }
}

function renderStoryTimelinePreviewEmptyState() {
  if (!el.storyTimelinePreview) {
    return;
  }
  el.storyTimelinePreview.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "story-empty-state";

  const icon = document.createElement("span");
  icon.className = "story-empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "Storyboard";

  const title = document.createElement("p");
  title.className = "story-empty-title";
  title.textContent = "No timeline yet";

  const hint = document.createElement("p");
  hint.className = "story-empty-hint";
  hint.append("Run a ");
  const code = document.createElement("code");
  code.textContent = "story:";
  hint.append(code, " intent in Live Negotiator to generate segments, asset refs, and progress data.");

  const checklist = document.createElement("ul");
  checklist.className = "story-empty-checklist";
  checklist.setAttribute("aria-label", "Story timeline readiness checklist");
  const checklistItems = [
    "Segment cards with scrubber and selector",
    "Image, audio, and video asset references",
    "Timeline progress and pending video jobs",
  ];
  for (const itemText of checklistItems) {
    const item = document.createElement("li");
    item.textContent = itemText;
    checklist.append(item);
  }

  const actions = document.createElement("div");
  actions.className = "story-empty-actions";

  const action = document.createElement("button");
  action.id = "storyTimelineOpenLiveBtn";
  action.type = "button";
  action.className = "story-empty-action";
  action.textContent = "Open Live Negotiator";
  action.addEventListener("click", openLiveNegotiatorFromStoryEmptyState);

  const actionTemplate = document.createElement("button");
  actionTemplate.id = "storyTimelineApplyTemplateBtn";
  actionTemplate.type = "button";
  actionTemplate.className = "button-muted story-empty-action story-empty-action-template";
  actionTemplate.textContent = "Use Story Prompt Template";
  actionTemplate.addEventListener("click", applyStoryPromptTemplateFromStoryEmptyState);

  actions.append(action, actionTemplate);
  wrapper.append(icon, title, hint, checklist, actions);
  el.storyTimelinePreview.append(wrapper);
}

function renderStoryTimelinePreview(segment) {
  if (!el.storyTimelinePreview) {
    return;
  }
  if (!segment) {
    el.storyTimelinePreview.classList.add("story-timeline-preview-empty");
    renderStoryTimelinePreviewEmptyState();
    return;
  }
  el.storyTimelinePreview.classList.remove("story-timeline-preview-empty");
  el.storyTimelinePreview.innerHTML = "";

  const head = document.createElement("div");
  head.className = "story-preview-head";

  const indexPill = document.createElement("span");
  indexPill.className = "story-preview-index";
  indexPill.textContent = `Segment #${segment.index}`;
  head.appendChild(indexPill);

  if (segment.videoStatus) {
    const statusPill = document.createElement("span");
    statusPill.className = `status-pill story-preview-status ${resolveStoryVideoStatusVariant(segment.videoStatus)}`;
    statusPill.textContent = `video:${segment.videoStatus}`;
    head.appendChild(statusPill);
  }

  const text = segment.text.length > 0 ? segment.text : "(empty segment text)";
  const textNode = document.createElement("p");
  textNode.className = "story-preview-text";
  textNode.textContent = text;

  const assets = document.createElement("div");
  assets.className = "story-preview-assets";

  if (segment.imageRef) {
    assets.appendChild(buildStoryAssetPill(`image:${compactStoryAssetRef(segment.imageRef)}`, "is-image"));
  }
  if (segment.videoRef) {
    assets.appendChild(buildStoryAssetPill(`video:${compactStoryAssetRef(segment.videoRef)}`, "is-video"));
  }
  if (segment.audioRef) {
    assets.appendChild(buildStoryAssetPill(`audio:${compactStoryAssetRef(segment.audioRef)}`, "is-audio"));
  }
  if (assets.childElementCount === 0) {
    assets.appendChild(buildStoryAssetPill("no assets yet", "is-empty"));
  }

  el.storyTimelinePreview.append(head, textNode, assets);
}

function renderStoryTimelineProgress(count, selectedIndex) {
  const safeCount = Math.max(0, Math.floor(count));
  const safeIndex = Math.max(0, Math.floor(selectedIndex));
  const resolvedIndex = safeCount > 0 ? Math.min(Math.max(safeIndex, 1), safeCount) : 0;
  const progressPercent = safeCount > 0 ? Math.round((resolvedIndex / safeCount) * 100) : 0;
  const hasPendingVideoJobs = Math.max(0, Math.floor(state.storyTimelinePendingJobs ?? 0)) > 0;

  if (el.storyTimelineProgressLabel) {
    el.storyTimelineProgressLabel.textContent = `${progressPercent}%`;
  }
  if (el.storyTimelineProgressBar) {
    el.storyTimelineProgressBar.style.width = `${progressPercent}%`;
  }
  if (el.storyTimelineProgressTrack) {
    el.storyTimelineProgressTrack.setAttribute("aria-valuenow", String(progressPercent));
    const valueText = safeCount > 0 ? `${resolvedIndex}/${safeCount}` : "0/0";
    el.storyTimelineProgressTrack.setAttribute("aria-valuetext", valueText);
    el.storyTimelineProgressTrack.classList.toggle("is-empty", safeCount === 0);
    el.storyTimelineProgressTrack.classList.toggle("is-pending", safeCount > 0 && hasPendingVideoJobs);
    el.storyTimelineProgressTrack.classList.toggle("is-active", safeCount > 0 && !hasPendingVideoJobs);
  }
  if (el.storyTimelineProgressHint) {
    const hintText = safeCount > 0 ? `${resolvedIndex}/${safeCount} segments` : "0/0 segments";
    const hintVariant = safeCount === 0 ? "neutral" : hasPendingVideoJobs ? "neutral" : "ok";
    setStatusPill(el.storyTimelineProgressHint, hintText, hintVariant);
  }
}

function renderStoryTimelineList() {
  if (!el.storyTimelineList) {
    return;
  }
  el.storyTimelineList.innerHTML = "";
  const segments = state.storyTimelineSegments;
  if (segments.length === 0) {
    const empty = document.createElement("div");
    empty.className = "story-timeline-list-empty";
    const icon = document.createElement("span");
    icon.className = "story-timeline-list-empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "Timeline";

    const title = document.createElement("p");
    title.className = "story-timeline-list-empty-title";
    title.textContent = "No timeline segments yet";

    const hint = document.createElement("p");
    hint.className = "story-timeline-list-empty-hint";
    hint.textContent = "Send a story intent from Live Negotiator to populate segment cards, asset refs, and progress.";

    const action = document.createElement("button");
    action.type = "button";
    action.className = "button-muted story-timeline-list-empty-action";
    action.textContent = "Open Live Negotiator";
    action.addEventListener("click", () => {
      openLiveNegotiatorFromStoryEmptyState();
    });

    const actions = document.createElement("div");
    actions.className = "story-timeline-list-empty-actions";

    const actionTemplate = document.createElement("button");
    actionTemplate.type = "button";
    actionTemplate.className = "button-muted story-timeline-list-empty-action story-timeline-list-empty-action-template";
    actionTemplate.textContent = "Use Story Prompt Template";
    actionTemplate.addEventListener("click", () => {
      applyStoryPromptTemplateFromStoryEmptyState();
    });

    actions.append(action, actionTemplate);

    empty.append(icon, title, hint, actions);
    el.storyTimelineList.append(empty);
    return;
  }
  const selectedIndex = state.storyTimelineSelectedIndex;
  for (let idx = segments.length - 1; idx >= 0; idx -= 1) {
    const segment = segments[idx];
    const text = segment.text.length > 0 ? segment.text : "(empty segment text)";
    const compactText = text.length > 180 ? `${text.slice(0, 180)}...` : text;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "story-segment-card";
    card.setAttribute("aria-label", `Select segment ${segment.index}`);
    card.dataset.segmentIndex = String(segment.index);
    if (segment.index === selectedIndex) {
      card.classList.add("is-selected");
    }
    card.addEventListener("click", () => {
      updateStoryTimelineSelection(segment.index);
    });

    const head = document.createElement("div");
    head.className = "story-segment-head";

    const index = document.createElement("span");
    index.className = "story-segment-index";
    index.textContent = `Segment #${segment.index}`;
    head.appendChild(index);

    const statePill = document.createElement("span");
    statePill.className = "status-pill story-segment-state";
    if (segment.videoStatus) {
      statePill.classList.add(resolveStoryVideoStatusVariant(segment.videoStatus));
      statePill.textContent = `video:${segment.videoStatus}`;
    } else {
      statePill.classList.add("status-neutral");
      statePill.textContent = "video:n/a";
    }
    head.appendChild(statePill);

    const body = document.createElement("p");
    body.className = "story-segment-text";
    body.textContent = compactText;

    const assetRow = document.createElement("div");
    assetRow.className = "story-segment-assets";
    if (segment.imageRef) {
      assetRow.appendChild(buildStoryAssetPill("image", "is-image"));
    }
    if (segment.videoRef) {
      assetRow.appendChild(buildStoryAssetPill("video", "is-video"));
    }
    if (segment.audioRef) {
      assetRow.appendChild(buildStoryAssetPill("audio", "is-audio"));
    }
    if (assetRow.childElementCount === 0) {
      assetRow.appendChild(buildStoryAssetPill("no assets", "is-empty"));
    }

    card.append(head, body, assetRow);
    el.storyTimelineList.append(card);
  }
}

function renderStoryTimeline() {
  const segments = state.storyTimelineSegments;
  const count = segments.length;
  const pendingJobs = Math.max(0, Math.floor(state.storyTimelinePendingJobs ?? 0));
  const imageAssetCount = segments.filter((segment) => typeof segment.imageRef === "string").length;
  const videoAssetCount = segments.filter((segment) => typeof segment.videoRef === "string").length;
  const audioAssetCount = segments.filter((segment) => typeof segment.audioRef === "string").length;
  setText(el.storyTimelineTitle, state.storyTimelineTitle ?? "-");
  setText(el.storyTimelineCount, String(count));
  setText(el.storyTimelinePendingJobs, String(pendingJobs));

  if (count === 0) {
    setStatusPill(el.storyTimelineMode, "timeline_idle", "neutral");
  } else if (pendingJobs > 0) {
    setStatusPill(el.storyTimelineMode, "timeline_pending_video", "neutral");
  } else {
    setStatusPill(el.storyTimelineMode, "timeline_ready", "ok");
  }

  if (count === 0) {
    setStatusPill(el.storyTimelineAssetMix, "assets=none", "neutral");
  } else {
    const assetText = `assets=i${imageAssetCount}/v${videoAssetCount}/a${audioAssetCount}`;
    const hasAnyAssets = imageAssetCount + videoAssetCount + audioAssetCount > 0;
    setStatusPill(el.storyTimelineAssetMix, assetText, hasAnyAssets ? "ok" : "neutral");
  }

  if (el.storyTimelineScrubber) {
    el.storyTimelineScrubber.min = count > 0 ? "1" : "0";
    el.storyTimelineScrubber.max = count > 0 ? String(count) : "0";
    el.storyTimelineScrubber.value = count > 0 ? String(state.storyTimelineSelectedIndex) : "0";
    el.storyTimelineScrubber.disabled = count === 0;
  }

  if (el.storyTimelineSelect) {
    el.storyTimelineSelect.innerHTML = "";
    if (count === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No segments";
      el.storyTimelineSelect.append(option);
      el.storyTimelineSelect.disabled = true;
    } else {
      el.storyTimelineSelect.disabled = false;
      for (const segment of segments) {
        const option = document.createElement("option");
        option.value = String(segment.index);
        const raw = segment.text.length > 0 ? segment.text : "(empty segment text)";
        const compact = raw.length > 64 ? `${raw.slice(0, 64)}...` : raw;
        option.textContent = `#${segment.index} ${compact}`;
        if (segment.index === state.storyTimelineSelectedIndex) {
          option.selected = true;
        }
        el.storyTimelineSelect.append(option);
      }
    }
  }

  if (el.storyTimelinePosition) {
    const positionText = count === 0 ? "-" : `${state.storyTimelineSelectedIndex} / ${count}`;
    el.storyTimelinePosition.textContent = positionText;
  }

  renderStoryTimelineProgress(count, state.storyTimelineSelectedIndex);
  renderStoryTimelinePreview(getStoryTimelineSelectedSegment());
  renderStoryTimelineList();
}

function updateStoryTimelineSelection(nextIndex) {
  const total = state.storyTimelineSegments.length;
  if (total === 0) {
    state.storyTimelineSelectedIndex = 0;
    renderStoryTimeline();
    return;
  }
  const value =
    typeof nextIndex === "number" && Number.isFinite(nextIndex) ? Math.floor(nextIndex) : state.storyTimelineSelectedIndex;
  state.storyTimelineSelectedIndex = Math.min(Math.max(value, 1), total);
  renderStoryTimeline();
}

function setStoryTimelineData({ title = null, timeline = [], pendingVideoJobs = null } = {}) {
  const normalized = Array.isArray(timeline)
    ? timeline
        .map((segment, index) => normalizeStoryTimelineSegment(segment, index))
        .filter(Boolean)
        .sort((left, right) => left.index - right.index)
    : [];
  state.storyTimelineTitle = toOptionalText(title);
  state.storyTimelineSegments = normalized;
  const computedPending =
    typeof pendingVideoJobs === "number" && Number.isFinite(pendingVideoJobs)
      ? Math.max(0, Math.floor(pendingVideoJobs))
      : 0;
  state.storyTimelinePendingJobs = computedPending;

  if (normalized.length === 0) {
    state.storyTimelineSelectedIndex = 0;
  } else if (
    typeof state.storyTimelineSelectedIndex !== "number" ||
    !Number.isFinite(state.storyTimelineSelectedIndex) ||
    state.storyTimelineSelectedIndex < 1 ||
    state.storyTimelineSelectedIndex > normalized.length
  ) {
    state.storyTimelineSelectedIndex = 1;
  }

  renderStoryTimeline();
}

function toNodeText(node, fallback = "") {
  if (!node) {
    return fallback;
  }
  const text = typeof node.textContent === "string" ? node.textContent.trim() : "";
  return text.length > 0 ? text : fallback;
}

function sanitizeFileNamePart(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.length > 0 ? normalized.slice(0, 64) : fallback;
}

function collectEntryLane(container, lane) {
  if (!(container instanceof HTMLElement)) {
    return [];
  }
  const rows = Array.from(container.querySelectorAll(".entry"));
  const mapped = rows.map((entry) => {
    const titleNode = entry.querySelector("small");
    const bodyNode = entry.querySelector("div");
    return {
      lane,
      title: toNodeText(titleNode, lane),
      message: toNodeText(bodyNode, ""),
    };
  });
  return mapped.reverse();
}

function toIsoNow() {
  return new Date().toISOString();
}

function resetAssistantAudioExport() {
  state.assistantAudioChunks = [];
  state.assistantAudioBytesTotal = 0;
  state.assistantAudioSampleRate = 16000;
  state.assistantAudioTrimmed = false;
}

function copyInt16Bytes(samples) {
  if (!(samples instanceof Int16Array) || samples.length === 0) {
    return new Uint8Array(0);
  }
  const start = samples.byteOffset;
  const end = start + samples.byteLength;
  return new Uint8Array(samples.buffer.slice(start, end));
}

function recordAssistantAudioChunk(samples, sampleRate = 16000, turnId = null) {
  const bytes = copyInt16Bytes(samples);
  if (bytes.byteLength === 0) {
    return;
  }
  const normalizedSampleRate =
    typeof sampleRate === "number" && Number.isFinite(sampleRate) && sampleRate > 0 ? Math.floor(sampleRate) : 16000;
  if (state.assistantAudioChunks.length === 0) {
    state.assistantAudioSampleRate = normalizedSampleRate;
  }

  state.assistantAudioChunks.push({
    bytes,
    turnId: typeof turnId === "string" && turnId.trim().length > 0 ? turnId.trim() : null,
  });
  state.assistantAudioBytesTotal += bytes.byteLength;

  while (state.assistantAudioBytesTotal > MAX_ASSISTANT_AUDIO_EXPORT_BYTES && state.assistantAudioChunks.length > 1) {
    const removed = state.assistantAudioChunks.shift();
    if (removed && removed.bytes instanceof Uint8Array) {
      state.assistantAudioBytesTotal = Math.max(0, state.assistantAudioBytesTotal - removed.bytes.byteLength);
      state.assistantAudioTrimmed = true;
    }
  }
}

function collectAssistantAudioBytes() {
  if (!Array.isArray(state.assistantAudioChunks) || state.assistantAudioChunks.length === 0) {
    return new Uint8Array(0);
  }
  const totalBytes = state.assistantAudioChunks.reduce((sum, chunk) => {
    if (!chunk || !(chunk.bytes instanceof Uint8Array)) {
      return sum;
    }
    return sum + chunk.bytes.byteLength;
  }, 0);
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    return new Uint8Array(0);
  }
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of state.assistantAudioChunks) {
    if (!chunk || !(chunk.bytes instanceof Uint8Array)) {
      continue;
    }
    merged.set(chunk.bytes, offset);
    offset += chunk.bytes.byteLength;
  }
  return merged;
}

function buildAssistantAudioSummary() {
  const uniqueTurns = new Set();
  for (const chunk of state.assistantAudioChunks) {
    const turnId = chunk && typeof chunk.turnId === "string" ? chunk.turnId : null;
    if (turnId) {
      uniqueTurns.add(turnId);
    }
  }
  return {
    totalChunks: state.assistantAudioChunks.length,
    totalBytes: state.assistantAudioBytesTotal,
    sampleRate: state.assistantAudioSampleRate,
    uniqueTurns: uniqueTurns.size,
    trimmed: state.assistantAudioTrimmed === true,
    maxBytes: MAX_ASSISTANT_AUDIO_EXPORT_BYTES,
  };
}

function formatByteSize(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildPcm16WavBytes(pcmBytes, sampleRate = 16000, channels = 1) {
  const safePcm = pcmBytes instanceof Uint8Array ? pcmBytes : new Uint8Array(0);
  const safeSampleRate =
    typeof sampleRate === "number" && Number.isFinite(sampleRate) && sampleRate > 0 ? Math.floor(sampleRate) : 16000;
  const safeChannels = channels === 2 ? 2 : 1;
  const bitsPerSample = 16;
  const blockAlign = (safeChannels * bitsPerSample) / 8;
  const byteRate = safeSampleRate * blockAlign;
  const dataSize = safePcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);

  function writeAscii(offset, text) {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  }

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, safeChannels, true);
  view.setUint32(24, safeSampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);
  out.set(safePcm, 44);
  return out;
}

function buildSessionExportPayload() {
  const audioSummary = buildAssistantAudioSummary();
  const selectedStorySegment = getStoryTimelineSelectedSegment();
  return {
    schemaVersion: 1,
    generatedAt: toIsoNow(),
    context: {
      wsUrl: state.wsUrl,
      apiBaseUrl: state.apiBaseUrl,
      sessionId: state.sessionId,
      runId: state.runId,
      userId: state.userId,
      mode: state.mode,
      sessionState: state.sessionState,
      connectionStatus: state.connectionStatus,
      targetLanguage: toOptionalText(el.targetLanguage?.value) ?? null,
    },
    approvals: {
      pendingApprovalId: state.pendingApproval?.approvalId ?? null,
      pendingApprovalStatus: state.pendingApproval?.status ?? null,
      approvalStatusText: toNodeText(el.approvalStatus, "idle"),
    },
    kpi: {
      target: {
        price: toNodeText(el.targetPrice, "-"),
        delivery: toNodeText(el.targetDelivery, "-"),
        sla: toNodeText(el.targetSla, "-"),
      },
      currentOffer: {
        price: toNodeText(el.currentPrice, "-"),
        delivery: toNodeText(el.currentDelivery, "-"),
        sla: toNodeText(el.currentSla, "-"),
      },
      finalOffer: {
        price: toNodeText(el.finalPrice, "-"),
        delivery: toNodeText(el.finalDelivery, "-"),
        sla: toNodeText(el.finalSla, "-"),
      },
      constraintStatus: toNodeText(el.constraintStatus, "-"),
      fallbackAssetStatus: toNodeText(el.fallbackAssetStatus, "-"),
    },
    storyTimeline: {
      title: state.storyTimelineTitle,
      totalSegments: state.storyTimelineSegments.length,
      selectedIndex: state.storyTimelineSelectedIndex > 0 ? state.storyTimelineSelectedIndex : null,
      pendingVideoJobs: Math.max(0, Math.floor(state.storyTimelinePendingJobs ?? 0)),
      selectedSegment: selectedStorySegment,
      segments: state.storyTimelineSegments,
    },
    audio: {
      exportFormat: "pcm16-wav",
      ...audioSummary,
    },
    transcript: collectEntryLane(el.transcript, "transcript"),
    events: collectEntryLane(el.events, "events"),
    operatorSummary: collectEntryLane(el.operatorSummary, "operator_summary"),
    tasks: collectEntryLane(el.tasks, "tasks"),
  };
}

function toMarkdownExport(payload) {
  const lines = [];
  lines.push("# Live Agent Session Export");
  lines.push("");
  lines.push(`- generatedAt: ${payload.generatedAt}`);
  lines.push(`- sessionId: ${payload.context.sessionId ?? "-"}`);
  lines.push(`- runId: ${payload.context.runId ?? "-"}`);
  lines.push(`- userId: ${payload.context.userId ?? "-"}`);
  lines.push(`- mode: ${payload.context.mode ?? "-"}`);
  lines.push(`- connectionStatus: ${payload.context.connectionStatus ?? "-"}`);
  lines.push(`- sessionState: ${payload.context.sessionState ?? "-"}`);
  lines.push(`- targetLanguage: ${payload.context.targetLanguage ?? "-"}`);
  lines.push("");
  lines.push("## KPI Snapshot");
  lines.push("");
  lines.push(`- target: price=${payload.kpi.target.price}, delivery=${payload.kpi.target.delivery}, sla=${payload.kpi.target.sla}`);
  lines.push(
    `- current: price=${payload.kpi.currentOffer.price}, delivery=${payload.kpi.currentOffer.delivery}, sla=${payload.kpi.currentOffer.sla}`,
  );
  lines.push(`- final: price=${payload.kpi.finalOffer.price}, delivery=${payload.kpi.finalOffer.delivery}, sla=${payload.kpi.finalOffer.sla}`);
  lines.push(`- constraintStatus: ${payload.kpi.constraintStatus}`);
  lines.push(`- fallbackAsset: ${payload.kpi.fallbackAssetStatus}`);
  lines.push("");
  lines.push("## Story Timeline Snapshot");
  lines.push("");
  lines.push(`- title: ${payload.storyTimeline?.title ?? "-"}`);
  lines.push(`- totalSegments: ${payload.storyTimeline?.totalSegments ?? 0}`);
  lines.push(`- selectedIndex: ${payload.storyTimeline?.selectedIndex ?? "-"}`);
  lines.push(`- pendingVideoJobs: ${payload.storyTimeline?.pendingVideoJobs ?? 0}`);
  if (
    payload.storyTimeline?.selectedSegment &&
    typeof payload.storyTimeline.selectedSegment === "object" &&
    typeof payload.storyTimeline.selectedSegment.index === "number"
  ) {
    const selectedSegment = payload.storyTimeline.selectedSegment;
    lines.push(
      `- selectedSegment: #${selectedSegment.index} ${toOptionalText(selectedSegment.text) ?? "(empty segment text)"}`,
    );
  }
  lines.push("");
  lines.push("## Audio Export Snapshot");
  lines.push("");
  lines.push(`- format: ${payload.audio.exportFormat ?? "pcm16-wav"}`);
  lines.push(`- sampleRate: ${payload.audio.sampleRate ?? 16000}`);
  lines.push(`- totalChunks: ${payload.audio.totalChunks ?? 0}`);
  lines.push(`- totalBytes: ${payload.audio.totalBytes ?? 0}`);
  lines.push(`- uniqueTurns: ${payload.audio.uniqueTurns ?? 0}`);
  lines.push(`- trimmed: ${payload.audio.trimmed === true}`);
  lines.push("");
  lines.push("## Transcript");
  lines.push("");
  if (payload.transcript.length === 0) {
    lines.push("- (empty)");
  } else {
    for (const row of payload.transcript) {
      lines.push(`- ${row.title}: ${row.message}`);
    }
  }
  lines.push("");
  lines.push("## Events");
  lines.push("");
  if (payload.events.length === 0) {
    lines.push("- (empty)");
  } else {
    for (const row of payload.events) {
      lines.push(`- ${row.title}: ${row.message}`);
    }
  }
  lines.push("");
  lines.push("## Operator Summary");
  lines.push("");
  if (payload.operatorSummary.length === 0) {
    lines.push("- (empty)");
  } else {
    for (const row of payload.operatorSummary) {
      lines.push(`- ${row.title}: ${row.message}`);
    }
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- Audio is streamed realtime; this export includes audio snapshot metadata.");
  lines.push("- Use `Export Session Audio (WAV)` for downloadable assistant output audio.");
  return lines.join("\n");
}

function triggerDownload(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function buildSessionExportBaseName() {
  const sessionPart = sanitizeFileNamePart(state.sessionId, "session");
  const runPart = sanitizeFileNamePart(state.runId, "run");
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  return `live-agent-${sessionPart}-${runPart}-${stamp}`;
}

function closeExportMenu() {
  if (el.exportMenu instanceof HTMLDetailsElement) {
    el.exportMenu.open = false;
  }
}

function exportSessionMarkdown() {
  const payload = buildSessionExportPayload();
  const markdown = toMarkdownExport(payload);
  const fileName = `${buildSessionExportBaseName()}.md`;
  triggerDownload(fileName, markdown, "text/markdown;charset=utf-8");
  setExportStatus(`markdown exported (${fileName})`);
  appendTranscript("system", `Session markdown export downloaded: ${fileName}`);
}

function exportSessionJson() {
  const payload = buildSessionExportPayload();
  const fileName = `${buildSessionExportBaseName()}.json`;
  triggerDownload(fileName, `${JSON.stringify(payload, null, 2)}\n`, "application/json;charset=utf-8");
  setExportStatus(`json exported (${fileName})`);
  appendTranscript("system", `Session JSON export downloaded: ${fileName}`);
}

function exportSessionAudio() {
  const pcmBytes = collectAssistantAudioBytes();
  if (!(pcmBytes instanceof Uint8Array) || pcmBytes.byteLength === 0) {
    setExportStatus("audio export skipped (no audio)");
    appendTranscript("system", "Session audio export skipped: no assistant audio captured yet");
    return;
  }
  const sampleRate =
    typeof state.assistantAudioSampleRate === "number" && Number.isFinite(state.assistantAudioSampleRate)
      ? Math.max(8000, Math.floor(state.assistantAudioSampleRate))
      : 16000;
  const wavBytes = buildPcm16WavBytes(pcmBytes, sampleRate, 1);
  const fileName = `${buildSessionExportBaseName()}.wav`;
  triggerDownload(fileName, wavBytes, "audio/wav");
  const sizeText = formatByteSize(pcmBytes.byteLength);
  setExportStatus(`audio exported (${fileName})`);
  appendTranscript("system", `Session audio export downloaded: ${fileName} (${sizeText})`);
}

function normalizeTaskRecord(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const taskId = typeof value.taskId === "string" ? value.taskId : null;
  if (!taskId || taskId.trim().length === 0) {
    return null;
  }
  return {
    taskId: taskId.trim(),
    sessionId: typeof value.sessionId === "string" ? value.sessionId : state.sessionId,
    runId: typeof value.runId === "string" ? value.runId : null,
    intent: typeof value.intent === "string" ? value.intent : null,
    route: typeof value.route === "string" ? value.route : null,
    status: typeof value.status === "string" ? value.status : "running",
    progressPct: typeof value.progressPct === "number" ? value.progressPct : 0,
    stage: typeof value.stage === "string" ? value.stage : "unknown",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    error: typeof value.error === "string" ? value.error : null,
  };
}

function renderTaskList() {
  const records = [...state.taskRecords.values()].sort((left, right) =>
    String(right.updatedAt).localeCompare(String(left.updatedAt)),
  );
  el.activeTaskCount.textContent = String(records.length);
  el.tasks.innerHTML = "";

  if (records.length === 0) {
    appendEntry(el.tasks, "system", "task", "No active tasks");
    return;
  }

  for (const task of records) {
    const summary = [
      `status=${task.status}`,
      `progress=${typeof task.progressPct === "number" ? task.progressPct : 0}%`,
      `stage=${task.stage ?? "unknown"}`,
      task.intent ? `intent=${task.intent}` : null,
      task.route ? `route=${task.route}` : null,
      task.error ? `error=${task.error}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    appendEntry(el.tasks, "system", task.taskId, summary);
  }
}

function upsertTaskRecord(value) {
  const normalized = normalizeTaskRecord(value);
  if (!normalized) {
    return;
  }
  state.taskRecords.set(normalized.taskId, normalized);
  renderTaskList();
}

function removeTaskRecord(taskId) {
  if (typeof taskId !== "string" || taskId.trim().length === 0) {
    return;
  }
  state.taskRecords.delete(taskId.trim());
  renderTaskList();
}

function formatMs(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${Math.round(value)}ms`;
}

function formatUsd(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "n/a";
  }
  return `$${value.toFixed(6)}`;
}

function syncOperatorSignalFromStatus(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const mirrorId = OPERATOR_SIGNAL_STATUS_MIRROR_IDS[node.id];
  if (typeof mirrorId !== "string") {
    return;
  }
  const mirrorNode = el[mirrorId];
  if (!(mirrorNode instanceof HTMLElement)) {
    return;
  }
  mirrorNode.textContent = node.textContent ?? "no_data";
  mirrorNode.className = node.className;
}

function setStatusPill(node, text, variant) {
  if (!node) {
    return;
  }
  const operatorCard = typeof node.closest === "function" ? node.closest(".operator-health-card") : null;
  const statusCode = typeof text === "string" ? text : String(text ?? "");
  if (node instanceof HTMLElement) {
    node.dataset.statusCode = statusCode;
  }
  node.textContent = resolveStatusPillDisplayText(statusCode);
  node.className = "status-pill";
  if (variant === "ok") {
    node.classList.add("status-ok");
    if (operatorCard) {
      applyOperatorCardVisibility(operatorCard);
      const group = operatorCard.closest(".operator-health-group");
      if (group instanceof HTMLElement) {
        applyOperatorGroupVisibility(group);
      }
      syncOperatorCollapseActionButtons();
      refreshOperatorTriageSummary();
      refreshOperatorGroupMetrics();
    }
    syncOperatorSignalFromStatus(node);
    return;
  }
  if (variant === "fail") {
    node.classList.add("status-fail");
    if (operatorCard) {
      applyOperatorCardVisibility(operatorCard);
      const group = operatorCard.closest(".operator-health-group");
      if (group instanceof HTMLElement) {
        applyOperatorGroupVisibility(group);
      }
      syncOperatorCollapseActionButtons();
      refreshOperatorTriageSummary();
      refreshOperatorGroupMetrics();
    }
    syncOperatorSignalFromStatus(node);
    return;
  }
  node.classList.add("status-neutral");
  if (operatorCard) {
    applyOperatorCardVisibility(operatorCard);
    const group = operatorCard.closest(".operator-health-group");
    if (group instanceof HTMLElement) {
      applyOperatorGroupVisibility(group);
    }
    syncOperatorCollapseActionButtons();
    refreshOperatorTriageSummary();
    refreshOperatorGroupMetrics();
  }
  syncOperatorSignalFromStatus(node);
}

function renderAssistantActivityStatus() {
  const resolved = resolveAssistantActivityStatus({
    connectionStatus: state.connectionStatus,
    isStreaming: state.assistantIsStreaming,
    isSpeaking: state.assistantIsSpeaking,
  });
  setStatusPill(el.assistantStreamStatus, resolved.text, resolved.variant);
}

function getNumeric(inputEl) {
  const value = Number(inputEl.value);
  return Number.isFinite(value) ? value : null;
}

function setMaybeValue(node, value, suffix = "") {
  node.textContent = value === null || value === undefined ? "-" : `${value}${suffix}`;
}

function setText(node, value) {
  if (!node) {
    return;
  }
  if (typeof value === "string" && value.trim().toLowerCase() === "n/a") {
    node.textContent = "pending";
    return;
  }
  node.textContent = value;
}

function setOperatorHealthHint(text, variant = "neutral") {
  if (!el.operatorHealthHint) {
    return;
  }
  el.operatorHealthHint.textContent = text;
  el.operatorHealthHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorHealthHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorHealthHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorHealthHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorHealthHint.classList.add("operator-health-hint-neutral");
}

function setOperatorUiExecutorHint(text, variant = "neutral") {
  if (!el.operatorUiExecutorHint) {
    return;
  }
  el.operatorUiExecutorHint.textContent = text;
  el.operatorUiExecutorHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorUiExecutorHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorUiExecutorHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorUiExecutorHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorUiExecutorHint.classList.add("operator-health-hint-neutral");
}

function setOperatorDeviceNodesHint(text, variant = "neutral") {
  if (!el.operatorDeviceNodesHint) {
    return;
  }
  el.operatorDeviceNodesHint.textContent = text;
  el.operatorDeviceNodesHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorDeviceNodesHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorDeviceNodesHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorDeviceNodesHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorDeviceNodesHint.classList.add("operator-health-hint-neutral");
}

function setOperatorDeviceNodeUpdatesHint(text, variant = "neutral") {
  if (!el.operatorDeviceNodeUpdatesHint) {
    return;
  }
  el.operatorDeviceNodeUpdatesHint.textContent = text;
  el.operatorDeviceNodeUpdatesHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorDeviceNodeUpdatesHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorDeviceNodeUpdatesHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorDeviceNodeUpdatesHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorDeviceNodeUpdatesHint.classList.add("operator-health-hint-neutral");
}

function setOperatorTraceHint(text, variant = "neutral") {
  if (!el.operatorTraceHint) {
    return;
  }
  el.operatorTraceHint.textContent = text;
  el.operatorTraceHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorTraceHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorTraceHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorTraceHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorTraceHint.classList.add("operator-health-hint-neutral");
}

function setOperatorApprovalsHint(text, variant = "neutral") {
  if (!el.operatorApprovalsHint) {
    return;
  }
  el.operatorApprovalsHint.textContent = text;
  el.operatorApprovalsHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorApprovalsHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorApprovalsHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorApprovalsHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorApprovalsHint.classList.add("operator-health-hint-neutral");
}

function setOperatorLifecycleHint(text, variant = "neutral") {
  if (!el.operatorLifecycleHint) {
    return;
  }
  el.operatorLifecycleHint.textContent = text;
  el.operatorLifecycleHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorLifecycleHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorLifecycleHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorLifecycleHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorLifecycleHint.classList.add("operator-health-hint-neutral");
}

function setOperatorTaskQueueHint(text, variant = "neutral") {
  if (!el.operatorTaskQueueHint) {
    return;
  }
  el.operatorTaskQueueHint.textContent = text;
  el.operatorTaskQueueHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorTaskQueueHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorTaskQueueHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorTaskQueueHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorTaskQueueHint.classList.add("operator-health-hint-neutral");
}

function setOperatorGatewayErrorHint(text, variant = "neutral") {
  if (!el.operatorGatewayErrorHint) {
    return;
  }
  el.operatorGatewayErrorHint.textContent = text;
  el.operatorGatewayErrorHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorGatewayErrorHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorGatewayErrorHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorGatewayErrorHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorGatewayErrorHint.classList.add("operator-health-hint-neutral");
}

function setOperatorTurnTruncationHint(text, variant = "neutral") {
  if (!el.operatorTurnTruncationHint) {
    return;
  }
  el.operatorTurnTruncationHint.textContent = text;
  el.operatorTurnTruncationHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorTurnTruncationHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorTurnTruncationHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorTurnTruncationHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorTurnTruncationHint.classList.add("operator-health-hint-neutral");
}

function setOperatorTurnDeleteHint(text, variant = "neutral") {
  if (!el.operatorTurnDeleteHint) {
    return;
  }
  el.operatorTurnDeleteHint.textContent = text;
  el.operatorTurnDeleteHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorTurnDeleteHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorTurnDeleteHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorTurnDeleteHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorTurnDeleteHint.classList.add("operator-health-hint-neutral");
}

function setOperatorDamageControlHint(text, variant = "neutral") {
  if (!el.operatorDamageControlHint) {
    return;
  }
  el.operatorDamageControlHint.textContent = text;
  el.operatorDamageControlHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorDamageControlHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorDamageControlHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorDamageControlHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorDamageControlHint.classList.add("operator-health-hint-neutral");
}

function setOperatorSkillsRegistryHint(text, variant = "neutral") {
  if (!el.operatorSkillsRegistryHint) {
    return;
  }
  el.operatorSkillsRegistryHint.textContent = text;
  el.operatorSkillsRegistryHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorSkillsRegistryHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorSkillsRegistryHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorSkillsRegistryHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorSkillsRegistryHint.classList.add("operator-health-hint-neutral");
}

function setOperatorPluginMarketplaceHint(text, variant = "neutral") {
  if (!el.operatorPluginMarketplaceHint) {
    return;
  }
  el.operatorPluginMarketplaceHint.textContent = text;
  el.operatorPluginMarketplaceHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorPluginMarketplaceHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorPluginMarketplaceHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorPluginMarketplaceHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorPluginMarketplaceHint.classList.add("operator-health-hint-neutral");
}

function setOperatorGovernancePolicyHint(text, variant = "neutral") {
  if (!el.operatorGovernancePolicyHint) {
    return;
  }
  el.operatorGovernancePolicyHint.textContent = text;
  el.operatorGovernancePolicyHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorGovernancePolicyHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorGovernancePolicyHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorGovernancePolicyHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorGovernancePolicyHint.classList.add("operator-health-hint-neutral");
}

function setOperatorAgentUsageHint(text, variant = "neutral") {
  if (!el.operatorAgentUsageHint) {
    return;
  }
  el.operatorAgentUsageHint.textContent = text;
  el.operatorAgentUsageHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorAgentUsageHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorAgentUsageHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorAgentUsageHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorAgentUsageHint.classList.add("operator-health-hint-neutral");
}

function setOperatorCostEstimateHint(text, variant = "neutral") {
  if (!el.operatorCostEstimateHint) {
    return;
  }
  el.operatorCostEstimateHint.textContent = text;
  el.operatorCostEstimateHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorCostEstimateHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorCostEstimateHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorCostEstimateHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorCostEstimateHint.classList.add("operator-health-hint-neutral");
}

function setOperatorStartupHint(text, variant = "neutral") {
  if (!el.operatorStartupHint) {
    return;
  }
  el.operatorStartupHint.textContent = text;
  el.operatorStartupHint.className = "operator-health-hint";
  if (variant === "ok") {
    el.operatorStartupHint.classList.add("operator-health-hint-ok");
    return;
  }
  if (variant === "warn") {
    el.operatorStartupHint.classList.add("operator-health-hint-warn");
    return;
  }
  if (variant === "fail") {
    el.operatorStartupHint.classList.add("operator-health-hint-fail");
    return;
  }
  el.operatorStartupHint.classList.add("operator-health-hint-neutral");
}

function resetOperatorHealthWidget(reason = "no_data") {
  setText(el.operatorHealthState, "unknown");
  setText(el.operatorHealthLastEventType, "-");
  setText(el.operatorHealthLastEventAt, "-");
  setText(el.operatorHealthDegraded, "0");
  setText(el.operatorHealthRecovered, "0");
  setText(el.operatorHealthWatchdogReconnects, "0");
  setText(el.operatorHealthErrors, "0");
  setText(el.operatorHealthUnavailable, "0");
  setText(el.operatorHealthConnectTimeouts, "0");
  setText(el.operatorHealthProbes, "0");
  setText(el.operatorHealthPingSent, "0");
  setText(el.operatorHealthPongs, "0");
  setText(el.operatorHealthPingErrors, "0");
  setText(el.operatorHealthProbeSuccess, "n/a");
  setOperatorHealthHint("Live bridge not initialized yet. Click Refresh Summary after opening a live session.", "neutral");
  setStatusPill(el.operatorHealthStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorUiExecutorWidget(reason = "no_data") {
  setText(el.operatorUiExecutorState, "unknown");
  setText(el.operatorUiExecutorHealthy, "unknown");
  setText(el.operatorUiExecutorProfile, "n/a");
  setText(el.operatorUiExecutorVersion, "n/a");
  setText(el.operatorUiExecutorLastAction, "-");
  setText(el.operatorUiExecutorLastOutcome, "-");
  setOperatorUiExecutorHint("Refresh summary to inspect ui-executor failover state.", "neutral");
  setStatusPill(el.operatorUiExecutorStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorDeviceNodesWidget(reason = "no_data") {
  setText(el.operatorDeviceNodesTotal, "0");
  setText(el.operatorDeviceNodesOnline, "0");
  setText(el.operatorDeviceNodesDegraded, "0");
  setText(el.operatorDeviceNodesOffline, "0");
  setText(el.operatorDeviceNodesStale, "0");
  setText(el.operatorDeviceNodesMissingHeartbeat, "0");
  setText(el.operatorDeviceNodesMaxAge, "n/a");
  setOperatorDeviceNodesHint("No device nodes registered yet. Add at least one node in Device Nodes tab, then refresh.", "neutral");
  setStatusPill(el.operatorDeviceNodesStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorDeviceNodeUpdatesWidget(reason = "no_data") {
  setText(el.operatorDeviceNodeUpdatesTotal, "0");
  setText(el.operatorDeviceNodeUpdatesUpsert, "0");
  setText(el.operatorDeviceNodeUpdatesHeartbeat, "0");
  setText(el.operatorDeviceNodeUpdatesUniqueNodes, "0");
  setText(el.operatorDeviceNodeUpdatesLatest, "n/a");
  setText(el.operatorDeviceNodeUpdatesSeenAt, "n/a");
  setOperatorDeviceNodeUpdatesHint("Refresh summary to inspect upsert/heartbeat updates proof.", "neutral");
  setStatusPill(el.operatorDeviceNodeUpdatesStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorTraceWidget(reason = "no_data") {
  setText(el.operatorTraceRuns, "0");
  setText(el.operatorTraceEvents, "0");
  setText(el.operatorTraceUiRuns, "0");
  setText(el.operatorTraceApprovals, "0");
  setText(el.operatorTraceSteps, "0");
  setText(el.operatorTraceScreenshots, "0");
  setText(el.operatorTraceTopRoute, "n/a");
  setText(el.operatorTraceTopStatus, "n/a");
  setOperatorTraceHint("Refresh summary to inspect operator trace coverage.", "neutral");
  setStatusPill(el.operatorTraceStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorApprovalsWidget(reason = "no_data") {
  setText(el.operatorApprovalsTotal, "0");
  setText(el.operatorApprovalsPending, "0");
  setText(el.operatorApprovalsApproved, "0");
  setText(el.operatorApprovalsRejected, "0");
  setText(el.operatorApprovalsTimeout, "0");
  setText(el.operatorApprovalsPendingFromTasks, "0");
  setText(el.operatorApprovalsSla, "0 / 0");
  setText(el.operatorApprovalsLatest, "n/a");
  setOperatorApprovalsHint("Refresh summary to inspect approval backlog and SLA timeouts.", "neutral");
  setStatusPill(el.operatorApprovalsStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorLifecycleWidget(reason = "no_data") {
  setText(el.operatorLifecycleReady, "0");
  setText(el.operatorLifecycleDraining, "0");
  setText(el.operatorLifecycleUnknown, "0");
  setText(el.operatorLifecycleLastChange, "n/a");
  setText(el.operatorLifecycleDrainingServices, "none");
  setOperatorLifecycleHint("Refresh summary to inspect runtime lifecycle states.", "neutral");
  setStatusPill(el.operatorLifecycleStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorTaskQueueWidget(reason = "no_data") {
  setText(el.operatorTaskQueueTotal, "0");
  setText(el.operatorTaskQueueQueued, "0");
  setText(el.operatorTaskQueueRunning, "0");
  setText(el.operatorTaskQueuePendingApproval, "0");
  setText(el.operatorTaskQueueStale, "0");
  setText(el.operatorTaskQueueMaxAge, "n/a");
  setText(el.operatorTaskQueueOldest, "n/a");
  setOperatorTaskQueueHint("No task pressure signal yet. Run one intent and click Refresh Summary.", "neutral");
  setStatusPill(el.operatorTaskQueueStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorGatewayErrorWidget(reason = "no_data") {
  setText(el.operatorGatewayErrorSource, "n/a");
  setText(el.operatorGatewayErrorCode, "n/a");
  setText(el.operatorGatewayErrorTraceId, "n/a");
  setText(el.operatorGatewayErrorClientEventId, "n/a");
  setText(el.operatorGatewayErrorClientEventType, "n/a");
  setText(el.operatorGatewayErrorConversation, "n/a");
  setText(el.operatorGatewayErrorLatency, "n/a");
  setText(el.operatorGatewayErrorSeenAt, "n/a");
  setOperatorGatewayErrorHint("No gateway errors captured yet. Run flow probes or refresh summary to validate correlation lane.", "neutral");
  setStatusPill(el.operatorGatewayErrorStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorTurnTruncationWidget(reason = "no_data") {
  setText(el.operatorTurnTruncationTotal, "0");
  setText(el.operatorTurnTruncationRuns, "0");
  setText(el.operatorTurnTruncationSessions, "0");
  setText(el.operatorTurnTruncationTurnId, "n/a");
  setText(el.operatorTurnTruncationReason, "n/a");
  setText(el.operatorTurnTruncationAudioEndMs, "n/a");
  setText(el.operatorTurnTruncationContentIndex, "n/a");
  setText(el.operatorTurnTruncationSeenAt, "n/a");
  setOperatorTurnTruncationHint(
    "No turn-truncation evidence yet. Trigger interruption/truncate flow in Live Negotiator, then refresh summary.",
    "neutral",
  );
  setStatusPill(el.operatorTurnTruncationStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorTurnDeleteWidget(reason = "no_data") {
  setText(el.operatorTurnDeleteTotal, "0");
  setText(el.operatorTurnDeleteRuns, "0");
  setText(el.operatorTurnDeleteSessions, "0");
  setText(el.operatorTurnDeleteTurnId, "n/a");
  setText(el.operatorTurnDeleteReason, "n/a");
  setText(el.operatorTurnDeleteScope, "n/a");
  setText(el.operatorTurnDeleteSeenAt, "n/a");
  setOperatorTurnDeleteHint(
    "No turn-delete evidence yet. Run delete action in Live Controls, then refresh summary.",
    "neutral",
  );
  setStatusPill(el.operatorTurnDeleteStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorDamageControlWidget(reason = "no_data") {
  setText(el.operatorDamageControlTotal, "0");
  setText(el.operatorDamageControlRuns, "0");
  setText(el.operatorDamageControlSessions, "0");
  setText(el.operatorDamageControlVerdicts, "allow=0 ask=0 block=0");
  setText(el.operatorDamageControlLatest, "n/a");
  setText(el.operatorDamageControlRuleIds, "n/a");
  setText(el.operatorDamageControlSeenAt, "n/a");
  setOperatorDamageControlHint("No damage-control decisions observed yet. Run a UI sandbox flow to populate this lane.", "neutral");
  setStatusPill(el.operatorDamageControlStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorSkillsRegistryWidget(reason = "no_data") {
  setText(el.operatorSkillsRegistryTotal, "0");
  setText(el.operatorSkillsRegistrySkills, "0");
  setText(el.operatorSkillsRegistryOutcomes, "ok=0 denied=0 failed=0");
  setText(el.operatorSkillsRegistryLifecycle, "created=0 updated=0 replay=0");
  setText(el.operatorSkillsRegistryConflicts, "version=0 plugin_perm=0");
  setText(el.operatorSkillsRegistryLatest, "n/a");
  setText(el.operatorSkillsRegistrySeenAt, "n/a");
  setOperatorSkillsRegistryHint(
    "No skills-registry lifecycle evidence yet. Run a skills scenario and refresh summary.",
    "neutral",
  );
  setStatusPill(el.operatorSkillsRegistryStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorPluginMarketplaceWidget(reason = "no_data") {
  setText(el.operatorPluginMarketplaceTotal, "0");
  setText(el.operatorPluginMarketplacePlugins, "0");
  setText(el.operatorPluginMarketplaceOutcomes, "ok=0 denied=0 failed=0");
  setText(el.operatorPluginMarketplaceSigning, "verified=0 unsigned=0 none=0");
  setText(el.operatorPluginMarketplacePermissions, "total=0 entries=0");
  setText(el.operatorPluginMarketplaceLifecycle, "created=0 updated=0 replay=0");
  setText(el.operatorPluginMarketplaceConflicts, "version=0 plugin_perm=0");
  setText(el.operatorPluginMarketplaceLatest, "n/a");
  setText(el.operatorPluginMarketplaceSeenAt, "n/a");
  setOperatorPluginMarketplaceHint(
    "No plugin-marketplace lifecycle evidence yet. Run plugin scenario and refresh summary.",
    "neutral",
  );
  setStatusPill(el.operatorPluginMarketplaceStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorGovernancePolicyWidget(reason = "no_data") {
  setText(el.operatorGovernancePolicyTotal, "0");
  setText(el.operatorGovernancePolicyTenants, "0");
  setText(el.operatorGovernancePolicyOutcomes, "ok=0 denied=0 failed=0");
  setText(el.operatorGovernancePolicyLifecycle, "created=0 updated=0 replay=0");
  setText(el.operatorGovernancePolicyConflicts, "version=0 idempotency=0 tenant_scope=0");
  setText(el.operatorGovernancePolicyLatest, "n/a");
  setText(el.operatorGovernancePolicySeenAt, "n/a");
  setOperatorGovernancePolicyHint(
    "No governance-policy lifecycle evidence yet. Run governance update/replay and refresh summary.",
    "neutral",
  );
  setStatusPill(el.operatorGovernancePolicyStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorAgentUsageWidget(reason = "no_data") {
  setText(el.operatorAgentUsageTotal, "0");
  setText(el.operatorAgentUsageRuns, "0");
  setText(el.operatorAgentUsageSessions, "0");
  setText(el.operatorAgentUsageCalls, "0");
  setText(el.operatorAgentUsageTokens, "0 (in=0 out=0)");
  setText(el.operatorAgentUsageModels, "n/a");
  setText(el.operatorAgentUsageSource, "n/a");
  setText(el.operatorAgentUsageSeenAt, "n/a");
  setOperatorAgentUsageHint(
    "No agent-usage evidence yet. Run one live/story exchange, then refresh summary.",
    "neutral",
  );
  setStatusPill(el.operatorAgentUsageStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorCostEstimateWidget(reason = "no_data") {
  setText(el.operatorCostEstimateCurrency, "USD");
  setText(el.operatorCostEstimateMode, "tokens_only");
  setText(el.operatorCostEstimateSource, "operator_summary");
  setText(el.operatorCostEstimateTokens, "0 (in=0 out=0)");
  setText(el.operatorCostEstimateInputUsd, "$0.000000");
  setText(el.operatorCostEstimateOutputUsd, "$0.000000");
  setText(el.operatorCostEstimateTotalUsd, "$0.000000");
  setText(el.operatorCostEstimateRates, "in=0 out=0 (per 1k)");
  setText(el.operatorCostEstimateSeenAt, "n/a");
  setOperatorCostEstimateHint(
    "No cost-estimate evidence yet. Run one exchange and refresh summary to recalculate tokens/USD.",
    "neutral",
  );
  setStatusPill(el.operatorCostEstimateStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function resetOperatorStartupWidget(reason = "no_data") {
  setText(el.operatorStartupTotal, "0");
  setText(el.operatorStartupBlocking, "0");
  setText(el.operatorStartupLastType, "n/a");
  setText(el.operatorStartupLastService, "n/a");
  setText(el.operatorStartupLastCheckedAt, "n/a");
  setOperatorStartupHint("Startup diagnostics not sampled yet. Refresh Summary to pull probe evidence.", "neutral");
  setStatusPill(el.operatorStartupStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function renderOperatorGatewayErrorWidget(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    resetOperatorGatewayErrorWidget("no_data");
    return;
  }

  const source = typeof snapshot.source === "string" ? snapshot.source : "unknown";
  const code = typeof snapshot.code === "string" ? snapshot.code : "n/a";
  const traceId = typeof snapshot.traceId === "string" ? snapshot.traceId : "n/a";
  const clientEventId = typeof snapshot.clientEventId === "string" ? snapshot.clientEventId : "n/a";
  const clientEventType = typeof snapshot.clientEventType === "string" ? snapshot.clientEventType : "n/a";
  const conversation = typeof snapshot.conversation === "string" ? snapshot.conversation : "n/a";
  const latencyMs = typeof snapshot.latencyMs === "number" && Number.isFinite(snapshot.latencyMs)
    ? `${Math.max(0, Math.round(snapshot.latencyMs))} ms`
    : "n/a";
  const seenAt = typeof snapshot.seenAt === "string" ? snapshot.seenAt : "n/a";
  const errorCount =
    typeof snapshot.errorCount === "number" && Number.isFinite(snapshot.errorCount) ? Math.max(1, snapshot.errorCount) : 1;

  setText(el.operatorGatewayErrorSource, source);
  setText(el.operatorGatewayErrorCode, code);
  setText(el.operatorGatewayErrorTraceId, traceId);
  setText(el.operatorGatewayErrorClientEventId, clientEventId);
  setText(el.operatorGatewayErrorClientEventType, clientEventType);
  setText(el.operatorGatewayErrorConversation, conversation);
  setText(el.operatorGatewayErrorLatency, latencyMs);
  setText(el.operatorGatewayErrorSeenAt, seenAt);

  const hasCorrelation = clientEventId !== "n/a" && clientEventType !== "n/a";
  const hasTrace = traceId !== "n/a";
  let statusVariant = "fail";
  let hintVariant = "fail";
  let hint = "Correlation incomplete. Capture a new error with client event metadata enabled.";
  if (hasCorrelation && hasTrace) {
    statusVariant = "ok";
    hintVariant = "ok";
    hint = "Correlation complete. Use traceId and clientEventId pair for deterministic replay diagnostics.";
  } else if (hasCorrelation || hasTrace) {
    statusVariant = "neutral";
    hintVariant = "warn";
    hint = "Partial correlation captured. Inspect missing trace/client event fields before rerunning scenario.";
  }

  setStatusPill(el.operatorGatewayErrorStatus, `${source} #${errorCount}`, statusVariant);
  setOperatorGatewayErrorHint(hint, hintVariant);
}

function updateOperatorGatewayErrorWidgetFromEvent(eventType, payload, pendingContext = null) {
  const source = eventType === "orchestrator.error" ? "orchestrator.error" : "gateway.error";
  const context = extractGatewayErrorContext(payload);
  const details = payload && typeof payload.details === "object" ? payload.details : null;

  const code =
    toOptionalText(payload?.code) ??
    toOptionalText(payload?.errorCode) ??
    toOptionalText(details?.code) ??
    "n/a";
  const traceId = context.traceId ?? "n/a";
  const clientEventId = context.clientEventId ?? "n/a";
  const clientEventType = toOptionalText(pendingContext?.sentType) ?? "n/a";
  const conversation = toOptionalText(pendingContext?.conversation) ?? "n/a";
  const latencyMs =
    typeof pendingContext?.elapsedMs === "number" && Number.isFinite(pendingContext.elapsedMs)
      ? Math.max(0, Math.round(pendingContext.elapsedMs))
      : null;

  const previousCount = Number(state.operatorGatewayErrorSnapshot?.errorCount ?? 0);
  const nextSnapshot = {
    source,
    code,
    traceId,
    clientEventId,
    clientEventType,
    conversation,
    latencyMs,
    seenAt: new Date().toISOString(),
    errorCount: Number.isFinite(previousCount) ? previousCount + 1 : 1,
  };
  state.operatorGatewayErrorSnapshot = nextSnapshot;
  renderOperatorGatewayErrorWidget(nextSnapshot);
}

function renderOperatorTurnTruncationWidget(truncationSummary, snapshot = null) {
  const summary = truncationSummary && typeof truncationSummary === "object" ? truncationSummary : null;
  const latestFromSummary =
    summary?.latest && typeof summary.latest === "object"
      ? summary.latest
      : Array.isArray(summary?.recent) && summary.recent.length > 0 && summary.recent[0] && typeof summary.recent[0] === "object"
        ? summary.recent[0]
        : null;
  const snapshotRecord = snapshot && typeof snapshot === "object" ? snapshot : null;

  const summaryLatestSeenAt = latestFromSummary && typeof latestFromSummary.createdAt === "string"
    ? latestFromSummary.createdAt
    : null;
  const snapshotSeenAt = snapshotRecord && typeof snapshotRecord.seenAt === "string" ? snapshotRecord.seenAt : null;
  const summaryLatestSeenAtMs = parseIsoTimestampMs(summaryLatestSeenAt);
  const snapshotSeenAtMs = parseIsoTimestampMs(snapshotSeenAt);
  const useSnapshotLatest =
    snapshotRecord &&
    (
      summaryLatestSeenAtMs === null ||
      (snapshotSeenAtMs !== null && snapshotSeenAtMs >= summaryLatestSeenAtMs)
    );

  const latest = useSnapshotLatest ? snapshotRecord : latestFromSummary;
  const totalFromSummary = Number(summary?.total ?? 0);
  const totalFromSnapshot =
    snapshotRecord && typeof snapshotRecord.eventCount === "number" && Number.isFinite(snapshotRecord.eventCount)
      ? Math.max(0, Math.floor(snapshotRecord.eventCount))
      : 0;
  const total = Math.max(Math.max(0, Math.floor(totalFromSummary)), totalFromSnapshot);
  const uniqueRunsSummary = Number(summary?.uniqueRuns ?? 0);
  const uniqueSessionsSummary = Number(summary?.uniqueSessions ?? 0);
  const latestRunId = latest && typeof latest.runId === "string" ? latest.runId : null;
  const latestSessionId = latest && typeof latest.sessionId === "string" ? latest.sessionId : null;
  const uniqueRuns = Math.max(Math.max(0, Math.floor(uniqueRunsSummary)), latestRunId ? 1 : 0);
  const uniqueSessions = Math.max(Math.max(0, Math.floor(uniqueSessionsSummary)), latestSessionId ? 1 : 0);

  const latestTurnId = latest && typeof latest.turnId === "string" && latest.turnId.trim().length > 0
    ? latest.turnId
    : "n/a";
  const latestReason = latest && typeof latest.reason === "string" && latest.reason.trim().length > 0
    ? latest.reason
    : "n/a";
  const latestAudioEndMs = latest && typeof latest.audioEndMs === "number" && Number.isFinite(latest.audioEndMs)
    ? `${Math.max(0, Math.floor(latest.audioEndMs))} ms`
    : "n/a";
  const latestContentIndex = latest && typeof latest.contentIndex === "number" && Number.isFinite(latest.contentIndex)
    ? String(Math.max(0, Math.floor(latest.contentIndex)))
    : "n/a";
  const latestSeenAt = latest && typeof latest.seenAt === "string"
    ? latest.seenAt
    : latest && typeof latest.createdAt === "string"
      ? latest.createdAt
      : "n/a";

  setText(el.operatorTurnTruncationTotal, String(total));
  setText(el.operatorTurnTruncationRuns, String(uniqueRuns));
  setText(el.operatorTurnTruncationSessions, String(uniqueSessions));
  setText(el.operatorTurnTruncationTurnId, latestTurnId);
  setText(el.operatorTurnTruncationReason, latestReason);
  setText(el.operatorTurnTruncationAudioEndMs, latestAudioEndMs);
  setText(el.operatorTurnTruncationContentIndex, latestContentIndex);
  setText(el.operatorTurnTruncationSeenAt, latestSeenAt);

  if (total <= 0) {
    setStatusPill(el.operatorTurnTruncationStatus, "no_evidence", "neutral");
    setOperatorTurnTruncationHint("No turn truncation observed yet. Run truncate flow to populate operator evidence.", "warn");
    return;
  }

  const statusText = `observed total=${total} runs=${uniqueRuns}`;
  const statusVariant = latestTurnId === "n/a" || latestReason === "n/a" ? "neutral" : "ok";
  const hintVariant = statusVariant === "ok" ? "ok" : "warn";
  const hint = statusVariant === "ok"
    ? "Turn truncation evidence captured and ready for judge-facing verification."
    : "Turn truncation observed, but latest payload is incomplete. Re-run truncate checkpoint.";
  setStatusPill(el.operatorTurnTruncationStatus, statusText, statusVariant);
  setOperatorTurnTruncationHint(hint, hintVariant);
}

function renderOperatorTurnDeleteWidget(deleteSummary, snapshot = null) {
  const summary = deleteSummary && typeof deleteSummary === "object" ? deleteSummary : null;
  const latestFromSummary =
    summary?.latest && typeof summary.latest === "object"
      ? summary.latest
      : Array.isArray(summary?.recent) && summary.recent.length > 0 && summary.recent[0] && typeof summary.recent[0] === "object"
        ? summary.recent[0]
        : null;
  const snapshotRecord = snapshot && typeof snapshot === "object" ? snapshot : null;

  const summaryLatestSeenAt = latestFromSummary && typeof latestFromSummary.createdAt === "string"
    ? latestFromSummary.createdAt
    : null;
  const snapshotSeenAt = snapshotRecord && typeof snapshotRecord.seenAt === "string" ? snapshotRecord.seenAt : null;
  const summaryLatestSeenAtMs = parseIsoTimestampMs(summaryLatestSeenAt);
  const snapshotSeenAtMs = parseIsoTimestampMs(snapshotSeenAt);
  const useSnapshotLatest =
    snapshotRecord &&
    (
      summaryLatestSeenAtMs === null ||
      (snapshotSeenAtMs !== null && snapshotSeenAtMs >= summaryLatestSeenAtMs)
    );

  const latest = useSnapshotLatest ? snapshotRecord : latestFromSummary;
  const totalFromSummary = Number(summary?.total ?? 0);
  const totalFromSnapshot =
    snapshotRecord && typeof snapshotRecord.eventCount === "number" && Number.isFinite(snapshotRecord.eventCount)
      ? Math.max(0, Math.floor(snapshotRecord.eventCount))
      : 0;
  const total = Math.max(Math.max(0, Math.floor(totalFromSummary)), totalFromSnapshot);
  const uniqueRunsSummary = Number(summary?.uniqueRuns ?? 0);
  const uniqueSessionsSummary = Number(summary?.uniqueSessions ?? 0);
  const latestRunId = latest && typeof latest.runId === "string" ? latest.runId : null;
  const latestSessionId = latest && typeof latest.sessionId === "string" ? latest.sessionId : null;
  const uniqueRuns = Math.max(Math.max(0, Math.floor(uniqueRunsSummary)), latestRunId ? 1 : 0);
  const uniqueSessions = Math.max(Math.max(0, Math.floor(uniqueSessionsSummary)), latestSessionId ? 1 : 0);

  const latestTurnId = latest && typeof latest.turnId === "string" && latest.turnId.trim().length > 0
    ? latest.turnId
    : "n/a";
  const latestReason = latest && typeof latest.reason === "string" && latest.reason.trim().length > 0
    ? latest.reason
    : "n/a";
  const latestScope = latest && typeof latest.scope === "string" && latest.scope.trim().length > 0
    ? latest.scope
    : "n/a";
  const latestSeenAt = latest && typeof latest.seenAt === "string"
    ? latest.seenAt
    : latest && typeof latest.createdAt === "string"
      ? latest.createdAt
      : "n/a";

  setText(el.operatorTurnDeleteTotal, String(total));
  setText(el.operatorTurnDeleteRuns, String(uniqueRuns));
  setText(el.operatorTurnDeleteSessions, String(uniqueSessions));
  setText(el.operatorTurnDeleteTurnId, latestTurnId);
  setText(el.operatorTurnDeleteReason, latestReason);
  setText(el.operatorTurnDeleteScope, latestScope);
  setText(el.operatorTurnDeleteSeenAt, latestSeenAt);

  if (total <= 0) {
    setStatusPill(el.operatorTurnDeleteStatus, "no_evidence", "neutral");
    setOperatorTurnDeleteHint("No turn delete observed yet. Run delete flow to populate operator evidence.", "warn");
    return;
  }

  const statusText = `observed total=${total} runs=${uniqueRuns}`;
  const statusVariant = latestTurnId === "n/a" || latestReason === "n/a" ? "neutral" : "ok";
  const hintVariant = statusVariant === "ok" ? "ok" : "warn";
  const hint = statusVariant === "ok"
    ? "Turn delete evidence captured and ready for judge-facing verification."
    : "Turn delete observed, but latest payload is incomplete. Re-run delete checkpoint.";
  setStatusPill(el.operatorTurnDeleteStatus, statusText, statusVariant);
  setOperatorTurnDeleteHint(hint, hintVariant);
}

function updateOperatorTurnTruncationWidgetFromEvent(event) {
  const payload = event && typeof event.payload === "object" && event.payload !== null ? event.payload : {};
  const turnId = toOptionalText(payload.turnId) ?? null;
  const reason = toOptionalText(payload.reason) ?? null;
  const audioEndMs =
    typeof payload.audioEndMs === "number" && Number.isFinite(payload.audioEndMs)
      ? Math.max(0, Math.floor(payload.audioEndMs))
      : null;
  const contentIndex =
    typeof payload.contentIndex === "number" && Number.isFinite(payload.contentIndex)
      ? Math.max(0, Math.floor(payload.contentIndex))
      : null;
  const scope = toOptionalText(payload.scope) ?? null;
  const previousCount = Number(state.operatorTurnTruncationSnapshot?.eventCount ?? 0);
  const nextSnapshot = {
    eventCount: Number.isFinite(previousCount) ? Math.max(0, Math.floor(previousCount)) + 1 : 1,
    runId: typeof event.runId === "string" ? event.runId : null,
    sessionId: typeof event.sessionId === "string" ? event.sessionId : null,
    turnId,
    reason,
    audioEndMs,
    contentIndex,
    scope,
    seenAt: new Date().toISOString(),
  };
  state.operatorTurnTruncationSnapshot = nextSnapshot;
  renderOperatorTurnTruncationWidget(null, nextSnapshot);
  appendEntry(
    el.operatorSummary,
    "system",
    "turn_truncation.live_event",
    `event_count=${nextSnapshot.eventCount} turn=${turnId ?? "n/a"} reason=${reason ?? "n/a"} audio_end_ms=${audioEndMs ?? "n/a"} content_index=${contentIndex ?? "n/a"} scope=${scope ?? "n/a"} run=${nextSnapshot.runId ?? "n/a"} session=${nextSnapshot.sessionId ?? "n/a"} seen_at=${nextSnapshot.seenAt}`,
  );
}

function updateOperatorTurnDeleteWidgetFromEvent(event) {
  const payload = event && typeof event.payload === "object" && event.payload !== null ? event.payload : {};
  const turnId = toOptionalText(payload.turnId) ?? null;
  const reason = toOptionalText(payload.reason) ?? null;
  const scope = toOptionalText(payload.scope) ?? null;
  const hadActiveTurn = payload.hadActiveTurn === true;
  const previousCount = Number(state.operatorTurnDeleteSnapshot?.eventCount ?? 0);
  const nextSnapshot = {
    eventCount: Number.isFinite(previousCount) ? Math.max(0, Math.floor(previousCount)) + 1 : 1,
    runId: typeof event.runId === "string" ? event.runId : null,
    sessionId: typeof event.sessionId === "string" ? event.sessionId : null,
    turnId,
    reason,
    scope,
    hadActiveTurn,
    seenAt: new Date().toISOString(),
  };
  state.operatorTurnDeleteSnapshot = nextSnapshot;
  renderOperatorTurnDeleteWidget(null, nextSnapshot);
  appendEntry(
    el.operatorSummary,
    "system",
    "turn_delete.live_event",
    `event_count=${nextSnapshot.eventCount} turn=${turnId ?? "n/a"} reason=${reason ?? "n/a"} scope=${scope ?? "n/a"} had_active_turn=${hadActiveTurn} run=${nextSnapshot.runId ?? "n/a"} session=${nextSnapshot.sessionId ?? "n/a"} seen_at=${nextSnapshot.seenAt}`,
  );
}

function renderOperatorDamageControlWidget(damageControlSummary, snapshot = null) {
  const summary = damageControlSummary && typeof damageControlSummary === "object" ? damageControlSummary : null;
  const latestFromSummary =
    summary?.latest && typeof summary.latest === "object"
      ? summary.latest
      : Array.isArray(summary?.recent) && summary.recent.length > 0 && summary.recent[0] && typeof summary.recent[0] === "object"
        ? summary.recent[0]
        : null;
  const snapshotRecord = snapshot && typeof snapshot === "object" ? snapshot : null;

  const summaryLatestSeenAt = latestFromSummary && typeof latestFromSummary.createdAt === "string"
    ? latestFromSummary.createdAt
    : null;
  const snapshotSeenAt = snapshotRecord && typeof snapshotRecord.seenAt === "string" ? snapshotRecord.seenAt : null;
  const summaryLatestSeenAtMs = parseIsoTimestampMs(summaryLatestSeenAt);
  const snapshotSeenAtMs = parseIsoTimestampMs(snapshotSeenAt);
  const useSnapshotLatest =
    snapshotRecord &&
    (
      summaryLatestSeenAtMs === null ||
      (snapshotSeenAtMs !== null && snapshotSeenAtMs >= summaryLatestSeenAtMs)
    );

  const latest = useSnapshotLatest ? snapshotRecord : latestFromSummary;
  const totalFromSummary = Number(summary?.total ?? 0);
  const totalFromSnapshot =
    snapshotRecord && typeof snapshotRecord.eventCount === "number" && Number.isFinite(snapshotRecord.eventCount)
      ? Math.max(0, Math.floor(snapshotRecord.eventCount))
      : 0;
  const total = Math.max(Math.max(0, Math.floor(totalFromSummary)), totalFromSnapshot);
  const uniqueRunsSummary = Number(summary?.uniqueRuns ?? 0);
  const uniqueSessionsSummary = Number(summary?.uniqueSessions ?? 0);
  const latestRunId = latest && typeof latest.runId === "string" ? latest.runId : null;
  const latestSessionId = latest && typeof latest.sessionId === "string" ? latest.sessionId : null;
  const uniqueRuns = Math.max(Math.max(0, Math.floor(uniqueRunsSummary)), latestRunId ? 1 : 0);
  const uniqueSessions = Math.max(Math.max(0, Math.floor(uniqueSessionsSummary)), latestSessionId ? 1 : 0);

  const verdictCounts = summary?.verdictCounts && typeof summary.verdictCounts === "object"
    ? summary.verdictCounts
    : {};
  const allowCount = Math.max(0, Math.floor(Number(verdictCounts.allow ?? 0) || 0));
  const askCount = Math.max(0, Math.floor(Number(verdictCounts.ask ?? 0) || 0));
  const blockCount = Math.max(0, Math.floor(Number(verdictCounts.block ?? 0) || 0));
  const latestVerdict = latest && typeof latest.verdict === "string" && latest.verdict.trim().length > 0
    ? latest.verdict
    : "n/a";
  const latestPolicySource = latest && typeof latest.policySource === "string" && latest.policySource.trim().length > 0
    ? latest.policySource
    : latest && typeof latest.source === "string" && latest.source.trim().length > 0
      ? latest.source
      : "n/a";
  const latestMatchedRuleCount = latest && typeof latest.matchedRuleCount === "number" && Number.isFinite(latest.matchedRuleCount)
    ? Math.max(0, Math.floor(latest.matchedRuleCount))
    : null;
  const latestRuleIds = latest && Array.isArray(latest.matchRuleIds)
    ? latest.matchRuleIds.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  const latestSeenAt = latest && typeof latest.seenAt === "string"
    ? latest.seenAt
    : latest && typeof latest.createdAt === "string"
      ? latest.createdAt
      : "n/a";
  const latestLabel = latestMatchedRuleCount === null
    ? `verdict=${latestVerdict} source=${latestPolicySource}`
    : `verdict=${latestVerdict} source=${latestPolicySource} rules=${latestMatchedRuleCount}`;

  setText(el.operatorDamageControlTotal, String(total));
  setText(el.operatorDamageControlRuns, String(uniqueRuns));
  setText(el.operatorDamageControlSessions, String(uniqueSessions));
  setText(el.operatorDamageControlVerdicts, `allow=${allowCount} ask=${askCount} block=${blockCount}`);
  setText(el.operatorDamageControlLatest, latestLabel);
  setText(el.operatorDamageControlRuleIds, latestRuleIds.length > 0 ? latestRuleIds.join(", ") : "n/a");
  setText(el.operatorDamageControlSeenAt, latestSeenAt);

  if (total <= 0) {
    setStatusPill(el.operatorDamageControlStatus, "no_evidence", "neutral");
    setOperatorDamageControlHint("No damage-control decisions observed yet. Run UI sandbox flow to populate evidence.", "warn");
    return;
  }

  const completeLatest = latestVerdict !== "n/a" && latestPolicySource !== "n/a";
  const statusVariant = completeLatest ? "ok" : "neutral";
  const hintVariant = completeLatest ? "ok" : "warn";
  const statusText = `observed total=${total} block=${blockCount} ask=${askCount}`;
  const hint = completeLatest
    ? "Damage-control timeline captured and ready for judge-facing safety review."
    : "Damage-control events observed, but latest payload is incomplete. Re-run ui.sandbox.policy_modes.";
  setStatusPill(el.operatorDamageControlStatus, statusText, statusVariant);
  setOperatorDamageControlHint(hint, hintVariant);
}

function renderOperatorSkillsRegistryWidget(skillsRegistrySummary) {
  const summary =
    skillsRegistrySummary && typeof skillsRegistrySummary === "object" ? skillsRegistrySummary : null;
  if (!summary) {
    resetOperatorSkillsRegistryWidget("no_data");
    return;
  }

  const total = Math.max(0, Math.floor(Number(summary.total ?? 0) || 0));
  const uniqueSkills = Math.max(0, Math.floor(Number(summary.uniqueSkills ?? 0) || 0));
  const outcomes = summary.outcomes && typeof summary.outcomes === "object" ? summary.outcomes : {};
  const lifecycle = summary.lifecycle && typeof summary.lifecycle === "object" ? summary.lifecycle : {};
  const conflicts = summary.conflicts && typeof summary.conflicts === "object" ? summary.conflicts : {};
  const latest = summary.latest && typeof summary.latest === "object" ? summary.latest : null;
  const lifecycleValidated = summary.lifecycleValidated === true;

  const succeeded = Math.max(0, Math.floor(Number(outcomes.succeeded ?? 0) || 0));
  const denied = Math.max(0, Math.floor(Number(outcomes.denied ?? 0) || 0));
  const failed = Math.max(0, Math.floor(Number(outcomes.failed ?? 0) || 0));
  const created = Math.max(0, Math.floor(Number(lifecycle.created ?? 0) || 0));
  const updated = Math.max(0, Math.floor(Number(lifecycle.updated ?? 0) || 0));
  const replay = Math.max(0, Math.floor(Number(lifecycle.idempotentReplay ?? 0) || 0));
  const versionConflict = Math.max(0, Math.floor(Number(conflicts.versionConflict ?? 0) || 0));
  const pluginInvalidPermission = Math.max(0, Math.floor(Number(conflicts.pluginInvalidPermission ?? 0) || 0));

  const latestOutcome = latest && typeof latest.outcome === "string" ? latest.outcome : "n/a";
  const latestSkillId = latest && typeof latest.skillId === "string" ? latest.skillId : "n/a";
  const latestErrorCode = latest && typeof latest.errorCode === "string" ? latest.errorCode : "n/a";
  const latestSeenAt = latest && typeof latest.createdAt === "string" ? latest.createdAt : "n/a";
  const latestLabel =
    latestErrorCode === "n/a"
      ? `outcome=${latestOutcome} skill=${latestSkillId}`
      : `outcome=${latestOutcome} skill=${latestSkillId} code=${latestErrorCode}`;

  setText(el.operatorSkillsRegistryTotal, String(total));
  setText(el.operatorSkillsRegistrySkills, String(uniqueSkills));
  setText(el.operatorSkillsRegistryOutcomes, `ok=${succeeded} denied=${denied} failed=${failed}`);
  setText(el.operatorSkillsRegistryLifecycle, `created=${created} updated=${updated} replay=${replay}`);
  setText(
    el.operatorSkillsRegistryConflicts,
    `version=${versionConflict} plugin_perm=${pluginInvalidPermission}`,
  );
  setText(el.operatorSkillsRegistryLatest, latestLabel);
  setText(el.operatorSkillsRegistrySeenAt, latestSeenAt);

  if (total <= 0) {
    setStatusPill(el.operatorSkillsRegistryStatus, "no_evidence", "neutral");
    setOperatorSkillsRegistryHint(
      "No skills registry lifecycle evidence observed yet. Run managed-skills scenario to populate it.",
      "warn",
    );
    return;
  }

  const missingChecklist = [];
  if (created <= 0) {
    missingChecklist.push("created");
  }
  if (replay <= 0) {
    missingChecklist.push("idempotent_replay");
  }
  if (versionConflict <= 0) {
    missingChecklist.push("version_conflict");
  }
  if (pluginInvalidPermission <= 0) {
    missingChecklist.push("plugin_invalid_permission");
  }

  if (lifecycleValidated) {
    setStatusPill(
      el.operatorSkillsRegistryStatus,
      `validated total=${total} skills=${uniqueSkills}`,
      "ok",
    );
    setOperatorSkillsRegistryHint(
      "Skills registry lifecycle evidence captured and ready for judge-facing release validation.",
      "ok",
    );
    return;
  }

  const missingText = missingChecklist.length > 0 ? missingChecklist.join(",") : "none";
  setStatusPill(
    el.operatorSkillsRegistryStatus,
    `partial total=${total} skills=${uniqueSkills}`,
    "neutral",
  );
  setOperatorSkillsRegistryHint(
    `Lifecycle evidence partial. Missing checkpoints: ${missingText}.`,
    "warn",
  );
}

function renderOperatorPluginMarketplaceWidget(pluginMarketplaceSummary) {
  const summary =
    pluginMarketplaceSummary && typeof pluginMarketplaceSummary === "object"
      ? pluginMarketplaceSummary
      : null;
  if (!summary) {
    resetOperatorPluginMarketplaceWidget("no_data");
    return;
  }

  const total = Math.max(0, Math.floor(Number(summary.total ?? 0) || 0));
  const uniquePlugins = Math.max(0, Math.floor(Number(summary.uniquePlugins ?? 0) || 0));
  const outcomes = summary.outcomes && typeof summary.outcomes === "object" ? summary.outcomes : {};
  const lifecycle = summary.lifecycle && typeof summary.lifecycle === "object" ? summary.lifecycle : {};
  const conflicts = summary.conflicts && typeof summary.conflicts === "object" ? summary.conflicts : {};
  const signingStatusCounts =
    summary.signingStatusCounts && typeof summary.signingStatusCounts === "object"
      ? summary.signingStatusCounts
      : {};
  const permissionTotals =
    summary.permissionTotals && typeof summary.permissionTotals === "object"
      ? summary.permissionTotals
      : {};
  const latest = summary.latest && typeof summary.latest === "object" ? summary.latest : null;
  const lifecycleValidated = summary.lifecycleValidated === true;

  const succeeded = Math.max(0, Math.floor(Number(outcomes.succeeded ?? 0) || 0));
  const denied = Math.max(0, Math.floor(Number(outcomes.denied ?? 0) || 0));
  const failed = Math.max(0, Math.floor(Number(outcomes.failed ?? 0) || 0));
  const created = Math.max(0, Math.floor(Number(lifecycle.created ?? 0) || 0));
  const updated = Math.max(0, Math.floor(Number(lifecycle.updated ?? 0) || 0));
  const replay = Math.max(0, Math.floor(Number(lifecycle.idempotentReplay ?? 0) || 0));
  const versionConflict = Math.max(0, Math.floor(Number(conflicts.versionConflict ?? 0) || 0));
  const pluginInvalidPermission = Math.max(0, Math.floor(Number(conflicts.pluginInvalidPermission ?? 0) || 0));
  const signingVerified = Math.max(0, Math.floor(Number(signingStatusCounts.verified ?? 0) || 0));
  const signingUnsigned = Math.max(0, Math.floor(Number(signingStatusCounts.unsigned ?? 0) || 0));
  const signingNone = Math.max(0, Math.floor(Number(signingStatusCounts.none ?? 0) || 0));
  const totalPermissions = Math.max(0, Math.floor(Number(permissionTotals.totalPermissions ?? 0) || 0));
  const entriesWithPermissions = Math.max(
    0,
    Math.floor(Number(permissionTotals.entriesWithPermissions ?? 0) || 0),
  );
  const latestOutcome = latest && typeof latest.outcome === "string" ? latest.outcome : "n/a";
  const latestPluginId = latest && typeof latest.pluginId === "string" ? latest.pluginId : "n/a";
  const latestSigning = latest && typeof latest.signingStatus === "string" ? latest.signingStatus : "n/a";
  const latestErrorCode = latest && typeof latest.errorCode === "string" ? latest.errorCode : "n/a";
  const latestSeenAt = latest && typeof latest.createdAt === "string" ? latest.createdAt : "n/a";
  const latestLabel =
    latestErrorCode === "n/a"
      ? `outcome=${latestOutcome} plugin=${latestPluginId} signing=${latestSigning}`
      : `outcome=${latestOutcome} plugin=${latestPluginId} code=${latestErrorCode}`;

  setText(el.operatorPluginMarketplaceTotal, String(total));
  setText(el.operatorPluginMarketplacePlugins, String(uniquePlugins));
  setText(el.operatorPluginMarketplaceOutcomes, `ok=${succeeded} denied=${denied} failed=${failed}`);
  setText(
    el.operatorPluginMarketplaceSigning,
    `verified=${signingVerified} unsigned=${signingUnsigned} none=${signingNone}`,
  );
  setText(
    el.operatorPluginMarketplacePermissions,
    `total=${totalPermissions} entries=${entriesWithPermissions}`,
  );
  setText(el.operatorPluginMarketplaceLifecycle, `created=${created} updated=${updated} replay=${replay}`);
  setText(
    el.operatorPluginMarketplaceConflicts,
    `version=${versionConflict} plugin_perm=${pluginInvalidPermission}`,
  );
  setText(el.operatorPluginMarketplaceLatest, latestLabel);
  setText(el.operatorPluginMarketplaceSeenAt, latestSeenAt);

  if (total <= 0) {
    setStatusPill(el.operatorPluginMarketplaceStatus, "no_evidence", "neutral");
    setOperatorPluginMarketplaceHint(
      "No plugin marketplace lifecycle evidence observed yet. Run managed-skills scenario to populate it.",
      "warn",
    );
    return;
  }

  const missingChecklist = [];
  if (created <= 0) {
    missingChecklist.push("created");
  }
  if (replay <= 0) {
    missingChecklist.push("idempotent_replay");
  }
  if (versionConflict <= 0) {
    missingChecklist.push("version_conflict");
  }
  if (pluginInvalidPermission <= 0) {
    missingChecklist.push("plugin_invalid_permission");
  }
  if (signingVerified + signingUnsigned <= 0) {
    missingChecklist.push("signing_status");
  }

  if (lifecycleValidated) {
    setStatusPill(
      el.operatorPluginMarketplaceStatus,
      `validated total=${total} plugins=${uniquePlugins}`,
      "ok",
    );
    setOperatorPluginMarketplaceHint(
      "Plugin marketplace lifecycle evidence captured and ready for judge-facing release validation.",
      "ok",
    );
    return;
  }

  const missingText = missingChecklist.length > 0 ? missingChecklist.join(",") : "none";
  setStatusPill(
    el.operatorPluginMarketplaceStatus,
    `partial total=${total} plugins=${uniquePlugins}`,
    "neutral",
  );
  setOperatorPluginMarketplaceHint(
    `Lifecycle evidence partial. Missing checkpoints: ${missingText}.`,
    "warn",
  );
}

function renderOperatorGovernancePolicyWidget(governancePolicySummary) {
  const summary =
    governancePolicySummary && typeof governancePolicySummary === "object" ? governancePolicySummary : null;
  if (!summary) {
    resetOperatorGovernancePolicyWidget("no_data");
    return;
  }

  const total = Math.max(0, Math.floor(Number(summary.total ?? 0) || 0));
  const uniqueTenants = Math.max(0, Math.floor(Number(summary.uniqueTenants ?? 0) || 0));
  const outcomes = summary.outcomes && typeof summary.outcomes === "object" ? summary.outcomes : {};
  const lifecycle = summary.lifecycle && typeof summary.lifecycle === "object" ? summary.lifecycle : {};
  const conflicts = summary.conflicts && typeof summary.conflicts === "object" ? summary.conflicts : {};
  const latest = summary.latest && typeof summary.latest === "object" ? summary.latest : null;
  const lifecycleValidated = summary.lifecycleValidated === true;

  const succeeded = Math.max(0, Math.floor(Number(outcomes.succeeded ?? 0) || 0));
  const denied = Math.max(0, Math.floor(Number(outcomes.denied ?? 0) || 0));
  const failed = Math.max(0, Math.floor(Number(outcomes.failed ?? 0) || 0));
  const created = Math.max(0, Math.floor(Number(lifecycle.created ?? 0) || 0));
  const updated = Math.max(0, Math.floor(Number(lifecycle.updated ?? 0) || 0));
  const replay = Math.max(0, Math.floor(Number(lifecycle.idempotentReplay ?? 0) || 0));
  const versionConflict = Math.max(0, Math.floor(Number(conflicts.versionConflict ?? 0) || 0));
  const idempotencyConflict = Math.max(0, Math.floor(Number(conflicts.idempotencyConflict ?? 0) || 0));
  const tenantScopeForbidden = Math.max(0, Math.floor(Number(conflicts.tenantScopeForbidden ?? 0) || 0));

  const latestOutcome = latest && typeof latest.outcome === "string" ? latest.outcome : "n/a";
  const latestTenantId = latest && typeof latest.tenantId === "string" ? latest.tenantId : "n/a";
  const latestTemplate = latest && typeof latest.complianceTemplate === "string" ? latest.complianceTemplate : "n/a";
  const latestErrorCode = latest && typeof latest.errorCode === "string" ? latest.errorCode : "n/a";
  const latestSeenAt = latest && typeof latest.createdAt === "string" ? latest.createdAt : "n/a";
  const latestLabel =
    latestErrorCode === "n/a"
      ? `outcome=${latestOutcome} tenant=${latestTenantId} template=${latestTemplate}`
      : `outcome=${latestOutcome} tenant=${latestTenantId} code=${latestErrorCode}`;

  setText(el.operatorGovernancePolicyTotal, String(total));
  setText(el.operatorGovernancePolicyTenants, String(uniqueTenants));
  setText(el.operatorGovernancePolicyOutcomes, `ok=${succeeded} denied=${denied} failed=${failed}`);
  setText(el.operatorGovernancePolicyLifecycle, `created=${created} updated=${updated} replay=${replay}`);
  setText(
    el.operatorGovernancePolicyConflicts,
    `version=${versionConflict} idempotency=${idempotencyConflict} tenant_scope=${tenantScopeForbidden}`,
  );
  setText(el.operatorGovernancePolicyLatest, latestLabel);
  setText(el.operatorGovernancePolicySeenAt, latestSeenAt);

  if (total <= 0) {
    setStatusPill(el.operatorGovernancePolicyStatus, "no_evidence", "neutral");
    setOperatorGovernancePolicyHint(
      "No governance policy lifecycle evidence observed yet. Run governance lifecycle scenario to populate it.",
      "warn",
    );
    return;
  }

  const missingChecklist = [];
  if (created <= 0) {
    missingChecklist.push("created");
  }
  if (replay <= 0) {
    missingChecklist.push("idempotent_replay");
  }
  if (versionConflict <= 0) {
    missingChecklist.push("version_conflict");
  }
  if (idempotencyConflict <= 0) {
    missingChecklist.push("idempotency_conflict");
  }

  if (lifecycleValidated) {
    setStatusPill(
      el.operatorGovernancePolicyStatus,
      `validated total=${total} tenants=${uniqueTenants}`,
      "ok",
    );
    setOperatorGovernancePolicyHint(
      "Governance policy lifecycle evidence captured and ready for judge-facing release validation.",
      "ok",
    );
    return;
  }

  const missingText = missingChecklist.length > 0 ? missingChecklist.join(",") : "none";
  setStatusPill(
    el.operatorGovernancePolicyStatus,
    `partial total=${total} tenants=${uniqueTenants}`,
    "neutral",
  );
  setOperatorGovernancePolicyHint(
    `Lifecycle evidence partial. Missing checkpoints: ${missingText}.`,
    "warn",
  );
}

function renderOperatorAgentUsageWidget(agentUsageSummary) {
  const summary = agentUsageSummary && typeof agentUsageSummary === "object" ? agentUsageSummary : null;
  if (!summary) {
    resetOperatorAgentUsageWidget("no_data");
    return;
  }

  const total = Math.max(0, Math.floor(Number(summary.total ?? 0) || 0));
  const uniqueRuns = Math.max(0, Math.floor(Number(summary.uniqueRuns ?? 0) || 0));
  const uniqueSessions = Math.max(0, Math.floor(Number(summary.uniqueSessions ?? 0) || 0));
  const totalCalls = Math.max(0, Math.floor(Number(summary.totalCalls ?? 0) || 0));
  const inputTokens = Math.max(0, Math.floor(Number(summary.inputTokens ?? 0) || 0));
  const outputTokens = Math.max(0, Math.floor(Number(summary.outputTokens ?? 0) || 0));
  const totalTokens = Math.max(
    0,
    Math.floor(Math.max(Number(summary.totalTokens ?? 0) || 0, inputTokens + outputTokens)),
  );
  const models = Array.isArray(summary.models)
    ? summary.models
        .filter((item) => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];
  const source = typeof summary.source === "string" ? summary.source : "unknown";
  const status = typeof summary.status === "string" ? summary.status : total > 0 ? "observed" : "missing";
  const latest = summary.latest && typeof summary.latest === "object" ? summary.latest : null;
  const latestSeenAt = latest && typeof latest.createdAt === "string" ? latest.createdAt : "n/a";

  setText(el.operatorAgentUsageTotal, String(total));
  setText(el.operatorAgentUsageRuns, String(uniqueRuns));
  setText(el.operatorAgentUsageSessions, String(uniqueSessions));
  setText(el.operatorAgentUsageCalls, String(totalCalls));
  setText(el.operatorAgentUsageTokens, `${totalTokens} (in=${inputTokens} out=${outputTokens})`);
  setText(el.operatorAgentUsageModels, models.length > 0 ? models.join(", ") : "n/a");
  setText(el.operatorAgentUsageSource, source);
  setText(el.operatorAgentUsageSeenAt, latestSeenAt);

  if (total <= 0) {
    setStatusPill(el.operatorAgentUsageStatus, "no_evidence", "neutral");
    setOperatorAgentUsageHint(
      "No agent usage evidence yet. Run live/story/ui flows and refresh operator summary.",
      "warn",
    );
    return;
  }

  const invariantValidated =
    summary.validated === true &&
    source === "operator_summary" &&
    models.length > 0 &&
    totalTokens >= inputTokens + outputTokens;

  if (invariantValidated) {
    setStatusPill(el.operatorAgentUsageStatus, `validated total=${total}`, "ok");
    setOperatorAgentUsageHint(
      "Agent usage evidence is complete and aligned with release policy (source/models/token totals).",
      "ok",
    );
    return;
  }

  const missing = [];
  if (summary.validated !== true) {
    missing.push("validated_flag");
  }
  if (source !== "operator_summary") {
    missing.push("source=operator_summary");
  }
  if (models.length <= 0) {
    missing.push("models");
  }
  if (totalTokens < inputTokens + outputTokens) {
    missing.push("token_consistency");
  }
  const missingText = missing.length > 0 ? missing.join(",") : "none";
  setStatusPill(el.operatorAgentUsageStatus, `${status} total=${total}`, "neutral");
  setOperatorAgentUsageHint(`Agent usage evidence partial. Missing checkpoints: ${missingText}.`, "warn");
}

function renderOperatorCostEstimateWidget(costEstimateSummary) {
  const summary = costEstimateSummary && typeof costEstimateSummary === "object" ? costEstimateSummary : null;
  if (!summary) {
    resetOperatorCostEstimateWidget("no_data");
    return;
  }

  const currency = typeof summary.currency === "string" ? summary.currency : "USD";
  const estimationMode = typeof summary.estimationMode === "string" ? summary.estimationMode : "tokens_only";
  const summarySource = typeof summary.summarySource === "string" ? summary.summarySource : "operator_summary";
  const source = typeof summary.source === "string" ? summary.source : "operator_summary";
  const status = typeof summary.status === "string" ? summary.status : "missing";
  const pricingConfigured = summary.pricingConfigured === true;
  const validated = summary.validated === true;

  const inputTokens = Math.max(0, Math.floor(Number(summary.inputTokens ?? 0) || 0));
  const outputTokens = Math.max(0, Math.floor(Number(summary.outputTokens ?? 0) || 0));
  const totalTokens = Math.max(0, Math.floor(Number(summary.totalTokens ?? 0) || 0));
  const inputUsd = Number(summary.inputUsd ?? 0);
  const outputUsd = Number(summary.outputUsd ?? 0);
  const totalUsd = Number(summary.totalUsd ?? 0);
  const rateIn = Number(summary.pricePer1kInputUsd ?? 0);
  const rateOut = Number(summary.pricePer1kOutputUsd ?? 0);
  const latestSeenAt = typeof summary.latestSeenAt === "string" ? summary.latestSeenAt : "n/a";

  setText(el.operatorCostEstimateCurrency, currency);
  setText(el.operatorCostEstimateMode, estimationMode);
  setText(el.operatorCostEstimateSource, `${source}/${summarySource}`);
  setText(el.operatorCostEstimateTokens, `${totalTokens} (in=${inputTokens} out=${outputTokens})`);
  setText(el.operatorCostEstimateInputUsd, formatUsd(inputUsd));
  setText(el.operatorCostEstimateOutputUsd, formatUsd(outputUsd));
  setText(el.operatorCostEstimateTotalUsd, formatUsd(totalUsd));
  setText(el.operatorCostEstimateRates, `in=${rateIn.toFixed(6)} out=${rateOut.toFixed(6)} (per 1k)`);
  setText(el.operatorCostEstimateSeenAt, latestSeenAt);

  if (status === "missing" || totalTokens <= 0) {
    setStatusPill(el.operatorCostEstimateStatus, "no_evidence", "neutral");
    setOperatorCostEstimateHint("No token/cost evidence yet. Run flows and refresh operator summary.", "warn");
    return;
  }

  const consistencyOk = totalTokens >= inputTokens + outputTokens;
  if (validated && consistencyOk && summarySource === "operator_summary") {
    setStatusPill(
      el.operatorCostEstimateStatus,
      pricingConfigured ? "validated_estimate" : "validated_tokens_only",
      "ok",
    );
    setOperatorCostEstimateHint(
      pricingConfigured
        ? "Cost estimate is derived from token rates and operator summary usage evidence."
        : "Token evidence is validated. Configure token rates to enable non-zero USD estimate.",
      pricingConfigured ? "ok" : "warn",
    );
    return;
  }

  setStatusPill(el.operatorCostEstimateStatus, `partial ${status}`, "neutral");
  setOperatorCostEstimateHint(
    "Cost evidence is partial. Check operator summary source/consistency fields and token totals.",
    "warn",
  );
}

function updateOperatorDamageControlWidgetFromResponse(event) {
  const payload = event && typeof event.payload === "object" && event.payload !== null ? event.payload : {};
  const output = payload && typeof payload.output === "object" && payload.output !== null ? payload.output : {};
  const damageControl =
    output && typeof output.damageControl === "object" && output.damageControl !== null ? output.damageControl : null;
  if (!damageControl) {
    return;
  }

  const verdict = toOptionalText(damageControl.verdict) ?? null;
  const policySource = toOptionalText(damageControl.source) ?? null;
  const matchedRuleCount =
    typeof damageControl.matchedRuleCount === "number" && Number.isFinite(damageControl.matchedRuleCount)
      ? Math.max(0, Math.floor(damageControl.matchedRuleCount))
      : 0;
  const matchRuleIds = Array.isArray(damageControl.matches)
    ? damageControl.matches
      .map((item) => (item && typeof item === "object" ? toOptionalText(item.ruleId) : null))
      .filter((item) => typeof item === "string")
    : [];

  const previousCount = Number(state.operatorDamageControlSnapshot?.eventCount ?? 0);
  const previousVerdictCounts =
    state.operatorDamageControlSnapshot &&
    state.operatorDamageControlSnapshot.verdictCounts &&
    typeof state.operatorDamageControlSnapshot.verdictCounts === "object"
      ? state.operatorDamageControlSnapshot.verdictCounts
      : { allow: 0, ask: 0, block: 0 };
  const nextVerdictCounts = {
    allow: Math.max(0, Math.floor(Number(previousVerdictCounts.allow ?? 0) || 0)),
    ask: Math.max(0, Math.floor(Number(previousVerdictCounts.ask ?? 0) || 0)),
    block: Math.max(0, Math.floor(Number(previousVerdictCounts.block ?? 0) || 0)),
  };
  if (verdict === "allow" || verdict === "ask" || verdict === "block") {
    nextVerdictCounts[verdict] += 1;
  }

  const nextSnapshot = {
    eventCount: Number.isFinite(previousCount) ? Math.max(0, Math.floor(previousCount)) + 1 : 1,
    runId: typeof event.runId === "string" ? event.runId : null,
    sessionId: typeof event.sessionId === "string" ? event.sessionId : null,
    verdict,
    policySource,
    matchedRuleCount,
    matchRuleIds,
    seenAt: new Date().toISOString(),
    verdictCounts: nextVerdictCounts,
  };
  state.operatorDamageControlSnapshot = nextSnapshot;
  renderOperatorDamageControlWidget(null, nextSnapshot);
}

function renderOperatorHealthWidget(liveBridgeHealth) {
  if (!liveBridgeHealth || typeof liveBridgeHealth !== "object") {
    resetOperatorHealthWidget("no_data");
    return;
  }

  const bridgeState = typeof liveBridgeHealth.state === "string" ? liveBridgeHealth.state : "unknown";
  const degraded = Number(liveBridgeHealth.degradedEvents ?? 0);
  const recovered = Number(liveBridgeHealth.recoveredEvents ?? 0);
  const watchdogReconnects = Number(liveBridgeHealth.watchdogReconnectEvents ?? 0);
  const errors = Number(liveBridgeHealth.bridgeErrorEvents ?? 0);
  const unavailable = Number(liveBridgeHealth.unavailableEvents ?? 0);
  const connectTimeouts = Number(liveBridgeHealth.connectTimeoutEvents ?? 0);
  const probes = Number(liveBridgeHealth.probeStartedEvents ?? 0);
  const pingSent = Number(liveBridgeHealth.pingSentEvents ?? 0);
  const pongs = Number(liveBridgeHealth.pongEvents ?? 0);
  const pingErrors = Number(liveBridgeHealth.pingErrorEvents ?? 0);
  const lastEventType = typeof liveBridgeHealth.lastEventType === "string" ? liveBridgeHealth.lastEventType : "-";
  const lastEventAt = typeof liveBridgeHealth.lastEventAt === "string" ? liveBridgeHealth.lastEventAt : "-";
  const probeSuccessPct = pingSent > 0 ? Math.round((pongs / pingSent) * 100) : null;
  const probeSuccessText = probeSuccessPct === null ? "n/a" : `${probeSuccessPct}%`;

  setText(el.operatorHealthState, bridgeState);
  setText(el.operatorHealthLastEventType, lastEventType);
  setText(el.operatorHealthLastEventAt, lastEventAt);
  setText(el.operatorHealthDegraded, String(degraded));
  setText(el.operatorHealthRecovered, String(recovered));
  setText(el.operatorHealthWatchdogReconnects, String(watchdogReconnects));
  setText(el.operatorHealthErrors, String(errors));
  setText(el.operatorHealthUnavailable, String(unavailable));
  setText(el.operatorHealthConnectTimeouts, String(connectTimeouts));
  setText(el.operatorHealthProbes, String(probes));
  setText(el.operatorHealthPingSent, String(pingSent));
  setText(el.operatorHealthPongs, String(pongs));
  setText(el.operatorHealthPingErrors, String(pingErrors));
  setText(el.operatorHealthProbeSuccess, probeSuccessText);

  let statusVariant = "ok";
  let recoveryHint = "Bridge healthy. Keep monitoring counters; no failover action is required.";
  let recoveryHintVariant = "ok";
  if (bridgeState === "degraded" || unavailable > 0 || errors > 0) {
    statusVariant = "fail";
    recoveryHintVariant = "fail";
    recoveryHint =
      "Recommended: choose target `realtime-gateway`, click `Failover Drain`, then `Failover Warmup` after recovery.";
  } else if (bridgeState === "unknown" || pingErrors > 0 || (pingSent > 0 && pongs < pingSent)) {
    statusVariant = "neutral";
    recoveryHintVariant = "warn";
    recoveryHint =
      "State is uncertain. Refresh summary; if probe/errors counters grow, run `Failover Drain` and then `Failover Warmup`.";
  }
  const statusText = probeSuccessPct === null ? `state=${bridgeState}` : `state=${bridgeState} probe=${probeSuccessText}`;
  setStatusPill(el.operatorHealthStatus, statusText, statusVariant);
  setOperatorHealthHint(recoveryHint, recoveryHintVariant);
}

function renderOperatorUiExecutorWidget(uiExecutorService, lastFailoverAction) {
  if (!uiExecutorService || typeof uiExecutorService !== "object") {
    resetOperatorUiExecutorWidget("no_data");
    return;
  }

  const serviceState = typeof uiExecutorService.state === "string" ? uiExecutorService.state : "unknown";
  const healthy = uiExecutorService.healthy === true;
  const profileName =
    uiExecutorService.profile && typeof uiExecutorService.profile === "object" && typeof uiExecutorService.profile.profile === "string"
      ? uiExecutorService.profile.profile
      : "n/a";
  const profileEnv =
    uiExecutorService.profile && typeof uiExecutorService.profile === "object" && typeof uiExecutorService.profile.environment === "string"
      ? uiExecutorService.profile.environment
      : "n/a";
  const version = typeof uiExecutorService.version === "string" && uiExecutorService.version.trim().length > 0
    ? uiExecutorService.version.trim()
    : "n/a";
  const actionOperation =
    lastFailoverAction && typeof lastFailoverAction === "object" && typeof lastFailoverAction.operation === "string"
      ? lastFailoverAction.operation
      : null;
  const actionName =
    lastFailoverAction && typeof lastFailoverAction === "object" && typeof lastFailoverAction.action === "string"
      ? lastFailoverAction.action
      : null;
  const actionOutcome =
    lastFailoverAction && typeof lastFailoverAction === "object" && typeof lastFailoverAction.outcome === "string"
      ? lastFailoverAction.outcome
      : null;

  setText(el.operatorUiExecutorState, serviceState);
  setText(el.operatorUiExecutorHealthy, healthy ? "yes" : "no");
  setText(el.operatorUiExecutorProfile, `${profileName}/${profileEnv}`);
  setText(el.operatorUiExecutorVersion, version);
  setText(el.operatorUiExecutorLastAction, actionOperation ?? actionName ?? "-");
  setText(el.operatorUiExecutorLastOutcome, actionOutcome ?? "-");

  let statusVariant = "ok";
  let hintVariant = "ok";
  let hint = "ui-executor is ready. No manual failover action required.";

  if (!healthy) {
    statusVariant = "fail";
    hintVariant = "fail";
    hint =
      "ui-executor is unavailable. Use admin failover: target `ui-executor` -> `Failover Drain`, then `Failover Warmup` after health recovery.";
  } else if (serviceState === "draining") {
    statusVariant = "neutral";
    hintVariant = "warn";
    hint = "ui-executor is draining. Run `Failover Warmup` when safe to accept new execute requests.";
  } else if (actionOutcome === "failed" || actionOutcome === "denied") {
    statusVariant = "fail";
    hintVariant = "fail";
    hint = `Last ui-executor failover action ended as ${actionOutcome}. Re-run action with admin role and verify service health.`;
  } else if (serviceState !== "ready") {
    statusVariant = "neutral";
    hintVariant = "warn";
    hint = "ui-executor state is not ready. Refresh summary and verify failover sequence.";
  }

  setStatusPill(
    el.operatorUiExecutorStatus,
    `state=${serviceState} healthy=${healthy ? "yes" : "no"}`,
    statusVariant,
  );
  setOperatorUiExecutorHint(hint, hintVariant);
}

function renderOperatorDeviceNodesWidget(deviceNodesSummary) {
  if (!deviceNodesSummary || typeof deviceNodesSummary !== "object") {
    resetOperatorDeviceNodesWidget("no_data");
    return;
  }

  const total = Number(deviceNodesSummary.total ?? 0);
  const online = Number(deviceNodesSummary.statusCounts?.online ?? 0);
  const degraded = Number(deviceNodesSummary.statusCounts?.degraded ?? 0);
  const offline = Number(deviceNodesSummary.statusCounts?.offline ?? 0);
  const stale = Number(deviceNodesSummary.staleCount ?? 0);
  const missingHeartbeat = Number(deviceNodesSummary.missingHeartbeatCount ?? 0);
  const staleThresholdMs = Number(deviceNodesSummary.staleThresholdMs ?? 0);
  const maxAgeMsRaw = Number(deviceNodesSummary.lastSeenMaxAgeMs ?? Number.NaN);
  const maxAgeMs = Number.isFinite(maxAgeMsRaw) ? Math.max(0, Math.floor(maxAgeMsRaw)) : null;

  setText(el.operatorDeviceNodesTotal, String(Math.max(0, Math.floor(total))));
  setText(el.operatorDeviceNodesOnline, String(Math.max(0, Math.floor(online))));
  setText(el.operatorDeviceNodesDegraded, String(Math.max(0, Math.floor(degraded))));
  setText(el.operatorDeviceNodesOffline, String(Math.max(0, Math.floor(offline))));
  setText(el.operatorDeviceNodesStale, String(Math.max(0, Math.floor(stale))));
  setText(el.operatorDeviceNodesMissingHeartbeat, String(Math.max(0, Math.floor(missingHeartbeat))));
  setText(el.operatorDeviceNodesMaxAge, maxAgeMs === null ? "n/a" : `${maxAgeMs} ms`);

  let statusVariant = "ok";
  let statusText = "healthy";
  let hintVariant = "ok";
  let hint = "Device-node fleet is healthy. No manual action required.";

  if (total <= 0) {
    statusVariant = "neutral";
    statusText = "no_nodes";
    hintVariant = "warn";
    hint = "No device nodes registered. Create at least one node for UI execution demos.";
  } else if (offline > 0) {
    statusVariant = "fail";
    statusText = "offline_nodes";
    hintVariant = "fail";
    hint = "One or more device nodes are offline. Recover node availability or reroute execution before demo.";
  } else if (degraded > 0 || stale > 0 || missingHeartbeat > 0) {
    statusVariant = "neutral";
    statusText = "degraded";
    hintVariant = "warn";
    hint = `Fleet has degraded signals. Send heartbeat/update and verify stale threshold (${staleThresholdMs} ms).`;
  }

  setStatusPill(
    el.operatorDeviceNodesStatus,
    `${statusText} total=${Math.max(0, Math.floor(total))}`,
    statusVariant,
  );
  setOperatorDeviceNodesHint(hint, hintVariant);
}

function renderOperatorDeviceNodeUpdatesWidget(deviceNodeUpdatesSummary) {
  if (!deviceNodeUpdatesSummary || typeof deviceNodeUpdatesSummary !== "object") {
    resetOperatorDeviceNodeUpdatesWidget("no_data");
    return;
  }

  const total = Math.max(0, Math.floor(Number(deviceNodeUpdatesSummary.total ?? 0) || 0));
  const upsertTotal = Math.max(0, Math.floor(Number(deviceNodeUpdatesSummary.upsertTotal ?? 0) || 0));
  const heartbeatTotal = Math.max(0, Math.floor(Number(deviceNodeUpdatesSummary.heartbeatTotal ?? 0) || 0));
  const uniqueNodes = Math.max(0, Math.floor(Number(deviceNodeUpdatesSummary.uniqueNodes ?? 0) || 0));
  const latest = deviceNodeUpdatesSummary.latest && typeof deviceNodeUpdatesSummary.latest === "object"
    ? deviceNodeUpdatesSummary.latest
    : null;
  const latestAction = latest && typeof latest.action === "string" ? latest.action : "n/a";
  const latestOutcome = latest && typeof latest.outcome === "string" ? latest.outcome : "n/a";
  const latestNodeId = latest && typeof latest.nodeId === "string" ? latest.nodeId : "n/a";
  const latestSeenAt = latest && typeof latest.createdAt === "string" ? latest.createdAt : "n/a";
  const validated = deviceNodeUpdatesSummary.validated === true;
  const hasUpsert = deviceNodeUpdatesSummary.hasUpsert === true;
  const hasHeartbeat = deviceNodeUpdatesSummary.hasHeartbeat === true;

  setText(el.operatorDeviceNodeUpdatesTotal, String(total));
  setText(el.operatorDeviceNodeUpdatesUpsert, String(upsertTotal));
  setText(el.operatorDeviceNodeUpdatesHeartbeat, String(heartbeatTotal));
  setText(el.operatorDeviceNodeUpdatesUniqueNodes, String(uniqueNodes));
  setText(el.operatorDeviceNodeUpdatesLatest, `${latestAction}/${latestOutcome} node=${latestNodeId}`);
  setText(el.operatorDeviceNodeUpdatesSeenAt, latestSeenAt);

  let statusVariant = "ok";
  let statusText = "validated";
  let hintVariant = "ok";
  let hint = "Updates evidence is complete: both upsert and heartbeat lifecycle actions are visible.";

  if (total <= 0) {
    statusVariant = "neutral";
    statusText = "no_evidence";
    hintVariant = "warn";
    hint = "No device-node updates evidence yet. Run create/update and heartbeat actions from Operator Console.";
  } else if (!validated || !hasUpsert || !hasHeartbeat || total < 2) {
    statusVariant = "neutral";
    statusText = "partial";
    hintVariant = "warn";
    hint = "Partial updates evidence. Ensure both device_node_upsert and device_node_heartbeat are present.";
  }

  setStatusPill(el.operatorDeviceNodeUpdatesStatus, `${statusText} total=${total}`, statusVariant);
  setOperatorDeviceNodeUpdatesHint(hint, hintVariant);
}

function extractTopCounterEntry(counters) {
  if (!counters || typeof counters !== "object") {
    return null;
  }
  let topKey = null;
  let topValue = -1;
  for (const [key, value] of Object.entries(counters)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      continue;
    }
    if (numeric > topValue) {
      topValue = numeric;
      topKey = key;
    }
  }
  if (!topKey || topValue < 0) {
    return null;
  }
  return {
    key: topKey,
    value: Math.floor(topValue),
  };
}

function renderOperatorTraceWidget(traces) {
  if (!traces || typeof traces !== "object") {
    resetOperatorTraceWidget("no_data");
    return;
  }
  const totals = traces.totals && typeof traces.totals === "object" ? traces.totals : {};
  const runs = Number(totals.runsConsidered ?? 0);
  const events = Number(totals.eventsConsidered ?? 0);
  const uiRuns = Number(totals.uiTraceRuns ?? 0);
  const approvals = Number(totals.approvalLinkedRuns ?? 0);
  const traceSteps = Number(totals.traceSteps ?? 0);
  const screenshots = Number(totals.screenshotRefs ?? 0);
  const errorRuns = Number(totals.errorRuns ?? 0);
  const topRoute = extractTopCounterEntry(traces.byRoute);
  const topStatus = extractTopCounterEntry(traces.byStatus);

  setText(el.operatorTraceRuns, String(Math.max(0, Math.floor(runs))));
  setText(el.operatorTraceEvents, String(Math.max(0, Math.floor(events))));
  setText(el.operatorTraceUiRuns, String(Math.max(0, Math.floor(uiRuns))));
  setText(el.operatorTraceApprovals, String(Math.max(0, Math.floor(approvals))));
  setText(el.operatorTraceSteps, String(Math.max(0, Math.floor(traceSteps))));
  setText(el.operatorTraceScreenshots, String(Math.max(0, Math.floor(screenshots))));
  setText(
    el.operatorTraceTopRoute,
    topRoute ? `${topRoute.key} (${topRoute.value})` : "n/a",
  );
  setText(
    el.operatorTraceTopStatus,
    topStatus ? `${topStatus.key} (${topStatus.value})` : "n/a",
  );

  let statusVariant = "ok";
  let statusText = "covered";
  let hintVariant = "ok";
  let hint = "Trace coverage looks healthy for operator diagnostics.";

  if (runs <= 0) {
    statusVariant = "neutral";
    statusText = "no_runs";
    hintVariant = "warn";
    hint = "No runs available in trace summary yet. Run at least one live/story/ui scenario.";
  } else if (events <= 0) {
    statusVariant = "neutral";
    statusText = "no_events";
    hintVariant = "warn";
    hint = "Runs are present but event coverage is empty. Refresh summary and verify event persistence.";
  } else if (uiRuns <= 0 || traceSteps <= 0 || screenshots <= 0) {
    statusVariant = "neutral";
    statusText = "partial";
    hintVariant = "warn";
    hint = "Trace coverage is partial. Ensure UI runs include trace steps and screenshot references.";
  }

  if (errorRuns > 0) {
    if (errorRuns >= runs) {
      statusVariant = "fail";
      statusText = "error_heavy";
      hintVariant = "fail";
      hint = "Most traced runs ended with errors. Investigate recent trace failures before demo.";
    } else if (statusVariant === "ok") {
      statusVariant = "neutral";
      statusText = "warnings";
      hintVariant = "warn";
      hint = "Trace coverage is present but includes error runs. Verify retry/failover readiness.";
    }
  }

  setStatusPill(
    el.operatorTraceStatus,
    `${statusText} runs=${Math.max(0, Math.floor(runs))} events=${Math.max(0, Math.floor(events))}`,
    statusVariant,
  );
  setOperatorTraceHint(hint, hintVariant);
}

function buildApprovalStatusCountsFromRecent(recentApprovals) {
  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    timeout: 0,
  };
  if (!Array.isArray(recentApprovals)) {
    return counts;
  }
  for (const item of recentApprovals) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const status = typeof item.status === "string" ? item.status : "";
    if (status === "pending") {
      counts.pending += 1;
    } else if (status === "approved") {
      counts.approved += 1;
    } else if (status === "rejected") {
      counts.rejected += 1;
    } else if (status === "timeout") {
      counts.timeout += 1;
    }
  }
  return counts;
}

function renderOperatorApprovalsWidget(approvalsSummary) {
  if (!approvalsSummary || typeof approvalsSummary !== "object") {
    resetOperatorApprovalsWidget("no_data");
    return;
  }

  const total = Number(approvalsSummary.total ?? 0);
  const pendingFromTasks = Number(approvalsSummary.pendingFromTasks ?? 0);
  const recentApprovals = Array.isArray(approvalsSummary.recent) ? approvalsSummary.recent : [];
  const providedCounts = approvalsSummary.statusCounts && typeof approvalsSummary.statusCounts === "object"
    ? approvalsSummary.statusCounts
    : null;
  const fallbackCounts = buildApprovalStatusCountsFromRecent(recentApprovals);
  const pending = Number(providedCounts?.pending ?? fallbackCounts.pending);
  const approved = Number(providedCounts?.approved ?? fallbackCounts.approved);
  const rejected = Number(providedCounts?.rejected ?? fallbackCounts.rejected);
  const timeout = Number(providedCounts?.timeout ?? fallbackCounts.timeout);
  const sweep = approvalsSummary.slaSweep && typeof approvalsSummary.slaSweep === "object"
    ? approvalsSummary.slaSweep
    : null;
  const softReminders = Number(sweep?.softReminders ?? 0);
  const hardTimeouts = Number(sweep?.hardTimeouts ?? 0);
  const latest = approvalsSummary.latest && typeof approvalsSummary.latest === "object"
    ? approvalsSummary.latest
    : recentApprovals.find((item) => item && typeof item === "object") ?? null;
  const latestId = typeof latest?.approvalId === "string" ? latest.approvalId : null;
  const latestStatus = typeof latest?.status === "string" ? latest.status : null;
  const latestUpdatedAt = typeof latest?.updatedAt === "string" ? latest.updatedAt : null;

  setText(el.operatorApprovalsTotal, String(Math.max(0, Math.floor(total))));
  setText(el.operatorApprovalsPending, String(Math.max(0, Math.floor(pending))));
  setText(el.operatorApprovalsApproved, String(Math.max(0, Math.floor(approved))));
  setText(el.operatorApprovalsRejected, String(Math.max(0, Math.floor(rejected))));
  setText(el.operatorApprovalsTimeout, String(Math.max(0, Math.floor(timeout))));
  setText(el.operatorApprovalsPendingFromTasks, String(Math.max(0, Math.floor(pendingFromTasks))));
  setText(
    el.operatorApprovalsSla,
    `${Math.max(0, Math.floor(softReminders))} / ${Math.max(0, Math.floor(hardTimeouts))}`,
  );
  setText(
    el.operatorApprovalsLatest,
    latestId && latestStatus
      ? `${latestId.slice(0, 12)}... ${latestStatus}${latestUpdatedAt ? ` @ ${latestUpdatedAt}` : ""}`
      : "n/a",
  );

  let statusVariant = "ok";
  let statusText = "healthy";
  let hintVariant = "ok";
  let hint = "Approval backlog is healthy. Resume decisions are flowing normally.";

  if (total <= 0) {
    statusVariant = "neutral";
    statusText = "no_approvals";
    hintVariant = "warn";
    hint = "No approvals recorded yet. Trigger a sensitive UI task to validate approval flow.";
  } else if (timeout > 0 || hardTimeouts > 0) {
    statusVariant = "fail";
    statusText = "timeouts";
    hintVariant = "fail";
    hint = "Approval timeouts detected. Review pending queue and SLA thresholds before demo.";
  } else if (pending > 0 || pendingFromTasks > 0) {
    statusVariant = "neutral";
    statusText = "pending";
    hintVariant = "warn";
    hint = "Pending approvals require operator decision. Complete approve/reject flow before final run.";
  } else if (rejected > 0) {
    statusVariant = "neutral";
    statusText = "review";
    hintVariant = "warn";
    hint = "Queue contains rejected approvals. Confirm expected policy behavior in runbook evidence.";
  }

  setStatusPill(
    el.operatorApprovalsStatus,
    `${statusText} total=${Math.max(0, Math.floor(total))} pending=${Math.max(0, Math.floor(pending))}`,
    statusVariant,
  );
  setOperatorApprovalsHint(hint, hintVariant);
}

function parseIsoTimestampMs(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function normalizeLifecycleState(service) {
  if (!service || typeof service !== "object") {
    return "unknown";
  }
  const state = typeof service.state === "string" ? service.state.trim().toLowerCase() : "";
  if (state === "ready" || state === "draining") {
    return state;
  }
  if (service.draining === true) {
    return "draining";
  }
  if (service.ready === true) {
    return "ready";
  }
  return "unknown";
}

function renderOperatorLifecycleWidget(services) {
  if (!Array.isArray(services) || services.length === 0) {
    resetOperatorLifecycleWidget("no_data");
    return;
  }

  let readyCount = 0;
  let drainingCount = 0;
  let unknownCount = 0;
  let unhealthyCount = 0;
  const drainingServices = [];
  let latestChangeTs = null;
  let latestChangeLabel = "n/a";

  for (const item of services) {
    if (!item || typeof item !== "object") {
      unknownCount += 1;
      continue;
    }
    const serviceName = typeof item.name === "string" ? item.name : "service";
    const lifecycleState = normalizeLifecycleState(item);
    const healthy = item.healthy === true;
    if (!healthy) {
      unhealthyCount += 1;
    }

    if (lifecycleState === "ready") {
      readyCount += 1;
    } else if (lifecycleState === "draining") {
      drainingCount += 1;
      drainingServices.push(serviceName);
    } else {
      unknownCount += 1;
    }

    const warmupTs = parseIsoTimestampMs(item.lastWarmupAt);
    if (warmupTs !== null && (latestChangeTs === null || warmupTs > latestChangeTs)) {
      latestChangeTs = warmupTs;
      latestChangeLabel = `${serviceName} warmup @ ${item.lastWarmupAt}`;
    }
    const drainTs = parseIsoTimestampMs(item.lastDrainAt);
    if (drainTs !== null && (latestChangeTs === null || drainTs > latestChangeTs)) {
      latestChangeTs = drainTs;
      latestChangeLabel = `${serviceName} drain @ ${item.lastDrainAt}`;
    }
  }

  setText(el.operatorLifecycleReady, String(readyCount));
  setText(el.operatorLifecycleDraining, String(drainingCount));
  setText(el.operatorLifecycleUnknown, String(unknownCount));
  setText(el.operatorLifecycleLastChange, latestChangeLabel);
  setText(
    el.operatorLifecycleDrainingServices,
    drainingServices.length > 0 ? drainingServices.join(", ") : "none",
  );

  let statusVariant = "ok";
  let statusText = "stable";
  let hintVariant = "ok";
  let hint = "All tracked services are in ready lifecycle state.";

  if (unhealthyCount > 0) {
    statusVariant = "fail";
    statusText = "unhealthy";
    hintVariant = "fail";
    hint = `${unhealthyCount} service(s) unhealthy. Run failover drain/warmup and re-check /healthz before demo.`;
  } else if (drainingCount > 0) {
    statusVariant = "neutral";
    statusText = "draining_active";
    hintVariant = "warn";
    hint = "One or more services are draining. Complete warmup before starting judged flow.";
  } else if (unknownCount > 0) {
    statusVariant = "neutral";
    statusText = "unknown_state";
    hintVariant = "warn";
    hint = "Some services report unknown lifecycle state. Refresh summary and verify /status endpoints.";
  }

  setStatusPill(
    el.operatorLifecycleStatus,
    `${statusText} ready=${readyCount} draining=${drainingCount}`,
    statusVariant,
  );
  setOperatorLifecycleHint(hint, hintVariant);
}

function formatAgeMs(value) {
  if (!Number.isFinite(value) || value < 0) {
    return "n/a";
  }
  if (value < 1000) {
    return `${Math.floor(value)} ms`;
  }
  if (value < 10000) {
    return `${(value / 1000).toFixed(1)} s`;
  }
  return `${Math.round(value / 1000)} s`;
}

function normalizeTaskQueueStatus(value) {
  if (typeof value !== "string") {
    return "other";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "queued" || normalized === "running" || normalized === "pending_approval") {
    return normalized;
  }
  return "other";
}

function normalizeTaskQueuePressureLevel(value) {
  if (typeof value !== "string") {
    return "healthy";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "idle" || normalized === "healthy" || normalized === "elevated" || normalized === "critical") {
    return normalized;
  }
  return "healthy";
}

function buildTaskQueueSummaryFromActiveTasks(activeTasks) {
  if (!Array.isArray(activeTasks)) {
    return null;
  }
  const staleThresholdMs = 30000;
  const thresholds = {
    elevatedActive: 6,
    criticalActive: 12,
    pendingApprovalWarn: 2,
  };
  const nowMs = Date.now();
  let queued = 0;
  let running = 0;
  let pendingApproval = 0;
  let other = 0;
  let staleCount = 0;
  let maxAgeMs = 0;
  let oldestUpdatedAt = null;
  let oldestTaskId = null;
  let oldestTaskStatus = null;

  for (const item of activeTasks) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const status = normalizeTaskQueueStatus(item.status);
    if (status === "queued") {
      queued += 1;
    } else if (status === "running") {
      running += 1;
    } else if (status === "pending_approval") {
      pendingApproval += 1;
    } else {
      other += 1;
    }

    const updatedAtMs = parseIsoTimestampMs(item.updatedAt);
    if (updatedAtMs === null) {
      continue;
    }
    const ageMs = Math.max(0, nowMs - updatedAtMs);
    if (ageMs > maxAgeMs) {
      maxAgeMs = ageMs;
      oldestUpdatedAt = typeof item.updatedAt === "string" ? item.updatedAt : null;
      oldestTaskId = typeof item.taskId === "string" ? item.taskId : null;
      oldestTaskStatus = typeof item.status === "string" ? item.status : null;
    }
    if (ageMs >= staleThresholdMs) {
      staleCount += 1;
    }
  }

  const total = queued + running + pendingApproval + other;
  let pressureLevel = "healthy";
  if (total <= 0) {
    pressureLevel = "idle";
  } else if (staleCount > 0 || total >= thresholds.criticalActive) {
    pressureLevel = "critical";
  } else if (total >= thresholds.elevatedActive || pendingApproval >= thresholds.pendingApprovalWarn) {
    pressureLevel = "elevated";
  }

  return {
    total,
    statusCounts: {
      queued,
      running,
      pendingApproval,
      other,
    },
    staleCount,
    staleThresholdMs,
    maxAgeMs,
    oldestUpdatedAt,
    oldestTaskId,
    oldestTaskStatus,
    pressureLevel,
    thresholds,
  };
}

function renderOperatorTaskQueueWidget(taskQueueSummary) {
  if (!taskQueueSummary || typeof taskQueueSummary !== "object") {
    resetOperatorTaskQueueWidget("no_data");
    return;
  }
  const total = Number(taskQueueSummary.total ?? 0);
  const statusCounts = taskQueueSummary.statusCounts && typeof taskQueueSummary.statusCounts === "object"
    ? taskQueueSummary.statusCounts
    : {};
  const queued = Number(statusCounts.queued ?? 0);
  const running = Number(statusCounts.running ?? 0);
  const pendingApproval = Number(statusCounts.pendingApproval ?? 0);
  const staleCount = Number(taskQueueSummary.staleCount ?? 0);
  const staleThresholdMs = Number(taskQueueSummary.staleThresholdMs ?? 30000);
  const maxAgeMsRaw = Number(taskQueueSummary.maxAgeMs ?? Number.NaN);
  const maxAgeMs = Number.isFinite(maxAgeMsRaw) ? Math.max(0, maxAgeMsRaw) : null;
  const pressureLevel = normalizeTaskQueuePressureLevel(taskQueueSummary.pressureLevel);
  const thresholds = taskQueueSummary.thresholds && typeof taskQueueSummary.thresholds === "object"
    ? taskQueueSummary.thresholds
    : {};
  const elevatedActive = Number(thresholds.elevatedActive ?? 6);
  const pendingApprovalWarn = Number(thresholds.pendingApprovalWarn ?? 2);
  const oldestTaskId =
    typeof taskQueueSummary.oldestTaskId === "string" && taskQueueSummary.oldestTaskId.trim().length > 0
      ? taskQueueSummary.oldestTaskId.trim()
      : null;
  const oldestTaskStatus =
    typeof taskQueueSummary.oldestTaskStatus === "string" && taskQueueSummary.oldestTaskStatus.trim().length > 0
      ? taskQueueSummary.oldestTaskStatus.trim()
      : null;
  const oldestUpdatedAt =
    typeof taskQueueSummary.oldestUpdatedAt === "string" && taskQueueSummary.oldestUpdatedAt.trim().length > 0
      ? taskQueueSummary.oldestUpdatedAt.trim()
      : null;

  setText(el.operatorTaskQueueTotal, String(Math.max(0, Math.floor(total))));
  setText(el.operatorTaskQueueQueued, String(Math.max(0, Math.floor(queued))));
  setText(el.operatorTaskQueueRunning, String(Math.max(0, Math.floor(running))));
  setText(el.operatorTaskQueuePendingApproval, String(Math.max(0, Math.floor(pendingApproval))));
  setText(el.operatorTaskQueueStale, String(Math.max(0, Math.floor(staleCount))));
  setText(el.operatorTaskQueueMaxAge, maxAgeMs === null ? "n/a" : formatAgeMs(maxAgeMs));
  setText(
    el.operatorTaskQueueOldest,
    oldestTaskId
      ? `${oldestTaskId}${oldestTaskStatus ? ` (${oldestTaskStatus})` : ""}${
        oldestUpdatedAt ? ` @ ${oldestUpdatedAt}` : ""
      }`
      : "n/a",
  );

  let statusVariant = "ok";
  let statusText = pressureLevel;
  let hintVariant = "ok";
  let hint = "Task queue pressure is healthy. No recovery action is required.";

  if (total <= 0 || pressureLevel === "idle") {
    statusVariant = "neutral";
    statusText = "idle";
    hintVariant = "warn";
    hint = "No active tasks right now. Run one scenario to keep queue-proof evidence fresh.";
  } else if (pressureLevel === "critical" || staleCount > 0) {
    statusVariant = "fail";
    statusText = "critical";
    hintVariant = "fail";
    hint =
      "Critical queue pressure detected. Use operator cancel/retry and finish pending approvals before judged flow.";
  } else if (pressureLevel === "elevated" || pendingApproval > 0 || queued > running) {
    statusVariant = "neutral";
    statusText = "elevated";
    hintVariant = "warn";
    hint = `Queue pressure is elevated. Keep active tasks below ${Math.max(1, Math.floor(elevatedActive))} and pending approvals below ${Math.max(1, Math.floor(pendingApprovalWarn))}.`;
  }

  if (staleThresholdMs > 0 && statusVariant !== "fail") {
    hint = `${hint} Stale threshold: ${Math.floor(staleThresholdMs)} ms.`;
  }

  setStatusPill(
    el.operatorTaskQueueStatus,
    `${statusText} total=${Math.max(0, Math.floor(total))} stale=${Math.max(0, Math.floor(staleCount))}`,
    statusVariant,
  );
  setOperatorTaskQueueHint(hint, hintVariant);
}

function renderOperatorStartupWidget(startupSummary) {
  if (!startupSummary || typeof startupSummary !== "object") {
    resetOperatorStartupWidget("no_data");
    return;
  }

  const status = typeof startupSummary.status === "string" ? startupSummary.status.trim().toLowerCase() : "healthy";
  const total = Number(startupSummary.total ?? 0);
  const blocking = Number(startupSummary.blockingServices ?? 0);
  const recent = Array.isArray(startupSummary.recent) ? startupSummary.recent : [];
  const latest = recent.length > 0 && recent[0] && typeof recent[0] === "object" ? recent[0] : null;
  const latestType = latest && typeof latest.type === "string" ? latest.type : "n/a";
  const latestService = latest && typeof latest.service === "string" ? latest.service : "n/a";
  const latestCheckedAt = latest && typeof latest.checkedAt === "string" ? latest.checkedAt : "n/a";

  setText(el.operatorStartupTotal, String(Math.max(0, Math.floor(total))));
  setText(el.operatorStartupBlocking, String(Math.max(0, Math.floor(blocking))));
  setText(el.operatorStartupLastType, latestType);
  setText(el.operatorStartupLastService, latestService);
  setText(el.operatorStartupLastCheckedAt, latestCheckedAt);

  let statusVariant = "ok";
  let statusText = "healthy";
  let hintVariant = "ok";
  let hint = "No startup probe failures detected. Operator plane is ready for judged flow.";

  if (Math.max(0, Math.floor(total)) <= 0) {
    statusVariant = "ok";
    statusText = "healthy";
    hintVariant = "ok";
    hint = "No startup probe failures detected. Operator plane is ready for judged flow.";
  } else if (Math.max(0, Math.floor(blocking)) > 0 || status === "critical") {
    statusVariant = "fail";
    statusText = "critical";
    hintVariant = "fail";
    hint = "Blocking startup probe failures detected. Resolve service startup errors before continuing demo.";
  } else {
    statusVariant = "neutral";
    statusText = "degraded";
    hintVariant = "warn";
    hint = "Non-blocking startup probe failures detected. Recheck service health before judged run.";
  }

  setStatusPill(
    el.operatorStartupStatus,
    `${statusText} total=${Math.max(0, Math.floor(total))} blocking=${Math.max(0, Math.floor(blocking))}`,
    statusVariant,
  );
  setOperatorStartupHint(hint, hintVariant);
}

function extractNumber(text, regex) {
  const match = text.match(regex);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function updateOfferFromText(text, isFinal = false) {
  const price = extractNumber(text, /price\D{0,10}(\d+(?:[.,]\d+)?)/i);
  const delivery = extractNumber(text, /delivery\D{0,10}(\d+(?:[.,]\d+)?)/i);
  const sla = extractNumber(text, /sla\D{0,10}(\d+(?:[.,]\d+)?)/i);

  if (isFinal) {
    if (price !== null) {
      setMaybeValue(el.finalPrice, price);
    }
    if (delivery !== null) {
      setMaybeValue(el.finalDelivery, delivery);
    }
    if (sla !== null) {
      setMaybeValue(el.finalSla, sla, "%");
    }
  } else {
    if (price !== null) {
      setMaybeValue(el.currentPrice, price);
    }
    if (delivery !== null) {
      setMaybeValue(el.currentDelivery, delivery);
    }
    if (sla !== null) {
      setMaybeValue(el.currentSla, sla, "%");
    }
  }
}

function setKpiMetricVariant(node, variant = "neutral") {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  node.classList.remove("kpi-value-neutral", "kpi-value-ok", "kpi-value-fail");
  if (variant === "ok") {
    node.classList.add("kpi-value-ok");
    return;
  }
  if (variant === "fail") {
    node.classList.add("kpi-value-fail");
    return;
  }
  node.classList.add("kpi-value-neutral");
}

function resetKpiMetricVariants() {
  setKpiMetricVariant(el.currentPrice, "neutral");
  setKpiMetricVariant(el.currentDelivery, "neutral");
  setKpiMetricVariant(el.currentSla, "neutral");
  setKpiMetricVariant(el.finalPrice, "neutral");
  setKpiMetricVariant(el.finalDelivery, "neutral");
  setKpiMetricVariant(el.finalSla, "neutral");
}

function parseDisplayedNumber(node) {
  if (!node || typeof node.textContent !== "string") {
    return null;
  }
  const cleaned = node.textContent.replace("%", "").trim();
  if (cleaned === "-" || cleaned.length === 0) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCompactNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return normalized.replace(/\.?0+$/, "");
}

function setKpiDeltaBadge(node, text, variant = "neutral") {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  node.textContent = text;
  node.className = "kpi-delta";
  if (variant === "ok") {
    node.classList.add("kpi-delta-ok");
    return;
  }
  if (variant === "fail") {
    node.classList.add("kpi-delta-fail");
    return;
  }
  node.classList.add("kpi-delta-neutral");
}

function setKpiConstraintDelta(node, value, target, comparator, unitSuffix = "") {
  if (value === null || target === null) {
    setKpiDeltaBadge(node, "n/a", "neutral");
    return;
  }
  const deltaRaw = value - target;
  let delta = Number.isFinite(deltaRaw) ? Number(deltaRaw.toFixed(2)) : 0;
  if (Object.is(delta, -0)) {
    delta = 0;
  }
  const deltaText = `${delta >= 0 ? "+" : ""}${formatCompactNumber(delta)}${unitSuffix}`;
  const passed = comparator === "min" ? value >= target : value <= target;
  setKpiDeltaBadge(node, `delta ${deltaText}`, passed ? "ok" : "fail");
}

function setKpiConstraintSourceLabel(text) {
  if (!el.kpiConstraintSource) {
    return;
  }
  el.kpiConstraintSource.textContent = text;
}

function evaluateConstraints() {
  const targetPrice = getNumeric(el.targetPrice);
  const targetDelivery = getNumeric(el.targetDelivery);
  const targetSla = getNumeric(el.targetSla);

  const currentPrice = parseDisplayedNumber(el.currentPrice);
  const currentDelivery = parseDisplayedNumber(el.currentDelivery);
  const currentSla = parseDisplayedNumber(el.currentSla);
  const finalPrice = parseDisplayedNumber(el.finalPrice);
  const finalDelivery = parseDisplayedNumber(el.finalDelivery);
  const finalSla = parseDisplayedNumber(el.finalSla);

  const price = finalPrice ?? currentPrice;
  const delivery = finalDelivery ?? currentDelivery;
  const sla = finalSla ?? currentSla;
  const usingFinalPrice = finalPrice !== null;
  const usingFinalDelivery = finalDelivery !== null;
  const usingFinalSla = finalSla !== null;
  const priceNode = finalPrice !== null ? el.finalPrice : el.currentPrice;
  const deliveryNode = finalDelivery !== null ? el.finalDelivery : el.currentDelivery;
  const slaNode = finalSla !== null ? el.finalSla : el.currentSla;

  resetKpiMetricVariants();
  setKpiConstraintDelta(el.kpiPriceDelta, price, targetPrice, "max");
  setKpiConstraintDelta(el.kpiDeliveryDelta, delivery, targetDelivery, "max", "d");
  setKpiConstraintDelta(el.kpiSlaDelta, sla, targetSla, "min", "pp");
  if (price === null || delivery === null || sla === null) {
    setStatusPill(el.constraintStatus, "Waiting for complete offer", "neutral");
    setKpiConstraintSourceLabel("Evaluating source: none");
    return;
  }

  const okPrice = targetPrice === null ? true : price <= targetPrice;
  const okDelivery = targetDelivery === null ? true : delivery <= targetDelivery;
  const okSla = targetSla === null ? true : sla >= targetSla;

  if (usingFinalPrice && usingFinalDelivery && usingFinalSla) {
    setKpiConstraintSourceLabel("Evaluating source: final_offer");
  } else if (!usingFinalPrice && !usingFinalDelivery && !usingFinalSla) {
    setKpiConstraintSourceLabel("Evaluating source: current_offer");
  } else {
    setKpiConstraintSourceLabel("Evaluating source: mixed_offer");
  }

  setKpiMetricVariant(priceNode, okPrice ? "ok" : "fail");
  setKpiMetricVariant(deliveryNode, okDelivery ? "ok" : "fail");
  setKpiMetricVariant(slaNode, okSla ? "ok" : "fail");

  if (okPrice && okDelivery && okSla) {
    setStatusPill(el.constraintStatus, "Constraints satisfied", "ok");
  } else {
    setStatusPill(el.constraintStatus, "Constraints violated", "fail");
  }
}

function setFallbackAsset(value) {
  state.fallbackAsset = value;
  setStatusPill(
    el.fallbackAssetStatus,
    value ? "fallback_asset=true" : "fallback_asset=false",
    value ? "ok" : "neutral",
  );
}

function setApprovalStatus(text, variant = "neutral") {
  setStatusPill(el.approvalStatus, text, variant);
}

function clearPendingApproval(options = {}) {
  const keepStatus = options.keepStatus === true;
  state.pendingApproval = null;
  el.approvalId.value = "-";
  if (!keepStatus) {
    setApprovalStatus("idle", "neutral");
  }
}

function setPendingApproval(params) {
  const approvalId = typeof params?.approvalId === "string" ? params.approvalId : null;
  if (!approvalId) {
    return;
  }
  state.pendingApproval = {
    approvalId,
    intent: params.intent === "ui_task" ? "ui_task" : "ui_task",
    input: params.input && typeof params.input === "object" ? params.input : {},
  };
  el.approvalId.value = approvalId;
  setApprovalStatus("pending_approval", "fail");
}

function createEnvelope(type, payload, source = "frontend", runOrOptions = state.runId) {
  const options = toEnvelopeOptions(runOrOptions);
  const envelopeId = makeId();
  return {
    id: envelopeId,
    userId: state.userId,
    sessionId: state.sessionId,
    runId: options.runId ?? undefined,
    conversation: options.conversation,
    metadata: {
      clientSentAtMs: Date.now(),
      clientMode: state.mode,
      pttEnabled: state.pttEnabled,
      ...options.metadata,
    },
    type,
    source,
    ts: new Date().toISOString(),
    payload,
  };
}

function sendEnvelope(type, payload, source = "frontend", runOrOptions = state.runId) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    appendTranscript("error", "WebSocket is not connected");
    return;
  }
  const envelope = createEnvelope(type, payload, source, runOrOptions);
  prunePendingClientEvents();
  state.pendingClientEvents.set(envelope.id, {
    type,
    sentAtMs: Date.now(),
    conversation: envelope.conversation,
  });
  if (state.pendingClientEvents.size > 200) {
    const oldestKey = state.pendingClientEvents.keys().next().value;
    if (typeof oldestKey === "string") {
      state.pendingClientEvents.delete(oldestKey);
    }
  }
  state.ws.send(JSON.stringify(envelope));
}

function gatewayHttpBaseFromWs(wsUrl) {
  if (typeof wsUrl !== "string" || wsUrl.trim().length === 0) {
    return "http://localhost:8080";
  }
  const normalized = wsUrl.trim();
  if (normalized.startsWith("wss://")) {
    return normalized.replace(/^wss:\/\//, "https://").replace(/\/realtime\/?$/, "");
  }
  if (normalized.startsWith("ws://")) {
    return normalized.replace(/^ws:\/\//, "http://").replace(/\/realtime\/?$/, "");
  }
  return "http://localhost:8080";
}

async function refreshActiveTasks() {
  const baseUrl = gatewayHttpBaseFromWs(el.wsUrl.value);
  const sessionId = state.sessionId?.trim();
  const params = new URLSearchParams();
  if (sessionId) {
    params.set("sessionId", sessionId);
  }
  params.set("limit", "50");
  const url = `${baseUrl}/tasks/active?${params.toString()}`;

  try {
    const response = await fetch(url, { method: "GET" });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `tasks/active failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const records = Array.isArray(payload?.data) ? payload.data : [];
    state.taskRecords.clear();
    for (const item of records) {
      upsertTaskRecord(item);
    }
    if (!el.operatorTaskId.value.trim() && records.length > 0 && typeof records[0]?.taskId === "string") {
      el.operatorTaskId.value = records[0].taskId;
    }
    renderTaskList();
    appendTranscript("system", `Active tasks refreshed: ${records.length}`);
  } catch (error) {
    appendTranscript("error", `Active tasks refresh failed: ${String(error)}`);
  }
}

function operatorHeaders(includeJson = false) {
  const role = (el.operatorRole.value || "operator").trim().toLowerCase();
  const headers = {
    "x-operator-role": role,
  };
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function requestActionConfirmation(title, details = []) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return true;
  }
  const lines = [String(title ?? "").trim(), ...details.map((item) => String(item ?? "").trim())]
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (lines.length === 0) {
    return true;
  }
  return window.confirm(lines.join("\n"));
}

function renderOperatorSummary(summary) {
  el.operatorSummary.innerHTML = "";
  resetOperatorHealthWidget("no_data");
  resetOperatorUiExecutorWidget("no_data");
  resetOperatorDeviceNodesWidget("no_data");
  resetOperatorDeviceNodeUpdatesWidget("no_data");
  resetOperatorTraceWidget("no_data");
  resetOperatorApprovalsWidget("no_data");
  resetOperatorLifecycleWidget("no_data");
  resetOperatorTaskQueueWidget("no_data");
  resetOperatorGatewayErrorWidget("no_data");
  resetOperatorTurnTruncationWidget("no_data");
  resetOperatorTurnDeleteWidget("no_data");
  resetOperatorDamageControlWidget("no_data");
  resetOperatorSkillsRegistryWidget("no_data");
  resetOperatorPluginMarketplaceWidget("no_data");
  resetOperatorGovernancePolicyWidget("no_data");
  resetOperatorAgentUsageWidget("no_data");
  resetOperatorCostEstimateWidget("no_data");
  resetOperatorStartupWidget("no_data");
  renderOperatorGatewayErrorWidget(state.operatorGatewayErrorSnapshot);
  renderOperatorTurnTruncationWidget(null, state.operatorTurnTruncationSnapshot);
  renderOperatorTurnDeleteWidget(null, state.operatorTurnDeleteSnapshot);
  renderOperatorDamageControlWidget(null, state.operatorDamageControlSnapshot);
  renderOperatorDeviceNodeUpdatesWidget(null);
  renderOperatorSkillsRegistryWidget(null);
  renderOperatorPluginMarketplaceWidget(null);
  renderOperatorGovernancePolicyWidget(null);
  renderOperatorAgentUsageWidget(null);
  renderOperatorCostEstimateWidget(null);
  if (!summary || typeof summary !== "object") {
    appendEntry(el.operatorSummary, "error", "operator.summary", "No summary data");
    return;
  }

  const role = typeof summary.role === "string" ? summary.role : "unknown";
  const generatedAt = typeof summary.generatedAt === "string" ? summary.generatedAt : new Date().toISOString();
  appendEntry(el.operatorSummary, "system", "summary", `role=${role} generatedAt=${generatedAt}`);

  const activeTasks = summary.activeTasks?.data;
  const activeTotal = Number(summary.activeTasks?.total ?? 0);
  appendEntry(el.operatorSummary, "system", "tasks", `active=${activeTotal}`);
  const taskQueueSummary = summary.taskQueue && typeof summary.taskQueue === "object"
    ? summary.taskQueue
    : buildTaskQueueSummaryFromActiveTasks(Array.isArray(activeTasks) ? activeTasks : []);
  if (taskQueueSummary && typeof taskQueueSummary === "object") {
    const queueTotal = Number(taskQueueSummary.total ?? activeTotal);
    const queuePendingApproval = Number(taskQueueSummary.statusCounts?.pendingApproval ?? 0);
    const queueStale = Number(taskQueueSummary.staleCount ?? 0);
    appendEntry(
      el.operatorSummary,
      queueStale > 0 ? "error" : "system",
      "task_queue_pressure",
      `total=${queueTotal} pending_approval=${queuePendingApproval} stale=${queueStale}`,
    );
  }
  if (Array.isArray(activeTasks) && activeTasks.length > 0) {
    const firstTask = activeTasks.find((item) => item && typeof item.taskId === "string");
    if (firstTask && !el.operatorTaskId.value.trim()) {
      el.operatorTaskId.value = firstTask.taskId;
    }
  }

  const pendingApprovals = Number(summary.approvals?.pendingFromTasks ?? 0);
  const approvalsTotal = Number(summary.approvals?.total ?? 0);
  appendEntry(
    el.operatorSummary,
    "system",
    "approvals",
    `recorded=${approvalsTotal} pending_from_tasks=${pendingApprovals}`,
  );
  const turnTruncation = summary.turnTruncation && typeof summary.turnTruncation === "object"
    ? summary.turnTruncation
    : null;
  if (turnTruncation) {
    const truncationTotal = Number(turnTruncation.total ?? 0);
    const truncationUniqueRuns = Number(turnTruncation.uniqueRuns ?? 0);
    const truncationUniqueSessions = Number(turnTruncation.uniqueSessions ?? 0);
    appendEntry(
      el.operatorSummary,
      truncationTotal > 0 ? "system" : "error",
      "turn_truncation",
      `total=${Math.max(0, Math.floor(truncationTotal))} unique_runs=${Math.max(0, Math.floor(truncationUniqueRuns))} unique_sessions=${Math.max(0, Math.floor(truncationUniqueSessions))}`,
    );
    const truncationLatest = turnTruncation.latest && typeof turnTruncation.latest === "object"
      ? turnTruncation.latest
      : null;
    if (truncationLatest) {
      const latestTurnId = typeof truncationLatest.turnId === "string" ? truncationLatest.turnId : "n/a";
      const latestReason = typeof truncationLatest.reason === "string" ? truncationLatest.reason : "n/a";
      const latestAudioEndMs = typeof truncationLatest.audioEndMs === "number" ? truncationLatest.audioEndMs : "n/a";
      const latestContentIndex =
        typeof truncationLatest.contentIndex === "number" ? truncationLatest.contentIndex : "n/a";
      const latestSeenAt = typeof truncationLatest.createdAt === "string" ? truncationLatest.createdAt : "n/a";
      appendEntry(
        el.operatorSummary,
        "system",
        "turn_truncation.latest",
        `turn=${latestTurnId} reason=${latestReason} audio_end_ms=${latestAudioEndMs} content_index=${latestContentIndex} seen_at=${latestSeenAt}`,
      );
    }
  }
  renderOperatorTurnTruncationWidget(turnTruncation, state.operatorTurnTruncationSnapshot);
  const turnDelete = summary.turnDelete && typeof summary.turnDelete === "object"
    ? summary.turnDelete
    : null;
  if (turnDelete) {
    const deleteTotal = Number(turnDelete.total ?? 0);
    const deleteUniqueRuns = Number(turnDelete.uniqueRuns ?? 0);
    const deleteUniqueSessions = Number(turnDelete.uniqueSessions ?? 0);
    appendEntry(
      el.operatorSummary,
      deleteTotal > 0 ? "system" : "error",
      "turn_delete",
      `total=${Math.max(0, Math.floor(deleteTotal))} unique_runs=${Math.max(0, Math.floor(deleteUniqueRuns))} unique_sessions=${Math.max(0, Math.floor(deleteUniqueSessions))}`,
    );
    const deleteLatest = turnDelete.latest && typeof turnDelete.latest === "object"
      ? turnDelete.latest
      : null;
    if (deleteLatest) {
      const latestTurnId = typeof deleteLatest.turnId === "string" ? deleteLatest.turnId : "n/a";
      const latestReason = typeof deleteLatest.reason === "string" ? deleteLatest.reason : "n/a";
      const latestScope = typeof deleteLatest.scope === "string" ? deleteLatest.scope : "n/a";
      const latestSeenAt = typeof deleteLatest.createdAt === "string" ? deleteLatest.createdAt : "n/a";
      appendEntry(
        el.operatorSummary,
        "system",
        "turn_delete.latest",
        `turn=${latestTurnId} reason=${latestReason} scope=${latestScope} seen_at=${latestSeenAt}`,
      );
    }
  }
  renderOperatorTurnDeleteWidget(turnDelete, state.operatorTurnDeleteSnapshot);
  const damageControl = summary.damageControl && typeof summary.damageControl === "object"
    ? summary.damageControl
    : null;
  if (damageControl) {
    const damageControlTotal = Number(damageControl.total ?? 0);
    const damageControlUniqueRuns = Number(damageControl.uniqueRuns ?? 0);
    const damageControlUniqueSessions = Number(damageControl.uniqueSessions ?? 0);
    const verdictCounts = damageControl.verdictCounts && typeof damageControl.verdictCounts === "object"
      ? damageControl.verdictCounts
      : {};
    const allowCount = Math.max(0, Math.floor(Number(verdictCounts.allow ?? 0) || 0));
    const askCount = Math.max(0, Math.floor(Number(verdictCounts.ask ?? 0) || 0));
    const blockCount = Math.max(0, Math.floor(Number(verdictCounts.block ?? 0) || 0));
    appendEntry(
      el.operatorSummary,
      damageControlTotal > 0 ? "system" : "error",
      "damage_control",
      `total=${Math.max(0, Math.floor(damageControlTotal))} unique_runs=${Math.max(0, Math.floor(damageControlUniqueRuns))} unique_sessions=${Math.max(0, Math.floor(damageControlUniqueSessions))} allow=${allowCount} ask=${askCount} block=${blockCount}`,
    );
    const damageControlLatest = damageControl.latest && typeof damageControl.latest === "object"
      ? damageControl.latest
      : null;
    if (damageControlLatest) {
      const latestVerdict = typeof damageControlLatest.verdict === "string" ? damageControlLatest.verdict : "n/a";
      const latestSource = typeof damageControlLatest.policySource === "string"
        ? damageControlLatest.policySource
        : typeof damageControlLatest.source === "string"
          ? damageControlLatest.source
          : "n/a";
      const latestMatchedRuleCount = typeof damageControlLatest.matchedRuleCount === "number"
        ? damageControlLatest.matchedRuleCount
        : "n/a";
      const latestSeenAt = typeof damageControlLatest.createdAt === "string" ? damageControlLatest.createdAt : "n/a";
      appendEntry(
        el.operatorSummary,
        "system",
        "damage_control.latest",
        `verdict=${latestVerdict} source=${latestSource} matched_rules=${latestMatchedRuleCount} seen_at=${latestSeenAt}`,
      );
    }
  }
  renderOperatorDamageControlWidget(damageControl, state.operatorDamageControlSnapshot);
  const skillsRegistryLifecycle =
    summary.skillsRegistryLifecycle && typeof summary.skillsRegistryLifecycle === "object"
      ? summary.skillsRegistryLifecycle
      : null;
  if (skillsRegistryLifecycle) {
    const skillsTotal = Number(skillsRegistryLifecycle.total ?? 0);
    const skillsUnique = Number(skillsRegistryLifecycle.uniqueSkills ?? 0);
    const outcomes =
      skillsRegistryLifecycle.outcomes && typeof skillsRegistryLifecycle.outcomes === "object"
        ? skillsRegistryLifecycle.outcomes
        : {};
    const lifecycle =
      skillsRegistryLifecycle.lifecycle && typeof skillsRegistryLifecycle.lifecycle === "object"
        ? skillsRegistryLifecycle.lifecycle
        : {};
    const conflicts =
      skillsRegistryLifecycle.conflicts && typeof skillsRegistryLifecycle.conflicts === "object"
        ? skillsRegistryLifecycle.conflicts
        : {};
    const succeeded = Math.max(0, Math.floor(Number(outcomes.succeeded ?? 0) || 0));
    const denied = Math.max(0, Math.floor(Number(outcomes.denied ?? 0) || 0));
    const failed = Math.max(0, Math.floor(Number(outcomes.failed ?? 0) || 0));
    const created = Math.max(0, Math.floor(Number(lifecycle.created ?? 0) || 0));
    const replay = Math.max(0, Math.floor(Number(lifecycle.idempotentReplay ?? 0) || 0));
    const versionConflict = Math.max(0, Math.floor(Number(conflicts.versionConflict ?? 0) || 0));
    const pluginInvalidPermission = Math.max(
      0,
      Math.floor(Number(conflicts.pluginInvalidPermission ?? 0) || 0),
    );
    appendEntry(
      el.operatorSummary,
      skillsRegistryLifecycle.lifecycleValidated === true ? "system" : "error",
      "skills_registry.lifecycle",
      `total=${Math.max(0, Math.floor(skillsTotal))} unique_skills=${Math.max(0, Math.floor(skillsUnique))} ok=${succeeded} denied=${denied} failed=${failed} created=${created} replay=${replay} version_conflict=${versionConflict} plugin_invalid_permission=${pluginInvalidPermission} validated=${skillsRegistryLifecycle.lifecycleValidated === true}`,
    );
    const skillsLatest =
      skillsRegistryLifecycle.latest && typeof skillsRegistryLifecycle.latest === "object"
        ? skillsRegistryLifecycle.latest
        : null;
    if (skillsLatest) {
      const latestOutcome = typeof skillsLatest.outcome === "string" ? skillsLatest.outcome : "n/a";
      const latestSkillId = typeof skillsLatest.skillId === "string" ? skillsLatest.skillId : "n/a";
      const latestErrorCode = typeof skillsLatest.errorCode === "string" ? skillsLatest.errorCode : "n/a";
      const latestSeenAt = typeof skillsLatest.createdAt === "string" ? skillsLatest.createdAt : "n/a";
      appendEntry(
        el.operatorSummary,
        "system",
        "skills_registry.latest",
        `outcome=${latestOutcome} skill=${latestSkillId} code=${latestErrorCode} seen_at=${latestSeenAt}`,
      );
    }
  }
  renderOperatorSkillsRegistryWidget(skillsRegistryLifecycle);
  const pluginMarketplaceLifecycle =
    summary.pluginMarketplaceLifecycle && typeof summary.pluginMarketplaceLifecycle === "object"
      ? summary.pluginMarketplaceLifecycle
      : null;
  if (pluginMarketplaceLifecycle) {
    const pluginsTotal = Number(pluginMarketplaceLifecycle.total ?? 0);
    const pluginsUnique = Number(pluginMarketplaceLifecycle.uniquePlugins ?? 0);
    const outcomes =
      pluginMarketplaceLifecycle.outcomes && typeof pluginMarketplaceLifecycle.outcomes === "object"
        ? pluginMarketplaceLifecycle.outcomes
        : {};
    const lifecycle =
      pluginMarketplaceLifecycle.lifecycle && typeof pluginMarketplaceLifecycle.lifecycle === "object"
        ? pluginMarketplaceLifecycle.lifecycle
        : {};
    const conflicts =
      pluginMarketplaceLifecycle.conflicts && typeof pluginMarketplaceLifecycle.conflicts === "object"
        ? pluginMarketplaceLifecycle.conflicts
        : {};
    const signingStatusCounts =
      pluginMarketplaceLifecycle.signingStatusCounts &&
      typeof pluginMarketplaceLifecycle.signingStatusCounts === "object"
        ? pluginMarketplaceLifecycle.signingStatusCounts
        : {};
    const permissionTotals =
      pluginMarketplaceLifecycle.permissionTotals &&
      typeof pluginMarketplaceLifecycle.permissionTotals === "object"
        ? pluginMarketplaceLifecycle.permissionTotals
        : {};
    const succeeded = Math.max(0, Math.floor(Number(outcomes.succeeded ?? 0) || 0));
    const denied = Math.max(0, Math.floor(Number(outcomes.denied ?? 0) || 0));
    const failed = Math.max(0, Math.floor(Number(outcomes.failed ?? 0) || 0));
    const created = Math.max(0, Math.floor(Number(lifecycle.created ?? 0) || 0));
    const replay = Math.max(0, Math.floor(Number(lifecycle.idempotentReplay ?? 0) || 0));
    const versionConflict = Math.max(0, Math.floor(Number(conflicts.versionConflict ?? 0) || 0));
    const pluginInvalidPermission = Math.max(
      0,
      Math.floor(Number(conflicts.pluginInvalidPermission ?? 0) || 0),
    );
    const signingVerified = Math.max(
      0,
      Math.floor(Number(signingStatusCounts.verified ?? 0) || 0),
    );
    const signingUnsigned = Math.max(
      0,
      Math.floor(Number(signingStatusCounts.unsigned ?? 0) || 0),
    );
    const signingNone = Math.max(0, Math.floor(Number(signingStatusCounts.none ?? 0) || 0));
    const totalPermissions = Math.max(0, Math.floor(Number(permissionTotals.totalPermissions ?? 0) || 0));
    const entriesWithPermissions = Math.max(
      0,
      Math.floor(Number(permissionTotals.entriesWithPermissions ?? 0) || 0),
    );
    appendEntry(
      el.operatorSummary,
      pluginMarketplaceLifecycle.lifecycleValidated === true ? "system" : "error",
      "plugin_marketplace.lifecycle",
      `total=${Math.max(0, Math.floor(pluginsTotal))} unique_plugins=${Math.max(0, Math.floor(pluginsUnique))} ok=${succeeded} denied=${denied} failed=${failed} created=${created} replay=${replay} version_conflict=${versionConflict} plugin_invalid_permission=${pluginInvalidPermission} signing_verified=${signingVerified} signing_unsigned=${signingUnsigned} signing_none=${signingNone} total_permissions=${totalPermissions} entries_with_permissions=${entriesWithPermissions} validated=${pluginMarketplaceLifecycle.lifecycleValidated === true}`,
    );
    const pluginLatest =
      pluginMarketplaceLifecycle.latest && typeof pluginMarketplaceLifecycle.latest === "object"
        ? pluginMarketplaceLifecycle.latest
        : null;
    if (pluginLatest) {
      const latestOutcome = typeof pluginLatest.outcome === "string" ? pluginLatest.outcome : "n/a";
      const latestPluginId = typeof pluginLatest.pluginId === "string" ? pluginLatest.pluginId : "n/a";
      const latestSigningStatus =
        typeof pluginLatest.signingStatus === "string" ? pluginLatest.signingStatus : "n/a";
      const latestErrorCode = typeof pluginLatest.errorCode === "string" ? pluginLatest.errorCode : "n/a";
      const latestSeenAt = typeof pluginLatest.createdAt === "string" ? pluginLatest.createdAt : "n/a";
      appendEntry(
        el.operatorSummary,
        "system",
        "plugin_marketplace.latest",
        `outcome=${latestOutcome} plugin=${latestPluginId} signing=${latestSigningStatus} code=${latestErrorCode} seen_at=${latestSeenAt}`,
      );
    }
  }
  renderOperatorPluginMarketplaceWidget(pluginMarketplaceLifecycle);
  const governancePolicyLifecycle =
    summary.governancePolicyLifecycle && typeof summary.governancePolicyLifecycle === "object"
      ? summary.governancePolicyLifecycle
      : null;
  if (governancePolicyLifecycle) {
    const governanceTotal = Number(governancePolicyLifecycle.total ?? 0);
    const governanceUniqueTenants = Number(governancePolicyLifecycle.uniqueTenants ?? 0);
    const outcomes =
      governancePolicyLifecycle.outcomes && typeof governancePolicyLifecycle.outcomes === "object"
        ? governancePolicyLifecycle.outcomes
        : {};
    const lifecycle =
      governancePolicyLifecycle.lifecycle && typeof governancePolicyLifecycle.lifecycle === "object"
        ? governancePolicyLifecycle.lifecycle
        : {};
    const conflicts =
      governancePolicyLifecycle.conflicts && typeof governancePolicyLifecycle.conflicts === "object"
        ? governancePolicyLifecycle.conflicts
        : {};
    const succeeded = Math.max(0, Math.floor(Number(outcomes.succeeded ?? 0) || 0));
    const denied = Math.max(0, Math.floor(Number(outcomes.denied ?? 0) || 0));
    const failed = Math.max(0, Math.floor(Number(outcomes.failed ?? 0) || 0));
    const created = Math.max(0, Math.floor(Number(lifecycle.created ?? 0) || 0));
    const replay = Math.max(0, Math.floor(Number(lifecycle.idempotentReplay ?? 0) || 0));
    const versionConflict = Math.max(0, Math.floor(Number(conflicts.versionConflict ?? 0) || 0));
    const idempotencyConflict = Math.max(0, Math.floor(Number(conflicts.idempotencyConflict ?? 0) || 0));
    const tenantScopeForbidden = Math.max(
      0,
      Math.floor(Number(conflicts.tenantScopeForbidden ?? 0) || 0),
    );
    appendEntry(
      el.operatorSummary,
      governancePolicyLifecycle.lifecycleValidated === true ? "system" : "error",
      "governance_policy.lifecycle",
      `total=${Math.max(0, Math.floor(governanceTotal))} unique_tenants=${Math.max(0, Math.floor(governanceUniqueTenants))} ok=${succeeded} denied=${denied} failed=${failed} created=${created} replay=${replay} version_conflict=${versionConflict} idempotency_conflict=${idempotencyConflict} tenant_scope_forbidden=${tenantScopeForbidden} validated=${governancePolicyLifecycle.lifecycleValidated === true}`,
    );
    const governanceLatest =
      governancePolicyLifecycle.latest && typeof governancePolicyLifecycle.latest === "object"
        ? governancePolicyLifecycle.latest
        : null;
    if (governanceLatest) {
      const latestOutcome = typeof governanceLatest.outcome === "string" ? governanceLatest.outcome : "n/a";
      const latestTenantId = typeof governanceLatest.tenantId === "string" ? governanceLatest.tenantId : "n/a";
      const latestComplianceTemplate =
        typeof governanceLatest.complianceTemplate === "string"
          ? governanceLatest.complianceTemplate
          : "n/a";
      const latestErrorCode = typeof governanceLatest.errorCode === "string" ? governanceLatest.errorCode : "n/a";
      const latestSeenAt = typeof governanceLatest.createdAt === "string" ? governanceLatest.createdAt : "n/a";
      appendEntry(
        el.operatorSummary,
        "system",
        "governance_policy.latest",
        `outcome=${latestOutcome} tenant=${latestTenantId} template=${latestComplianceTemplate} code=${latestErrorCode} seen_at=${latestSeenAt}`,
      );
    }
  }
  renderOperatorGovernancePolicyWidget(governancePolicyLifecycle);
  const agentUsage = summary.agentUsage && typeof summary.agentUsage === "object"
    ? summary.agentUsage
    : null;
  if (agentUsage) {
    const usageTotal = Math.max(0, Math.floor(Number(agentUsage.total ?? 0) || 0));
    const usageUniqueRuns = Math.max(0, Math.floor(Number(agentUsage.uniqueRuns ?? 0) || 0));
    const usageUniqueSessions = Math.max(0, Math.floor(Number(agentUsage.uniqueSessions ?? 0) || 0));
    const usageTotalCalls = Math.max(0, Math.floor(Number(agentUsage.totalCalls ?? 0) || 0));
    const usageInputTokens = Math.max(0, Math.floor(Number(agentUsage.inputTokens ?? 0) || 0));
    const usageOutputTokens = Math.max(0, Math.floor(Number(agentUsage.outputTokens ?? 0) || 0));
    const usageTotalTokens = Math.max(
      0,
      Math.floor(Math.max(Number(agentUsage.totalTokens ?? 0) || 0, usageInputTokens + usageOutputTokens)),
    );
    const usageModels = Array.isArray(agentUsage.models)
      ? agentUsage.models
          .filter((item) => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
      : [];
    const usageSource = typeof agentUsage.source === "string" ? agentUsage.source : "n/a";
    const usageValidated = agentUsage.validated === true;
    appendEntry(
      el.operatorSummary,
      usageValidated ? "system" : "error",
      "agent_usage",
      `total=${usageTotal} unique_runs=${usageUniqueRuns} unique_sessions=${usageUniqueSessions} calls=${usageTotalCalls} input_tokens=${usageInputTokens} output_tokens=${usageOutputTokens} total_tokens=${usageTotalTokens} models=${usageModels.join(",") || "n/a"} source=${usageSource} validated=${usageValidated}`,
    );
    const usageLatest = agentUsage.latest && typeof agentUsage.latest === "object"
      ? agentUsage.latest
      : null;
    if (usageLatest) {
      const latestRunId = typeof usageLatest.runId === "string" ? usageLatest.runId : "n/a";
      const latestSessionId = typeof usageLatest.sessionId === "string" ? usageLatest.sessionId : "n/a";
      const latestUsageSource = typeof usageLatest.usageSource === "string" ? usageLatest.usageSource : "n/a";
      const latestSeenAt = typeof usageLatest.createdAt === "string" ? usageLatest.createdAt : "n/a";
      appendEntry(
        el.operatorSummary,
        "system",
        "agent_usage.latest",
        `run=${latestRunId} session=${latestSessionId} usage_source=${latestUsageSource} seen_at=${latestSeenAt}`,
      );
    }
  }
  renderOperatorAgentUsageWidget(agentUsage);
  const costEstimate = summary.costEstimate && typeof summary.costEstimate === "object"
    ? summary.costEstimate
    : null;
  if (costEstimate) {
    const costStatus = typeof costEstimate.status === "string" ? costEstimate.status : "missing";
    const costCurrency = typeof costEstimate.currency === "string" ? costEstimate.currency : "USD";
    const costMode = typeof costEstimate.estimationMode === "string" ? costEstimate.estimationMode : "tokens_only";
    const costValidated = costEstimate.validated === true;
    const costTokens = Math.max(0, Math.floor(Number(costEstimate.totalTokens ?? 0) || 0));
    const costTotalUsd = Number(costEstimate.totalUsd ?? 0);
    const costSource = typeof costEstimate.source === "string" ? costEstimate.source : "operator_summary";
    appendEntry(
      el.operatorSummary,
      costValidated ? "system" : "error",
      "cost_estimate",
      `status=${costStatus} mode=${costMode} currency=${costCurrency} total_tokens=${costTokens} total_usd=${Number.isFinite(costTotalUsd) ? costTotalUsd.toFixed(6) : "n/a"} source=${costSource} validated=${costValidated}`,
    );
    const costSeenAt = typeof costEstimate.latestSeenAt === "string" ? costEstimate.latestSeenAt : "n/a";
    appendEntry(
      el.operatorSummary,
      "system",
      "cost_estimate.latest",
      `seen_at=${costSeenAt} pricing_configured=${costEstimate.pricingConfigured === true}`,
    );
  }
  renderOperatorCostEstimateWidget(costEstimate);
  renderOperatorApprovalsWidget(summary.approvals);
  renderOperatorTaskQueueWidget(taskQueueSummary);
  const startupFailures = summary.startupFailures && typeof summary.startupFailures === "object"
    ? summary.startupFailures
    : null;
  if (startupFailures) {
    const startupTotal = Number(startupFailures.total ?? 0);
    const startupBlocking = Number(startupFailures.blockingServices ?? 0);
    const startupStatus = typeof startupFailures.status === "string" ? startupFailures.status : "healthy";
    appendEntry(
      el.operatorSummary,
      startupBlocking > 0 ? "error" : startupTotal > 0 ? "system" : "system",
      "startup_failures",
      `status=${startupStatus} total=${Math.max(0, Math.floor(startupTotal))} blocking=${Math.max(0, Math.floor(startupBlocking))}`,
    );
    const startupRecent = Array.isArray(startupFailures.recent) ? startupFailures.recent : [];
    for (const item of startupRecent.slice(0, 2)) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const failureService = typeof item.service === "string" ? item.service : "service";
      const failureEndpoint = typeof item.endpoint === "string" ? item.endpoint : "endpoint";
      const failureType = typeof item.type === "string" ? item.type : "unknown";
      const failureMessage = typeof item.message === "string" ? item.message : "probe failed";
      appendEntry(
        el.operatorSummary,
        "error",
        `startup.${failureService}.${failureEndpoint}`,
        `type=${failureType} message=${failureMessage}`,
      );
    }
  }
  renderOperatorStartupWidget(startupFailures);

  const deviceNodes = summary.deviceNodes && typeof summary.deviceNodes === "object"
    ? summary.deviceNodes
    : null;
  if (deviceNodes) {
    const total = Number(deviceNodes.total ?? 0);
    const online = Number(deviceNodes.statusCounts?.online ?? 0);
    const degraded = Number(deviceNodes.statusCounts?.degraded ?? 0);
    const offline = Number(deviceNodes.statusCounts?.offline ?? 0);
    const stale = Number(deviceNodes.staleCount ?? 0);
    const missingHeartbeat = Number(deviceNodes.missingHeartbeatCount ?? 0);
    const staleThresholdMs = Number(deviceNodes.staleThresholdMs ?? 0);
    const maxAgeMsRaw = Number(deviceNodes.lastSeenMaxAgeMs ?? Number.NaN);
    const maxAgeMs = Number.isFinite(maxAgeMsRaw) ? maxAgeMsRaw : null;
    appendEntry(
      el.operatorSummary,
      degraded > 0 || stale > 0 ? "error" : "system",
      "device_nodes_health",
      `total=${total} online=${online} degraded=${degraded} offline=${offline} stale=${stale} missing_heartbeat=${missingHeartbeat} stale_threshold_ms=${staleThresholdMs} max_age_ms=${maxAgeMs === null ? "n/a" : maxAgeMs}`,
    );
    const recentNodes = Array.isArray(deviceNodes.recent) ? deviceNodes.recent : [];
    for (const node of recentNodes.slice(0, 3)) {
      if (!node || typeof node !== "object") {
        continue;
      }
      const nodeId = typeof node.nodeId === "string" ? node.nodeId : "node";
      const nodeStatus = typeof node.status === "string" ? node.status : "unknown";
      const nodeKind = typeof node.kind === "string" ? node.kind : "unknown";
      const nodeVersion = Number(node.version ?? Number.NaN);
      const nodeLastSeen = typeof node.lastSeenAt === "string" ? node.lastSeenAt : "n/a";
      appendEntry(
        el.operatorSummary,
        nodeStatus === "degraded" || nodeStatus === "offline" ? "error" : "system",
        `device.${nodeId}`,
        `status=${nodeStatus} kind=${nodeKind} version=${Number.isFinite(nodeVersion) ? nodeVersion : "n/a"} last_seen=${nodeLastSeen}`,
      );
    }
  }
  renderOperatorDeviceNodesWidget(deviceNodes);
  const deviceNodeUpdates = summary.deviceNodeUpdates && typeof summary.deviceNodeUpdates === "object"
    ? summary.deviceNodeUpdates
    : null;
  if (deviceNodeUpdates) {
    const updatesTotal = Math.max(0, Math.floor(Number(deviceNodeUpdates.total ?? 0) || 0));
    const updatesUpsert = Math.max(0, Math.floor(Number(deviceNodeUpdates.upsertTotal ?? 0) || 0));
    const updatesHeartbeat = Math.max(0, Math.floor(Number(deviceNodeUpdates.heartbeatTotal ?? 0) || 0));
    const updatesUniqueNodes = Math.max(0, Math.floor(Number(deviceNodeUpdates.uniqueNodes ?? 0) || 0));
    const updatesValidated = deviceNodeUpdates.validated === true;
    appendEntry(
      el.operatorSummary,
      updatesValidated ? "system" : "error",
      "device_nodes_updates",
      `total=${updatesTotal} upsert=${updatesUpsert} heartbeat=${updatesHeartbeat} unique_nodes=${updatesUniqueNodes} validated=${updatesValidated}`,
    );
    const updatesLatest = deviceNodeUpdates.latest && typeof deviceNodeUpdates.latest === "object"
      ? deviceNodeUpdates.latest
      : null;
    if (updatesLatest) {
      const latestNodeId = typeof updatesLatest.nodeId === "string" ? updatesLatest.nodeId : "n/a";
      const latestAction = typeof updatesLatest.action === "string" ? updatesLatest.action : "n/a";
      const latestOutcome = typeof updatesLatest.outcome === "string" ? updatesLatest.outcome : "n/a";
      const latestSeenAt = typeof updatesLatest.createdAt === "string" ? updatesLatest.createdAt : "n/a";
      appendEntry(
        el.operatorSummary,
        "system",
        "device_nodes_updates.latest",
        `node=${latestNodeId} action=${latestAction} outcome=${latestOutcome} seen_at=${latestSeenAt}`,
      );
    }
  }
  renderOperatorDeviceNodeUpdatesWidget(deviceNodeUpdates);

  const operatorActions = summary.operatorActions && typeof summary.operatorActions === "object"
    ? summary.operatorActions
    : null;
  let uiExecutorLastFailoverAction = null;
  if (operatorActions) {
    const actionTotal = Number(operatorActions.total ?? 0);
    appendEntry(el.operatorSummary, "system", "operator_actions", `recorded=${actionTotal}`);
    const recentActions = Array.isArray(operatorActions.recent) ? operatorActions.recent : [];
    for (const item of recentActions.slice(0, 4)) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const action = typeof item.action === "string" ? item.action : "action";
      const outcome = typeof item.outcome === "string" ? item.outcome : "unknown";
      const actorRole = typeof item.actorRole === "string" ? item.actorRole : "unknown";
      const taskId = typeof item.taskId === "string" ? item.taskId : "-";
      const targetService = typeof item.targetService === "string" ? item.targetService : "-";
      const operation = typeof item.operation === "string" ? item.operation : "-";
      appendEntry(
        el.operatorSummary,
        "system",
        `audit.${action}`,
        `role=${actorRole} outcome=${outcome} task=${taskId} target=${targetService} op=${operation}`,
      );
      if (!uiExecutorLastFailoverAction && action === "failover" && targetService === "ui-executor") {
        uiExecutorLastFailoverAction = item;
      }
    }
  }

  const traces = summary.traces && typeof summary.traces === "object" ? summary.traces : null;
  let liveBridgeHealthForWidget = null;
  if (traces) {
    const totals = traces.totals && typeof traces.totals === "object" ? traces.totals : {};
    const traceRuns = Number(totals.runsConsidered ?? 0);
    const traceEvents = Number(totals.eventsConsidered ?? 0);
    const uiTraceRuns = Number(totals.uiTraceRuns ?? 0);
    const traceApprovals = Number(totals.approvalLinkedRuns ?? 0);
    const traceSteps = Number(totals.traceSteps ?? 0);
    const screenshotRefs = Number(totals.screenshotRefs ?? 0);
    appendEntry(
      el.operatorSummary,
      "system",
      "traces",
      `runs=${traceRuns} events=${traceEvents} ui_runs=${uiTraceRuns} approvals=${traceApprovals} steps=${traceSteps} screenshots=${screenshotRefs}`,
    );

    const recentRuns = Array.isArray(traces.recentRuns) ? traces.recentRuns : [];
    for (const run of recentRuns.slice(0, 5)) {
      if (!run || typeof run !== "object") {
        continue;
      }
      const runId = typeof run.runId === "string" ? run.runId : "run";
      const runRoute = typeof run.route === "string" ? run.route : "unknown";
      const runStatus = typeof run.status === "string" ? run.status : "unknown";
      const runEvents = Number(run.eventCount ?? 0);
      const runTraceSteps = Number(run.traceSteps ?? 0);
      const runShots = Number(run.screenshotRefs ?? 0);
      const runApproval = typeof run.approvalStatus === "string" ? run.approvalStatus : "-";
      appendEntry(
        el.operatorSummary,
        "system",
        `trace.${runId.slice(0, 12)}`,
        `route=${runRoute} status=${runStatus} events=${runEvents} steps=${runTraceSteps} screenshots=${runShots} approval=${runApproval}`,
      );
    }

    const liveBridgeHealth = traces.liveBridgeHealth && typeof traces.liveBridgeHealth === "object"
      ? traces.liveBridgeHealth
      : null;
    if (liveBridgeHealth) {
      liveBridgeHealthForWidget = liveBridgeHealth;
      const bridgeState = typeof liveBridgeHealth.state === "string" ? liveBridgeHealth.state : "unknown";
      const degraded = Number(liveBridgeHealth.degradedEvents ?? 0);
      const recovered = Number(liveBridgeHealth.recoveredEvents ?? 0);
      const watchdogReconnects = Number(liveBridgeHealth.watchdogReconnectEvents ?? 0);
      const errors = Number(liveBridgeHealth.bridgeErrorEvents ?? 0);
      const unavailable = Number(liveBridgeHealth.unavailableEvents ?? 0);
      const connectTimeouts = Number(liveBridgeHealth.connectTimeoutEvents ?? 0);
      const probeStarted = Number(liveBridgeHealth.probeStartedEvents ?? 0);
      const pingSent = Number(liveBridgeHealth.pingSentEvents ?? 0);
      const pongs = Number(liveBridgeHealth.pongEvents ?? 0);
      const pingErrors = Number(liveBridgeHealth.pingErrorEvents ?? 0);
      const lastEventType = typeof liveBridgeHealth.lastEventType === "string" ? liveBridgeHealth.lastEventType : "-";
      const lastEventAt = typeof liveBridgeHealth.lastEventAt === "string" ? liveBridgeHealth.lastEventAt : "-";
      const probeSuccessPct = pingSent > 0 ? Math.round((pongs / pingSent) * 100) : null;
      const probeSuccessText = probeSuccessPct === null ? "n/a" : `${probeSuccessPct}%`;

      appendEntry(
        el.operatorSummary,
        bridgeState === "degraded" ? "error" : "system",
        "live_bridge_health",
        `state=${bridgeState} degraded=${degraded} recovered=${recovered} watchdog_reconnects=${watchdogReconnects} errors=${errors} unavailable=${unavailable} connect_timeouts=${connectTimeouts} probes=${probeStarted} ping_sent=${pingSent} pongs=${pongs} ping_errors=${pingErrors} probe_success=${probeSuccessText} last=${lastEventType}@${lastEventAt}`,
      );
    }
  }
  renderOperatorTraceWidget(traces);
  renderOperatorHealthWidget(liveBridgeHealthForWidget);

  const services = Array.isArray(summary.services) ? summary.services : [];
  let uiExecutorService = null;
  for (const service of services) {
    const name = typeof service.name === "string" ? service.name : "service";
    const healthy = service.healthy === true ? "healthy" : "unavailable";
    const state = typeof service.state === "string" ? service.state : "unknown";
    const profile = service.profile?.profile || "n/a";
    const env = service.profile?.environment || "n/a";
    appendEntry(el.operatorSummary, "system", name, `${healthy} | state=${state} | profile=${profile}/${env}`);
    if (name === "ui-executor") {
      uiExecutorService = service;
    }
  }
  renderOperatorLifecycleWidget(services);
  renderOperatorUiExecutorWidget(uiExecutorService, uiExecutorLastFailoverAction);
}

async function refreshOperatorSummary(options = {}) {
  const markUserRefresh = options?.markUserRefresh === true;
  if (markUserRefresh && state.operatorSummaryUserRefreshed !== true) {
    state.operatorSummaryUserRefreshed = true;
    setOperatorCardsCollapsed(false);
    applyOperatorCardsVisibility();
  }
  syncOperatorSummaryGuide();
  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/operator/summary`, {
      method: "GET",
      headers: operatorHeaders(false),
    });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `operator summary failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    renderOperatorSummary(payload?.data ?? null);
    await refreshDeviceNodes({ silent: true });
    appendTranscript("system", "Operator summary refreshed");
  } catch (error) {
    resetOperatorHealthWidget("summary_error");
    resetOperatorUiExecutorWidget("summary_error");
    resetOperatorDeviceNodesWidget("summary_error");
    resetOperatorDeviceNodeUpdatesWidget("summary_error");
    resetOperatorTraceWidget("summary_error");
    resetOperatorApprovalsWidget("summary_error");
    resetOperatorLifecycleWidget("summary_error");
    resetOperatorTaskQueueWidget("summary_error");
    resetOperatorStartupWidget("summary_error");
    if (state.operatorTurnTruncationSnapshot) {
      renderOperatorTurnTruncationWidget(null, state.operatorTurnTruncationSnapshot);
    } else {
      resetOperatorTurnTruncationWidget("summary_error");
    }
    if (state.operatorTurnDeleteSnapshot) {
      renderOperatorTurnDeleteWidget(null, state.operatorTurnDeleteSnapshot);
    } else {
      resetOperatorTurnDeleteWidget("summary_error");
    }
    if (state.operatorDamageControlSnapshot) {
      renderOperatorDamageControlWidget(null, state.operatorDamageControlSnapshot);
    } else {
      resetOperatorDamageControlWidget("summary_error");
    }
    resetOperatorSkillsRegistryWidget("summary_error");
    resetOperatorPluginMarketplaceWidget("summary_error");
    resetOperatorGovernancePolicyWidget("summary_error");
    resetOperatorAgentUsageWidget("summary_error");
    resetOperatorCostEstimateWidget("summary_error");
    appendTranscript("error", `Operator summary refresh failed: ${String(error)}`);
  } finally {
    applyOperatorCardsVisibility();
    syncOperatorSummaryGuide();
  }
}

async function runOperatorAction(action, data = {}) {
  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/operator/actions`, {
      method: "POST",
      headers: operatorHeaders(true),
      body: JSON.stringify({
        action,
        ...data,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `operator action failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    appendTranscript("system", `Operator action executed: ${action}`);
    if (payload?.data?.taskId && typeof payload.data.taskId === "string") {
      el.operatorTaskId.value = payload.data.taskId;
    }
    await refreshOperatorSummary({ markUserRefresh: true });
  } catch (error) {
    appendTranscript("error", `Operator action failed (${action}): ${String(error)}`);
  }
}

function updateDeviceNodeSelectionMeta(node) {
  if (!node) {
    el.deviceNodeSelectedStatus.textContent = "-";
    el.deviceNodeSelectedVersion.textContent = "-";
    el.deviceNodeSelectedLastSeen.textContent = "-";
    return;
  }
  el.deviceNodeSelectedStatus.textContent = node.status ?? "-";
  el.deviceNodeSelectedVersion.textContent =
    typeof node.version === "number" && Number.isFinite(node.version) ? String(node.version) : "-";
  el.deviceNodeSelectedLastSeen.textContent = node.lastSeenAt ?? "-";
}

function applyDeviceNodeToForm(node) {
  if (!node) {
    updateDeviceNodeSelectionMeta(null);
    return;
  }
  state.selectedDeviceNodeId = node.nodeId.toLowerCase();
  el.deviceNodeId.value = node.nodeId;
  el.deviceNodeDisplayName.value = node.displayName ?? node.nodeId;
  el.deviceNodeKind.value = node.kind === "mobile" ? "mobile" : "desktop";
  el.deviceNodePlatform.value = node.platform ?? "";
  el.deviceNodeExecutorUrl.value = node.executorUrl ?? "";
  el.deviceNodeStatus.value =
    node.status === "offline" || node.status === "degraded" ? node.status : "online";
  el.deviceNodeTrustLevel.value =
    node.trustLevel === "trusted" || node.trustLevel === "untrusted" ? node.trustLevel : "reviewed";
  el.deviceNodeCapabilities.value = Array.isArray(node.capabilities) ? node.capabilities.join(",") : "";
  el.deviceNodeExpectedVersion.value =
    typeof node.version === "number" && Number.isFinite(node.version) ? String(node.version) : "";
  syncCustomSelectControl(el.deviceNodeKind);
  syncCustomSelectControl(el.deviceNodeStatus);
  syncCustomSelectControl(el.deviceNodeTrustLevel);
  updateDeviceNodeSelectionMeta(node);
}

function setDeviceNodeListHint(text) {
  if (!(el.deviceNodeListHint instanceof HTMLElement)) {
    return;
  }
  const normalized = typeof text === "string" && text.trim().length > 0
    ? text.trim()
    : "Device list is empty until the first refresh or node registration.";
  el.deviceNodeListHint.textContent = normalized;
}

function parseIsoTimestampMs(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return Number.NaN;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatDeviceNodeFleetPercent(part, total) {
  if (!Number.isFinite(total) || total <= 0) {
    return "0%";
  }
  const safePart = Number.isFinite(part) ? Math.max(0, Math.floor(part)) : 0;
  return `${Math.round((safePart / total) * 100)}%`;
}

function renderDeviceNodeFleetSummary(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const total = list.length;
  let online = 0;
  let degraded = 0;
  let offline = 0;
  let stale = 0;
  const nowMs = Date.now();

  for (const node of list) {
    const status = typeof node?.status === "string" ? node.status.trim().toLowerCase() : "unknown";
    if (status === "online") {
      online += 1;
    } else if (status === "degraded") {
      degraded += 1;
    } else if (status === "offline") {
      offline += 1;
    }

    const lastSeenMs = parseIsoTimestampMs(node?.lastSeenAt);
    const isStale = !Number.isFinite(lastSeenMs) || nowMs - lastSeenMs > DEVICE_NODE_STALE_AGE_MS;
    if (isStale) {
      stale += 1;
    }
  }

  if (el.deviceNodeFleetTotal) {
    el.deviceNodeFleetTotal.textContent = String(total);
  }
  if (el.deviceNodeFleetOnline) {
    el.deviceNodeFleetOnline.textContent = String(online);
  }
  if (el.deviceNodeFleetOnlinePct) {
    el.deviceNodeFleetOnlinePct.textContent = formatDeviceNodeFleetPercent(online, total);
  }
  if (el.deviceNodeFleetDegraded) {
    el.deviceNodeFleetDegraded.textContent = String(degraded);
  }
  if (el.deviceNodeFleetDegradedPct) {
    el.deviceNodeFleetDegradedPct.textContent = formatDeviceNodeFleetPercent(degraded, total);
  }
  if (el.deviceNodeFleetOffline) {
    el.deviceNodeFleetOffline.textContent = String(offline);
  }
  if (el.deviceNodeFleetOfflinePct) {
    el.deviceNodeFleetOfflinePct.textContent = formatDeviceNodeFleetPercent(offline, total);
  }
  if (el.deviceNodeFleetStale) {
    el.deviceNodeFleetStale.textContent = String(stale);
  }
  if (el.deviceNodeFleetStalePct) {
    el.deviceNodeFleetStalePct.textContent = formatDeviceNodeFleetPercent(stale, total);
  }
}

function normalizeDeviceNodeStatusVariant(status) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "unknown";
  if (normalized === "online") {
    return "ok";
  }
  if (normalized === "offline") {
    return "fail";
  }
  return "neutral";
}

function createDeviceNodeStatusPill(status) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "unknown";
  const variant = normalizeDeviceNodeStatusVariant(normalized);
  const pill = document.createElement("span");
  pill.className = "status-pill";
  pill.classList.add(variant === "ok" ? "status-ok" : variant === "fail" ? "status-fail" : "status-neutral");
  pill.textContent = normalized.length > 0 ? normalized : "unknown";
  return pill;
}

function applyDemoDeviceNodeTemplate() {
  if (el.deviceNodeId && !toOptionalText(el.deviceNodeId.value)) {
    el.deviceNodeId.value = "desktop-main";
  }
  if (el.deviceNodeDisplayName && !toOptionalText(el.deviceNodeDisplayName.value)) {
    el.deviceNodeDisplayName.value = "Desktop Main";
  }
  if (el.deviceNodePlatform && !toOptionalText(el.deviceNodePlatform.value)) {
    el.deviceNodePlatform.value = "windows-11";
  }
  if (el.deviceNodeCapabilities && !toOptionalText(el.deviceNodeCapabilities.value)) {
    el.deviceNodeCapabilities.value = "screen,click,type,scroll";
  }
  if (el.deviceNodeExecutorUrl && !toOptionalText(el.deviceNodeExecutorUrl.value)) {
    el.deviceNodeExecutorUrl.value = "http://localhost:8090/execute";
  }
  if (el.deviceNodeStatus) {
    el.deviceNodeStatus.value = "online";
    syncCustomSelectControl(el.deviceNodeStatus);
  }
  if (el.deviceNodeKind) {
    el.deviceNodeKind.value = "desktop";
    syncCustomSelectControl(el.deviceNodeKind);
  }
  if (el.deviceNodeTrustLevel) {
    el.deviceNodeTrustLevel.value = "reviewed";
    syncCustomSelectControl(el.deviceNodeTrustLevel);
  }
  if (el.deviceNodeId instanceof HTMLElement) {
    el.deviceNodeId.focus();
  }
}

function renderDeviceNodeEmptyState() {
  if (!(el.deviceNodeList instanceof HTMLElement)) {
    return;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "device-node-empty-state";

  const icon = document.createElement("span");
  icon.className = "device-node-empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "Nodes";

  const title = document.createElement("p");
  title.className = "device-node-empty-title";
  title.textContent = "No registered device nodes";

  const hint = document.createElement("p");
  hint.className = "device-node-empty-hint";
  hint.textContent = "Use the template below to register your first execution node for UI demos.";

  const action = document.createElement("button");
  action.type = "button";
  action.className = "button-muted device-node-empty-action";
  action.textContent = "Use Demo Template";
  action.addEventListener("click", applyDemoDeviceNodeTemplate);

  wrapper.append(icon, title, hint, action);
  el.deviceNodeList.append(wrapper);
}

function createDeviceNodeCard(node, isSelected) {
  const status = toOptionalText(node.status) ?? "unknown";
  const capabilities = Array.isArray(node.capabilities) && node.capabilities.length > 0 ? node.capabilities : [];
  const card = document.createElement("button");
  card.type = "button";
  card.className = "device-node-card";
  card.dataset.nodeId = node.nodeId.toLowerCase();
  card.setAttribute("aria-label", `Select device node ${node.nodeId}`);
  if (isSelected) {
    card.classList.add("is-selected");
  }

  const head = document.createElement("div");
  head.className = "device-node-card-head";

  const titleWrap = document.createElement("div");
  titleWrap.className = "device-node-card-title";

  const displayName = document.createElement("strong");
  displayName.textContent = node.displayName ?? node.nodeId;
  const nodeId = document.createElement("span");
  nodeId.textContent = node.nodeId;
  titleWrap.append(displayName, nodeId);

  head.append(titleWrap, createDeviceNodeStatusPill(status));

  const meta = document.createElement("div");
  meta.className = "device-node-card-meta";
  const metaItems = [
    ["Kind", node.kind ?? "unknown"],
    ["Platform", node.platform ?? "unknown"],
    [
      "Version",
      typeof node.version === "number" && Number.isFinite(node.version) ? String(Math.floor(node.version)) : "n/a",
    ],
    ["Trust", node.trustLevel ?? "reviewed"],
    ["Executor", node.executorUrl ?? "n/a"],
    ["Last Seen", node.lastSeenAt ?? "n/a"],
  ];
  for (const [label, value] of metaItems) {
    const row = document.createElement("p");
    row.className = "device-node-card-row";
    const key = document.createElement("span");
    key.className = "device-node-card-key";
    key.textContent = `${label}:`;
    const val = document.createElement("span");
    val.className = "device-node-card-value";
    val.textContent = value;
    row.append(key, val);
    meta.append(row);
  }

  const caps = document.createElement("div");
  caps.className = "device-node-card-caps";
  if (capabilities.length === 0) {
    const emptyCap = document.createElement("span");
    emptyCap.className = "device-node-cap-pill is-empty";
    emptyCap.textContent = "no capabilities";
    caps.append(emptyCap);
  } else {
    for (const cap of capabilities) {
      const capPill = document.createElement("span");
      capPill.className = "device-node-cap-pill";
      capPill.textContent = cap;
      caps.append(capPill);
    }
  }

  card.append(head, meta, caps);
  card.addEventListener("click", () => {
    applyDeviceNodeToForm(node);
    if (!(el.deviceNodeList instanceof HTMLElement)) {
      return;
    }
    const cards = Array.from(el.deviceNodeList.querySelectorAll(".device-node-card"));
    for (const candidate of cards) {
      const matches = (candidate.dataset.nodeId ?? "") === node.nodeId.toLowerCase();
      candidate.classList.toggle("is-selected", matches);
    }
  });

  return card;
}

function renderDeviceNodeList(nodes) {
  const normalizedNodes = Array.isArray(nodes) ? nodes.map(normalizeDeviceNode).filter(Boolean) : [];
  state.deviceNodes.clear();
  for (const node of normalizedNodes) {
    state.deviceNodes.set(node.nodeId.toLowerCase(), node);
  }
  renderDeviceNodeFleetSummary(normalizedNodes);
  el.deviceNodeCount.textContent = String(normalizedNodes.length);
  el.deviceNodeList.innerHTML = "";

  if (normalizedNodes.length === 0) {
    setDeviceNodeListHint("No nodes yet. Use Demo Template and Create / Update Node to bootstrap the lane.");
    renderDeviceNodeEmptyState();
    updateDeviceNodeSelectionMeta(null);
    return;
  }

  setDeviceNodeListHint("Click any node card to load it into the form and run status/heartbeat actions.");
  const selected = state.selectedDeviceNodeId
    ? state.deviceNodes.get(state.selectedDeviceNodeId.toLowerCase()) ?? normalizedNodes[0]
    : normalizedNodes[0];
  applyDeviceNodeToForm(selected);

  for (const node of normalizedNodes) {
    const isSelected = selected?.nodeId?.toLowerCase() === node.nodeId.toLowerCase();
    el.deviceNodeList.append(createDeviceNodeCard(node, isSelected));
  }
}

async function refreshDeviceNodes(options = {}) {
  const silent = options && options.silent === true;
  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/device-nodes?limit=200&includeOffline=true`, {
      method: "GET",
      headers: operatorHeaders(false),
    });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `device nodes list failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const nodes = Array.isArray(payload?.data) ? payload.data : [];
    renderDeviceNodeList(nodes);
    if (!silent) {
      appendTranscript("system", `Device nodes refreshed: ${nodes.length}`);
    }
  } catch (error) {
    appendTranscript("error", `Device nodes refresh failed: ${String(error)}`);
  }
}

async function fetchDeviceNodeStatusFromForm() {
  const nodeId = toOptionalText(el.deviceNodeId.value);
  if (!nodeId) {
    appendTranscript("error", "Device node nodeId is required for status check");
    return;
  }

  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/device-nodes/${encodeURIComponent(nodeId)}`, {
      method: "GET",
      headers: operatorHeaders(false),
    });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `device node status failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const node = normalizeDeviceNode(payload?.data);
    if (!node) {
      throw new Error("Device node response payload is invalid");
    }
    applyDeviceNodeToForm(node);
    appendTranscript("system", `Device node status loaded: ${node.nodeId} (${node.status ?? "unknown"})`);
  } catch (error) {
    appendTranscript("error", `Device node status check failed: ${String(error)}`);
  }
}

async function upsertDeviceNodeFromForm() {
  const nodeId = toOptionalText(el.deviceNodeId.value);
  const displayName = toOptionalText(el.deviceNodeDisplayName.value);
  if (!nodeId || !displayName) {
    appendTranscript("error", "Device node nodeId and displayName are required");
    return;
  }

  const expectedVersionValue = Number(el.deviceNodeExpectedVersion.value);
  const expectedVersion =
    Number.isFinite(expectedVersionValue) && expectedVersionValue >= 1
      ? Math.floor(expectedVersionValue)
      : null;

  let metadata = null;
  try {
    metadata = parseOptionalMetadataJson(el.deviceNodeMetadata.value);
  } catch (error) {
    appendTranscript("error", `Device node metadata JSON is invalid: ${String(error)}`);
    return;
  }

  const payload = {
    nodeId,
    displayName,
    kind: el.deviceNodeKind.value === "mobile" ? "mobile" : "desktop",
    platform: toOptionalText(el.deviceNodePlatform.value),
    executorUrl: toOptionalText(el.deviceNodeExecutorUrl.value),
    status:
      el.deviceNodeStatus.value === "offline" || el.deviceNodeStatus.value === "degraded"
        ? el.deviceNodeStatus.value
        : "online",
    capabilities: parseCapabilitiesCsv(el.deviceNodeCapabilities.value),
    trustLevel:
      el.deviceNodeTrustLevel.value === "trusted" || el.deviceNodeTrustLevel.value === "untrusted"
        ? el.deviceNodeTrustLevel.value
        : "reviewed",
    updatedBy: (el.operatorRole.value || "operator").trim().toLowerCase(),
  };

  if (expectedVersion !== null) {
    payload.expectedVersion = expectedVersion;
  }
  if (metadata !== null) {
    payload.metadata = metadata;
  }

  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/device-nodes`, {
      method: "POST",
      headers: operatorHeaders(true),
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(body, `device node upsert failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const node = normalizeDeviceNode(body?.data);
    if (node) {
      applyDeviceNodeToForm(node);
    }
    appendTranscript("system", `Device node upserted: ${nodeId}`);
    await refreshDeviceNodes({ silent: true });
  } catch (error) {
    appendTranscript("error", `Device node upsert failed: ${String(error)}`);
  }
}

async function probeDeviceNodeConflictFromForm() {
  const nodeId = toOptionalText(el.deviceNodeId.value);
  if (!nodeId) {
    appendTranscript("error", "Device node nodeId is required for conflict probe");
    return;
  }

  const knownNode = state.deviceNodes.get(nodeId.toLowerCase()) ?? null;
  const knownVersionRaw = Number(knownNode?.version ?? Number.NaN);
  const fallbackVersionRaw = Number(el.deviceNodeSelectedVersion.textContent);
  const currentVersion = Number.isFinite(knownVersionRaw)
    ? Math.floor(knownVersionRaw)
    : Number.isFinite(fallbackVersionRaw)
      ? Math.floor(fallbackVersionRaw)
      : Number.NaN;
  if (!Number.isFinite(currentVersion) || currentVersion < 2) {
    appendTranscript(
      "error",
      "Conflict probe requires an existing node with version >= 2. Run create/update first.",
    );
    return;
  }

  const displayName = toOptionalText(el.deviceNodeDisplayName.value) ?? (knownNode?.displayName ?? nodeId);
  let metadata = null;
  try {
    metadata = parseOptionalMetadataJson(el.deviceNodeMetadata.value);
  } catch (error) {
    appendTranscript("error", `Device node metadata JSON is invalid: ${String(error)}`);
    return;
  }

  const staleExpectedVersion = Math.max(1, currentVersion - 1);
  const payload = {
    nodeId,
    displayName,
    kind: el.deviceNodeKind.value === "mobile" ? "mobile" : "desktop",
    platform: toOptionalText(el.deviceNodePlatform.value),
    executorUrl: toOptionalText(el.deviceNodeExecutorUrl.value),
    status:
      el.deviceNodeStatus.value === "offline" || el.deviceNodeStatus.value === "degraded"
        ? el.deviceNodeStatus.value
        : "online",
    capabilities: parseCapabilitiesCsv(el.deviceNodeCapabilities.value),
    trustLevel:
      el.deviceNodeTrustLevel.value === "trusted" || el.deviceNodeTrustLevel.value === "untrusted"
        ? el.deviceNodeTrustLevel.value
        : "reviewed",
    updatedBy: (el.operatorRole.value || "operator").trim().toLowerCase(),
    expectedVersion: staleExpectedVersion,
  };
  if (metadata !== null) {
    payload.metadata = metadata;
  }

  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/device-nodes`, {
      method: "POST",
      headers: operatorHeaders(true),
      body: JSON.stringify(payload),
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (response.status !== 409) {
      const errorText = getApiErrorMessage(
        body,
        `expected 409 conflict but got ${response.status} for stale expectedVersion`,
      );
      throw new Error(String(errorText));
    }
    const errorCode = String(body?.error?.code ?? "");
    const actualVersion = Number(body?.error?.details?.actualVersion ?? Number.NaN);
    if (errorCode !== "API_DEVICE_NODE_VERSION_CONFLICT") {
      throw new Error(`unexpected conflict code: ${errorCode || "unknown"}`);
    }
    const actualVersionText = Number.isFinite(actualVersion) ? String(Math.floor(actualVersion)) : "n/a";
    appendTranscript(
      "system",
      `Device node conflict probe passed: stale=${staleExpectedVersion}, actual=${actualVersionText}`,
    );
    await refreshDeviceNodes({ silent: true });
  } catch (error) {
    appendTranscript("error", `Device node conflict probe failed: ${String(error)}`);
  }
}

async function sendDeviceNodeHeartbeatFromForm() {
  const nodeId = toOptionalText(el.deviceNodeId.value);
  if (!nodeId) {
    appendTranscript("error", "Device node nodeId is required for heartbeat");
    return;
  }

  let metadata = null;
  try {
    metadata = parseOptionalMetadataJson(el.deviceNodeMetadata.value);
  } catch (error) {
    appendTranscript("error", `Device node metadata JSON is invalid: ${String(error)}`);
    return;
  }

  const payload = {
    nodeId,
    status:
      el.deviceNodeStatus.value === "offline" || el.deviceNodeStatus.value === "degraded"
        ? el.deviceNodeStatus.value
        : "online",
  };
  if (metadata !== null) {
    payload.metadata = metadata;
  }

  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/device-nodes/heartbeat`, {
      method: "POST",
      headers: operatorHeaders(true),
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(body, `device node heartbeat failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const node = normalizeDeviceNode(body?.data);
    if (node) {
      applyDeviceNodeToForm(node);
    }
    appendTranscript("system", `Device node heartbeat recorded: ${nodeId}`);
    await refreshDeviceNodes({ silent: true });
  } catch (error) {
    appendTranscript("error", `Device node heartbeat failed: ${String(error)}`);
  }
}

function decodeBase64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new AudioContext();
    state.nextPlayTime = 0;
  }
  return state.audioContext;
}

function playPcm16Chunk(samples, sampleRate = 16000, turnId = null) {
  recordAssistantAudioChunk(samples, sampleRate, turnId);
  const audioContext = ensureAudioContext();
  const floatData = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    floatData[i] = Math.max(-1, Math.min(1, samples[i] / 32768));
  }
  const buffer = audioContext.createBuffer(1, floatData.length, sampleRate);
  buffer.copyToChannel(floatData, 0);

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);

  if (typeof turnId === "string" && turnId.trim().length > 0) {
    const normalizedTurnId = turnId.trim();
    if (state.assistantPlaybackTurnId !== normalizedTurnId) {
      state.assistantPlaybackTurnId = normalizedTurnId;
      state.assistantPlaybackStartedAtMs = Date.now();
      state.assistantPlaybackScheduledMs = 0;
    }
  }
  if (!state.assistantPlaybackStartedAtMs) {
    state.assistantPlaybackStartedAtMs = Date.now();
  }
  state.assistantPlaybackScheduledMs += Math.max(0, Math.round(buffer.duration * 1000));

  const startAt = Math.max(audioContext.currentTime + 0.01, state.nextPlayTime);
  source.start(startAt);
  state.nextPlayTime = startAt + buffer.duration;
  state.assistantIsSpeaking = true;
  renderAssistantActivityStatus();
  scheduleAssistantSpeakingReset();
}

function resetAssistantPlayback() {
  state.nextPlayTime = 0;
  resetPlaybackTracking();
  clearAssistantSpeakingResetTimer();
  state.assistantIsSpeaking = false;
  renderAssistantActivityStatus();
}

function findAudioBase64(upstream) {
  if (!upstream || typeof upstream !== "object") {
    return null;
  }
  const queue = [upstream];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }
    if (typeof current.audioBase64 === "string") {
      return current.audioBase64;
    }
    if (typeof current.chunkBase64 === "string") {
      return current.chunkBase64;
    }
    if (current.audio && typeof current.audio === "object") {
      if (typeof current.audio.chunkBase64 === "string") {
        return current.audio.chunkBase64;
      }
      if (typeof current.audio.audioBase64 === "string") {
        return current.audio.audioBase64;
      }
    }
    for (const value of Object.values(current)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }
  return null;
}

function findTextPayload(value) {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  if (typeof value.text === "string") {
    return value.text;
  }
  if (typeof value.transcript === "string") {
    return value.transcript;
  }
  if (typeof value.message === "string") {
    return value.message;
  }
  for (const nested of Object.values(value)) {
    const found = findTextPayload(nested);
    if (found) {
      return found;
    }
  }
  return null;
}

function getApiErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }
  if (payload.error && typeof payload.error === "object") {
    if (typeof payload.error.message === "string" && payload.error.message.trim().length > 0) {
      return payload.error.message;
    }
  }
  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return payload.message;
  }
  return fallback;
}

function extractGatewayErrorContext(payload) {
  if (!payload || typeof payload !== "object") {
    return { traceId: null, clientEventId: null };
  }
  const traceId =
    typeof payload.traceId === "string" && payload.traceId.trim().length > 0 ? payload.traceId.trim() : null;
  const details = payload.details && typeof payload.details === "object" ? payload.details : null;
  const clientEventId =
    details && typeof details.clientEventId === "string" && details.clientEventId.trim().length > 0
      ? details.clientEventId.trim()
      : null;
  return { traceId, clientEventId };
}

function prunePendingClientEvents(nowMs = Date.now()) {
  if (!(state.pendingClientEvents instanceof Map) || state.pendingClientEvents.size === 0) {
    return;
  }
  for (const [eventId, record] of state.pendingClientEvents.entries()) {
    const sentAtMs = record && typeof record === "object" && typeof record.sentAtMs === "number" ? record.sentAtMs : null;
    if (!Number.isFinite(sentAtMs) || nowMs - sentAtMs > PENDING_CLIENT_EVENT_MAX_AGE_MS) {
      state.pendingClientEvents.delete(eventId);
    }
  }
}

function resolvePendingClientEventContext(clientEventId) {
  if (typeof clientEventId !== "string" || clientEventId.trim().length === 0) {
    return null;
  }

  prunePendingClientEvents();

  const eventId = clientEventId.trim();
  const record = state.pendingClientEvents.get(eventId);
  if (!record || typeof record !== "object") {
    return null;
  }
  state.pendingClientEvents.delete(eventId);

  const sentType = typeof record.type === "string" && record.type.trim().length > 0 ? record.type.trim() : null;
  const conversation =
    typeof record.conversation === "string" && record.conversation.trim().length > 0
      ? record.conversation.trim()
      : null;
  const sentAtMs = typeof record.sentAtMs === "number" ? record.sentAtMs : null;
  const elapsedMsRaw = Number.isFinite(sentAtMs) ? Date.now() - sentAtMs : null;
  const elapsedMs = Number.isFinite(elapsedMsRaw) && elapsedMsRaw >= 0 ? Math.round(elapsedMsRaw) : null;

  return {
    sentType,
    conversation,
    elapsedMs,
  };
}

function handleLiveOutput(upstream, turnId = null) {
  const audioBase64 = findAudioBase64(upstream);
  if (audioBase64) {
    try {
      playPcm16Chunk(decodeBase64ToInt16(audioBase64), 16000, turnId);
    } catch (error) {
      appendTranscript("error", `Audio decode failed: ${String(error)}`);
    }
  }
  const text = findTextPayload(upstream);
  if (text) {
    appendAssistantStreamingText(text);
  }
}

function handleNormalizedLiveOutput(normalized, turnIdFromEvent = null) {
  if (!normalized || typeof normalized !== "object") {
    return;
  }
  const turnId =
    typeof normalized.turnId === "string" && normalized.turnId.trim().length > 0
      ? normalized.turnId.trim()
      : typeof turnIdFromEvent === "string" && turnIdFromEvent.trim().length > 0
        ? turnIdFromEvent.trim()
        : null;
  if (typeof normalized.audioBase64 === "string") {
    try {
      playPcm16Chunk(decodeBase64ToInt16(normalized.audioBase64), 16000, turnId);
    } catch (error) {
      appendTranscript("error", `Audio decode failed: ${String(error)}`);
    }
  }
  if (typeof normalized.text === "string") {
    appendAssistantStreamingText(normalized.text);
  }
  if (normalized.interrupted === true) {
    finalizeAssistantStreamEntry();
    resetAssistantPlayback();
    appendTranscript("system", "Assistant interrupted (normalized signal)");
  }
}

function handleLiveOutputAudioDelta(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.audioBase64 !== "string") {
    return;
  }
  const turnId = typeof payload.turnId === "string" && payload.turnId.trim().length > 0
    ? payload.turnId.trim()
    : null;
  try {
    playPcm16Chunk(decodeBase64ToInt16(payload.audioBase64), 16000, turnId);
  } catch (error) {
    appendTranscript("error", `Audio decode failed: ${String(error)}`);
  }
}

function handleLiveOutputTranscriptDelta(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const text = typeof payload.text === "string"
    ? payload.text
    : typeof payload.delta === "string"
      ? payload.delta
      : typeof payload.transcript === "string"
        ? payload.transcript
        : null;
  if (typeof text === "string" && text.length > 0) {
    appendAssistantStreamingText(text);
  }
}

async function submitApprovalDecision(decision) {
  if (!state.pendingApproval || !state.pendingApproval.approvalId) {
    appendTranscript("error", "No pending approval to process");
    return;
  }

  const apiBaseUrl = normalizeApiBaseUrl(el.apiBaseUrl.value);
  state.apiBaseUrl = apiBaseUrl;
  el.apiBaseUrl.value = apiBaseUrl;

  const reason = el.approvalReason.value.trim();
  const fallbackReason =
    decision === "approved" ? "Approved from demo frontend" : "Rejected from demo frontend";

  setApprovalStatus("submitting", "neutral");

  try {
    const response = await fetch(`${apiBaseUrl}/v1/approvals/resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        approvalId: state.pendingApproval.approvalId,
        userId: state.userId,
        sessionId: state.sessionId,
        runId: state.runId ?? makeId(),
        intent: state.pendingApproval.intent ?? "ui_task",
        decision,
        reason: reason.length > 0 ? reason : fallbackReason,
        input: state.pendingApproval.input ?? {},
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `Approval request failed with status ${response.status}`);
      throw new Error(String(errorText));
    }

    const approval = payload?.data?.approval;
    const approvalDecision = approval?.decision ?? decision;
    appendTranscript(
      "system",
      `Approval ${state.pendingApproval.approvalId} recorded with decision=${approvalDecision}`,
    );

    if (payload?.data?.orchestrator) {
      handleGatewayEvent(payload.data.orchestrator);
    }

    if (approvalDecision === "approved") {
      setApprovalStatus("approved", "ok");
    } else {
      setApprovalStatus("rejected", "fail");
    }

    if (decision === "approved" || approvalDecision === "rejected") {
      clearPendingApproval({ keepStatus: true });
    }
  } catch (error) {
    setApprovalStatus("error", "fail");
    appendTranscript("error", `Approval submit failed: ${String(error)}`);
  }
}

function handleGatewayEvent(event) {
  if (!event || typeof event !== "object") {
    return;
  }

  if (typeof event.userId === "string" && event.userId.trim().length > 0) {
    state.userId = event.userId;
    el.currentUserId.textContent = event.userId;
    el.userId.value = event.userId;
  }

  if (typeof event.runId === "string") {
    state.runId = event.runId;
    el.runId.textContent = event.runId;
  }

  appendEvent(event.type ?? "event", JSON.stringify(event.payload ?? {}, null, 0));

  if (event.type === "gateway.connected") {
    setSessionState("socket_connected");
    appendTranscript("system", "Gateway connected");
    return;
  }

  if (event.type === "session.state") {
    const nextState =
      event.payload && typeof event.payload.state === "string" ? event.payload.state : "unknown";
    const previousState =
      event.payload && typeof event.payload.previousState === "string"
        ? event.payload.previousState
        : null;
    setSessionState(nextState);
    appendTranscript(
      "system",
      previousState ? `Session state: ${previousState} -> ${nextState}` : `Session state: ${nextState}`,
    );
    return;
  }

  if (event.type === "live.bridge.unavailable") {
    finalizeAssistantStreamEntry();
    setMode("text-fallback");
    appendTranscript("system", "Live bridge unavailable. Switched to text fallback.");
    return;
  }

  if (event.type === "live.bridge.chunk_dropped") {
    const modality = event.payload?.modality ?? "unknown";
    const ageMs = event.payload?.ageMs;
    appendTranscript("system", `Dropped stale ${String(modality)} chunk (age ${formatMs(ageMs)})`);
    return;
  }

  if (event.type === "live.metrics.round_trip") {
    appendTranscript("system", `Live round-trip: ${formatMs(event.payload?.roundTripMs)}`);
    return;
  }

  if (event.type === "live.metrics.interrupt_latency") {
    appendTranscript("system", `Interrupt latency: ${formatMs(event.payload?.interruptLatencyMs)}`);
    return;
  }

  if (event.type === "live.turn.completed") {
    finalizeAssistantStreamEntry();
    if (
      typeof event.payload?.turnId === "string" &&
      state.assistantPlaybackTurnId &&
      event.payload.turnId === state.assistantPlaybackTurnId
    ) {
      resetPlaybackTracking();
    }
    const textChars = event.payload?.textChars;
    appendTranscript("system", `Assistant turn completed (${typeof textChars === "number" ? textChars : 0} chars)`);
    return;
  }

  if (event.type === "live.turn.truncated") {
    const turnId = typeof event.payload?.turnId === "string" ? event.payload.turnId : "unknown_turn";
    const audioEndMs = event.payload?.audioEndMs;
    appendTranscript("system", `Assistant turn truncated (${turnId}, audio_end_ms=${formatMs(audioEndMs)})`);
    updateOperatorTurnTruncationWidgetFromEvent(event);
    if (state.assistantPlaybackTurnId && state.assistantPlaybackTurnId === turnId) {
      resetPlaybackTracking();
    }
    return;
  }

  if (event.type === "live.turn.deleted") {
    const turnId = typeof event.payload?.turnId === "string" ? event.payload.turnId : "unknown_turn";
    appendTranscript("system", `Assistant turn deleted (${turnId})`);
    updateOperatorTurnDeleteWidgetFromEvent(event);
    if (state.assistantPlaybackTurnId && state.assistantPlaybackTurnId === turnId) {
      resetPlaybackTracking();
    }
    finalizeAssistantStreamEntry();
    return;
  }

  if (event.type === "live.input.cleared" || event.type === "live.input.committed") {
    const reason = typeof event.payload?.reason === "string" ? event.payload.reason : "n/a";
    appendTranscript("system", `${event.type} (${reason})`);
    return;
  }

  if (event.type === "live.function_call.dispatching") {
    const name = typeof event.payload?.name === "string" ? event.payload.name : "unknown_function";
    const callId = typeof event.payload?.callId === "string" ? event.payload.callId : "n/a";
    const intent = typeof event.payload?.intent === "string" ? event.payload.intent : "unknown_intent";
    appendTranscript("system", `Function dispatching: ${name} (intent=${intent}, callId=${callId})`);
    return;
  }

  if (event.type === "live.function_call.completed") {
    const name = typeof event.payload?.name === "string" ? event.payload.name : "unknown_function";
    const callId = typeof event.payload?.callId === "string" ? event.payload.callId : "n/a";
    const status = typeof event.payload?.status === "string" ? event.payload.status : "unknown";
    appendTranscript("system", `Function dispatch completed: ${name} (status=${status}, callId=${callId})`);
    return;
  }

  if (event.type === "live.function_call.failed") {
    const name = typeof event.payload?.name === "string" ? event.payload.name : "unknown_function";
    const callId = typeof event.payload?.callId === "string" ? event.payload.callId : "n/a";
    const message = typeof event.payload?.message === "string" ? event.payload.message : "function dispatch failed";
    appendTranscript("error", `Function dispatch failed: ${name} (callId=${callId}) ${message}`);
    return;
  }

  if (event.type === "live.function_call") {
    const callId = typeof event.payload?.callId === "string" ? event.payload.callId : makeId();
    const name = typeof event.payload?.name === "string" ? event.payload.name : "unknown_function";
    const autoDispatchMode =
      typeof event.metadata?.autoDispatch === "string" ? event.metadata.autoDispatch : null;
    const argumentsJson =
      typeof event.payload?.argumentsJson === "string" ? event.payload.argumentsJson : "{}";
    if (autoDispatchMode === "gateway_auto_invoke") {
      appendTranscript("system", `Function call requested: ${name} (callId=${callId}, dispatch=gateway)`);
      return;
    }
    appendTranscript("system", `Function call requested: ${name} (callId=${callId}, dispatch=frontend)`);
    sendEnvelope(
      "live.function_call_output",
      {
        callId,
        name,
        output: {
          handledBy: "demo-frontend",
          status: "ok",
          argumentsJson,
        },
      },
      "frontend",
      {
        conversation: event.conversation === "none" ? "none" : "default",
        metadata: {
          parentEventId: event.id,
          functionCallName: name,
        },
      },
    );
    return;
  }

  if (event.type === "live.function_call_output.sent") {
    const name = typeof event.payload?.name === "string" ? event.payload.name : "unknown_function";
    const callId = typeof event.payload?.callId === "string" ? event.payload.callId : "n/a";
    appendTranscript("system", `Function output sent: ${name} (callId=${callId})`);
    return;
  }

  if (event.type === "live.interrupted") {
    finalizeAssistantStreamEntry();
    resetAssistantPlayback();
    appendTranscript("system", "Assistant output interrupted");
    return;
  }

  if (event.type === "live.output.audio.delta") {
    handleLiveOutputAudioDelta(event.payload);
    return;
  }

  if (event.type === "live.output.transcript.delta") {
    handleLiveOutputTranscriptDelta(event.payload);
    return;
  }

  if (event.type === "live.output") {
    const turnId =
      typeof event.payload?.normalized?.turnId === "string"
        ? event.payload.normalized.turnId
        : typeof event.payload?.turnId === "string"
          ? event.payload.turnId
          : null;
    if (event.payload?.normalized) {
      if (event.payload.normalized.granular === true) {
        return;
      }
      handleNormalizedLiveOutput(event.payload.normalized, turnId);
      return;
    }
    handleLiveOutput(event.payload?.upstream, turnId);
    return;
  }

  if (event.type === "orchestrator.response") {
    finalizeAssistantStreamEntry();
    const isOutOfBandResponse = event.conversation === "none";
    const oobTopic =
      typeof event.metadata?.topic === "string"
        ? event.metadata.topic
        : typeof event.metadata?.requestMetadata?.topic === "string"
          ? event.metadata.requestMetadata.topic
          : "oob";
    const output = event.payload?.output;
    if (!isOutOfBandResponse) {
      updateOperatorDamageControlWidgetFromResponse(event);
    }
    if (!isOutOfBandResponse && event.payload?.task) {
      const task = normalizeTaskRecord(event.payload.task);
      if (task) {
        if (task.status === "completed" || task.status === "failed") {
          removeTaskRecord(task.taskId);
        } else {
          upsertTaskRecord(task);
        }
      }
    }
    if (!isOutOfBandResponse && typeof output?.fallbackAsset === "boolean") {
      setFallbackAsset(output.fallbackAsset);
    }
    if (!isOutOfBandResponse && output?.approvalRequired === true && output?.approvalId) {
      appendTranscript("system", `Approval required: ${output.approvalId}`);
      const resumeTemplate =
        output?.resumeRequestTemplate &&
        typeof output.resumeRequestTemplate === "object" &&
        output.resumeRequestTemplate !== null
          ? output.resumeRequestTemplate
          : {};
      setPendingApproval({
        approvalId: output.approvalId,
        intent: resumeTemplate.intent ?? "ui_task",
        input: resumeTemplate.input ?? {},
      });
    } else if (!isOutOfBandResponse && output?.approval && output.approval.decision === "approved") {
      setApprovalStatus("approved", "ok");
      clearPendingApproval({ keepStatus: true });
    } else if (!isOutOfBandResponse && output?.approval && output.approval.decision === "rejected") {
      setApprovalStatus("rejected", "fail");
      clearPendingApproval({ keepStatus: true });
    }
    if (!isOutOfBandResponse && output?.story?.title) {
      appendTranscript("system", `Story title: ${output.story.title}`);
    }
    const storyTimeline = !isOutOfBandResponse && Array.isArray(output?.story?.timeline) ? output.story.timeline : [];
    if (!isOutOfBandResponse && storyTimeline.length > 0) {
      appendTranscript("system", `Story timeline segments: ${storyTimeline.length}`);
    }
    const videoJobs = !isOutOfBandResponse && Array.isArray(output?.mediaJobs?.video) ? output.mediaJobs.video : [];
    const pendingVideoJobs = videoJobs.filter(
      (job) => job && typeof job === "object" && (job.status === "queued" || job.status === "running"),
    ).length;
    if (!isOutOfBandResponse && videoJobs.length > 0) {
      appendTranscript("system", `Story video jobs: ${videoJobs.length} total, ${pendingVideoJobs} pending`);
    }
    if (!isOutOfBandResponse && (storyTimeline.length > 0 || output?.story?.title || videoJobs.length > 0)) {
      setStoryTimelineData({
        title: output?.story?.title ?? state.storyTimelineTitle,
        timeline: storyTimeline,
        pendingVideoJobs,
      });
      if (storyTimeline.length > 0) {
        appendTranscript("system", "Story timeline ready: use scrubber/selector for segment preview.");
      }
    }
    if (!isOutOfBandResponse && output?.delegation?.delegatedRoute) {
      appendTranscript(
        "system",
        `Delegated to ${output.delegation.delegatedRoute} (${output.delegation.delegatedStatus ?? "unknown"})`,
      );
      const delegatedText = findTextPayload(output.delegation.delegatedOutput);
      if (delegatedText) {
        appendTranscript("assistant", delegatedText);
      }
    }
    if (
      !isOutOfBandResponse &&
      output?.visualTesting &&
      typeof output.visualTesting === "object" &&
      output.visualTesting.enabled === true
    ) {
      const checksCount = Array.isArray(output.visualTesting.checks) ? output.visualTesting.checks.length : 0;
      const regressionCount =
        typeof output.visualTesting.regressionCount === "number" ? output.visualTesting.regressionCount : 0;
      appendTranscript(
        "system",
        `Visual testing: ${output.visualTesting.status ?? "unknown"} (checks=${checksCount}, regressions=${regressionCount})`,
      );
      if (Array.isArray(output.visualTesting.checks)) {
        const regressions = output.visualTesting.checks
          .filter((check) => check && typeof check === "object" && check.status === "regression")
          .slice(0, 3);
        for (const check of regressions) {
          const severity = typeof check.severity === "string" ? check.severity : "n/a";
          const category = typeof check.category === "string" ? check.category : "unknown";
          const assertion = typeof check.assertion === "string" ? check.assertion : "unspecified assertion";
          appendTranscript("system", `Regression [${severity}] ${category}: ${assertion}`);
        }
      }
    }

    const text = findTextPayload(output) ?? "orchestrator.response received";
    if (isOutOfBandResponse) {
      appendTranscript("system", `[OOB:${oobTopic}] ${text}`);
      return;
    }
    appendTranscript("assistant", text);
    updateOfferFromText(text, false);
    if (event.payload?.status === "completed") {
      updateOfferFromText(text, true);
    }
    evaluateConstraints();
    return;
  }

  if (event.type === "task.started" || event.type === "task.progress") {
    upsertTaskRecord(event.payload);
    const task = normalizeTaskRecord(event.payload);
    if (task) {
      appendTranscript(
        "system",
        `Task ${task.taskId}: ${task.status} (${task.progressPct}%, stage=${task.stage})`,
      );
    }
    return;
  }

  if (event.type === "task.completed" || event.type === "task.failed") {
    const task = normalizeTaskRecord(event.payload);
    if (task) {
      removeTaskRecord(task.taskId);
      appendTranscript("system", `Task ${task.taskId}: ${task.status}`);
    }
    return;
  }

  if (event.type === "gateway.error" || event.type === "orchestrator.error") {
    const fallbackMessage = findTextPayload(event.payload) ?? "Gateway/Orchestrator error";
    const detailsObj = event.payload && typeof event.payload.details === "object" ? event.payload.details : null;
    const code =
      toOptionalText(event.payload?.code) ??
      toOptionalText(event.payload?.errorCode) ??
      toOptionalText(detailsObj?.code);
    const context = extractGatewayErrorContext(event.payload);
    const pendingContext = resolvePendingClientEventContext(context.clientEventId);
    updateOperatorGatewayErrorWidgetFromEvent(event.type, event.payload, pendingContext);
    const details = [
      code ? `code=${code}` : null,
      context.clientEventId ? `clientEventId=${context.clientEventId}` : null,
      context.traceId ? `traceId=${context.traceId}` : null,
      pendingContext?.sentType ? `clientEventType=${pendingContext.sentType}` : null,
      pendingContext?.conversation ? `conversation=${pendingContext.conversation}` : null,
      pendingContext?.elapsedMs !== null && pendingContext?.elapsedMs !== undefined
        ? `latencyMs=${pendingContext.elapsedMs}`
        : null,
    ]
      .filter((item) => typeof item === "string")
      .join(" ");
    appendTranscript("error", details.length > 0 ? `${fallbackMessage} (${details})` : fallbackMessage);
    return;
  }
}

function connectWebSocket() {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    return;
  }
  const wsUrl = el.wsUrl.value.trim();
  state.wsUrl = wsUrl;
  const ws = new WebSocket(wsUrl);
  state.ws = ws;

  setConnectionStatus("connecting");

  ws.addEventListener("open", () => {
    setConnectionStatus("connected");
    appendTranscript("system", `Connected to ${wsUrl}`);
  });

  ws.addEventListener("close", () => {
    finalizeAssistantStreamEntry();
    resetAssistantPlayback();
    state.pttPressed = false;
    updatePttUi();
    setConnectionStatus("disconnected");
    appendTranscript("system", "WebSocket closed");
    state.pendingClientEvents.clear();
    state.ws = null;
  });

  ws.addEventListener("error", () => {
    finalizeAssistantStreamEntry();
    resetAssistantPlayback();
    state.pttPressed = false;
    updatePttUi();
    setConnectionStatus("error");
    appendTranscript("error", "WebSocket error");
    state.pendingClientEvents.clear();
  });

  ws.addEventListener("message", (raw) => {
    try {
      const parsed = JSON.parse(raw.data);
      handleGatewayEvent(parsed);
    } catch {
      appendTranscript("error", "Received non-JSON frame from gateway");
    }
  });
}

function disconnectWebSocket() {
  if (!state.ws) {
    return;
  }
  state.ws.close();
}

function downsampleTo16k(input, inputRate) {
  if (inputRate === 16000) {
    return input;
  }
  const ratio = inputRate / 16000;
  const outputLength = Math.floor(input.length / ratio);
  const result = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = Math.floor(i * ratio);
    result[i] = input[sourceIndex];
  }
  return result;
}

function float32ToInt16(floatArray) {
  const out = new Int16Array(floatArray.length);
  for (let i = 0; i < floatArray.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floatArray[i]));
    out[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return out;
}

function int16ToBase64(buffer) {
  const bytes = new Uint8Array(buffer.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to read image as data URL"));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Image read failed"));
    };
    reader.readAsDataURL(file);
  });
}

function parseBase64DataUrl(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(trimmed);
  if (!match) {
    return null;
  }
  const mimeType = typeof match[1] === "string" ? match[1].trim() : "";
  const base64 = typeof match[2] === "string" ? match[2].replace(/\s+/g, "") : "";
  if (mimeType.length === 0 || base64.length === 0) {
    return null;
  }
  return {
    mimeType,
    base64,
  };
}

function parseMarkHintsInput(value) {
  if (typeof value !== "string") {
    return [];
  }
  const chunks = value
    .split(/\r?\n|,/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const unique = [];
  const seen = new Set();
  for (const chunk of chunks) {
    if (seen.has(chunk)) {
      continue;
    }
    seen.add(chunk);
    unique.push(chunk);
    if (unique.length >= 80) {
      break;
    }
  }
  return unique;
}

function collectUiTaskOverrides() {
  const url = typeof el.uiTaskUrl?.value === "string" ? el.uiTaskUrl.value.trim() : "";
  const deviceNodeId =
    typeof el.uiTaskDeviceNodeId?.value === "string" ? el.uiTaskDeviceNodeId.value.trim() : "";
  const screenshotRef =
    typeof el.uiTaskScreenshotRef?.value === "string" ? el.uiTaskScreenshotRef.value.trim() : "";
  const domSnapshot =
    typeof el.uiTaskDomSnapshot?.value === "string" ? el.uiTaskDomSnapshot.value.trim() : "";
  const accessibilityTree =
    typeof el.uiTaskAccessibilityTree?.value === "string" ? el.uiTaskAccessibilityTree.value.trim() : "";
  const markHintsRaw =
    typeof el.uiTaskMarkHints?.value === "string" ? el.uiTaskMarkHints.value : "";
  const markHints = parseMarkHintsInput(markHintsRaw);

  const payload = {};
  if (url.length > 0) {
    payload.url = url;
  }
  if (deviceNodeId.length > 0) {
    payload.deviceNodeId = deviceNodeId;
  }
  if (screenshotRef.length > 0) {
    payload.screenshotRef = screenshotRef;
  }
  if (domSnapshot.length > 0) {
    payload.domSnapshot = domSnapshot;
  }
  if (accessibilityTree.length > 0) {
    payload.accessibilityTree = accessibilityTree;
  }
  if (markHints.length > 0) {
    payload.markHints = markHints;
  }
  return payload;
}

function collectLiveSetupOverride() {
  const model =
    typeof el.liveSetupModel?.value === "string"
      ? el.liveSetupModel.value.trim()
      : "";
  const voice =
    typeof el.liveSetupVoice?.value === "string"
      ? el.liveSetupVoice.value.trim()
      : "";
  const activityHandling =
    typeof el.liveSetupActivityHandling?.value === "string"
      ? el.liveSetupActivityHandling.value.trim()
      : "";
  const systemInstruction =
    typeof el.liveSetupInstruction?.value === "string"
      ? el.liveSetupInstruction.value.trim()
      : "";

  const payload = {};
  const summary = [];

  if (model.length > 0) {
    payload.model = model;
    summary.push(`model=${model}`);
  }

  const generationConfig = {};
  if (voice.length > 0) {
    generationConfig.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: voice,
        },
      },
    };
    summary.push(`voice=${voice}`);
  }
  if (activityHandling.length > 0) {
    generationConfig.realtimeInputConfig = {
      activityHandling,
    };
    summary.push(`activity=${activityHandling}`);
  }
  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }

  if (systemInstruction.length > 0) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
    summary.push("systemInstruction=custom");
  }

  return { payload, summary };
}

function sendLiveSetupOverride() {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    appendTranscript("error", "Connect WebSocket before applying live setup");
    return;
  }

  const { payload, summary } = collectLiveSetupOverride();
  if (Object.keys(payload).length === 0) {
    appendTranscript("error", "Provide at least one live setup override field");
    return;
  }

  const requestRunId = makeId();
  state.runId = requestRunId;
  el.runId.textContent = requestRunId;

  sendEnvelope("live.setup", payload, "frontend", requestRunId);
  const details = summary.length > 0 ? summary.join(", ") : "override";
  appendTranscript("system", `live.setup sent (${details})`);
}

async function sendImageFrame() {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    appendTranscript("error", "Connect WebSocket before sending image frame");
    return;
  }

  const fileList = el.imageInput?.files;
  const file = fileList && fileList.length > 0 ? fileList[0] : null;
  if (!file) {
    appendTranscript("error", "Select an image file before sending");
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    sendEnvelope("live.image", {
      dataUrl,
      mimeType: file.type || undefined,
      fileName: file.name || null,
      sentAtMs: Date.now(),
    });
    appendTranscript("system", `Image frame sent (${file.name}, ${file.type || "unknown"})`);
  } catch (error) {
    appendTranscript("error", `Image send failed: ${String(error)}`);
  }
}

async function startMicStream() {
  if (state.micProcessor) {
    return;
  }

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    appendTranscript("error", "Connect WebSocket before starting mic stream");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micContext = new AudioContext();
    const source = micContext.createMediaStreamSource(stream);
    const processor = micContext.createScriptProcessor(4096, 1, 1);
    const gain = micContext.createGain();
    gain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (state.pttEnabled && !state.pttPressed) {
        return;
      }
      const channel = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleTo16k(channel, micContext.sampleRate);
      const pcm16 = float32ToInt16(downsampled);
      const chunkBase64 = int16ToBase64(pcm16);
      sendEnvelope("live.audio", {
        format: "pcm16",
        sampleRate: 16000,
        chunkBase64,
        sentAtMs: Date.now(),
      });
    };

    source.connect(processor);
    processor.connect(gain);
    gain.connect(micContext.destination);

    state.micContext = micContext;
    state.micStream = stream;
    state.micProcessor = processor;
    state.micGain = gain;

    appendTranscript("system", "Mic stream started");
  } catch (error) {
    appendTranscript("error", `Mic start failed: ${String(error)}`);
  }
}

function stopMicStream() {
  const hadActiveMic = Boolean(state.micProcessor);
  if (state.micProcessor) {
    state.micProcessor.disconnect();
    state.micProcessor.onaudioprocess = null;
    state.micProcessor = null;
  }
  if (state.micGain) {
    state.micGain.disconnect();
    state.micGain = null;
  }
  if (state.micStream) {
    for (const track of state.micStream.getTracks()) {
      track.stop();
    }
    state.micStream = null;
  }
  if (state.micContext) {
    state.micContext.close();
    state.micContext = null;
  }
  if (hadActiveMic) {
    if (state.pttEnabled) {
      if (state.pttPressed) {
        state.pttPressed = false;
        sendEnvelope("live.input.commit", {
          reason: "ptt_mic_stopped",
          sentAtMs: Date.now(),
        });
      }
    } else {
      sendEnvelope("live.turn.end", {
        reason: "mic_stopped",
        sentAtMs: Date.now(),
      });
    }
  }
  appendTranscript("system", "Mic stream stopped");
}

function sendIntentRequest(options = {}) {
  const intent = el.intent.value;
  const message = el.message.value.trim();
  const targetLanguage = el.targetLanguage.value.trim();
  const targetPrice = getNumeric(el.targetPrice);
  const targetDelivery = getNumeric(el.targetDelivery);
  const targetSla = getNumeric(el.targetSla);
  const uiTaskOverrides = collectUiTaskOverrides();
  const conversation = toConversationScope(options.conversation);
  const requestMetadata =
    options.metadata && typeof options.metadata === "object" && !Array.isArray(options.metadata)
      ? options.metadata
      : {};

  const input = {
    text: message,
    targetLanguage,
    constraints: {
      maxPrice: targetPrice,
      maxDeliveryDays: targetDelivery,
      minSla: targetSla,
    },
  };
  if (intent === "ui_task") {
    Object.assign(input, uiTaskOverrides);
  }

  appendTranscript("user", message);
  updateOfferFromText(message, false);
  evaluateConstraints();

  const requestRunId = makeId();
  state.runId = requestRunId;
  el.runId.textContent = requestRunId;

  sendEnvelope("orchestrator.request", { intent, input }, "frontend", {
    runId: requestRunId,
    conversation,
    metadata: requestMetadata,
  });

  if (conversation === "none") {
    const topic = typeof requestMetadata.topic === "string" ? requestMetadata.topic : "oob";
    appendTranscript("system", `OOB request dispatched (topic=${topic}, runId=${requestRunId})`);
  }
}

async function sendConversationItemCreate() {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    appendTranscript("error", "Connect WebSocket before sending conversation item");
    return;
  }

  const content = [];
  const message = el.message.value.trim();
  if (message.length > 0) {
    content.push({
      type: "input_text",
      text: message,
    });
  }

  const fileList = el.imageInput?.files;
  const imageFile = fileList && fileList.length > 0 ? fileList[0] : null;
  if (imageFile) {
    try {
      const imageDataUrl = await readFileAsDataUrl(imageFile);
      content.push({
        type: "input_image",
        image_url: imageDataUrl,
      });
    } catch (error) {
      appendTranscript("error", `Image encode failed: ${String(error)}`);
      return;
    }
  }

  const audioFileList = el.audioInput?.files;
  const audioFile = audioFileList && audioFileList.length > 0 ? audioFileList[0] : null;
  if (audioFile) {
    try {
      const audioDataUrl = await readFileAsDataUrl(audioFile);
      const parsedAudio = parseBase64DataUrl(audioDataUrl);
      if (!parsedAudio) {
        appendTranscript("error", "Audio encode failed: invalid data URL payload");
        return;
      }
      content.push({
        type: "input_audio",
        audio: parsedAudio.base64,
        mimeType: parsedAudio.mimeType || audioFile.type || "audio/wav",
      });
    } catch (error) {
      appendTranscript("error", `Audio encode failed: ${String(error)}`);
      return;
    }
  }

  if (content.length === 0) {
    appendTranscript("error", "Provide message text, image, or audio before sending conversation item");
    return;
  }

  const requestRunId = makeId();
  state.runId = requestRunId;
  el.runId.textContent = requestRunId;

  sendEnvelope(
    "conversation.item.create",
    {
      item: {
        type: "message",
        role: "user",
        content,
      },
      turnComplete: true,
      sentAtMs: Date.now(),
    },
    "frontend",
    requestRunId,
  );

  if (message.length > 0) {
    appendTranscript("user", message);
  }
  appendTranscript("system", `conversation.item.create sent (${content.length} part${content.length > 1 ? "s" : ""})`);
}

function sendConversationItemDelete() {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    appendTranscript("error", "Connect WebSocket before deleting conversation item");
    return;
  }

  const turnId = state.assistantPlaybackTurnId;
  sendEnvelope("conversation.item.delete", {
    ...(turnId ? { item_id: turnId } : {}),
    reason: "operator_delete_active_turn",
    sentAtMs: Date.now(),
  });

  finalizeAssistantStreamEntry();
  resetAssistantPlayback();
  appendTranscript("system", `conversation.item.delete sent (${turnId ?? "active_turn"})`);
}

function sendOutOfBandRequest() {
  sendIntentRequest({
    conversation: "none",
    metadata: {
      topic: "assistive_router",
      lane: "oob",
      purpose: "classification_probe",
    },
  });
}

function interruptAssistant(reason = "user_interrupt") {
  const wsReady = Boolean(state.ws && state.ws.readyState === WebSocket.OPEN);
  if (!wsReady) {
    resetAssistantPlayback();
    appendTranscript("error", "WebSocket is not connected");
    return;
  }
  const turnId = state.assistantPlaybackTurnId;
  const audioEndMs = estimateAssistantPlaybackMs();
  if (turnId) {
    sendEnvelope("conversation.item.truncate", {
      item_id: turnId,
      content_index: 0,
      audio_end_ms: audioEndMs,
      reason,
    });
  }
  resetAssistantPlayback();
  sendEnvelope("live.interrupt", { reason });
  appendTranscript("system", "Interrupt requested");
}

function updatePttUi() {
  if (!el.pttToggleBtn || !el.pttHoldBtn) {
    return;
  }
  if (state.pttEnabled) {
    el.pttToggleBtn.textContent = "Disable Push-to-Talk";
    el.pttHoldBtn.disabled = false;
    setPttStatus(state.pttPressed ? "ptt=recording" : "ptt=armed", state.pttPressed ? "ok" : "neutral");
  } else {
    el.pttToggleBtn.textContent = "Enable Push-to-Talk";
    el.pttHoldBtn.disabled = true;
    setPttStatus("ptt=off", "neutral");
  }
}

function togglePushToTalkMode() {
  state.pttEnabled = !state.pttEnabled;
  if (!state.pttEnabled) {
    state.pttPressed = false;
  }
  updatePttUi();
  appendTranscript("system", state.pttEnabled ? "Push-to-talk enabled" : "Push-to-talk disabled");
}

async function startPushToTalk() {
  if (!state.pttEnabled || state.pttPressed) {
    return;
  }
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    appendTranscript("error", "Connect WebSocket before using push-to-talk");
    return;
  }
  if (!state.micProcessor) {
    await startMicStream();
  }
  state.pttPressed = true;
  updatePttUi();
  sendEnvelope("live.input.clear", {
    reason: "ptt_press",
    sentAtMs: Date.now(),
  });
  if (state.assistantIsSpeaking || state.assistantIsStreaming) {
    interruptAssistant("ptt_interrupt");
  }
}

function stopPushToTalk() {
  if (!state.pttEnabled || !state.pttPressed) {
    return;
  }
  state.pttPressed = false;
  updatePttUi();
  sendEnvelope("live.input.commit", {
    reason: "ptt_release",
    sentAtMs: Date.now(),
  });
}

function toggleFallbackMode() {
  if (state.mode === "voice") {
    setMode("text-fallback");
    appendTranscript("system", "Switched to text fallback mode");
  } else {
    setMode("voice");
    appendTranscript("system", "Switched to voice mode");
  }
}

function bindEvents() {
  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tabTarget ?? DEFAULT_TAB_ID);
    });
  }
  document.getElementById("connectBtn").addEventListener("click", connectWebSocket);
  document.getElementById("disconnectBtn").addEventListener("click", disconnectWebSocket);
  if (el.exportMarkdownBtn) {
    el.exportMarkdownBtn.addEventListener("click", () => {
      exportSessionMarkdown();
      closeExportMenu();
    });
  }
  if (el.exportJsonBtn) {
    el.exportJsonBtn.addEventListener("click", () => {
      exportSessionJson();
      closeExportMenu();
    });
  }
  if (el.exportAudioBtn) {
    el.exportAudioBtn.addEventListener("click", () => {
      exportSessionAudio();
      closeExportMenu();
    });
  }
  if (el.exportMenu instanceof HTMLDetailsElement) {
    document.addEventListener("click", (event) => {
      if (!el.exportMenu?.open) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && !el.exportMenu.contains(target)) {
        el.exportMenu.open = false;
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && el.exportMenu?.open) {
        el.exportMenu.open = false;
      }
    });
  }
  if (el.themeToggleBtn) {
    el.themeToggleBtn.addEventListener("click", toggleThemeMode);
  }
  document.getElementById("startMicBtn").addEventListener("click", startMicStream);
  document.getElementById("stopMicBtn").addEventListener("click", stopMicStream);
  document.getElementById("pttToggleBtn").addEventListener("click", togglePushToTalkMode);
  document.getElementById("pttHoldBtn").addEventListener("pointerdown", async (event) => {
    event.preventDefault();
    await startPushToTalk();
  });
  document.getElementById("pttHoldBtn").addEventListener("pointerup", (event) => {
    event.preventDefault();
    stopPushToTalk();
  });
  document.getElementById("pttHoldBtn").addEventListener("pointerleave", () => {
    stopPushToTalk();
  });
  document.getElementById("pttHoldBtn").addEventListener("pointercancel", () => {
    stopPushToTalk();
  });
  if (el.sendImageBtn) {
    el.sendImageBtn.addEventListener("click", () => {
      void sendImageFrame();
    });
  }
  if (el.applyLiveSetupBtn) {
    el.applyLiveSetupBtn.addEventListener("click", sendLiveSetupOverride);
  }
  document.getElementById("sendBtn").addEventListener("click", sendIntentRequest);
  if (el.sendConversationItemBtn) {
    el.sendConversationItemBtn.addEventListener("click", () => {
      void sendConversationItemCreate();
    });
  }
  if (el.sendConversationDeleteBtn) {
    el.sendConversationDeleteBtn.addEventListener("click", sendConversationItemDelete);
  }
  document.getElementById("sendOobBtn").addEventListener("click", sendOutOfBandRequest);
  document.getElementById("approveResumeBtn").addEventListener("click", () => {
    submitApprovalDecision("approved");
  });
  document.getElementById("rejectResumeBtn").addEventListener("click", () => {
    submitApprovalDecision("rejected");
  });
  document.getElementById("interruptBtn").addEventListener("click", interruptAssistant);
  document.getElementById("fallbackBtn").addEventListener("click", toggleFallbackMode);
  document.getElementById("refreshTasksBtn").addEventListener("click", refreshActiveTasks);
  document.getElementById("operatorRefreshBtn").addEventListener("click", () => {
    void refreshOperatorSummary({ markUserRefresh: true });
  });
  if (el.operatorSummaryGuideRefreshBtn) {
    el.operatorSummaryGuideRefreshBtn.addEventListener("click", () => {
      void refreshOperatorSummary({ markUserRefresh: true });
    });
  }
  if (el.operatorDemoViewBtn) {
    el.operatorDemoViewBtn.addEventListener("click", () => {
      setOperatorBoardMode("demo");
    });
  }
  if (el.operatorFullOpsViewBtn) {
    el.operatorFullOpsViewBtn.addEventListener("click", () => {
      setOperatorBoardMode("full");
    });
  }
  if (el.operatorResetViewBtn) {
    el.operatorResetViewBtn.addEventListener("click", () => {
      resetOperatorBoardView();
    });
  }
  if (el.operatorFocusCriticalBtn) {
    el.operatorFocusCriticalBtn.addEventListener("click", () => {
      setOperatorFocusCriticalMode(!state.operatorFocusCriticalOnly);
    });
  }
  if (el.operatorIssuesOnlyBtn) {
    el.operatorIssuesOnlyBtn.addEventListener("click", () => {
      setOperatorIssuesOnlyMode(!state.operatorIssuesOnly);
    });
  }
  if (el.operatorCollapseAllBtn) {
    el.operatorCollapseAllBtn.addEventListener("click", () => {
      setOperatorCardsCollapsed(true);
    });
  }
  if (el.operatorExpandAllBtn) {
    el.operatorExpandAllBtn.addEventListener("click", () => {
      setOperatorCardsCollapsed(false);
    });
  }
  const operatorGroupToggles = document.querySelectorAll("[data-operator-group-toggle]");
  for (const toggle of operatorGroupToggles) {
    toggle.addEventListener("click", () => {
      const group = toggle.closest(".operator-health-group");
      if (!(group instanceof HTMLElement)) {
        return;
      }
      const shouldCollapse = !group.classList.contains("is-collapsed");
      setOperatorGroupCollapsed(group, shouldCollapse);
      syncOperatorCollapseActionButtons();
    });
  }
  const operatorSignalJumps = document.querySelectorAll("[data-operator-signal-target]");
  for (const jumpButton of operatorSignalJumps) {
    jumpButton.addEventListener("click", () => {
      const statusId = jumpButton.getAttribute("data-operator-signal-target");
      jumpToOperatorStatusCard(statusId ?? "");
    });
  }
  document.getElementById("operatorCancelBtn").addEventListener("click", () => {
    const taskId = el.operatorTaskId.value.trim();
    if (!taskId) {
      appendTranscript("error", "Operator taskId is required for cancel");
      return;
    }
    const role = (el.operatorRole.value || "operator").trim().toLowerCase();
    const shouldContinue = requestActionConfirmation("Cancel active task?", [
      `taskId: ${taskId}`,
      `role: ${role}`,
      "This action requests immediate task cancellation.",
    ]);
    if (!shouldContinue) {
      appendTranscript("system", "Operator action canceled by user: cancel_task");
      return;
    }
    runOperatorAction("cancel_task", { taskId, reason: "Cancelled from operator console" });
  });
  document.getElementById("operatorRetryBtn").addEventListener("click", () => {
    const taskId = el.operatorTaskId.value.trim();
    if (!taskId) {
      appendTranscript("error", "Operator taskId is required for retry");
      return;
    }
    const role = (el.operatorRole.value || "operator").trim().toLowerCase();
    const shouldContinue = requestActionConfirmation("Retry task execution?", [
      `taskId: ${taskId}`,
      `role: ${role}`,
      "This action asks orchestrator to re-run the selected task.",
    ]);
    if (!shouldContinue) {
      appendTranscript("system", "Operator action canceled by user: retry_task");
      return;
    }
    runOperatorAction("retry_task", { taskId, reason: "Retry requested from operator console" });
  });
  document.getElementById("operatorDrainBtn").addEventListener("click", () => {
    const targetService = el.operatorTargetService.value;
    const role = (el.operatorRole.value || "operator").trim().toLowerCase();
    const shouldContinue = requestActionConfirmation("Start failover drain?", [
      `targetService: ${targetService}`,
      `role: ${role}`,
      "Service will stop accepting new workload until warmup.",
    ]);
    if (!shouldContinue) {
      appendTranscript("system", "Operator action canceled by user: failover/drain");
      return;
    }
    runOperatorAction("failover", {
      targetService,
      operation: "drain",
      reason: "Drain requested from operator console",
    });
  });
  document.getElementById("operatorWarmupBtn").addEventListener("click", () => {
    const targetService = el.operatorTargetService.value;
    const role = (el.operatorRole.value || "operator").trim().toLowerCase();
    const shouldContinue = requestActionConfirmation("Resume service with warmup?", [
      `targetService: ${targetService}`,
      `role: ${role}`,
      "Service will return to ready state and accept new workload.",
    ]);
    if (!shouldContinue) {
      appendTranscript("system", "Operator action canceled by user: failover/warmup");
      return;
    }
    runOperatorAction("failover", {
      targetService,
      operation: "warmup",
      reason: "Warmup requested from operator console",
    });
  });
  document.getElementById("deviceNodeRefreshBtn").addEventListener("click", () => {
    refreshDeviceNodes();
  });
  document.getElementById("deviceNodeUpsertBtn").addEventListener("click", () => {
    const nodeId = toOptionalText(el.deviceNodeId.value) ?? "(new)";
    const role = (el.operatorRole.value || "operator").trim().toLowerCase();
    const shouldContinue = requestActionConfirmation("Create or update device node?", [
      `nodeId: ${nodeId}`,
      `role: ${role}`,
      "This action writes device node metadata and increments version.",
    ]);
    if (!shouldContinue) {
      appendTranscript("system", "Device node action canceled by user: upsert");
      return;
    }
    upsertDeviceNodeFromForm();
  });
  if (el.deviceNodeConflictBtn) {
    el.deviceNodeConflictBtn.addEventListener("click", () => {
      const nodeId = toOptionalText(el.deviceNodeId.value) ?? "(missing)";
      const shouldContinue = requestActionConfirmation("Run stale-version conflict probe?", [
        `nodeId: ${nodeId}`,
        "Expecting HTTP 409 API_DEVICE_NODE_VERSION_CONFLICT as a guard proof.",
      ]);
      if (!shouldContinue) {
        appendTranscript("system", "Device node action canceled by user: conflict_probe");
        return;
      }
      probeDeviceNodeConflictFromForm();
    });
  }
  document.getElementById("deviceNodeHeartbeatBtn").addEventListener("click", () => {
    const nodeId = toOptionalText(el.deviceNodeId.value) ?? "(missing)";
    const targetStatus = toOptionalText(el.deviceNodeStatus.value) ?? "online";
    const role = (el.operatorRole.value || "operator").trim().toLowerCase();
    const shouldContinue = requestActionConfirmation("Send device-node heartbeat?", [
      `nodeId: ${nodeId}`,
      `status: ${targetStatus}`,
      `role: ${role}`,
    ]);
    if (!shouldContinue) {
      appendTranscript("system", "Device node action canceled by user: heartbeat");
      return;
    }
    sendDeviceNodeHeartbeatFromForm();
  });
  document.getElementById("deviceNodeStatusBtn").addEventListener("click", () => {
    fetchDeviceNodeStatusFromForm();
  });
  document.getElementById("newSessionBtn").addEventListener("click", () => {
    state.sessionId = makeId();
    el.sessionId.value = state.sessionId;
    state.runId = null;
    resetAssistantAudioExport();
    setStoryTimelineData();
    el.runId.textContent = "-";
    setSessionState("-");
    clearPendingApproval();
    state.taskRecords.clear();
    renderTaskList();
    appendTranscript("system", "Generated new session ID");
  });
  el.userId.addEventListener("input", () => {
    state.userId = el.userId.value.trim() || "demo-user";
    el.userId.value = state.userId;
    el.currentUserId.textContent = state.userId;
  });
  el.sessionId.addEventListener("input", () => {
    state.sessionId = el.sessionId.value.trim() || makeId();
    el.sessionId.value = state.sessionId;
  });
  el.apiBaseUrl.addEventListener("input", () => {
    state.apiBaseUrl = normalizeApiBaseUrl(el.apiBaseUrl.value);
  });
  el.deviceNodeId.addEventListener("change", () => {
    const nodeId = toOptionalText(el.deviceNodeId.value);
    if (!nodeId) {
      return;
    }
    const node = state.deviceNodes.get(nodeId.toLowerCase());
    if (node) {
      applyDeviceNodeToForm(node);
    }
  });
  [el.targetPrice, el.targetDelivery, el.targetSla].forEach((input) => {
    input.addEventListener("input", evaluateConstraints);
  });
  if (el.intent) {
    el.intent.addEventListener("change", setUiTaskFieldsVisibility);
  }
  if (el.storyTimelineScrubber) {
    el.storyTimelineScrubber.addEventListener("input", () => {
      const value = Number(el.storyTimelineScrubber.value);
      if (Number.isFinite(value)) {
        updateStoryTimelineSelection(value);
      }
    });
  }
  if (el.storyTimelineSelect) {
    el.storyTimelineSelect.addEventListener("change", () => {
      const value = Number(el.storyTimelineSelect.value);
      if (Number.isFinite(value)) {
        updateStoryTimelineSelection(value);
      }
    });
  }
}

async function bootstrap() {
  const runtimeConfig = await loadRuntimeConfig();
  if (runtimeConfig?.wsUrl) {
    el.wsUrl.value = runtimeConfig.wsUrl;
    state.wsUrl = runtimeConfig.wsUrl;
  }
  if (runtimeConfig?.apiBaseUrl) {
    el.apiBaseUrl.value = runtimeConfig.apiBaseUrl;
  }

  state.apiBaseUrl = normalizeApiBaseUrl(el.apiBaseUrl.value);
  el.apiBaseUrl.value = state.apiBaseUrl;
  state.userId = "demo-user";
  el.userId.value = state.userId;
  el.currentUserId.textContent = state.userId;
  state.sessionId = makeId();
  el.sessionId.value = state.sessionId;
  setSessionState("-");
  resetAssistantAudioExport();
  applyThemeMode(readStoredThemeMode(), { persist: false, announce: false });
  setConnectionStatus("disconnected");
  setExportStatus("idle");
  updatePttUi();
  setStatusPill(el.constraintStatus, "Waiting for offer", "neutral");
  setFallbackAsset(false);
  setStoryTimelineData();
  clearPendingApproval();
  resetOperatorHealthWidget("no_data");
  resetOperatorDeviceNodeUpdatesWidget("no_data");
  resetOperatorGatewayErrorWidget("no_data");
  resetOperatorTurnTruncationWidget("no_data");
  resetOperatorTurnDeleteWidget("no_data");
  resetOperatorDamageControlWidget("no_data");
  resetOperatorBoardView();
  renderTaskList();
  evaluateConstraints();
  setActiveTab(DEFAULT_TAB_ID);
  setUiTaskFieldsVisibility();
  initBackgroundVideoLoopBlend();
  enhanceSelectControls();
  bindEvents();
  refreshOperatorSummary().catch(() => {
    appendTranscript("error", "Initial operator summary fetch failed");
  });
  refreshDeviceNodes({ silent: true }).catch(() => {
    appendTranscript("error", "Initial device node registry fetch failed");
  });
  appendTranscript("system", "Frontend ready");
}

bootstrap().catch(() => {
  appendTranscript("error", "Frontend bootstrap failed");
});

