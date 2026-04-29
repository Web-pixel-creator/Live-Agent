import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Plus,
  Search,
  ChevronDown,
  Check,
  UserRoundCog,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Camera,
  Download,
  FileText,
  X,
  Inbox,
  User,
  Star,
  Flame,
  CalendarCheck,
  ClipboardCheck,
  BriefcaseBusiness,
  MessageSquareText,
  ShieldCheck,
  Copy,
  PhoneCall,
  Wrench,
  Wind,
  Sparkles,
  Ruler,
  MapPin,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CURRENT_OPERATOR, STATUS_META, type EdgeNode } from "@/data/nodes";
import { Server } from "lucide-react";
import {
  type CaseStatus,
  type WorkspaceCase,
  slaBurnPercent,
  parseSlaMinutes,
  stuckLabel,
} from "@/data/workspace";
import { useAllRequestCounts, useAllRequestStaleness } from "@/data/sessionRequests";
import { OwnerAvatar } from "./OwnerAvatar";
import { CountryChip } from "./CountryChip";
import { StageIcon } from "./StageIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useVipCases } from "@/hooks/useVipCases";
import { useToast } from "@/hooks/use-toast";
import { NewCaseSheet } from "./NewCaseSheet";
import { type RuntimeCaseWiki, useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";
import {
  buildCaseBundlePath,
  buildCaseEvidencePath,
  buildCaseVaultPath,
} from "@/lib/case-artifact-links";

type Status = CaseStatus;

// Identity of the operator currently signed into the workspace. Mirrors the
// name shown in AppSidebar's footer ("A. Petrova"). Centralised here so the
// "Mine only" filter — and any future "assigned to me" affordances — share a
// single source of truth. When real auth lands this becomes a hook reading
// from session/profile.
const statusGroups: {
  key: Status;
  label: string;
  dotClass: string;
  tint: "rose" | "violet" | "amber" | "mint";
  /** Whether this group should be visually emphasised vs. quieted down. */
  emphasis: "loud" | "normal" | "muted";
  /** Whether this group is collapsed by default. */
  defaultCollapsed: boolean;
}[] = [
  { key: "needs_action", label: "Needs action", dotClass: "bg-destructive", tint: "rose", emphasis: "loud", defaultCollapsed: false },
  { key: "in_flight", label: "In flight", dotClass: "bg-primary", tint: "violet", emphasis: "normal", defaultCollapsed: false },
  { key: "awaiting_client", label: "Awaiting client", dotClass: "bg-warning", tint: "amber", emphasis: "muted", defaultCollapsed: false },
  { key: "resolved", label: "Resolved", dotClass: "bg-success", tint: "mint", emphasis: "muted", defaultCollapsed: true },
];

const visaTone: Record<string, "violet" | "rose" | "amber" | "mint" | "slate"> = {
  "EU Blue Card": "violet",
  "Skilled Worker": "violet",
  "O-1A": "rose",
  "Highly Skilled Pro": "amber",
  "D7 Passive Income": "mint",
  Humanitarian: "rose",
};

// Single source of truth for column layout — header & rows share this exactly.
// Leading 20px column is for the bulk-select checkbox.
const COLS =
  "grid grid-cols-[20px_88px_minmax(0,1.4fr)_minmax(0,1fr)_72px_88px_60px] items-center gap-6";

// Sort helper — most-burning SLA first, infinite/none cases last.
function sortByBurn(items: WorkspaceCase[]) {
  return [...items].sort((a, b) => {
    const ma = parseSlaMinutes(a.sla);
    const mb = parseSlaMinutes(b.sla);
    if (ma === null && mb === null) return 0;
    if (ma === null) return 1;
    if (mb === null) return -1;
    return ma - mb;
  });
}

// Tiny shortcut hint chip used in the bottom hints bar.
const ShortcutHint = ({
  keys,
  label,
  dim = false,
}: {
  keys: string[];
  label: string;
  dim?: boolean;
}) => (
  <span className={`inline-flex items-center gap-1.5 ${dim ? "opacity-40" : ""}`}>
    <span className="inline-flex items-center gap-0.5">
      {keys.map((k) => (
        <kbd
          key={k}
          className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-secondary/60 ring-1 ring-inset ring-border/60 font-mono text-[9px] text-foreground/80"
        >
          {k}
        </kbd>
      ))}
    </span>
    <span className="text-muted-foreground/70">{label}</span>
  </span>
);

// Compact relative-age label for the "N requested · 3d" hint inline with the
// requested-badge. Mirrors operator shorthand: <1h → "now", <24h → "Nh",
// otherwise "Nd". Returns null when the input is missing.
const shortAge = (iso: string | undefined, now: number): string | null => {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return "now";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const SevenMinuteVisaIntakePanel = ({
  caseValue,
  onClose,
  onOpenConsole,
  onOpenBundle,
  onOpenEvidence,
  onOpenCaseVault,
}: {
  caseValue: WorkspaceCase;
  onClose: () => void;
  onOpenConsole: () => void;
  onOpenBundle: () => void;
  onOpenEvidence: () => void;
  onOpenCaseVault: () => void;
}) => {
  const missingDocs = caseValue.documents.filter((doc) => doc.state === "missing");
  const reviewDocs = caseValue.documents.filter((doc) => doc.state === "review");
  const completedDocs = caseValue.documents.filter((doc) => doc.state === "ok");
  const signals = caseValue.approval?.signals ?? [];
  const outcomeItems = [
    { label: "Lead qualified", value: `${caseValue.visa} · ${caseValue.country}`, tone: "violet", Icon: ClipboardCheck },
    { label: "Missing docs", value: `${missingDocs.length} requested`, tone: "amber", Icon: FileText },
    { label: "Consultation", value: "Ready from timeline", tone: "mint", Icon: CalendarCheck },
    { label: "CRM handoff", value: "Prepared in Console", tone: "slate", Icon: BriefcaseBusiness },
    { label: "Approval", value: caseValue.approval ? "Required before send" : "No blocker", tone: caseValue.approval ? "rose" : "mint", Icon: ShieldCheck },
    { label: "Evidence", value: "Bundle available", tone: "violet", Icon: Camera },
  ] as const;

  return (
    <section
      aria-label="Seven-minute visa intake demo"
      className="mx-8 mb-5 rounded-md border border-border/70 bg-card/35 overflow-hidden shadow-[0_18px_40px_-28px_rgba(0,0,0,0.65)]"
    >
      <div className="px-5 py-4 border-b border-border/60 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex h-5 items-center px-2 rounded-[5px] bg-[hsl(var(--tint-violet)/0.14)] text-[10px] font-mono uppercase tracking-[0.12em] text-[hsl(var(--tint-violet-fg))] ring-1 ring-inset ring-[hsl(var(--tint-violet)/0.24)]">
              7-minute path
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{caseValue.ref}</span>
          </div>
          <h2 className="font-serif text-[22px] leading-tight tracking-tight text-foreground">
            Visa intake from lead to evidence.
          </h2>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-relaxed max-w-3xl">
            {caseValue.client} · {caseValue.stage}. Review the outcome, approve the protected
            follow-up, then open the proof surface.
          </p>
        </div>
        <div className="hidden lg:grid grid-cols-3 gap-2 min-w-[360px]">
          {[
            ["Client", caseValue.client],
            ["Owner", caseValue.owner],
            ["SLA", caseValue.sla],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                {label}
              </div>
              <div className="mt-1 font-mono text-[11px] text-foreground truncate">{value}</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-smooth"
          aria-label="Close visa intake demo panel"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-0">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {outcomeItems.map(({ label, value, tone, Icon }) => (
              <div
                key={label}
                className="rounded-md border border-border/50 bg-background/35 px-3 py-3 min-h-[86px]"
              >
                <div className="flex items-center gap-1.5">
                  <Icon
                    className="h-3.5 w-3.5"
                    strokeWidth={1.8}
                    style={{ color: `hsl(var(--tint-${tone}-fg))` }}
                  />
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/75">
                    {label}
                  </span>
                </div>
                <div className="mt-2 text-[12px] leading-snug text-foreground">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <div className="rounded-md border border-border/50 bg-secondary/15 p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                <h3 className="text-[12px] font-semibold text-foreground">Next operator action</h3>
              </div>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {caseValue.approval?.headline.prefix}
                <span className="text-foreground">{caseValue.approval?.headline.emphasis}</span>
                {caseValue.approval?.headline.suffix}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {signals.map((signal) => (
                  <Pill key={signal.label} tone={signal.tone} size="sm">
                    {signal.label}
                  </Pill>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border/50 bg-secondary/15 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                <h3 className="text-[12px] font-semibold text-foreground">Document posture</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-background/35 px-2 py-2">
                  <div className="font-mono text-[15px] text-[hsl(var(--tint-mint-fg))]">
                    {completedDocs.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">ready</div>
                </div>
                <div className="rounded-md bg-background/35 px-2 py-2">
                  <div className="font-mono text-[15px] text-[hsl(var(--tint-amber-fg))]">
                    {reviewDocs.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">review</div>
                </div>
                <div className="rounded-md bg-background/35 px-2 py-2">
                  <div className="font-mono text-[15px] text-[hsl(var(--tint-rose-fg))]">
                    {missingDocs.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">missing</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {missingDocs.slice(0, 4).map((doc) => (
                  <Pill key={doc.name} tone="amber" size="sm">
                    {doc.name}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="border-t xl:border-t-0 xl:border-l border-border/60 p-5 bg-background/30">
          <h3 className="text-[12px] font-semibold text-foreground">Case Outcome Summary</h3>
          <div className="mt-3 space-y-2">
            {[
              ["Qualification", "Good-fit lead captured"],
              ["Documents", `${missingDocs.length} missing · ${reviewDocs.length} review`],
              ["Booking", "Consultation path ready"],
              ["Handoff", "Console has CRM-ready packet"],
              ["Control", caseValue.approval ? "Human approval required" : "No pending approval"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 text-[11.5px]">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground text-right">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <Button
              size="sm"
              onClick={onOpenConsole}
              className="h-8 justify-start bg-foreground text-background hover:bg-foreground/90"
            >
              <ShieldCheck className="mr-2 h-3.5 w-3.5" strokeWidth={2} />
              Review approval
            </Button>
            <Button size="sm" variant="secondary" onClick={onOpenBundle} className="h-8 justify-start">
              <FileText className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Presentation bundle
            </Button>
            <Button size="sm" variant="secondary" onClick={onOpenEvidence} className="h-8 justify-start">
              <Camera className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Evidence bundle
            </Button>
            <Button size="sm" variant="ghost" onClick={onOpenCaseVault} className="h-8 justify-start">
              <Server className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Case Vault
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
};

type PlaybookTemplate = {
  id: string;
  title: string;
  summary: string;
  statusNote: string;
  highlights: { label: string; value: string }[];
  detail: {
    sampleInput: string;
    approvalPolicy: string[];
    evidenceOutput: string[];
    crmFields: string[];
  };
  tone: "violet" | "rose" | "amber" | "mint" | "slate";
  Icon: typeof ClipboardCheck;
  caseValue: WorkspaceCase;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
};

type PlaybookPayloadPreview = {
  surfaceLabel: string;
  surfacePath: string;
  payload: Record<string, boolean | number | string | string[]>;
};

type PlaybookExportMode = "human" | "json";
type LocalServiceExportKind = "dispatch" | "customer" | "handoff";

type PlaybookOperatorExport = {
  title: string;
  description: string;
  modeLabel: string;
  copyLabel: string;
  surfaceActionLabel: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  checklist: string[];
};

type LocalServicePayloadPreview = {
  surfaceLabel: string;
  surfacePath: string;
  payload: Record<string, boolean | number | string | string[]>;
};

type LocalServiceDispatchExport = {
  title: string;
  description: string;
  modeLabel: string;
  copyLabel: string;
  surfaceActionLabel: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  checklist: string[];
};

type LocalServiceIntakeEvidence = {
  title: string;
  description: string;
  modeLabel: string;
  copyLabel: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  transcript: { speaker: string; text: string }[];
  checklist: string[];
};

type LocalServicePilotWorkspaceExport = {
  title: string;
  description: string;
  eyebrow?: string;
  modeLabel: string;
  copyLabel: string;
  reviewTitle?: string;
  reviewDescription?: string;
  scorecardActionLabel?: string;
  executionActionLabel?: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  checklist: string[];
};

type LocalServicePilotMessagePreview = {
  title: string;
  description: string;
  modeLabel: string;
  copyPreviewLabel: string;
  copyMessageLabel: string;
  messageText: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  checklist: string[];
};

type LocalServicePilotConfirmationSummary = {
  title: string;
  description: string;
  modeLabel: string;
  copyLabel: string;
  statusLabel: string;
  messageText: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  checklist: string[];
};

type LocalServicePilotAnalystBrief = {
  title: string;
  description: string;
  modeLabel: string;
  copyLabel: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  suggestedQuestions: { question: string; answer: string; action: string }[];
  guardrails: string[];
};

type LocalServiceDiscoveryCallPrep = {
  title: string;
  description: string;
  modeLabel: string;
  copyLabel: string;
  statusLabel: string;
  callReadiness: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  discoveryQuestions: string[];
  successCriteria: string[];
  guardrails: string[];
};

type LocalServiceDayOneSetupBrief = {
  title: string;
  description: string;
  modeLabel: string;
  copyLabel: string;
  setupReadiness: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  businessProfile: { label: string; value: string }[];
  setupTasks: { label: string; value: string; owner: string }[];
  testPlan: string[];
  guardrails: string[];
};

type LocalServiceAgentSetupBrief = {
  title: string;
  description: string;
  modeLabel: string;
  copyLabel: string;
  humanText: string;
  jsonText: string;
  rows: { label: string; value: string }[];
  setupSteps: { id: LocalServiceSetupStepId; label: string; value: string; status: string }[];
  trainingCards: { label: string; value: string }[];
  guardrails: string[];
};

type LocalServiceSetupStepId =
  | "business_profile"
  | "knowledge_sources"
  | "agent_behavior"
  | "test_call_message"
  | "ready_for_pilot_test";

type LocalServiceSetupStepCompletion = Partial<Record<LocalServiceSetupStepId, boolean>>;
type LocalServiceTestCallCheckId =
  | "sample_input_reviewed"
  | "expected_fields_matched"
  | "approval_gate_confirmed"
  | "handoff_preview_confirmed";
type LocalServiceTestCallChecklistState = Partial<Record<LocalServiceTestCallCheckId, boolean>>;

type LocalServiceOutreachProspect = {
  id: string;
  company: string;
  segment: string;
  channelFit: string;
  whyNow: string;
  scorecardFocus: string;
  nextStep: string;
};

type LocalServicePilotStatus =
  | "not_contacted"
  | "draft_ready"
  | "contacted_manually"
  | "reply_received"
  | "rejected_for_now";

type LocalServiceFirstRequestOutcome =
  | "not_recorded"
  | "qualified"
  | "needs_follow_up"
  | "rejected"
  | "booked_manually";

type LocalServicePilotMetricStatus = "not_started" | "baseline_captured" | "tracking_live" | "review_ready";
type LocalServiceWeekOneOwnerDecision = "not_recorded" | "continue" | "pause" | "stop";
type LocalServiceProposalApprovalDecision = "not_reviewed" | "approved" | "needs_changes" | "blocked";
type LocalServiceKickoffDecision = "not_reviewed" | "ready" | "needs_more_prep" | "blocked";
type LocalServiceFounderContactField =
  | "channelChecked"
  | "manualMessageSent"
  | "discoveryCallCompleted"
  | "demoBooked"
  | "pilotCandidate";
type LocalServiceFounderContactProof = Partial<Record<LocalServiceFounderContactField, boolean>>;
type LocalServicePilotActivityKind =
  | "status_change"
  | "metric_change"
  | "contact_proof"
  | "outcome_change"
  | "owner_decision"
  | "proposal_approval"
  | "kickoff_decision"
  | "weekly_sync_review";
type LocalServicePilotActivityEvent = {
  id: string;
  kind: LocalServicePilotActivityKind;
  label: string;
  value: string;
  serviceId: string;
  serviceTitle: string;
  prospectId?: string;
  company?: string;
  createdAt: string;
};

type LocalServicePilotWorkspaceState = {
  selectedProspectByService: Record<string, string>;
  statusByProspectKey: Record<string, LocalServicePilotStatus>;
  firstRequestOutcomeByProspectKey: Record<string, LocalServiceFirstRequestOutcome>;
  weekOneOwnerDecisionByProspectKey: Record<string, LocalServiceWeekOneOwnerDecision>;
  proposalApprovalByService: Record<string, LocalServiceProposalApprovalDecision>;
  kickoffDecisionByService: Record<string, LocalServiceKickoffDecision>;
  weeklyScorecardSyncReviewedByService: Record<string, boolean>;
  metricStatusByService: Record<string, LocalServicePilotMetricStatus>;
  setupStepCompletionByService: Record<string, LocalServiceSetupStepCompletion>;
  setupReadyByService: Record<string, boolean>;
  testCallChecklistByService: Record<string, LocalServiceTestCallChecklistState>;
  testCallPassedByService: Record<string, boolean>;
  contactProofByProspectKey: Record<string, LocalServiceFounderContactProof>;
  activityLog: LocalServicePilotActivityEvent[];
};

type LocalServiceDemoTemplate = {
  id: string;
  title: string;
  ref: string;
  summary: string;
  statusNote: string;
  channel: string;
  tone: "violet" | "rose" | "amber" | "mint" | "slate";
  Icon: typeof ClipboardCheck;
  highlights: { label: string; value: string }[];
  detail: {
    sampleInput: string;
    phoneIntake: string[];
    estimateInputs: string[];
    approvalPolicy: string[];
    evidenceOutput: string[];
    handoffFields: string[];
    telegramIntake: {
      inboundMessage: string;
      normalizedFields: string[];
      replyDraft: string;
    };
    pilotKit: {
      offerSummary: string;
      demoScript: string[];
      outreachFocus: string[];
      launchChecklist: string[];
      outreachWizard: {
        audience: string;
        testMessage: string;
        confirmationGate: string;
        prospects: LocalServiceOutreachProspect[];
      };
      metrics: {
        label: string;
        baseline: string;
        target: string;
      }[];
    };
    customerConfirmation: string;
    operatorHandoff: string;
  };
  payload: Record<string, boolean | number | string | string[]>;
  evidencePath: string;
  bundlePath: string;
};

type LocalServicePilotFunnelRow = {
  key: string;
  serviceId: string;
  serviceTitle: string;
  tone: "violet" | "rose" | "amber" | "mint" | "slate";
  prospect: LocalServiceOutreachProspect;
  status: LocalServicePilotStatus;
  statusLabel: string;
};

type LocalServiceFounderContactRow = LocalServicePilotFunnelRow & {
  channelChecked: boolean;
  manualMessageSent: boolean;
  discoveryCallCompleted: boolean;
  demoBooked: boolean;
  pilotCandidate: boolean;
  proofStatus: string;
};

type LocalServiceFounderDecisionGate = {
  verdictLabel: string;
  posture: string;
  action: string;
  targetLane: string;
  tone: "continue" | "revise" | "stop" | "collect";
  readyToContinue: boolean;
  proofSummary: string;
  stopRules: string[];
  continueRules: string[];
};

type LocalServiceCategoryPilotScore = {
  serviceId: string;
  serviceTitle: string;
  rank: number;
  score: number;
  signalLabel: "Lead category" | "Active signal" | "Needs more proof" | "Unproven";
  proofSummary: string;
  nextAction: string;
  counts: {
    contacts: number;
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  };
};

type LocalServiceLeadingCategoryActionLayer = {
  serviceId: string;
  serviceTitle: string;
  signalLabel: LocalServiceCategoryPilotScore["signalLabel"];
  posture: string;
  action: string;
  nextManualBatch: { company: string; segment: string; statusLabel: string; nextStep: string }[];
  discoveryQuestions: string[];
  pilotSetupChecklist: string[];
  integrationHold: string[];
};

type LocalServiceLeadingCategoryPilotReadiness = {
  serviceId: string;
  serviceTitle: string;
  ownerDecision: LocalServiceWeekOneOwnerDecision;
  ownerDecisionLabel: string;
  readinessLabel: "Ready for first paid pilot" | "Pilot setup almost ready" | "Not ready for paid pilot";
  progressLabel: string;
  paidPilotGate: string;
  nextAction: string;
  readyToPilot: boolean;
  checklist: { label: string; status: string; done: boolean }[];
  blockers: string[];
  readySignals: string[];
};

type LocalServicePilotReadinessActionPlan = {
  serviceId: string;
  serviceTitle: string;
  exportSurface: "local_services_readiness_action_plan";
  primarySurface:
    | "Setup path"
    | "Founder batch review"
    | "Pilot metrics tracker"
    | "Week-one review"
    | "Paid pilot proposal";
  primaryAction: string;
  secondaryAction: string;
  operatorScript: string;
  copyLabel: string;
  noGo: string[];
};

type LocalServicePilotStatusFilter = LocalServicePilotStatus | "all";
type LocalServicePilotColumnKey = "service" | "status" | "channelFit" | "nextStep";
type LocalServicePilotExecutionStep = {
  label: string;
  status: string;
  owner: string;
  detail: string;
  done: boolean;
};

const LOCAL_SERVICES_PILOT_OFFER_PATH = "/workspace-docs/local-services-pilot-offer.md";
const LOCAL_SERVICES_DEMO_SCRIPT_PATH = "/workspace-docs/local-services-demo-script.md";
const LOCAL_SERVICES_DEMO_RECORDING_CHECKLIST_PATH =
  "/workspace-docs/local-services-demo-recording-checklist.md";
const LOCAL_SERVICES_OUTREACH_LIST_PATH = "/workspace-docs/local-services-outreach-list.md";
const LOCAL_SERVICES_PILOT_SCORECARD_PATH = "/workspace-docs/local-services-pilot-scorecard.md";
const LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH = "/workspace-docs/local-services-outreach-execution-pack.md";
const LOCAL_SERVICES_PILOT_RUNBOOK_PATH = "/workspace-docs/local-services-pilot-runbook.md";
const LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH = "/workspace-docs/local-services-founder-execution-log.md";
const LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY = "liveDesk:localServicesPilotWorkspace:v1";
const LOCAL_SERVICE_PILOT_STATUS_LABELS: Record<LocalServicePilotStatus, string> = {
  not_contacted: "Not contacted",
  draft_ready: "Draft ready",
  contacted_manually: "Contacted manually",
  reply_received: "Reply received",
  rejected_for_now: "Rejected for now",
};
const LOCAL_SERVICE_PILOT_STATUS_ORDER: LocalServicePilotStatus[] = [
  "not_contacted",
  "draft_ready",
  "contacted_manually",
  "reply_received",
  "rejected_for_now",
];
const LOCAL_SERVICE_PILOT_STATUS_ACTIONS: { status: LocalServicePilotStatus; label: string }[] = [
  { status: "draft_ready", label: "Record scorecard draft" },
  { status: "contacted_manually", label: "Mark manually contacted" },
  { status: "reply_received", label: "Mark reply received" },
  { status: "rejected_for_now", label: "Reject for now" },
];
const LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS: Record<LocalServiceFirstRequestOutcome, string> = {
  not_recorded: "Not recorded",
  qualified: "Qualified",
  needs_follow_up: "Needs follow-up",
  rejected: "Rejected",
  booked_manually: "Booked manually",
};
const LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_ACTIONS: {
  outcome: Exclude<LocalServiceFirstRequestOutcome, "not_recorded">;
  label: string;
}[] = [
  { outcome: "qualified", label: "Qualified" },
  { outcome: "needs_follow_up", label: "Needs follow-up" },
  { outcome: "rejected", label: "Rejected" },
  { outcome: "booked_manually", label: "Booked manually" },
];
const LOCAL_SERVICE_PILOT_COLUMN_LABELS: Record<LocalServicePilotColumnKey, string> = {
  service: "Service",
  status: "Status",
  channelFit: "Channel fit",
  nextStep: "Next step",
};
const DEFAULT_LOCAL_SERVICE_PILOT_COLUMNS: Record<LocalServicePilotColumnKey, boolean> = {
  service: true,
  status: true,
  channelFit: true,
  nextStep: true,
};
const LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS: Record<LocalServicePilotMetricStatus, string> = {
  not_started: "Metrics not started",
  baseline_captured: "Baseline captured",
  tracking_live: "Tracking live",
  review_ready: "Review ready",
};
const LOCAL_SERVICE_PILOT_METRIC_STATUS_ACTIONS: { status: LocalServicePilotMetricStatus; label: string }[] = [
  { status: "baseline_captured", label: "Mark baseline captured" },
  { status: "tracking_live", label: "Mark tracking live" },
  { status: "review_ready", label: "Mark review ready" },
];
const LOCAL_SERVICE_WEEK_ONE_OWNER_DECISION_LABELS: Record<LocalServiceWeekOneOwnerDecision, string> = {
  not_recorded: "Owner decision not recorded",
  continue: "Continue",
  pause: "Pause",
  stop: "Stop",
};
const LOCAL_SERVICE_WEEK_ONE_OWNER_DECISION_ACTIONS: {
  decision: Exclude<LocalServiceWeekOneOwnerDecision, "not_recorded">;
  label: string;
}[] = [
  { decision: "continue", label: "Record continue" },
  { decision: "pause", label: "Record pause" },
  { decision: "stop", label: "Record stop" },
];
const LOCAL_SERVICE_PROPOSAL_APPROVAL_LABELS: Record<LocalServiceProposalApprovalDecision, string> = {
  not_reviewed: "Proposal approval not reviewed",
  approved: "Approved for manual paid-pilot proposal",
  needs_changes: "Needs changes before approval",
  blocked: "Blocked by operator",
};
const LOCAL_SERVICE_PROPOSAL_APPROVAL_ACTIONS: {
  decision: Exclude<LocalServiceProposalApprovalDecision, "not_reviewed">;
  label: string;
}[] = [
  { decision: "approved", label: "Approve proposal handoff" },
  { decision: "needs_changes", label: "Needs changes" },
  { decision: "blocked", label: "Block proposal" },
];
const LOCAL_SERVICE_KICKOFF_DECISION_LABELS: Record<LocalServiceKickoffDecision, string> = {
  not_reviewed: "Kickoff not reviewed",
  ready: "Ready for manual day-one run",
  needs_more_prep: "Needs more prep before day one",
  blocked: "Kickoff blocked by operator",
};
const LOCAL_SERVICE_KICKOFF_DECISION_ACTIONS: {
  decision: Exclude<LocalServiceKickoffDecision, "not_reviewed">;
  label: string;
}[] = [
  { decision: "ready", label: "Mark kickoff ready" },
  { decision: "needs_more_prep", label: "Needs more prep" },
  { decision: "blocked", label: "Block kickoff" },
];
const LOCAL_SERVICE_FOUNDER_CONTACT_FIELD_LABELS: Record<LocalServiceFounderContactField, string> = {
  channelChecked: "Channel checked",
  manualMessageSent: "Manual sent",
  discoveryCallCompleted: "Discovery call",
  demoBooked: "Demo booked",
  pilotCandidate: "Pilot candidate",
};
const LOCAL_SERVICE_SETUP_READY_STEP_ID: LocalServiceSetupStepId = "ready_for_pilot_test";
const LOCAL_SERVICE_TEST_CALL_CHECK_IDS: LocalServiceTestCallCheckId[] = [
  "sample_input_reviewed",
  "expected_fields_matched",
  "approval_gate_confirmed",
  "handoff_preview_confirmed",
];

function isLocalServicePilotStatus(value: unknown): value is LocalServicePilotStatus {
  return (
    value === "not_contacted" ||
    value === "draft_ready" ||
    value === "contacted_manually" ||
    value === "reply_received" ||
    value === "rejected_for_now"
  );
}

function isLocalServicePilotMetricStatus(value: unknown): value is LocalServicePilotMetricStatus {
  return (
    value === "not_started" ||
    value === "baseline_captured" ||
    value === "tracking_live" ||
    value === "review_ready"
  );
}

function isLocalServiceWeekOneOwnerDecision(value: unknown): value is LocalServiceWeekOneOwnerDecision {
  return value === "not_recorded" || value === "continue" || value === "pause" || value === "stop";
}

function isLocalServiceProposalApprovalDecision(value: unknown): value is LocalServiceProposalApprovalDecision {
  return value === "not_reviewed" || value === "approved" || value === "needs_changes" || value === "blocked";
}

function isLocalServiceKickoffDecision(value: unknown): value is LocalServiceKickoffDecision {
  return value === "not_reviewed" || value === "ready" || value === "needs_more_prep" || value === "blocked";
}

function isLocalServiceFirstRequestOutcome(value: unknown): value is LocalServiceFirstRequestOutcome {
  return (
    value === "not_recorded" ||
    value === "qualified" ||
    value === "needs_follow_up" ||
    value === "rejected" ||
    value === "booked_manually"
  );
}

function isLocalServicePilotActivityKind(value: unknown): value is LocalServicePilotActivityKind {
  return (
    value === "status_change" ||
    value === "metric_change" ||
    value === "contact_proof" ||
    value === "outcome_change" ||
    value === "owner_decision" ||
    value === "proposal_approval" ||
    value === "kickoff_decision"
  );
}

function isLocalServiceSetupStepId(value: unknown): value is LocalServiceSetupStepId {
  return (
    value === "business_profile" ||
    value === "knowledge_sources" ||
    value === "agent_behavior" ||
    value === "test_call_message" ||
    value === LOCAL_SERVICE_SETUP_READY_STEP_ID
  );
}

function isLocalServiceTestCallCheckId(value: unknown): value is LocalServiceTestCallCheckId {
  return (
    value === "sample_input_reviewed" ||
    value === "expected_fields_matched" ||
    value === "approval_gate_confirmed" ||
    value === "handoff_preview_confirmed"
  );
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function readPilotStatusRecord(value: unknown): Record<string, LocalServicePilotStatus> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, LocalServicePilotStatus] =>
      isLocalServicePilotStatus(entry[1]),
    ),
  );
}

function readPilotMetricStatusRecord(value: unknown): Record<string, LocalServicePilotMetricStatus> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, LocalServicePilotMetricStatus] => isLocalServicePilotMetricStatus(entry[1]),
    ),
  );
}

function readFirstRequestOutcomeRecord(value: unknown): Record<string, LocalServiceFirstRequestOutcome> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, LocalServiceFirstRequestOutcome] =>
        isLocalServiceFirstRequestOutcome(entry[1]),
    ),
  );
}

function readWeekOneOwnerDecisionRecord(value: unknown): Record<string, LocalServiceWeekOneOwnerDecision> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, LocalServiceWeekOneOwnerDecision] =>
        isLocalServiceWeekOneOwnerDecision(entry[1]),
    ),
  );
}

function readProposalApprovalDecisionRecord(value: unknown): Record<string, LocalServiceProposalApprovalDecision> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, LocalServiceProposalApprovalDecision] =>
        isLocalServiceProposalApprovalDecision(entry[1]),
    ),
  );
}

function readKickoffDecisionRecord(value: unknown): Record<string, LocalServiceKickoffDecision> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, LocalServiceKickoffDecision] => isLocalServiceKickoffDecision(entry[1]),
    ),
  );
}

function readBooleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

function readSetupStepCompletionByService(value: unknown): Record<string, LocalServiceSetupStepCompletion> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, Record<string, unknown>] =>
        Boolean(entry[1]) && typeof entry[1] === "object" && !Array.isArray(entry[1]),
      )
      .map(([serviceId, completion]) => [
        serviceId,
        Object.fromEntries(
          Object.entries(completion).filter(
            (entry): entry is [LocalServiceSetupStepId, boolean] =>
              isLocalServiceSetupStepId(entry[0]) && typeof entry[1] === "boolean",
          ),
        ),
      ]),
  );
}

function readTestCallChecklistByService(value: unknown): Record<string, LocalServiceTestCallChecklistState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, Record<string, unknown>] =>
        Boolean(entry[1]) && typeof entry[1] === "object" && !Array.isArray(entry[1]),
      )
      .map(([serviceId, checklist]) => [
        serviceId,
        Object.fromEntries(
          Object.entries(checklist).filter(
            (entry): entry is [LocalServiceTestCallCheckId, boolean] =>
              isLocalServiceTestCallCheckId(entry[0]) && typeof entry[1] === "boolean",
          ),
        ),
      ]),
  );
}

function readFounderContactProofByProspectKey(value: unknown): Record<string, LocalServiceFounderContactProof> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, Record<string, unknown>] =>
        Boolean(entry[1]) && typeof entry[1] === "object" && !Array.isArray(entry[1]),
      )
      .map(([prospectKey, proof]) => [
        prospectKey,
        Object.fromEntries(
          Object.entries(proof).filter(
            (entry): entry is [LocalServiceFounderContactField, boolean] =>
              entry[0] in LOCAL_SERVICE_FOUNDER_CONTACT_FIELD_LABELS && typeof entry[1] === "boolean",
          ),
        ),
      ]),
  );
}

function readPilotActivityLog(value: unknown): LocalServicePilotActivityEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .filter(
      (entry) =>
        typeof entry.id === "string" &&
        isLocalServicePilotActivityKind(entry.kind) &&
        typeof entry.label === "string" &&
        typeof entry.value === "string" &&
        typeof entry.serviceId === "string" &&
        typeof entry.serviceTitle === "string" &&
        typeof entry.createdAt === "string" &&
        (typeof entry.prospectId === "undefined" || typeof entry.prospectId === "string") &&
        (typeof entry.company === "undefined" || typeof entry.company === "string"),
    )
    .slice(0, 12)
    .map((entry) => ({
      id: entry.id as string,
      kind: entry.kind as LocalServicePilotActivityKind,
      label: entry.label as string,
      value: entry.value as string,
      serviceId: entry.serviceId as string,
      serviceTitle: entry.serviceTitle as string,
      prospectId: entry.prospectId as string | undefined,
      company: entry.company as string | undefined,
      createdAt: entry.createdAt as string,
    }));
}

function appendLocalServicePilotActivity(
  log: LocalServicePilotActivityEvent[],
  event: Omit<LocalServicePilotActivityEvent, "id" | "createdAt">,
): LocalServicePilotActivityEvent[] {
  const createdAt = new Date().toISOString();
  return [
    {
      ...event,
      id: `${createdAt}:${event.kind}:${event.serviceId}:${event.prospectId ?? "service"}`,
      createdAt,
    },
    ...log,
  ].slice(0, 12);
}

function readLocalServicePilotWorkspaceState(): LocalServicePilotWorkspaceState {
  const emptyState: LocalServicePilotWorkspaceState = {
    selectedProspectByService: {},
    statusByProspectKey: {},
    firstRequestOutcomeByProspectKey: {},
    weekOneOwnerDecisionByProspectKey: {},
    proposalApprovalByService: {},
    kickoffDecisionByService: {},
    weeklyScorecardSyncReviewedByService: {},
    metricStatusByService: {},
    setupStepCompletionByService: {},
    setupReadyByService: {},
    testCallChecklistByService: {},
    testCallPassedByService: {},
    contactProofByProspectKey: {},
    activityLog: [],
  };
  if (typeof window === "undefined") {
    return emptyState;
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return emptyState;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      selectedProspectByService: readStringRecord(parsed.selectedProspectByService),
      statusByProspectKey: readPilotStatusRecord(parsed.statusByProspectKey),
      firstRequestOutcomeByProspectKey: readFirstRequestOutcomeRecord(
        parsed.firstRequestOutcomeByProspectKey,
      ),
      weekOneOwnerDecisionByProspectKey: readWeekOneOwnerDecisionRecord(
        parsed.weekOneOwnerDecisionByProspectKey,
      ),
      proposalApprovalByService: readProposalApprovalDecisionRecord(parsed.proposalApprovalByService),
      kickoffDecisionByService: readKickoffDecisionRecord(parsed.kickoffDecisionByService),
      weeklyScorecardSyncReviewedByService: readBooleanRecord(parsed.weeklyScorecardSyncReviewedByService),
      metricStatusByService: readPilotMetricStatusRecord(parsed.metricStatusByService),
      setupStepCompletionByService: readSetupStepCompletionByService(parsed.setupStepCompletionByService),
      setupReadyByService: readBooleanRecord(parsed.setupReadyByService),
      testCallChecklistByService: readTestCallChecklistByService(parsed.testCallChecklistByService),
      testCallPassedByService: readBooleanRecord(parsed.testCallPassedByService),
      contactProofByProspectKey: readFounderContactProofByProspectKey(parsed.contactProofByProspectKey),
      activityLog: readPilotActivityLog(parsed.activityLog),
    };
  } catch {
    return emptyState;
  }
}

function latestCaseEventTitle(caseValue: WorkspaceCase, pattern: RegExp): string | null {
  return [...caseValue.events].reverse().find((event) => pattern.test(event.title))?.title ?? null;
}

function extractEventSuffix(
  caseValue: WorkspaceCase,
  pattern: RegExp,
  prefixPattern: RegExp,
  fallback: string,
): string {
  return latestCaseEventTitle(caseValue, pattern)?.replace(prefixPattern, "").trim() || fallback;
}

function collectMissingDocumentNames(caseValue: WorkspaceCase): string[] {
  return caseValue.documents.filter((item) => item.state !== "ok").map((item) => item.name);
}

function buildPlaybookPayloadPreview(
  template: PlaybookTemplate,
  wiki: RuntimeCaseWiki | undefined,
): PlaybookPayloadPreview {
  const { caseValue } = template;
  const missingDocuments = collectMissingDocumentNames(caseValue);
  const currentBlocker =
    wiki?.highlights.topBlockingQuestion?.question ??
    latestCaseEventTitle(caseValue, /missing|review|flag/i) ??
    null;
  const nextAction =
    wiki?.recommendedNextAction?.title ??
    wiki?.recommendedNextAction?.summary ??
    latestCaseEventTitle(caseValue, /calendar invite sent|approved|reminder|lead intake/i) ??
    caseValue.stage;

  switch (template.id) {
    case "lead-qualification":
      return {
        surfaceLabel: "Operator Console",
        surfacePath: `/app/console?ref=${encodeURIComponent(caseValue.ref)}`,
        payload: {
          case_ref: caseValue.ref,
          client: caseValue.client,
          delivery_channel: "operator_intake_review",
          lead_status: wiki?.overview.status ?? caseValue.stage.toLowerCase().replace(/\s+/g, "_"),
          visa_route: caseValue.visa,
          country: caseValue.country,
          missing_documents: missingDocuments,
          next_action: nextAction,
          surface_path: `/app/console?ref=${encodeURIComponent(caseValue.ref)}`,
        },
      };
    case "missing-documents":
      return {
        surfaceLabel: "Documents lane",
        surfacePath: `/app/console?ref=${encodeURIComponent(caseValue.ref)}&focus=documents`,
        payload: {
          case_ref: caseValue.ref,
          client: caseValue.client,
          delivery_channel: "protected_follow_up",
          follow_up_status: caseValue.approval ? "approval_required" : "ready_to_send",
          missing_documents: missingDocuments,
          next_contact_at: caseValue.approval ? "approval pending" : caseValue.updated,
          approval_owner: wiki?.recommendedNextAction?.owner ?? caseValue.owner,
          current_blocker: currentBlocker ?? "Missing documents still block the case",
          evidence_path: buildCaseEvidencePath(caseValue),
          surface_path: `/app/console?ref=${encodeURIComponent(caseValue.ref)}&focus=documents`,
        },
      };
    case "consultation-booking":
      return {
        surfaceLabel: "Presentation bundle",
        surfacePath: buildCaseBundlePath(caseValue),
        payload: {
          case_ref: caseValue.ref,
          client: caseValue.client,
          delivery_channel: "consultation_packet",
          consultation_at: extractEventSuffix(
            caseValue,
            /Calendar invite sent/i,
            /^Calendar invite sent · /i,
            "Consultation booked",
          ),
          eligibility_status: extractEventSuffix(
            caseValue,
            /Eligibility check passed/i,
            /^Eligibility check passed · /i,
            "Eligibility confirmed",
          ),
          packet_status: missingDocuments.length > 0 ? "review_before_consult" : "booking_ready",
          doc_blockers: missingDocuments,
          next_action: nextAction,
          surface_path: buildCaseBundlePath(caseValue),
        },
      };
    case "crm-handoff":
      return {
        surfaceLabel: "Case Vault",
        surfacePath: buildCaseVaultPath(caseValue),
        payload: {
          case_ref: caseValue.ref,
          client: caseValue.client,
          delivery_channel: "crm_handoff",
          case_status: wiki?.overview.status ?? caseValue.status,
          handoff_ready: caseValue.status === "resolved" || wiki?.overview.status === "resolved",
          approved_by:
            latestCaseEventTitle(caseValue, /Approved by reviewer/i)?.replace(/^Approved by /i, "") ??
            caseValue.owner,
          evidence_link: buildCaseEvidencePath(caseValue),
          bundle_path: buildCaseBundlePath(caseValue),
          surface_path: buildCaseVaultPath(caseValue),
        },
      };
    default:
      return {
        surfaceLabel: "Operator Console",
        surfacePath: `/app/console?ref=${encodeURIComponent(caseValue.ref)}`,
        payload: {
          case_ref: caseValue.ref,
          client: caseValue.client,
          next_action: nextAction,
          surface_path: `/app/console?ref=${encodeURIComponent(caseValue.ref)}`,
        },
      };
  }
}

function formatPayloadValue(value: boolean | number | string | string[]): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function buildLocalServicePayloadPreview(template: LocalServiceDemoTemplate): LocalServicePayloadPreview {
  return {
    surfaceLabel: "Dispatch handoff bundle",
    surfacePath: template.bundlePath,
    payload: {
      ...template.payload,
      evidence_link: template.evidencePath,
      bundle_path: template.bundlePath,
      approval_policy: "operator_required_before_customer_or_master_send",
    },
  };
}

function buildLocalServiceDispatchExport(
  template: LocalServiceDemoTemplate,
  payloadPreview: LocalServicePayloadPreview,
  kind: LocalServiceExportKind = "dispatch",
): LocalServiceDispatchExport {
  const outcome = template.highlights.find((item) => item.label === "Outcome")?.value ?? template.title;
  const approval =
    template.highlights.find((item) => item.label === "Approval")?.value ?? "Operator approval required";
  const evidence = template.highlights.find((item) => item.label === "Evidence")?.value ?? "Call transcript";
  const deliverable =
    template.highlights.find((item) => item.label === "Deliverable")?.value ?? "Dispatch job card";
  const payloadFieldSummary = Object.entries(payloadPreview.payload)
    .map(([key, value]) => `${key}=${formatPayloadValue(value)}`)
    .join("; ");
  const rows = [
    { label: "Service", value: `${template.ref} - ${template.title}` },
    { label: "Channel", value: template.channel },
    { label: "Outcome", value: outcome },
    { label: "Approval", value: approval },
    { label: "Evidence", value: evidence },
    { label: "Deliverable", value: deliverable },
    { label: "Handoff status", value: formatPayloadValue(payloadPreview.payload.handoff_status ?? "approval_required") },
    { label: "Evidence link", value: template.evidencePath },
    { label: "Bundle", value: payloadPreview.surfacePath },
  ];
  const title =
    kind === "customer"
      ? "Customer confirmation drawer"
      : kind === "handoff"
        ? "Master/operator handoff drawer"
        : "Dispatch payload drawer";
  const description =
    kind === "customer"
      ? "Review the customer-facing confirmation before sending it by phone, SMS, or Telegram."
      : kind === "handoff"
        ? "Review the master/operator handoff before sending the job to a technician or service team."
        : "Review the local-services job card before copying it into CRM, Telegram, or dispatcher tooling.";
  const copyLabel =
    kind === "customer"
      ? "Copy customer confirmation"
      : kind === "handoff"
        ? "Copy master handoff"
        : "Copy dispatch export";
  const surfaceActionLabel = "Open handoff bundle";
  const checklist =
    kind === "customer"
      ? [
          "Confirm customer name, phone, and preferred visit window.",
          "Confirm the operator has approved the slot or callback posture.",
          "Do not promise final price unless the operator has approved the estimate.",
          "Send the confirmation only through an approved customer channel.",
        ]
      : kind === "handoff"
        ? [
            "Confirm service type, district, address, and access notes.",
            "Confirm urgency and preferred visit window before assigning a master.",
            "Open the evidence link when call transcript or media proof needs review.",
            "Send to the master or service team only after operator approval.",
          ]
        : [
            "Confirm customer phone, district, and address before dispatch.",
            "Confirm price or estimate range before sending the customer confirmation.",
            "Open the evidence link if the call summary or media request needs review.",
            "Send to the master or service team only after operator approval.",
          ];
  const coreLines = [
    `${title}: ${template.title}`,
    `Service: ${template.ref}`,
    `Channel: ${template.channel}`,
    `Outcome: ${outcome}`,
    `Approval: ${approval}`,
    `Evidence: ${evidence}`,
    `Deliverable: ${deliverable}`,
  ];
  const humanLines =
    kind === "customer"
      ? [
          ...coreLines,
          `Customer confirmation: ${template.detail.customerConfirmation}`,
          `Telegram reply draft: ${template.detail.telegramIntake.replyDraft}`,
          "Customer send posture: operator approval required before final booking or price promise.",
          `Evidence link: ${template.evidencePath}`,
        ]
      : kind === "handoff"
        ? [
            ...coreLines,
            `Master/operator handoff: ${template.detail.operatorHandoff}`,
            `Required fields: ${template.detail.handoffFields.join(", ")}`,
            `Telegram normalized fields: ${template.detail.telegramIntake.normalizedFields.join(", ")}`,
            `Payload fields: ${payloadFieldSummary}`,
            `Canonical bundle: ${payloadPreview.surfacePath}`,
          ]
        : [
            ...coreLines,
            `Telegram intake: ${template.detail.telegramIntake.inboundMessage}`,
            `Customer confirmation: ${template.detail.customerConfirmation}`,
            `Master/operator handoff: ${template.detail.operatorHandoff}`,
            `Required fields: ${template.detail.handoffFields.join(", ")}`,
            `Payload fields: ${payloadFieldSummary}`,
            `Evidence link: ${template.evidencePath}`,
            `Canonical bundle: ${payloadPreview.surfacePath}`,
          ];
  const jsonText = JSON.stringify(
    {
      export_surface: title,
      export_kind: kind,
      service_ref: template.ref,
      service_id: template.id,
      channel: template.channel,
      canonical_surface: {
        label: payloadPreview.surfaceLabel,
        path: payloadPreview.surfacePath,
      },
      human_summary: Object.fromEntries(rows.map((row) => [row.label.toLowerCase().replace(/\s+/g, "_"), row.value])),
      telegram_intake: template.detail.telegramIntake,
      customer_confirmation: template.detail.customerConfirmation,
      operator_handoff: template.detail.operatorHandoff,
      checklist,
      payload: payloadPreview.payload,
    },
    null,
    2,
  );

  return {
    title,
    description,
    modeLabel: "Dispatch export mode",
    copyLabel,
    surfaceActionLabel,
    humanText: humanLines.join("\n"),
    jsonText,
    rows,
    checklist,
  };
}

function buildLocalServiceIntakeEvidence(
  template: LocalServiceDemoTemplate,
  payloadPreview: LocalServicePayloadPreview,
): LocalServiceIntakeEvidence {
  const transcript = [
    { speaker: "Phone customer", text: template.detail.sampleInput },
    { speaker: "AI intake", text: template.detail.phoneIntake.join(" ") },
    { speaker: "Telegram fallback", text: template.detail.telegramIntake.inboundMessage },
    { speaker: "System normalization", text: template.detail.telegramIntake.normalizedFields.join("; ") },
    { speaker: "Operator note", text: template.detail.operatorHandoff },
  ];
  const rows = [
    { label: "Service", value: `${template.ref} - ${template.title}` },
    { label: "Evidence link", value: template.evidencePath },
    { label: "Handoff bundle", value: template.bundlePath },
    { label: "Transcript source", value: `${template.channel} + Telegram fallback` },
    { label: "Approval gate", value: "operator_required_before_customer_or_master_send" },
  ];
  const checklist = [
    "Save the intake transcript before customer confirmation or master handoff.",
    "Open the evidence link when the operator needs to inspect call or Telegram proof.",
    "Keep photos, videos, and address data behind the same operator approval posture.",
    "Do not treat this drawer as a live Telegram, CRM, or phone storage integration.",
  ];
  const humanLines = [
    `Intake transcript + evidence link: ${template.title}`,
    `Service: ${template.ref}`,
    `Evidence link: ${template.evidencePath}`,
    `Handoff bundle: ${template.bundlePath}`,
    "",
    "Transcript preview:",
    ...transcript.map((entry) => `- ${entry.speaker}: ${entry.text}`),
    "",
    "Saved evidence outputs:",
    ...template.detail.evidenceOutput.map((item) => `- ${item}`),
    "",
    "Operator checklist:",
    ...checklist.map((item) => `- ${item}`),
    "",
    "Manual execution rule: this export does not write Telegram, CRM, phone storage, or scorecard state automatically.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_intake_evidence",
      export_kind: "transcript_evidence_link",
      service_ref: template.ref,
      service_id: template.id,
      channel: template.channel,
      evidence_link: template.evidencePath,
      bundle_path: template.bundlePath,
      transcript,
      evidence_output: template.detail.evidenceOutput,
      telegram_intake: template.detail.telegramIntake,
      normalized_fields: template.detail.telegramIntake.normalizedFields,
      approval_policy: template.detail.approvalPolicy,
      payload: payloadPreview.payload,
      guardrails: [
        "operator_review_required_before_customer_send",
        "operator_review_required_before_master_handoff",
        "no_live_channel_storage",
        "no_crm_write",
      ],
    },
    null,
    2,
  );

  return {
    title: "Intake transcript + evidence link",
    description:
      "Review the saved phone/Telegram transcript preview and canonical evidence link before handoff.",
    modeLabel: "Evidence export mode",
    copyLabel: "Copy intake evidence",
    humanText: humanLines.join("\n"),
    jsonText,
    rows,
    transcript,
    checklist,
  };
}

function buildLocalServicePilotWorkspaceExport(
  rows: LocalServicePilotFunnelRow[],
  counts: Record<LocalServicePilotStatus, number>,
  activityLog: LocalServicePilotActivityEvent[] = [],
): LocalServicePilotWorkspaceExport {
  const nextManualBatch = rows
    .filter((row) => row.status !== "reply_received" && row.status !== "rejected_for_now")
    .slice(0, 4);
  const statusSummary = LOCAL_SERVICE_PILOT_STATUS_ORDER.map(
    (status) => `${LOCAL_SERVICE_PILOT_STATUS_LABELS[status]}=${counts[status]}`,
  ).join("; ");
  const candidateLines = rows.map(
    (row) =>
      `- ${row.prospect.company} (${row.serviceTitle}, ${row.prospect.segment}) -> ${row.statusLabel}; next: ${row.prospect.nextStep}`,
  );
  const nextBatchLines =
    nextManualBatch.length > 0
      ? nextManualBatch.map((row) => `- ${row.prospect.company} (${row.serviceTitle}) -> ${row.statusLabel}`)
      : ["- none"];
  const activityLines =
    activityLog.length > 0
      ? activityLog.map(
          (event) =>
            `- ${event.createdAt} | ${event.serviceTitle} | ${event.company ?? "service"} | ${event.label}: ${event.value}`,
        )
      : ["- No manual activity recorded yet."];
  const humanLines = [
    "Pilot workspace export drawer: Local services mini-funnel",
    "Export scope: browser-local planning state",
    `Storage key: ${LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY}`,
    `All candidates: ${rows.length}`,
    `Status summary: ${statusSummary}`,
    "",
    "Next manual batch:",
    ...nextBatchLines,
    "",
    "Candidates:",
    ...candidateLines,
    "",
    "Manual activity log:",
    ...activityLines,
    "",
    "Manual execution rule: this export does not send messages, update CRM, or modify Markdown scorecards automatically.",
    "Operator action: review the state, then manually sync the selected notes into the pilot scorecard or CRM.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_pilot_workspace",
      export_kind: "browser_local_planning_state",
      storage_key: LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY,
      all_candidates: rows.length,
      status_counts: Object.fromEntries(
        LOCAL_SERVICE_PILOT_STATUS_ORDER.map((status) => [status, counts[status]]),
      ),
      status_labels: LOCAL_SERVICE_PILOT_STATUS_LABELS,
      next_manual_batch: nextManualBatch.map((row) => ({
        key: row.key,
        service_id: row.serviceId,
        service_title: row.serviceTitle,
        company: row.prospect.company,
        segment: row.prospect.segment,
        status: row.status,
        status_label: row.statusLabel,
        next_step: row.prospect.nextStep,
      })),
      candidates: rows.map((row) => ({
        key: row.key,
        service_id: row.serviceId,
        service_title: row.serviceTitle,
        prospect_id: row.prospect.id,
        company: row.prospect.company,
        segment: row.prospect.segment,
        channel_fit: row.prospect.channelFit,
        why_now: row.prospect.whyNow,
        scorecard_focus: row.prospect.scorecardFocus,
        next_step: row.prospect.nextStep,
        status: row.status,
        status_label: row.statusLabel,
      })),
      activity_log: activityLog.map((event) => ({
        id: event.id,
        kind: event.kind,
        label: event.label,
        value: event.value,
        service_id: event.serviceId,
        service_title: event.serviceTitle,
        prospect_id: event.prospectId,
        company: event.company,
        created_at: event.createdAt,
      })),
      guardrails: [
        "operator_review_required_before_copy",
        "no_outbound_message_sent",
        "no_crm_write",
        "no_external_side_effects",
        "manual_scorecard_sync_required",
      ],
    },
    null,
    2,
  );
  const rowsSummary = [
    { label: "All candidates", value: String(rows.length) },
    { label: "Storage", value: LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY },
    { label: "Status summary", value: statusSummary },
    {
      label: "Next manual batch",
      value: nextManualBatch.map((row) => `${row.prospect.company} / ${row.serviceTitle}`).join(", ") || "none",
    },
    { label: "Last manual action", value: activityLog[0] ? `${activityLog[0].label}: ${activityLog[0].value}` : "none" },
    { label: "Guardrail", value: "No outbound message, no CRM write, manual scorecard sync only" },
  ];
  const checklist = [
    "Confirm the browser-local statuses match the operator's latest manual outreach notes.",
    "Review the manual activity log before copying the export.",
    "Review the next manual batch before copying the export.",
    "Manually sync useful notes into the pilot scorecard or CRM after review.",
    "Do not treat this export as proof that outreach was sent.",
  ];

  return {
    title: "Pilot workspace export drawer",
    description:
      "Export the local-services pilot mini-funnel as a reviewed operator note or JSON payload. It stays browser-local and does not send messages or write CRM.",
    eyebrow: "Pilot workspace export",
    modeLabel: "Pilot export mode",
    copyLabel: "Copy pilot workspace export",
    reviewTitle: "Operator review checklist",
    reviewDescription:
      "This export is a planning artifact only: no outbound message, no CRM write, no scorecard mutation.",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: rowsSummary,
    checklist,
  };
}

function buildLocalServiceFounderBatchReviewExport(
  rows: LocalServiceFounderContactRow[],
  counts: {
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  },
  proofChecklist: { label: string; status: string; done: boolean }[],
  proofProgress: string,
  decisionGate: LocalServiceFounderDecisionGate,
  categoryScores: LocalServiceCategoryPilotScore[],
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  pilotReadiness: LocalServiceLeadingCategoryPilotReadiness,
  readinessActionPlan: LocalServicePilotReadinessActionPlan,
  activityLog: LocalServicePilotActivityEvent[] = [],
): LocalServicePilotWorkspaceExport {
  const contactLines = rows.map(
    (row, index) =>
      `${index + 1}. ${row.prospect.company} | ${row.serviceTitle} | ${row.prospect.segment} | ${row.statusLabel} | ${row.proofStatus} | next: ${row.prospect.nextStep}`,
  );
  const checklistLines = proofChecklist.map((item) => `- ${item.done ? "done" : "pending"} | ${item.label}: ${item.status}`);
  const recentProofEvents = activityLog.filter((event) => event.kind === "contact_proof").slice(0, 8);
  const activityLines =
    recentProofEvents.length > 0
      ? recentProofEvents.map(
          (event) =>
            `- ${event.createdAt} | ${event.serviceTitle} | ${event.company ?? "service"} | ${event.label}: ${event.value}`,
        )
      : ["- No contact proof events recorded yet."];
  const categoryLines = categoryScores.map(
    (score) =>
      `${score.rank}. ${score.serviceTitle} | score ${score.score} | ${score.signalLabel} | ${score.proofSummary} | next: ${score.nextAction}`,
  );
  const leadCategory = categoryScores[0];
  const actionLayerLines = [
    `Posture: ${actionLayer.posture}`,
    `Action: ${actionLayer.action}`,
    "Next manual batch:",
    ...actionLayer.nextManualBatch.map(
      (item) => `- ${item.company} (${item.segment}) -> ${item.statusLabel}; next: ${item.nextStep}`,
    ),
    "Discovery questions:",
    ...actionLayer.discoveryQuestions.map((question) => `- ${question}`),
    "Pilot setup checklist:",
    ...actionLayer.pilotSetupChecklist.map((item) => `- ${item}`),
    "Integration hold:",
    ...actionLayer.integrationHold.map((item) => `- ${item}`),
  ];
  const readinessLines = [
    `Readiness: ${pilotReadiness.readinessLabel}`,
    `Progress: ${pilotReadiness.progressLabel}`,
    `Paid pilot gate: ${pilotReadiness.paidPilotGate}`,
    `Next action: ${pilotReadiness.nextAction}`,
    "Readiness checklist:",
    ...pilotReadiness.checklist.map((item) => `- ${item.done ? "done" : "blocked"} | ${item.label}: ${item.status}`),
    "Blockers:",
    ...(pilotReadiness.blockers.length > 0 ? pilotReadiness.blockers.map((item) => `- ${item}`) : ["- none"]),
  ];
  const readinessActionPlanLines = [
    `Primary surface: ${readinessActionPlan.primarySurface}`,
    `Primary action: ${readinessActionPlan.primaryAction}`,
    `Secondary action: ${readinessActionPlan.secondaryAction}`,
    `Operator script: ${readinessActionPlan.operatorScript}`,
    "No-go rules:",
    ...readinessActionPlan.noGo.map((item) => `- ${item}`),
  ];
  const humanLines = [
    "First contact batch review drawer: Local services founder validation",
    "Export scope: browser-local proof review for the first 10 manual contacts",
    `Storage key: ${LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY}`,
    `Proof progress: ${proofProgress}`,
    `Channel checked: ${counts.channelChecked}/10`,
    `Manual sends logged: ${counts.manualMessageSent}/10`,
    `Replies or clear rejections: ${counts.repliesOrRejections}/3`,
    `Discovery calls: ${counts.discoveryCalls}/1`,
    `Demos booked: ${counts.demosBooked}/1`,
    `Pilot candidates: ${counts.pilotCandidates}/1`,
    `Decision gate: ${decisionGate.verdictLabel}`,
    `Decision action: ${decisionGate.action}`,
    `Target lane: ${decisionGate.targetLane}`,
    `Category pilot score: ${leadCategory ? `${leadCategory.serviceTitle} / ${leadCategory.score} / ${leadCategory.signalLabel}` : "none"}`,
    "",
    "Pilot proof checklist:",
    ...checklistLines,
    "",
    "Category pilot score:",
    ...categoryLines,
    "",
    "Leading category action layer:",
    ...actionLayerLines,
    "",
    "Pilot setup readiness:",
    ...readinessLines,
    "",
    "Readiness action plan:",
    ...readinessActionPlanLines,
    "",
    "First 10 contact review:",
    ...contactLines,
    "",
    "Recent proof activity:",
    ...activityLines,
    "",
    "Manual execution rule: this review does not send outreach, create bookings, write CRM, sync analytics, bill, or mutate Markdown docs.",
    "Operator action: copy only after confirming the browser-local markers match real manual outreach notes.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_first_contact_batch_review",
      export_kind: "founder_manual_validation_review",
      storage_key: LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY,
      proof_progress: proofProgress,
      proof_counts: counts,
      decision_gate: {
        verdict: decisionGate.verdictLabel,
        posture: decisionGate.posture,
        action: decisionGate.action,
        target_lane: decisionGate.targetLane,
        ready_to_continue: decisionGate.readyToContinue,
        proof_summary: decisionGate.proofSummary,
        stop_rules: decisionGate.stopRules,
        continue_rules: decisionGate.continueRules,
      },
      category_pilot_score: {
        export_surface: "local_services_category_pilot_score",
        rule: "no_category_expansion_without_proof",
        leading_category: leadCategory
          ? {
              service_id: leadCategory.serviceId,
              service_title: leadCategory.serviceTitle,
              score: leadCategory.score,
              signal_label: leadCategory.signalLabel,
              proof_summary: leadCategory.proofSummary,
              next_action: leadCategory.nextAction,
            }
          : null,
        categories: categoryScores.map((score) => ({
          rank: score.rank,
          service_id: score.serviceId,
          service_title: score.serviceTitle,
          score: score.score,
          signal_label: score.signalLabel,
          proof_summary: score.proofSummary,
          next_action: score.nextAction,
          counts: score.counts,
        })),
      },
      leading_category_action_layer: {
        export_surface: "local_services_leading_category_action_layer",
        service_id: actionLayer.serviceId,
        service_title: actionLayer.serviceTitle,
        signal_label: actionLayer.signalLabel,
        posture: actionLayer.posture,
        action: actionLayer.action,
        next_manual_batch: actionLayer.nextManualBatch,
        discovery_questions: actionLayer.discoveryQuestions,
        pilot_setup_checklist: actionLayer.pilotSetupChecklist,
        integration_hold: actionLayer.integrationHold,
      },
      pilot_setup_readiness: {
        export_surface: "local_services_pilot_setup_readiness",
        service_id: pilotReadiness.serviceId,
        service_title: pilotReadiness.serviceTitle,
        readiness_label: pilotReadiness.readinessLabel,
        progress_label: pilotReadiness.progressLabel,
        paid_pilot_gate: pilotReadiness.paidPilotGate,
        next_action: pilotReadiness.nextAction,
        ready_to_pilot: pilotReadiness.readyToPilot,
        checklist: pilotReadiness.checklist,
        blockers: pilotReadiness.blockers,
        ready_signals: pilotReadiness.readySignals,
      },
      readiness_action_plan: {
        export_surface: readinessActionPlan.exportSurface,
        service_id: readinessActionPlan.serviceId,
        service_title: readinessActionPlan.serviceTitle,
        primary_surface: readinessActionPlan.primarySurface,
        primary_action: readinessActionPlan.primaryAction,
        secondary_action: readinessActionPlan.secondaryAction,
        operator_script: readinessActionPlan.operatorScript,
        no_go: readinessActionPlan.noGo,
      },
      proof_checklist: proofChecklist,
      first_contacts: rows.map((row, index) => ({
        index: index + 1,
        key: row.key,
        service_id: row.serviceId,
        service_title: row.serviceTitle,
        prospect_id: row.prospect.id,
        company: row.prospect.company,
        segment: row.prospect.segment,
        channel_fit: row.prospect.channelFit,
        why_now: row.prospect.whyNow,
        scorecard_focus: row.prospect.scorecardFocus,
        next_step: row.prospect.nextStep,
        status: row.status,
        status_label: row.statusLabel,
        proof_status: row.proofStatus,
        proof: {
          channel_checked: row.channelChecked,
          manual_message_sent: row.manualMessageSent,
          discovery_call_completed: row.discoveryCallCompleted,
          demo_booked: row.demoBooked,
          pilot_candidate: row.pilotCandidate,
        },
      })),
      recent_proof_activity: recentProofEvents.map((event) => ({
        id: event.id,
        label: event.label,
        value: event.value,
        service_id: event.serviceId,
        service_title: event.serviceTitle,
        prospect_id: event.prospectId,
        company: event.company,
        created_at: event.createdAt,
      })),
      guardrails: [
        "operator_review_required_before_copy",
        "no_outbound_message_sent",
        "no_booking_created",
        "no_crm_write",
        "no_analytics_sync",
        "no_billing_action",
        "no_markdown_mutation",
      ],
    },
    null,
    2,
  );
  const rowsSummary = [
    { label: "Review scope", value: "First 10 manual contacts" },
    { label: "Proof progress", value: proofProgress },
    { label: "Manual sends", value: `${counts.manualMessageSent}/10` },
    { label: "Replies / rejections", value: `${counts.repliesOrRejections}/3` },
    { label: "Discovery calls", value: `${counts.discoveryCalls}/1` },
    { label: "Pilot candidates", value: `${counts.pilotCandidates}/1` },
    { label: "Decision gate", value: decisionGate.verdictLabel },
    {
      label: "Leading category",
      value: leadCategory ? `${leadCategory.serviceTitle} / ${leadCategory.score} / ${leadCategory.signalLabel}` : "none",
    },
    { label: "Pilot setup readiness", value: `${pilotReadiness.readinessLabel} / ${pilotReadiness.progressLabel}` },
    { label: "Readiness action plan", value: readinessActionPlan.primarySurface },
  ];
  const checklist = [
    "Confirm the first 10 contact markers match real manual actions outside the shell.",
    "Confirm the leading category is based on proof markers, not preference or market guesswork.",
    "Confirm the pilot setup readiness gate is complete before selling or activating a paid pilot.",
    "Confirm the readiness action plan points to the next blocker surface before continuing.",
    "Confirm no private customer names, phone numbers, addresses, or deal terms are stored in this browser-local export.",
    "Copy the review into private founder notes only after operator review.",
    "Stop product expansion if replies, discovery calls, or pilot candidates do not appear after this batch.",
    "Do not treat this review as proof that the product sent outreach.",
  ];

  return {
    title: "First contact batch review drawer",
    description:
      "Review the first 10 manual contact proof markers before copying a private founder note or deciding whether to continue.",
    eyebrow: "First batch review",
    modeLabel: "Batch review mode",
    copyLabel: "Copy batch review",
    reviewTitle: "Founder validation checklist",
    reviewDescription:
      "This is a browser-local review artifact only: no outbound message, no booking, no CRM write, no analytics sync.",
    executionActionLabel: "Open founder execution log",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: rowsSummary,
    checklist,
  };
}

function buildLocalServicePilotOpsConfirmationExport(
  row: LocalServiceFounderContactRow | undefined,
  nextManualAction: string,
  proofMarker: string,
  proofProgress: string,
  decisionGate: LocalServiceFounderDecisionGate,
): LocalServicePilotWorkspaceExport {
  const proofLabel =
    proofMarker in LOCAL_SERVICE_FOUNDER_CONTACT_FIELD_LABELS
      ? LOCAL_SERVICE_FOUNDER_CONTACT_FIELD_LABELS[proofMarker as LocalServiceFounderContactField]
      : proofMarker === "reply_or_rejection_status"
        ? "Reply or rejection status"
        : proofMarker === "founder_batch_review"
          ? "Founder batch review"
          : "Target required";
  const proofInstruction = row
    ? proofMarker === "reply_or_rejection_status"
      ? "Record only a real owner reply or a clear rejection in the browser-local status control."
      : proofMarker === "founder_batch_review"
        ? "Open the batch review and decide continue, revise, or stop from the recorded proof."
        : proofMarker in LOCAL_SERVICE_FOUNDER_CONTACT_FIELD_LABELS
          ? `After the real manual action happens, update the ${proofLabel} marker for this account in the first-10 workspace.`
          : "Load a target from the outreach list before recording proof."
    : "Load a target from the outreach list before recording proof.";
  const humanLines = [
    "Pilot ops confirmation drawer: Local services manual action",
    "Export surface: local_services_pilot_ops_confirmation",
    `Storage key: ${LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY}`,
    "Manual-only proof confirmation. This drawer does not send outreach, create bookings, write CRM, sync analytics, bill, or mutate Markdown docs.",
    `Current account: ${row ? row.prospect.company : "none"}`,
    `Service lane: ${row ? row.serviceTitle : "none"}`,
    `Segment: ${row ? row.prospect.segment : "none"}`,
    `Current status: ${row ? row.statusLabel : "none"}`,
    `Next manual action: ${nextManualAction}`,
    `Proof marker to update: ${proofMarker}`,
    `Proof label: ${proofLabel}`,
    `Proof instruction: ${proofInstruction}`,
    `Owner next step: ${row ? row.prospect.nextStep : "none"}`,
    `Batch proof progress: ${proofProgress}`,
    `Decision gate: ${decisionGate.verdictLabel}`,
    "",
    "Operator confirmation checklist:",
    "- Confirm the real action happened outside the shell before updating any marker.",
    "- Confirm the account and service lane match the manual note.",
    "- Keep private notes, phone numbers, addresses, and owner names outside this browser-local export.",
    "- Update only browser-local proof markers after the real action is complete.",
    "- Reopen the first contact batch review before using this proof for a continue or stop decision.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_pilot_ops_confirmation",
      export_kind: "manual_pilot_action_confirmation",
      storage_key: LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY,
      current_account: row
        ? {
            key: row.key,
            service_id: row.serviceId,
            service_title: row.serviceTitle,
            prospect_id: row.prospect.id,
            company: row.prospect.company,
            segment: row.prospect.segment,
            status: row.status,
            status_label: row.statusLabel,
            proof_status: row.proofStatus,
          }
        : null,
      next_manual_action: nextManualAction,
      proof_marker: proofMarker,
      proof_label: proofLabel,
      proof_instruction: proofInstruction,
      owner_next_step: row?.prospect.nextStep ?? null,
      proof_progress: proofProgress,
      decision_gate: {
        verdict: decisionGate.verdictLabel,
        action: decisionGate.action,
        target_lane: decisionGate.targetLane,
      },
      guardrails: [
        "operator_confirmation_required",
        "browser_local_marker_only",
        "no_outbound_message_sent",
        "no_booking_created",
        "no_crm_write",
        "no_analytics_sync",
        "no_billing_action",
        "no_markdown_mutation",
      ],
    },
    null,
    2,
  );
  return {
    title: "Pilot ops confirmation drawer",
    description:
      "Confirm the next manual pilot action and proof marker before the operator updates any browser-local state.",
    eyebrow: "Pilot ops proof",
    modeLabel: "Ops confirmation mode",
    copyLabel: "Copy ops confirmation",
    reviewTitle: "Manual proof checklist",
    reviewDescription:
      "Use this only after the real action happens outside the shell. It is not an outreach, CRM, booking, billing, or analytics integration.",
    executionActionLabel: "Open founder execution log",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Current account", value: row ? row.prospect.company : "No account selected" },
      { label: "Service lane", value: row ? row.serviceTitle : "No service lane" },
      { label: "Next manual action", value: nextManualAction },
      { label: "Proof marker", value: proofMarker },
      { label: "Proof instruction", value: proofInstruction },
      { label: "Proof progress", value: proofProgress },
      { label: "Decision gate", value: decisionGate.verdictLabel },
      { label: "Owner next step", value: row ? row.prospect.nextStep : "Load a target from the outreach list." },
    ],
    checklist: [
      "Confirm the real manual action happened outside the shell before updating any marker.",
      "Confirm the selected account and service lane match the manual note.",
      "Confirm no private contact data is pasted into this export.",
      "Update only browser-local proof markers after the action is complete.",
      "Open batch review after proof changes before deciding continue, revise, or stop.",
      "Do not treat this drawer as proof that the platform sent outreach or booked work.",
    ],
  };
}

function buildLocalServiceFounderDecisionGate(
  rows: LocalServiceFounderContactRow[],
  counts: {
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  },
): LocalServiceFounderDecisionGate {
  const laneScores = new Map<string, { lane: string; score: number }>();
  for (const row of rows) {
    const existing = laneScores.get(row.serviceId) ?? { lane: row.serviceTitle, score: 0 };
    existing.score += row.channelChecked ? 1 : 0;
    existing.score += row.manualMessageSent ? 2 : 0;
    existing.score += row.status === "reply_received" || row.status === "rejected_for_now" ? 3 : 0;
    existing.score += row.discoveryCallCompleted ? 5 : 0;
    existing.score += row.demoBooked ? 6 : 0;
    existing.score += row.pilotCandidate ? 10 : 0;
    laneScores.set(row.serviceId, existing);
  }
  const strongestLane =
    Array.from(laneScores.values()).sort((a, b) => b.score - a.score)[0]?.lane ?? "AC repair dispatch";
  const firstBatchComplete = counts.manualMessageSent >= 10;
  const hasStrongDemandSignal = counts.pilotCandidates > 0 || counts.demosBooked > 0 || counts.discoveryCalls > 0;
  const hasWeakButUsefulSignal = counts.repliesOrRejections >= 3;
  const proofSummary = `${counts.manualMessageSent}/10 sent, ${counts.repliesOrRejections}/3 replies or rejections, ${counts.discoveryCalls}/1 discovery calls, ${counts.pilotCandidates}/1 pilot candidates`;
  const stopRules = [
    "Stop category expansion if 10 targeted contacts produce no replies, calls, demos, or pilot candidates.",
    "Stop integration work if owners only ask for ads, marketplace demand, or generic lead volume.",
    "Stop automation build-out if the business has no phone, Telegram, booking, dispatch, or approval pain.",
  ];
  const continueRules = [
    "Continue only when at least one owner confirms missed-call, delayed-response, quote, booking, or dispatch pain.",
    "Continue only when a real owner or dispatcher accepts a 7-minute demo or 14-day manual pilot.",
    "Continue by deepening the strongest category lane first, not by adding new categories.",
  ];

  if (!firstBatchComplete) {
    return {
      verdictLabel: "Keep collecting proof",
      posture: "First 10 contacts not complete",
      action: "Finish the first 10 manual contacts before changing category strategy or adding integrations.",
      targetLane: strongestLane,
      tone: "collect",
      readyToContinue: false,
      proofSummary,
      stopRules,
      continueRules,
    };
  }

  if (hasStrongDemandSignal) {
    return {
      verdictLabel: "Continue to pilot setup",
      posture: "Demand signal found",
      action: `Deepen ${strongestLane}, prepare one operator-approved pilot, and do not add a new category yet.`,
      targetLane: strongestLane,
      tone: "continue",
      readyToContinue: true,
      proofSummary,
      stopRules,
      continueRules,
    };
  }

  if (hasWeakButUsefulSignal) {
    return {
      verdictLabel: "Revise offer before building",
      posture: "Replies exist but no pilot signal",
      action: "Rewrite the offer and message from rejection reasons, then run one more manual batch before engineering more automation.",
      targetLane: strongestLane,
      tone: "revise",
      readyToContinue: false,
      proofSummary,
      stopRules,
      continueRules,
    };
  }

  return {
    verdictLabel: "Stop expansion for now",
    posture: "No useful demand signal after first batch",
    action: "Do not add channels, billing, CRM, or new categories; change the offer or prospect list before writing more product code.",
    targetLane: strongestLane,
    tone: "stop",
    readyToContinue: false,
    proofSummary,
    stopRules,
    continueRules,
  };
}

function buildLocalServiceCategoryPilotScores(
  rows: LocalServiceFounderContactRow[],
): LocalServiceCategoryPilotScore[] {
  return LOCAL_SERVICE_DEMO_TEMPLATES.map((template) => {
    const laneRows = rows.filter((row) => row.serviceId === template.id);
    const counts = {
      contacts: laneRows.length,
      channelChecked: laneRows.filter((row) => row.channelChecked).length,
      manualMessageSent: laneRows.filter((row) => row.manualMessageSent).length,
      repliesOrRejections: laneRows.filter(
        (row) => row.status === "reply_received" || row.status === "rejected_for_now",
      ).length,
      discoveryCalls: laneRows.filter((row) => row.discoveryCallCompleted).length,
      demosBooked: laneRows.filter((row) => row.demoBooked).length,
      pilotCandidates: laneRows.filter((row) => row.pilotCandidate).length,
    };
    const score =
      counts.channelChecked * 1 +
      counts.manualMessageSent * 2 +
      counts.repliesOrRejections * 3 +
      counts.discoveryCalls * 5 +
      counts.demosBooked * 6 +
      counts.pilotCandidates * 10;
    const signalLabel: LocalServiceCategoryPilotScore["signalLabel"] =
      counts.pilotCandidates > 0 || score >= 18
        ? "Lead category"
        : counts.discoveryCalls > 0 || counts.demosBooked > 0 || score >= 10
          ? "Active signal"
          : counts.manualMessageSent > 0 || counts.repliesOrRejections > 0 || score >= 4
            ? "Needs more proof"
            : "Unproven";
    const nextAction =
      signalLabel === "Lead category"
        ? "Deepen this category before adding new lanes."
        : signalLabel === "Active signal"
          ? "Run one more targeted batch before integration work."
          : signalLabel === "Needs more proof"
            ? "Finish manual sends and capture reply reasons."
            : "Do not build category-specific integrations yet.";

    return {
      serviceId: template.id,
      serviceTitle: template.title,
      rank: 0,
      score,
      signalLabel,
      proofSummary: `${counts.manualMessageSent}/${counts.contacts} manual sends, ${counts.repliesOrRejections} replies or rejections, ${counts.discoveryCalls} calls, ${counts.pilotCandidates} pilot candidates`,
      nextAction,
      counts,
    };
  })
    .sort((a, b) => b.score - a.score || b.counts.manualMessageSent - a.counts.manualMessageSent)
    .map((score, index) => ({ ...score, rank: index + 1 }));
}

function buildLocalServiceLeadingCategoryActionLayer(
  score: LocalServiceCategoryPilotScore | undefined,
  rows: LocalServiceFounderContactRow[],
): LocalServiceLeadingCategoryActionLayer {
  const fallbackTemplate = LOCAL_SERVICE_DEMO_TEMPLATES[0];
  const template =
    LOCAL_SERVICE_DEMO_TEMPLATES.find((item) => item.id === score?.serviceId) ?? fallbackTemplate;
  const laneRows = rows.filter((row) => row.serviceId === template.id);
  const pendingLaneRows = laneRows.filter(
    (row) =>
      !row.manualMessageSent ||
      row.status === "not_contacted" ||
      row.status === "draft_ready" ||
      row.status === "contacted_manually",
  );
  const nextManualBatch = (pendingLaneRows.length > 0 ? pendingLaneRows : laneRows).slice(0, 3).map((row) => ({
    company: row.prospect.company,
    segment: row.prospect.segment,
    statusLabel: row.statusLabel,
    nextStep: row.prospect.nextStep,
  }));
  const signalLabel = score?.signalLabel ?? "Unproven";
  const posture =
    signalLabel === "Lead category"
      ? "Pilot-ready lane, but still operator-approved only."
      : signalLabel === "Active signal"
        ? "Promising lane; run one more focused batch before integration work."
        : signalLabel === "Needs more proof"
          ? "Useful early signal; keep outreach manual and capture rejection reasons."
          : "Unproven lane; do not build category-specific automation yet.";
  const action =
    signalLabel === "Lead category"
      ? `Prepare one operator-approved ${template.title} pilot and stop adding new categories.`
      : signalLabel === "Active signal"
        ? `Focus the next manual batch on ${template.title} and validate owner pain before build-out.`
        : signalLabel === "Needs more proof"
          ? `Finish manual sends for ${template.title}, then compare replies before changing the offer.`
          : `Keep ${template.title} as research only until real owner replies appear.`;
  const discoveryQuestions = [
    `Where do ${template.title.toLowerCase()} requests arrive first: phone, Telegram, Instagram, marketplace, or walk-in?`,
    "How many requests per week are missed, delayed, or lost because the first response is late?",
    "Which details must the assistant collect before a dispatcher or owner can approve the quote, slot, or master?",
    "What price, slot, address, material, or final promise must always stay human-approved?",
    `What would make a 14-day ${template.title} pilot worth paying for?`,
  ];
  const pilotSetupChecklist = [
    `Focus only on ${template.title} until the next manual batch changes the score.`,
    "Pick one owner/operator and one real channel to observe before any live integration.",
    "Prepare a 7-minute demo using the lane offer, sample input, and approval policy.",
    "Run the test call/message gate before any customer-facing pilot traffic.",
    "Copy discovery call prep only after a real reply appears.",
  ];
  const integrationHold = [
    "No live phone, Telegram, WhatsApp, CRM, calendar, analytics, billing, or marketplace integration before proof.",
    "No category-specific workflow build-out while the lane is Needs more proof or Unproven.",
    "No booking, price, master assignment, material availability, or customer promise without operator approval.",
  ];

  return {
    serviceId: template.id,
    serviceTitle: template.title,
    signalLabel,
    posture,
    action,
    nextManualBatch,
    discoveryQuestions,
    pilotSetupChecklist,
    integrationHold,
  };
}

function buildLocalServiceLeadingCategoryPilotReadiness(
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  score: LocalServiceCategoryPilotScore | undefined,
  setupStepCompletion: LocalServiceSetupStepCompletion,
  setupReady: boolean,
  testCallPassed: boolean,
  metricStatus: LocalServicePilotMetricStatus,
  ownerDecision: LocalServiceWeekOneOwnerDecision,
): LocalServiceLeadingCategoryPilotReadiness {
  const setupPrerequisites: LocalServiceSetupStepId[] = [
    "business_profile",
    "knowledge_sources",
    "agent_behavior",
    "test_call_message",
  ];
  const completedSetupPrerequisites = setupPrerequisites.filter((stepId) => setupStepCompletion[stepId] === true).length;
  const hasProofSignal =
    score?.signalLabel === "Lead category" ||
    (score?.counts.discoveryCalls ?? 0) > 0 ||
    (score?.counts.demosBooked ?? 0) > 0 ||
    (score?.counts.pilotCandidates ?? 0) > 0;
  const hasRealConversation = (score?.counts.discoveryCalls ?? 0) > 0 || (score?.counts.pilotCandidates ?? 0) > 0;
  const metricStarted = metricStatus !== "not_started";
  const ownerDecisionLabel = LOCAL_SERVICE_WEEK_ONE_OWNER_DECISION_LABELS[ownerDecision];
  const ownerDecisionStatus =
    ownerDecision === "continue"
      ? "Continue recorded; paid-pilot proposal path can open if all other gates pass"
      : ownerDecision === "pause"
        ? "Pause recorded; resolve owner blockers before any proposal"
        : ownerDecision === "stop"
          ? "Stop recorded; do not prepare a paid pilot proposal"
          : "Needs Continue, Pause, or Stop recorded from week-one review";
  const checklist = [
    {
      label: "Category proof signal",
      status: score
        ? `${score.signalLabel}; ${score.proofSummary}`
        : "No category score yet",
      done: hasProofSignal,
    },
    {
      label: "Setup prerequisites",
      status: `${completedSetupPrerequisites}/${setupPrerequisites.length} setup steps complete`,
      done: completedSetupPrerequisites === setupPrerequisites.length,
    },
    {
      label: "Ready for pilot test",
      status: setupReady ? "Ready for pilot test recorded" : "Needs ready gate",
      done: setupReady,
    },
    {
      label: "Test call/message passed",
      status: testCallPassed ? "Test call passed" : "Needs passing dry run",
      done: testCallPassed,
    },
    {
      label: "Real owner conversation",
      status: hasRealConversation ? "Discovery or pilot signal exists" : "Needs reply or discovery call",
      done: hasRealConversation,
    },
    {
      label: "Metric baseline",
      status: LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus],
      done: metricStarted,
    },
    {
      label: "Week-one owner decision",
      status: ownerDecisionStatus,
      done: ownerDecision === "continue",
    },
  ];
  const completed = checklist.filter((item) => item.done).length;
  const readyToPilot = checklist.every((item) => item.done);
  const ownerDecisionBlocksPaidPilot = ownerDecision === "pause" || ownerDecision === "stop";
  const readinessLabel: LocalServiceLeadingCategoryPilotReadiness["readinessLabel"] =
    readyToPilot
      ? "Ready for first paid pilot"
      : ownerDecisionBlocksPaidPilot
        ? "Not ready for paid pilot"
        : completed >= 5
          ? "Pilot setup almost ready"
          : "Not ready for paid pilot";
  const blockers = checklist.filter((item) => !item.done).map((item) => `${item.label}: ${item.status}`);
  const readySignals = checklist.filter((item) => item.done).map((item) => `${item.label}: ${item.status}`);
  const nextAction =
    ownerDecision === "pause"
      ? "Open week-one review, capture the owner blocker, and do not prepare a proposal until Continue is recorded."
      : ownerDecision === "stop"
        ? "Prepare a clean stop packet and do not move this lane into paid-pilot proposal work."
        : blockers[0] ??
          `Prepare one paid ${actionLayer.serviceTitle} pilot proposal and keep sends operator-approved.`;
  const paidPilotGate =
    ownerDecision === "stop"
      ? "Owner decision is Stop; do not prepare a paid pilot proposal for this lane."
      : ownerDecision === "pause"
        ? "Owner decision is Pause; keep proof collection manual and resolve blockers before proposal work."
        : readyToPilot
          ? "Paid pilot proposal can be prepared; live sends, bookings, CRM, and billing still require operator approval."
          : "Do not sell or activate a paid pilot yet; finish the blocking proof, setup, dry-run, conversation, metric, and owner-decision gates first.";

  return {
    serviceId: actionLayer.serviceId,
    serviceTitle: actionLayer.serviceTitle,
    ownerDecision,
    ownerDecisionLabel,
    readinessLabel,
    progressLabel: `${completed}/${checklist.length}`,
    paidPilotGate,
    nextAction,
    readyToPilot,
    checklist,
    blockers,
    readySignals,
  };
}

function buildLocalServicePilotReadinessActionPlan(
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  readiness: LocalServiceLeadingCategoryPilotReadiness,
): LocalServicePilotReadinessActionPlan {
  const firstBlocker = readiness.blockers[0] ?? "";
  const primarySurface: LocalServicePilotReadinessActionPlan["primarySurface"] =
    firstBlocker.includes("Setup prerequisites") ||
    firstBlocker.includes("Ready for pilot test") ||
    firstBlocker.includes("Test call/message")
      ? "Setup path"
      : firstBlocker.includes("Category proof signal") || firstBlocker.includes("Real owner conversation")
        ? "Founder batch review"
        : firstBlocker.includes("Metric baseline")
          ? "Pilot metrics tracker"
          : firstBlocker.includes("Week-one owner decision")
            ? "Week-one review"
          : "Paid pilot proposal";
  const primaryAction =
    primarySurface === "Setup path"
      ? `Open the 7-minute setup wizard for ${actionLayer.serviceTitle}, finish setup prerequisites, and pass the dry run.`
      : primarySurface === "Founder batch review"
        ? `Open batch review, capture real owner proof for ${actionLayer.serviceTitle}, and keep the next batch manual.`
        : primarySurface === "Pilot metrics tracker"
          ? `Open metrics tracker for ${actionLayer.serviceTitle} and record the baseline before any paid pilot promise.`
          : primarySurface === "Week-one review"
            ? `Open week-one review for ${actionLayer.serviceTitle}, record Continue/Pause/Stop, and keep proposal work blocked unless Continue is recorded.`
          : `Prepare one operator-approved ${actionLayer.serviceTitle} paid pilot proposal; do not activate live channels yet.`;
  const secondaryAction = readiness.readyToPilot
    ? "Prepare proposal copy and keep final send, booking, CRM, analytics, and billing behind operator approval."
    : readiness.nextAction;
  const operatorScript = readiness.readyToPilot
    ? `${actionLayer.serviceTitle} has enough proof to prepare a first paid pilot proposal, but every customer-facing step still needs operator approval.`
    : `${actionLayer.serviceTitle} is not ready for paid pilot activation. Next blocker: ${readiness.nextAction}`;

  return {
    serviceId: actionLayer.serviceId,
    serviceTitle: actionLayer.serviceTitle,
    exportSurface: "local_services_readiness_action_plan",
    primarySurface,
    primaryAction,
    secondaryAction,
    operatorScript,
    copyLabel: "Copy readiness action plan",
    noGo: [
      "No paid pilot sale until every readiness gate is complete.",
      "No paid pilot proposal unless Week-one owner decision is Continue.",
      "No live phone, Telegram, WhatsApp, CRM, calendar, analytics, billing, or customer send from this surface.",
      "No category expansion while the leading category has unresolved proof, setup, dry-run, owner-conversation, or metric blockers.",
    ],
  };
}

function formatLocalServiceReadinessActionPlanText(plan: LocalServicePilotReadinessActionPlan): string {
  return [
    `Readiness action plan: ${plan.serviceTitle}`,
    `Export surface: ${plan.exportSurface}`,
    `Primary surface: ${plan.primarySurface}`,
    `Primary action: ${plan.primaryAction}`,
    `Secondary action: ${plan.secondaryAction}`,
    `Operator script: ${plan.operatorScript}`,
    "No-go rules:",
    ...plan.noGo.map((item) => `- ${item}`),
  ].join("\n");
}

function buildLocalServiceReadinessProofDrawer(
  rows: LocalServiceFounderContactRow[],
  counts: {
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  },
  proofChecklist: { label: string; status: string; done: boolean }[],
  proofProgress: string,
  score: LocalServiceCategoryPilotScore | undefined,
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  readiness: LocalServiceLeadingCategoryPilotReadiness,
  actionPlan: LocalServicePilotReadinessActionPlan,
  setupStepCompletion: LocalServiceSetupStepCompletion,
  setupReady: boolean,
  testCallPassed: boolean,
  metricStatus: LocalServicePilotMetricStatus,
  activityLog: LocalServicePilotActivityEvent[] = [],
): LocalServicePilotWorkspaceExport {
  const setupPrerequisites: LocalServiceSetupStepId[] = [
    "business_profile",
    "knowledge_sources",
    "agent_behavior",
    "test_call_message",
  ];
  const setupEvidence = setupPrerequisites.map((stepId) => ({
    id: stepId,
    done: setupStepCompletion[stepId] === true,
  }));
  const laneRows = rows.filter((row) => row.serviceId === actionLayer.serviceId);
  const recentProofEvents = activityLog
    .filter((event) => event.kind === "contact_proof" && event.serviceId === actionLayer.serviceId)
    .slice(0, 8);
  const evidenceLines = [
    `Category signal: ${score ? `${score.signalLabel}; ${score.proofSummary}` : "No category score yet"}`,
    `First-batch proof: ${proofProgress}`,
    `Manual sends: ${counts.manualMessageSent}/10`,
    `Replies or rejections: ${counts.repliesOrRejections}/3`,
    `Discovery calls: ${counts.discoveryCalls}/1`,
    `Pilot candidates: ${counts.pilotCandidates}/1`,
    `Setup prerequisites: ${setupEvidence.filter((item) => item.done).length}/${setupEvidence.length}`,
    `Ready for pilot test: ${setupReady ? "yes" : "no"}`,
    `Test call passed: ${testCallPassed ? "yes" : "no"}`,
    `Metric baseline: ${LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus]}`,
  ];
  const laneLines =
    laneRows.length > 0
      ? laneRows.map(
          (row, index) =>
            `${index + 1}. ${row.prospect.company} | ${row.statusLabel} | ${row.proofStatus} | next: ${row.prospect.nextStep}`,
        )
      : ["No lane-specific contacts in the first batch yet."];
  const humanLines = [
    `Readiness proof drawer: ${actionLayer.serviceTitle}`,
    "Export surface: local_services_readiness_proof_drawer",
    "Purpose: show why the paid-pilot gate is blocked or ready without opening multiple drawers.",
    `Readiness: ${readiness.readinessLabel} / ${readiness.progressLabel}`,
    `Primary action: ${actionPlan.primaryAction}`,
    "",
    "Proof snippets:",
    ...evidenceLines.map((item) => `- ${item}`),
    "",
    "Readiness checklist:",
    ...readiness.checklist.map((item) => `- ${item.done ? "done" : "blocked"} | ${item.label}: ${item.status}`),
    "",
    "First-batch checklist:",
    ...proofChecklist.map((item) => `- ${item.done ? "done" : "pending"} | ${item.label}: ${item.status}`),
    "",
    "Lane contacts:",
    ...laneLines,
    "",
    "Recent lane proof activity:",
    ...(recentProofEvents.length > 0
      ? recentProofEvents.map(
          (event) =>
            `- ${event.createdAt} | ${event.company ?? "service"} | ${event.label}: ${event.value}`,
        )
      : ["- No lane-specific proof events recorded yet."]),
    "",
    "No-go rules:",
    ...actionPlan.noGo.map((item) => `- ${item}`),
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_readiness_proof_drawer",
      export_kind: "readiness_evidence_view",
      service_id: actionLayer.serviceId,
      service_title: actionLayer.serviceTitle,
      readiness: {
        label: readiness.readinessLabel,
        progress: readiness.progressLabel,
        paid_pilot_gate: readiness.paidPilotGate,
        next_action: readiness.nextAction,
        ready_to_pilot: readiness.readyToPilot,
        checklist: readiness.checklist,
        blockers: readiness.blockers,
        ready_signals: readiness.readySignals,
      },
      action_plan: {
        export_surface: actionPlan.exportSurface,
        primary_surface: actionPlan.primarySurface,
        primary_action: actionPlan.primaryAction,
        secondary_action: actionPlan.secondaryAction,
        operator_script: actionPlan.operatorScript,
        no_go: actionPlan.noGo,
      },
      proof_snippets: {
        category_signal: score?.signalLabel ?? "Unproven",
        category_proof_summary: score?.proofSummary ?? "No category score yet",
        proof_progress: proofProgress,
        proof_counts: counts,
        setup_prerequisites: setupEvidence,
        setup_ready: setupReady,
        test_call_passed: testCallPassed,
        metric_status: metricStatus,
        metric_status_label: LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus],
      },
      first_batch_checklist: proofChecklist,
      lane_contacts: laneRows.map((row, index) => ({
        index: index + 1,
        key: row.key,
        prospect_id: row.prospect.id,
        company: row.prospect.company,
        segment: row.prospect.segment,
        status: row.status,
        status_label: row.statusLabel,
        proof_status: row.proofStatus,
        next_step: row.prospect.nextStep,
      })),
      recent_lane_proof_activity: recentProofEvents,
      guardrails: [
        "no_customer_send",
        "no_booking_created",
        "no_crm_write",
        "no_analytics_sync",
        "no_billing_action",
        "browser_local_evidence_view_only",
      ],
    },
    null,
    2,
  );

  return {
    title: "Readiness proof drawer",
    description:
      "Inspect the proof snippets behind the paid-pilot gate before continuing setup, outreach, or proposal work.",
    eyebrow: "Readiness evidence",
    modeLabel: "Proof drawer mode",
    copyLabel: "Copy readiness proof",
    reviewTitle: "Proof review checklist",
    reviewDescription:
      "This drawer only summarizes browser-local proof markers. It does not send outreach, book work, write CRM, sync analytics, or bill.",
    executionActionLabel: "Open founder execution log",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Service", value: actionLayer.serviceTitle },
      { label: "Readiness", value: `${readiness.readinessLabel} / ${readiness.progressLabel}` },
      { label: "Primary surface", value: actionPlan.primarySurface },
      { label: "Proof progress", value: proofProgress },
      { label: "Manual sends", value: `${counts.manualMessageSent}/10` },
      { label: "Replies / rejections", value: `${counts.repliesOrRejections}/3` },
      { label: "Discovery calls", value: `${counts.discoveryCalls}/1` },
      { label: "Metric baseline", value: LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus] },
    ],
    checklist: [
      "Confirm the drawer only contains redacted browser-local proof markers.",
      "Confirm setup and test-call state match the visible setup wizard.",
      "Confirm first-batch proof is based on manual owner interactions, not assumptions.",
      "Confirm paid-pilot blockers are resolved before preparing any proposal.",
      "Do not use this drawer as proof that the platform sent outreach or activated channels.",
    ],
  };
}

function buildLocalServicePaidPilotProposalPreview(
  template: LocalServiceDemoTemplate,
  rows: LocalServiceFounderContactRow[],
  counts: {
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  },
  proofProgress: string,
  score: LocalServiceCategoryPilotScore | undefined,
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  readiness: LocalServiceLeadingCategoryPilotReadiness,
  actionPlan: LocalServicePilotReadinessActionPlan,
  metricStatus: LocalServicePilotMetricStatus,
): LocalServicePilotWorkspaceExport {
  const laneRows = rows.filter((row) => row.serviceId === actionLayer.serviceId);
  const targetRow =
    laneRows.find((row) => row.pilotCandidate) ??
    laneRows.find((row) => row.demoBooked) ??
    laneRows.find((row) => row.discoveryCallCompleted) ??
    laneRows.find((row) => row.status === "reply_received") ??
    laneRows[0];
  const proposalStatus = readiness.readyToPilot
    ? "Proposal draft ready for operator approval"
    : "Proposal preview blocked by readiness gate";
  const targetCompany = targetRow
    ? `${targetRow.prospect.company} (${targetRow.prospect.segment})`
    : "No paid-pilot prospect selected yet";
  const pricingPolicy = "Founder fills the paid pilot price manually; the product does not calculate or charge it.";
  const proposalScope = [
    `Service lane: ${template.title}`,
    `Offer: ${template.detail.pilotKit.offerSummary}`,
    "AI answers or drafts intake from phone, Telegram, or WhatsApp-style messages only after approved setup.",
    "AI collects needs, urgency, address/service area, preferred time, and handoff notes.",
    "AI prepares booking or callback handoff for owner approval; it does not create appointments by itself.",
    "Operator gets evidence, transcript, CRM payload preview, and no-go blockers before any customer-facing step.",
  ];
  const customerFacingDraft = [
    `We can run a small paid pilot for ${template.title} focused on one measurable intake workflow.`,
    "The pilot stays owner-approved: no final price, appointment slot, dispatcher assignment, or customer message goes live without confirmation.",
    "Before launch we will confirm the business profile, approved answers, test call/message, and success metric baseline.",
    "If the first week does not show qualified demand or cleaner handoff, the pilot is revised or stopped before adding more automation.",
  ];
  const blockerLines =
    readiness.blockers.length > 0 ? readiness.blockers.map((item) => `- ${item}`) : ["- none"];
  const humanLines = [
    `Paid pilot proposal preview: ${actionLayer.serviceTitle}`,
    "Export surface: local_services_paid_pilot_proposal_preview",
    "Export kind: operator_approved_proposal_preview",
    `Proposal status: ${proposalStatus}`,
    `Paid pilot gate: ${readiness.paidPilotGate}`,
    `Week-one owner decision: ${readiness.ownerDecisionLabel}`,
    "Owner decision state key: weekOneOwnerDecisionByProspectKey",
    `Target prospect: ${targetCompany}`,
    `Pricing policy: ${pricingPolicy}`,
    "",
    "Proposal scope:",
    ...proposalScope.map((item) => `- ${item}`),
    "",
    "Customer-facing draft preview:",
    ...customerFacingDraft.map((item) => `- ${item}`),
    "",
    "Readiness blockers:",
    ...blockerLines,
    "",
    "Proof summary:",
    `- Category signal: ${score ? `${score.signalLabel}; ${score.proofSummary}` : "No category score yet"}`,
    `- First-batch proof: ${proofProgress}`,
    `- Manual sends: ${counts.manualMessageSent}/10`,
    `- Replies or rejections: ${counts.repliesOrRejections}/3`,
    `- Discovery calls: ${counts.discoveryCalls}/1`,
    `- Pilot candidates: ${counts.pilotCandidates}/1`,
    `- Metric baseline: ${LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus]}`,
    "",
    "No-go rules:",
    ...actionPlan.noGo.map((item) => `- ${item}`),
    "- No proposal send, booking, CRM write, analytics sync, billing, or channel activation from this preview.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_paid_pilot_proposal_preview",
      export_kind: "operator_approved_proposal_preview",
      service_id: actionLayer.serviceId,
      service_title: actionLayer.serviceTitle,
      proposal_status: readiness.readyToPilot ? "ready_for_operator_approval" : "blocked_by_readiness_gate",
      paid_pilot_gate: readiness.paidPilotGate,
      week_one_owner_decision: readiness.ownerDecision,
      week_one_owner_decision_label: readiness.ownerDecisionLabel,
      owner_decision_state_key: "weekOneOwnerDecisionByProspectKey",
      readiness: {
        label: readiness.readinessLabel,
        progress: readiness.progressLabel,
        ready_to_pilot: readiness.readyToPilot,
        week_one_owner_decision: readiness.ownerDecision,
        week_one_owner_decision_label: readiness.ownerDecisionLabel,
        blockers: readiness.blockers,
        ready_signals: readiness.readySignals,
      },
      target_prospect: targetRow
        ? {
            key: targetRow.key,
            company: targetRow.prospect.company,
            segment: targetRow.prospect.segment,
            status: targetRow.status,
            proof_status: targetRow.proofStatus,
            next_step: targetRow.prospect.nextStep,
          }
        : null,
      commercial_terms: {
        pricing_policy: pricingPolicy,
        billing_action: "none",
        customer_send: "operator_approval_required",
      },
      proposal_scope: proposalScope,
      customer_facing_draft_preview: customerFacingDraft,
      proof_summary: {
        category_signal: score?.signalLabel ?? "Unproven",
        category_proof_summary: score?.proofSummary ?? "No category score yet",
        proof_progress: proofProgress,
        proof_counts: counts,
        metric_status: metricStatus,
        metric_status_label: LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus],
      },
      guardrails: [
        "no_customer_send",
        "no_booking_created",
        "no_crm_write",
        "no_analytics_sync",
        "no_billing_action",
        "operator_approval_required",
      ],
    },
    null,
    2,
  );

  return {
    title: "Paid pilot proposal preview",
    description:
      "Preview the first paid pilot offer only after proof is reviewed. This drawer never sends, books, writes CRM, syncs analytics, or bills.",
    eyebrow: "Proposal gate",
    modeLabel: "Proposal preview mode",
    copyLabel: "Copy proposal preview",
    reviewTitle: "Proposal approval checklist",
    reviewDescription:
      "This is a private operator preview. Treat blocked readiness as a hard stop and treat ready readiness as proposal prep only.",
    executionActionLabel: "Open founder execution log",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Proposal status", value: proposalStatus },
      { label: "Service", value: actionLayer.serviceTitle },
      { label: "Readiness", value: `${readiness.readinessLabel} / ${readiness.progressLabel}` },
      { label: "Week-one owner decision", value: readiness.ownerDecisionLabel },
      { label: "Target prospect", value: targetCompany },
      { label: "Offer", value: template.detail.pilotKit.offerSummary },
      { label: "Pricing policy", value: pricingPolicy },
      { label: "Metric baseline", value: LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus] },
      { label: "Customer send", value: "Operator approval required; no send from preview" },
    ],
    checklist: [
      "Open the readiness proof drawer first and confirm the proof snippets are current.",
      "Confirm Week-one owner decision is Continue before proposal approval.",
      "Do not send the proposal while any readiness blocker remains.",
      "Fill pricing and commercial terms manually with the founder or owner.",
      "Keep final customer message, booking, CRM write, analytics sync, and billing behind explicit operator approval.",
      "Use this preview as a private proposal draft, not as proof that a paid pilot has launched.",
    ],
  };
}

function buildLocalServiceProposalApprovalHandoff(
  template: LocalServiceDemoTemplate,
  rows: LocalServiceFounderContactRow[],
  counts: {
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  },
  proofProgress: string,
  score: LocalServiceCategoryPilotScore | undefined,
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  readiness: LocalServiceLeadingCategoryPilotReadiness,
  metricStatus: LocalServicePilotMetricStatus,
  proposalApprovalDecision: LocalServiceProposalApprovalDecision,
): LocalServicePilotWorkspaceExport {
  const laneRows = rows.filter((row) => row.serviceId === actionLayer.serviceId);
  const targetRow =
    laneRows.find((row) => row.pilotCandidate) ??
    laneRows.find((row) => row.demoBooked) ??
    laneRows.find((row) => row.discoveryCallCompleted) ??
    laneRows.find((row) => row.status === "reply_received") ??
    laneRows[0];
  const targetCompany = targetRow
    ? `${targetRow.prospect.company} (${targetRow.prospect.segment})`
    : "No paid-pilot prospect selected yet";
  const proposalApprovalLabel = LOCAL_SERVICE_PROPOSAL_APPROVAL_LABELS[proposalApprovalDecision];
  const approvalStatus = !readiness.readyToPilot
    ? "Approval handoff blocked by readiness gate"
    : proposalApprovalDecision === "approved"
      ? "Operator-approved for manual proposal follow-up"
      : proposalApprovalDecision === "needs_changes"
        ? "Needs changes before operator approval"
        : proposalApprovalDecision === "blocked"
          ? "Blocked by operator decision"
          : "Waiting for operator approval";
  const approvalItems = [
    {
      label: "Price and commercial terms",
      owner: "Founder / business owner",
      required: true,
      detail: "Founder manually confirms pilot price, included volume, payment method, and cancellation terms.",
    },
    {
      label: "Pilot scope and success metric",
      owner: "Operator",
      required: true,
      detail: `Scope stays limited to ${template.title}; metric baseline is ${LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus]}.`,
    },
    {
      label: "Owner send approval",
      owner: "Operator + owner",
      required: true,
      detail: "Customer-facing proposal send remains manual and approved outside this shell.",
    },
    {
      label: "CRM payload review",
      owner: "Operator",
      required: true,
      detail: `Review handoff fields only: ${template.detail.handoffFields.join("; ")}.`,
    },
    {
      label: "Booking policy review",
      owner: "Owner",
      required: true,
      detail: "No appointment, technician, dispatcher, calendar slot, or callback is created from this handoff.",
    },
    {
      label: "Billing disabled confirmation",
      owner: "Founder",
      required: true,
      detail: "Billing remains disabled; any invoice, payment link, or subscription setup happens outside the product.",
    },
  ];
  const crmPayloadPreview = {
    service_lane: template.title,
    target_company: targetRow?.prospect.company ?? null,
    segment: targetRow?.prospect.segment ?? null,
    channel_fit: targetRow?.prospect.channelFit ?? template.channel,
    offer_summary: template.detail.pilotKit.offerSummary,
    handoff_fields: template.detail.handoffFields,
    operator_handoff: template.detail.operatorHandoff,
    readiness_label: readiness.readinessLabel,
    week_one_owner_decision: readiness.ownerDecisionLabel,
    proposal_approval: proposalApprovalLabel,
    proof_progress: proofProgress,
  };
  const blockerLines =
    readiness.blockers.length > 0 ? readiness.blockers.map((item) => `- ${item}`) : ["- none"];
  const humanLines = [
    `Proposal approval handoff: ${actionLayer.serviceTitle}`,
    "Export surface: local_services_proposal_approval_handoff",
    "Export kind: manual_paid_pilot_approval_handoff",
    `Approval status: ${approvalStatus}`,
    `Proposal approval decision: ${proposalApprovalLabel}`,
    "Proposal approval state key: proposalApprovalByService",
    `Target prospect: ${targetCompany}`,
    `Paid pilot gate: ${readiness.paidPilotGate}`,
    `Week-one owner decision: ${readiness.ownerDecisionLabel}`,
    "Owner decision state key: weekOneOwnerDecisionByProspectKey",
    "",
    "Approval checklist:",
    ...approvalItems.map((item) => `- ${item.label} | owner: ${item.owner} | ${item.detail}`),
    "",
    "CRM payload preview:",
    ...Object.entries(crmPayloadPreview).map(([key, value]) =>
      `- ${key}: ${Array.isArray(value) ? value.join("; ") : value ?? "none"}`,
    ),
    "",
    "Readiness blockers:",
    ...blockerLines,
    "",
    "Proof summary:",
    `- Category signal: ${score ? `${score.signalLabel}; ${score.proofSummary}` : "No category score yet"}`,
    `- First-batch proof: ${proofProgress}`,
    `- Manual sends: ${counts.manualMessageSent}/10`,
    `- Replies or rejections: ${counts.repliesOrRejections}/3`,
    `- Discovery calls: ${counts.discoveryCalls}/1`,
    `- Pilot candidates: ${counts.pilotCandidates}/1`,
    "",
    "Hard stop:",
    "- Do not send a proposal, create a booking, write CRM, sync analytics, bill, or activate channels from this handoff.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_proposal_approval_handoff",
      export_kind: "manual_paid_pilot_approval_handoff",
      service_id: actionLayer.serviceId,
      service_title: actionLayer.serviceTitle,
      approval_status: !readiness.readyToPilot ? "blocked_by_readiness_gate" : proposalApprovalDecision,
      proposal_approval_decision: proposalApprovalDecision,
      proposal_approval_label: proposalApprovalLabel,
      proposal_approval_state_key: "proposalApprovalByService",
      paid_pilot_gate: readiness.paidPilotGate,
      week_one_owner_decision: readiness.ownerDecision,
      week_one_owner_decision_label: readiness.ownerDecisionLabel,
      owner_decision_state_key: "weekOneOwnerDecisionByProspectKey",
      target_prospect: targetRow
        ? {
            key: targetRow.key,
            company: targetRow.prospect.company,
            segment: targetRow.prospect.segment,
            channel_fit: targetRow.prospect.channelFit,
            status: targetRow.status,
            proof_status: targetRow.proofStatus,
          }
        : null,
      approvals_required: approvalItems.map((item) => ({
        label: item.label,
        owner: item.owner,
        required: item.required,
        detail: item.detail,
      })),
      crm_payload_preview: crmPayloadPreview,
      readiness: {
        label: readiness.readinessLabel,
        progress: readiness.progressLabel,
        ready_to_pilot: readiness.readyToPilot,
        week_one_owner_decision: readiness.ownerDecision,
        week_one_owner_decision_label: readiness.ownerDecisionLabel,
        blockers: readiness.blockers,
        ready_signals: readiness.readySignals,
      },
      proof_summary: {
        category_signal: score?.signalLabel ?? "Unproven",
        category_proof_summary: score?.proofSummary ?? "No category score yet",
        proof_progress: proofProgress,
        proof_counts: counts,
        metric_status: metricStatus,
        metric_status_label: LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus],
      },
      guardrails: [
        "proposal_send_requires_operator_approval",
        "no_customer_send",
        "no_booking_created",
        "no_crm_write",
        "no_analytics_sync",
        "no_billing_action",
        "no_channel_activation",
      ],
    },
    null,
    2,
  );

  return {
    title: "Proposal approval handoff",
    description:
      "Review the human approval handoff for a paid pilot before any proposal send, booking, CRM write, analytics sync, billing, or channel activation.",
    eyebrow: "Approval handoff",
    modeLabel: "Approval handoff mode",
    copyLabel: "Copy approval handoff",
    reviewTitle: "Manual approval checklist",
    reviewDescription:
      "This handoff is private operator evidence. It lists required approvals and blocks all external side effects.",
    executionActionLabel: "Open founder execution log",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Approval status", value: approvalStatus },
      { label: "Proposal approval decision", value: proposalApprovalLabel },
      { label: "Service", value: actionLayer.serviceTitle },
      { label: "Target prospect", value: targetCompany },
      { label: "Readiness", value: `${readiness.readinessLabel} / ${readiness.progressLabel}` },
      { label: "Week-one owner decision", value: readiness.ownerDecisionLabel },
      { label: "Price owner", value: "Founder / business owner" },
      { label: "CRM payload", value: "Preview only; no write" },
      { label: "Booking policy", value: "Manual owner approval required" },
      { label: "Billing", value: "Disabled from this handoff" },
    ],
    checklist: [
      "Confirm readiness proof and proposal preview were reviewed before this handoff.",
      "Confirm price, scope, pilot volume, and payment terms are filled manually by the founder or owner.",
      "Confirm CRM payload fields are only previewed and are not written from the shell.",
      "Confirm booking, calendar, dispatcher assignment, and customer message are still manual approvals.",
      "Do not treat this handoff as a launched pilot, sent proposal, invoice, or active channel.",
    ],
  };
}

function buildLocalServicePilotKickoffGate(
  template: LocalServiceDemoTemplate,
  rows: LocalServiceFounderContactRow[],
  counts: {
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  },
  proofProgress: string,
  score: LocalServiceCategoryPilotScore | undefined,
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  readiness: LocalServiceLeadingCategoryPilotReadiness,
  setupReady: boolean,
  testCallPassed: boolean,
  testCallProgress: string,
  metricStatus: LocalServicePilotMetricStatus,
  proposalApprovalDecision: LocalServiceProposalApprovalDecision,
  kickoffDecision: LocalServiceKickoffDecision,
): LocalServicePilotWorkspaceExport {
  const laneRows = rows.filter((row) => row.serviceId === actionLayer.serviceId);
  const targetRow =
    laneRows.find((row) => row.pilotCandidate) ??
    laneRows.find((row) => row.demoBooked) ??
    laneRows.find((row) => row.discoveryCallCompleted) ??
    laneRows.find((row) => row.status === "reply_received") ??
    laneRows[0];
  const metricStarted = metricStatus !== "not_started";
  const proposalApprovalLabel = LOCAL_SERVICE_PROPOSAL_APPROVAL_LABELS[proposalApprovalDecision];
  const kickoffDecisionLabel = LOCAL_SERVICE_KICKOFF_DECISION_LABELS[kickoffDecision];
  const kickoffChecks = [
    {
      label: "Readiness proof reviewed",
      status: readiness.readyToPilot ? "Ready for first paid pilot" : readiness.nextAction,
      done: readiness.readyToPilot,
    },
    {
      label: "Proposal approval decision",
      status: !readiness.readyToPilot
        ? "Blocked until readiness gate is complete"
        : proposalApprovalDecision === "approved"
          ? "Proposal approval recorded"
          : proposalApprovalLabel,
      done: readiness.readyToPilot && proposalApprovalDecision === "approved",
    },
    {
      label: "Week-one owner decision",
      status:
        readiness.ownerDecision === "continue"
          ? "Continue recorded"
          : `${readiness.ownerDecisionLabel}; kickoff stays blocked`,
      done: readiness.ownerDecision === "continue",
    },
    {
      label: "Kickoff operator decision",
      status:
        kickoffDecision === "ready"
          ? "Ready for manual day-one run recorded"
          : `${kickoffDecisionLabel}; run sheet stays blocked`,
      done: kickoffDecision === "ready",
    },
    {
      label: "Setup ready",
      status: setupReady ? "Ready for pilot test recorded" : "Setup path needs ready gate",
      done: setupReady,
    },
    {
      label: "Test call/message passed",
      status: testCallPassed ? "Test call passed" : `Needs dry run (${testCallProgress})`,
      done: testCallPassed,
    },
    {
      label: "Owner conversation exists",
      status:
        counts.discoveryCalls > 0 || counts.pilotCandidates > 0
          ? "Discovery or pilot-candidate proof exists"
          : "Needs real owner conversation before kickoff",
      done: counts.discoveryCalls > 0 || counts.pilotCandidates > 0,
    },
    {
      label: "Metric baseline started",
      status: LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus],
      done: metricStarted,
    },
  ];
  const completed = kickoffChecks.filter((item) => item.done).length;
  const kickoffStatus =
    completed === kickoffChecks.length
      ? "Kickoff-ready for manual day-one setup"
      : "Kickoff blocked";
  const nextKickoffAction =
    kickoffChecks.find((item) => !item.done)?.status ??
    "Open day-one setup, confirm owner-approved profile, and keep the first real pilot action manual.";
  const targetCompany = targetRow
    ? `${targetRow.prospect.company} (${targetRow.prospect.segment})`
    : "No paid-pilot prospect selected yet";
  const humanLines = [
    `Pilot kickoff gate: ${actionLayer.serviceTitle}`,
    "Export surface: local_services_pilot_kickoff_gate",
    "Export kind: manual_day_one_kickoff_gate",
    `Kickoff status: ${kickoffStatus}`,
    `Kickoff progress: ${completed}/${kickoffChecks.length}`,
    `Target prospect: ${targetCompany}`,
    `Week-one owner decision: ${readiness.ownerDecisionLabel}`,
    "Owner decision state key: weekOneOwnerDecisionByProspectKey",
    `Proposal approval decision: ${proposalApprovalLabel}`,
    "Proposal approval state key: proposalApprovalByService",
    `Kickoff decision: ${kickoffDecisionLabel}`,
    "Kickoff decision state key: kickoffDecisionByService",
    `Next kickoff action: ${nextKickoffAction}`,
    "",
    "Kickoff checks:",
    ...kickoffChecks.map((item) => `- ${item.done ? "done" : "blocked"} | ${item.label}: ${item.status}`),
    "",
    "Day-one setup path:",
    `- Service lane: ${template.title}`,
    `- Offer: ${template.detail.pilotKit.offerSummary}`,
    "- Open day-one setup only after proof, proposal handoff, setup, dry-run, owner conversation, and metric baseline are ready.",
    "- Keep first real phone, Telegram, WhatsApp, calendar, CRM, analytics, billing, and customer-send actions manual.",
    "",
    "Proof summary:",
    `- Category signal: ${score ? `${score.signalLabel}; ${score.proofSummary}` : "No category score yet"}`,
    `- First-batch proof: ${proofProgress}`,
    `- Manual sends: ${counts.manualMessageSent}/10`,
    `- Replies or rejections: ${counts.repliesOrRejections}/3`,
    `- Discovery calls: ${counts.discoveryCalls}/1`,
    `- Pilot candidates: ${counts.pilotCandidates}/1`,
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_pilot_kickoff_gate",
      export_kind: "manual_day_one_kickoff_gate",
      service_id: actionLayer.serviceId,
      service_title: actionLayer.serviceTitle,
      kickoff_status: completed === kickoffChecks.length ? "ready_for_manual_day_one_setup" : "blocked",
      kickoff_progress: `${completed}/${kickoffChecks.length}`,
      week_one_owner_decision: readiness.ownerDecision,
      week_one_owner_decision_label: readiness.ownerDecisionLabel,
      owner_decision_state_key: "weekOneOwnerDecisionByProspectKey",
      proposal_approval_decision: proposalApprovalDecision,
      proposal_approval_label: proposalApprovalLabel,
      proposal_approval_state_key: "proposalApprovalByService",
      kickoff_decision: kickoffDecision,
      kickoff_decision_label: kickoffDecisionLabel,
      kickoff_decision_state_key: "kickoffDecisionByService",
      next_kickoff_action: nextKickoffAction,
      target_prospect: targetRow
        ? {
            key: targetRow.key,
            company: targetRow.prospect.company,
            segment: targetRow.prospect.segment,
            channel_fit: targetRow.prospect.channelFit,
            status: targetRow.status,
            proof_status: targetRow.proofStatus,
          }
        : null,
      kickoff_checks: kickoffChecks,
      day_one_setup_path: {
        service_lane: template.title,
        offer_summary: template.detail.pilotKit.offerSummary,
        setup_surface: "Open day-one setup",
        copy_surface: "Copy day-one setup brief",
      },
      proof_summary: {
        category_signal: score?.signalLabel ?? "Unproven",
        category_proof_summary: score?.proofSummary ?? "No category score yet",
        proof_progress: proofProgress,
        proof_counts: counts,
        setup_ready: setupReady,
        test_call_passed: testCallPassed,
        test_call_progress: testCallProgress,
        metric_status: metricStatus,
        metric_status_label: LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus],
      },
      guardrails: [
        "manual_day_one_setup_only",
        "no_phone_channel_activation",
        "no_telegram_or_whatsapp_activation",
        "no_calendar_booking_created",
        "no_customer_send",
        "no_crm_write",
        "no_analytics_sync",
        "no_billing_action",
      ],
    },
    null,
    2,
  );

  return {
    title: "Pilot kickoff gate",
    description:
      "Decide whether the paid-pilot proposal can move into manual day-one setup. This gate never activates channels or external systems.",
    eyebrow: "Kickoff gate",
    modeLabel: "Kickoff gate mode",
    copyLabel: "Copy kickoff gate",
    reviewTitle: "Day-one kickoff checklist",
    reviewDescription:
      "Use this after proof and proposal approval handoff. It is still a private gate, not a live pilot launch.",
    executionActionLabel: "Open founder execution log",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Kickoff status", value: kickoffStatus },
      { label: "Progress", value: `${completed}/${kickoffChecks.length}` },
      { label: "Service", value: actionLayer.serviceTitle },
      { label: "Target prospect", value: targetCompany },
      { label: "Week-one owner decision", value: readiness.ownerDecisionLabel },
      { label: "Proposal approval decision", value: proposalApprovalLabel },
      { label: "Kickoff decision", value: kickoffDecisionLabel },
      { label: "Next action", value: nextKickoffAction },
      { label: "Day-one setup", value: "Manual setup only; no live channel activation" },
      { label: "Metric baseline", value: LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus] },
      { label: "Guardrail", value: "No phone, messaging, CRM, analytics, billing, booking, or customer send" },
    ],
    checklist: kickoffChecks.map((item) => `${item.label}: ${item.status}`),
  };
}

function buildLocalServiceDayOneOperatorRunSheet(
  template: LocalServiceDemoTemplate,
  rows: LocalServiceFounderContactRow[],
  counts: {
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  },
  proofProgress: string,
  score: LocalServiceCategoryPilotScore | undefined,
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  readiness: LocalServiceLeadingCategoryPilotReadiness,
  setupReady: boolean,
  testCallPassed: boolean,
  testCallProgress: string,
  metricStatus: LocalServicePilotMetricStatus,
  kickoffDecision: LocalServiceKickoffDecision,
  firstRequestOutcome: LocalServiceFirstRequestOutcome,
): LocalServicePilotWorkspaceExport {
  const laneRows = rows.filter((row) => row.serviceId === actionLayer.serviceId);
  const targetRow =
    laneRows.find((row) => row.pilotCandidate) ??
    laneRows.find((row) => row.demoBooked) ??
    laneRows.find((row) => row.discoveryCallCompleted) ??
    laneRows.find((row) => row.status === "reply_received") ??
    laneRows[0];
  const targetCompany = targetRow
    ? `${targetRow.prospect.company} (${targetRow.prospect.segment})`
    : "No replied pilot company selected yet";
  const targetStatus = targetRow?.statusLabel ?? "No company selected";
  const metricStatusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus];
  const kickoffDecisionLabel = LOCAL_SERVICE_KICKOFF_DECISION_LABELS[kickoffDecision];
  const firstRequestOutcomeLabel = LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS[firstRequestOutcome];
  const weeklyScorecardSyncGate =
    firstRequestOutcome === "not_recorded"
      ? "Blocked until first request outcome is recorded"
      : metricStatus === "review_ready"
        ? "Ready for manual weekly scorecard sync"
        : "Outcome captured; metrics still need review-ready status";
  const runReadiness = (() => {
    if (kickoffDecision !== "ready") {
      return `${kickoffDecisionLabel}; run sheet blocked until kickoff is ready`;
    }
    if (readiness.readyToPilot && setupReady && testCallPassed) {
      return "Ready for manual day-one run";
    }
    if (testCallPassed) {
      return "Needs owner-approved setup and readiness proof before day-one run";
    }
    return `Needs passing dry run (${testCallProgress})`;
  })();
  const sampleInbound = [
    `Phone test: ${template.detail.sampleInput}`,
    `Telegram/media test: ${template.detail.telegramIntake.inboundMessage}`,
  ];
  const ownerScript = [
    `Confirm the request is for ${template.title}.`,
    "Confirm service area, urgency, preferred time window, budget expectation, and approval owner.",
    "Repeat that price, slot, dispatcher assignment, and customer confirmation stay human-approved.",
  ];
  const expectedFields = [
    ...template.detail.telegramIntake.normalizedFields,
    ...template.detail.estimateInputs,
    ...template.detail.handoffFields,
  ];
  const approvalPauses = template.detail.approvalPolicy;
  const metricCapture = template.detail.pilotKit.metrics.map(
    (metric) => `${metric.label}: baseline=${metric.baseline}; target=${metric.target}`,
  );
  const manualLogging = [
    "Record whether the request was qualified, rejected, or needs follow-up.",
    "Record every owner edit before approval.",
    "Update the pilot scorecard manually after the run; do not sync CRM from this sheet.",
  ];
  const outcomeCapture = {
    surface: "Open daily log",
    contract: "day_one_run_sheet_outcome_capture",
    rule: "After the first manual request, open Pilot daily log and record the actual result before any weekly scorecard sync.",
  };
  const guardrails = [
    "manual_day_one_operator_run_sheet",
    "day_one_run_sheet_outcome_capture",
    "manual_weekly_scorecard_sync_gate",
    "manual_day_one_run_only",
    "no_phone_channel_activation",
    "no_telegram_or_whatsapp_activation",
    "no_calendar_booking_created",
    "no_customer_send",
    "no_crm_write",
    "no_analytics_sync",
    "no_billing_action",
  ];
  const checklist = [
    `Target company: ${targetCompany}`,
    `Readiness state: ${runReadiness}`,
    `Kickoff decision: ${kickoffDecisionLabel}`,
    `First request outcome after run: ${firstRequestOutcomeLabel}`,
    `Weekly scorecard sync gate: ${weeklyScorecardSyncGate}`,
    `Proof reviewed: ${proofProgress}`,
    `Setup ready: ${setupReady ? "yes" : "no"}`,
    `Dry run passed: ${testCallPassed ? "yes" : "no"} (${testCallProgress})`,
    `Metric baseline: ${metricStatusLabel}`,
    "First real action remains manual and owner-approved.",
  ];
  const humanLines = [
    `Day-one operator run sheet: ${actionLayer.serviceTitle}`,
    "Export surface: local_services_day_one_operator_run_sheet",
    "Export kind: manual_day_one_operator_run_sheet",
    `Run readiness: ${runReadiness}`,
    `Kickoff decision: ${kickoffDecisionLabel}`,
    "Kickoff decision state key: kickoffDecisionByService",
    `First request outcome after run: ${firstRequestOutcomeLabel}`,
    "Outcome state key: firstRequestOutcomeByProspectKey",
    `Weekly scorecard sync gate: ${weeklyScorecardSyncGate}`,
    "Weekly sync contract: manual_weekly_scorecard_sync_gate",
    `Target company: ${targetCompany}`,
    `Current status: ${targetStatus}`,
    `Category proof: ${score ? `${score.signalLabel}; ${score.proofSummary}` : "No category score yet"}`,
    `Proof progress: ${proofProgress}`,
    `Metric status: ${metricStatusLabel}`,
    "",
    "Sample inbound:",
    ...sampleInbound.map((item) => `- ${item}`),
    "",
    "Owner script:",
    ...ownerScript.map((item) => `- ${item}`),
    "",
    "Expected fields:",
    ...expectedFields.map((field) => `- ${field}`),
    "",
    "Approval pauses:",
    ...approvalPauses.map((pause) => `- ${pause}`),
    "",
    "Metric capture:",
    ...metricCapture.map((metric) => `- ${metric}`),
    "",
    "Outcome capture:",
    `- Surface: ${outcomeCapture.surface}`,
    `- Contract: ${outcomeCapture.contract}`,
    `- Rule: ${outcomeCapture.rule}`,
    "",
    "Manual result logging:",
    ...manualLogging.map((item) => `- ${item}`),
    "",
    "Guardrails:",
    ...guardrails.map((guardrail) => `- ${guardrail}`),
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_day_one_operator_run_sheet",
      export_kind: "manual_day_one_operator_run_sheet",
      service_id: actionLayer.serviceId,
      service_title: actionLayer.serviceTitle,
      run_readiness: runReadiness,
      kickoff_decision: kickoffDecision,
      kickoff_decision_label: kickoffDecisionLabel,
      kickoff_decision_state_key: "kickoffDecisionByService",
      first_request_outcome: firstRequestOutcome,
      first_request_outcome_label: firstRequestOutcomeLabel,
      outcome_state_key: "firstRequestOutcomeByProspectKey",
      weekly_scorecard_sync_gate: weeklyScorecardSyncGate,
      weekly_scorecard_sync_contract: "manual_weekly_scorecard_sync_gate",
      target_company: targetRow
        ? {
            key: targetRow.key,
            company: targetRow.prospect.company,
            segment: targetRow.prospect.segment,
            channel_fit: targetRow.prospect.channelFit,
            status: targetRow.status,
            proof_status: targetRow.proofStatus,
          }
        : null,
      sample_inbound: sampleInbound,
      owner_script: ownerScript,
      expected_fields: expectedFields,
      approval_pauses: approvalPauses,
      metric_capture: metricCapture,
      outcome_capture: outcomeCapture,
      manual_result_logging: manualLogging,
      proof_summary: {
        category_signal: score?.signalLabel ?? "Unproven",
        category_proof_summary: score?.proofSummary ?? "No category score yet",
        proof_progress: proofProgress,
        proof_counts: counts,
        ready_to_pilot: readiness.readyToPilot,
        setup_ready: setupReady,
        test_call_passed: testCallPassed,
        test_call_progress: testCallProgress,
        metric_status: metricStatus,
        metric_status_label: metricStatusLabel,
      },
      guardrails,
    },
    null,
    2,
  );

  return {
    title: "Day-one operator run sheet",
    description:
      "Manual first-day operating sheet for one owner-approved request. It tells the operator what to ask, capture, pause on, and log without activating channels or writing external systems.",
    eyebrow: "Day-one run sheet",
    modeLabel: "Run sheet mode",
    copyLabel: "Copy run sheet",
    reviewTitle: "Manual first-day run checklist",
    reviewDescription:
      "Use this after the kickoff gate. It is a run worksheet only: no phone, Telegram, WhatsApp, booking, CRM, analytics, billing, or customer-send side effect.",
    executionActionLabel: "Open daily log",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Run readiness", value: runReadiness },
      { label: "Kickoff decision", value: kickoffDecisionLabel },
      { label: "First request outcome", value: firstRequestOutcomeLabel },
      { label: "Weekly scorecard sync gate", value: weeklyScorecardSyncGate },
      { label: "Service", value: actionLayer.serviceTitle },
      { label: "Target company", value: targetCompany },
      { label: "Current status", value: targetStatus },
      { label: "Sample inbound", value: sampleInbound[0] },
      { label: "Outcome capture", value: `${outcomeCapture.surface} / ${outcomeCapture.contract}` },
      { label: "Metric baseline", value: metricStatusLabel },
      { label: "Guardrail", value: "Manual run only; no external side effects" },
    ],
    checklist,
  };
}

function buildLocalServiceDayOneRecapExport(
  template: LocalServiceDemoTemplate,
  rows: LocalServiceFounderContactRow[],
  counts: {
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  },
  proofProgress: string,
  score: LocalServiceCategoryPilotScore | undefined,
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  readiness: LocalServiceLeadingCategoryPilotReadiness,
  firstRequestOutcomes: Record<string, LocalServiceFirstRequestOutcome>,
  metricStatus: LocalServicePilotMetricStatus,
  activityLog: LocalServicePilotActivityEvent[],
): LocalServicePilotWorkspaceExport {
  const laneRows = rows.filter((row) => row.serviceId === actionLayer.serviceId);
  const targetRow =
    laneRows.find((row) => row.pilotCandidate) ??
    laneRows.find((row) => row.demoBooked) ??
    laneRows.find((row) => row.discoveryCallCompleted) ??
    laneRows.find((row) => row.status === "reply_received") ??
    laneRows[0];
  const targetCompany = targetRow
    ? `${targetRow.prospect.company} (${targetRow.prospect.segment})`
    : "No day-one company selected yet";
  const firstRequestOutcome = targetRow
    ? firstRequestOutcomes[targetRow.key] ?? "not_recorded"
    : "not_recorded";
  const firstRequestOutcomeLabel =
    LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS[firstRequestOutcome];
  const metricStatusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus];
  const latestLaneActivity = activityLog.find((event) => event.serviceId === actionLayer.serviceId);
  const recapStatus =
    firstRequestOutcome === "not_recorded"
      ? "Needs first request outcome before recap"
      : readiness.readyToPilot
        ? "Ready for owner recap and week-one tracking"
        : "Recap captured, readiness still blocked";
  const dayOneFields = [
    {
      label: "Request result",
      value: firstRequestOutcomeLabel,
      source: "firstRequestOutcomeByProspectKey",
    },
    {
      label: "Operator edits",
      value: "what had to be corrected before owner approval",
      source: "manual recap note",
    },
    {
      label: "Approval pause",
      value: "where human approval was required before customer or master handoff",
      source: "run sheet",
    },
    {
      label: "Metric delta",
      value: "missed-call recovery, reply speed, booking/dispatch, or rewrite work",
      source: "daily log",
    },
  ];
  const nextDayActions = [
    firstRequestOutcome === "booked_manually"
      ? "Prepare one redacted proof item for the evidence pack."
      : "Use follow-up or rejection reason to adjust the next manual run.",
    "Sync the recap into the private pilot scorecard or daily log manually.",
    "Do not move to week-one review until at least one real pilot day is recorded.",
  ];
  const guardrails = [
    "manual_day_one_recap",
    "day_one_recap_to_week_one_review",
    "manual_scorecard_sync_required",
    "no_calendar_booking_created",
    "no_customer_send",
    "no_crm_write",
    "no_analytics_sync",
    "no_billing_action",
    "no_channel_activation",
  ];
  const humanLines = [
    `Day-one recap: ${actionLayer.serviceTitle}`,
    "Export surface: local_services_day_one_recap",
    "Export kind: manual_day_one_recap",
    `Recap status: ${recapStatus}`,
    `Target company: ${targetCompany}`,
    `First request outcome: ${firstRequestOutcomeLabel}`,
    "Outcome state key: firstRequestOutcomeByProspectKey",
    `Metric status: ${metricStatusLabel}`,
    `Latest lane activity: ${latestLaneActivity ? `${latestLaneActivity.label}: ${latestLaneActivity.value}` : "No lane activity recorded yet"}`,
    "",
    "Day-one recap fields:",
    ...dayOneFields.map((field) => `- ${field.label}: ${field.value} (${field.source})`),
    "",
    "Next-day actions:",
    ...nextDayActions.map((action) => `- ${action}`),
    "",
    "Proof summary:",
    `- Category signal: ${score ? `${score.signalLabel}; ${score.proofSummary}` : "No category score yet"}`,
    `- First-batch proof: ${proofProgress}`,
    `- Manual sends: ${counts.manualMessageSent}/10`,
    `- Replies or rejections: ${counts.repliesOrRejections}/3`,
    `- Discovery calls: ${counts.discoveryCalls}/1`,
    `- Pilot candidates: ${counts.pilotCandidates}/1`,
    "",
    "Guardrails:",
    ...guardrails.map((guardrail) => `- ${guardrail}`),
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_day_one_recap",
      export_kind: "manual_day_one_recap",
      service_id: actionLayer.serviceId,
      service_title: actionLayer.serviceTitle,
      recap_status: firstRequestOutcome === "not_recorded" ? "needs_first_request_outcome" : "captured",
      target_company: targetRow
        ? {
            key: targetRow.key,
            company: targetRow.prospect.company,
            segment: targetRow.prospect.segment,
            channel_fit: targetRow.prospect.channelFit,
            status: targetRow.status,
            proof_status: targetRow.proofStatus,
          }
        : null,
      first_request_outcome: firstRequestOutcome,
      first_request_outcome_label: firstRequestOutcomeLabel,
      outcome_state_key: "firstRequestOutcomeByProspectKey",
      metric_status: metricStatus,
      metric_status_label: metricStatusLabel,
      latest_lane_activity: latestLaneActivity ?? null,
      day_one_recap_fields: dayOneFields,
      next_day_actions: nextDayActions,
      proof_summary: {
        category_signal: score?.signalLabel ?? "Unproven",
        category_proof_summary: score?.proofSummary ?? "No category score yet",
        proof_progress: proofProgress,
        proof_counts: counts,
        ready_to_pilot: readiness.readyToPilot,
      },
      week_one_review_handoff: {
        source_surface: "local_services_day_one_recap",
        target_surface: "local_services_pilot_week_one_review",
        contract: "day_one_recap_to_week_one_review",
      },
      guardrails,
    },
    null,
    2,
  );

  return {
    title: "Day-one recap",
    description:
      "Summarize the first operator-supervised local-services run before the result moves into the daily log, scorecard, or week-one review.",
    eyebrow: "Day-one recap",
    modeLabel: "Recap mode",
    copyLabel: "Copy day-one recap",
    reviewTitle: "First-day recap checklist",
    reviewDescription:
      "Use this after a real manual run. It records what happened; it does not send, book, bill, sync, or activate channels.",
    executionActionLabel: "Open week-one review",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Recap status", value: recapStatus },
      { label: "Service", value: actionLayer.serviceTitle },
      { label: "Target company", value: targetCompany },
      { label: "First request outcome", value: firstRequestOutcomeLabel },
      { label: "Metric status", value: metricStatusLabel },
      { label: "Week-one handoff", value: "day_one_recap_to_week_one_review" },
      { label: "Guardrail", value: "Manual recap only; no external side effects" },
    ],
    checklist: [
      "Record the first request outcome before copying the recap.",
      "Write operator edits and approval pauses in the private daily log or scorecard.",
      "Sync metric deltas manually; do not treat this as analytics sync.",
      "Use this recap as the handoff into week-one review only after a real day-one run.",
      "Do not create bookings, send customer messages, write CRM, bill, or activate channels.",
    ],
  };
}

function buildLocalServiceWeeklyScorecardSyncChecklist(
  template: LocalServiceDemoTemplate,
  rows: LocalServiceFounderContactRow[],
  counts: {
    channelChecked: number;
    manualMessageSent: number;
    repliesOrRejections: number;
    discoveryCalls: number;
    demosBooked: number;
    pilotCandidates: number;
  },
  proofProgress: string,
  score: LocalServiceCategoryPilotScore | undefined,
  actionLayer: LocalServiceLeadingCategoryActionLayer,
  readiness: LocalServiceLeadingCategoryPilotReadiness,
  firstRequestOutcomes: Record<string, LocalServiceFirstRequestOutcome>,
  metricStatus: LocalServicePilotMetricStatus,
  weeklySyncReviewed: boolean,
  activityLog: LocalServicePilotActivityEvent[],
): LocalServicePilotWorkspaceExport {
  const laneRows = rows.filter((row) => row.serviceId === actionLayer.serviceId);
  const targetRow =
    laneRows.find((row) => row.pilotCandidate) ??
    laneRows.find((row) => row.demoBooked) ??
    laneRows.find((row) => row.discoveryCallCompleted) ??
    laneRows.find((row) => row.status === "reply_received") ??
    laneRows[0];
  const targetCompany = targetRow
    ? `${targetRow.prospect.company} (${targetRow.prospect.segment})`
    : "No weekly scorecard target selected yet";
  const firstRequestOutcome = targetRow
    ? firstRequestOutcomes[targetRow.key] ?? "not_recorded"
    : "not_recorded";
  const firstRequestOutcomeLabel =
    LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS[firstRequestOutcome];
  const metricStatusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus];
  const latestLaneActivity = activityLog.find((event) => event.serviceId === actionLayer.serviceId);
  const latestLaneActivityLabel = latestLaneActivity
    ? `${latestLaneActivity.label}: ${latestLaneActivity.value}`
    : "No lane activity recorded yet";
  const weeklyScorecardSyncGate = !targetRow
    ? "Blocked until a day-one target is selected"
    : firstRequestOutcome === "not_recorded"
      ? "Blocked until first request outcome is recorded"
      : metricStatus === "review_ready"
        ? "Ready for manual weekly scorecard sync"
        : "Outcome captured; metrics still need review-ready status";
  const syncFields = [
    {
      label: "Target row",
      value: targetCompany,
      source: "leading category day-one target",
    },
    {
      label: "First request outcome",
      value: firstRequestOutcomeLabel,
      source: "firstRequestOutcomeByProspectKey",
    },
    {
      label: "Metric readiness",
      value: metricStatusLabel,
      source: "metricStatusByService",
    },
    {
      label: "Weekly sync reviewed",
      value: weeklySyncReviewed ? "Reviewed in browser-local state" : "Not reviewed yet",
      source: "weeklyScorecardSyncReviewedByService",
    },
    {
      label: "Latest manual signal",
      value: latestLaneActivityLabel,
      source: "local_services_manual_activity_log",
    },
    {
      label: "Day-one recap handoff",
      value: "day_one_recap_to_week_one_review",
      source: "local_services_day_one_recap",
    },
  ];
  const guardrails = [
    "manual_weekly_scorecard_sync_gate",
    "manual_weekly_scorecard_sync_checklist",
    "firstRequestOutcomeByProspectKey_required",
    "weeklyScorecardSyncReviewedByService",
    "metrics_review_ready_required",
    "manual_scorecard_sync_required",
    "no_markdown_scorecard_mutation",
    "no_crm_write",
    "no_analytics_sync",
    "no_customer_send",
    "no_billing_action",
  ];
  const humanLines = [
    `Weekly scorecard sync checklist: ${actionLayer.serviceTitle}`,
    "Export surface: local_services_weekly_scorecard_sync_checklist",
    "Export kind: manual_weekly_scorecard_sync_checklist",
    `Weekly scorecard sync gate: ${weeklyScorecardSyncGate}`,
    "Weekly sync contract: manual_weekly_scorecard_sync_gate",
    `Service lane: ${template.title}`,
    `Target company: ${targetCompany}`,
    `First request outcome: ${firstRequestOutcomeLabel}`,
    "Outcome state key: firstRequestOutcomeByProspectKey",
    `Metric status: ${metricStatusLabel}`,
    `Weekly sync reviewed: ${weeklySyncReviewed ? "yes" : "no"}`,
    "Weekly sync review state key: weeklyScorecardSyncReviewedByService",
    `Latest manual signal: ${latestLaneActivityLabel}`,
    "",
    "Sync fields:",
    ...syncFields.map((field) => `- ${field.label}: ${field.value} (${field.source})`),
    "",
    "Proof summary:",
    `- Category signal: ${score ? `${score.signalLabel}; ${score.proofSummary}` : "No category score yet"}`,
    `- First-batch proof: ${proofProgress}`,
    `- Manual sends: ${counts.manualMessageSent}/10`,
    `- Replies or rejections: ${counts.repliesOrRejections}/3`,
    `- Discovery calls: ${counts.discoveryCalls}/1`,
    `- Pilot candidates: ${counts.pilotCandidates}/1`,
    `- Paid-pilot readiness: ${readiness.readyToPilot ? "ready" : "blocked"}`,
    "",
    "Guardrails:",
    ...guardrails.map((guardrail) => `- ${guardrail}`),
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_weekly_scorecard_sync_checklist",
      export_kind: "manual_weekly_scorecard_sync_checklist",
      service_id: actionLayer.serviceId,
      service_title: actionLayer.serviceTitle,
      target_company: targetRow
        ? {
            key: targetRow.key,
            company: targetRow.prospect.company,
            segment: targetRow.prospect.segment,
            channel_fit: targetRow.prospect.channelFit,
            status: targetRow.status,
            proof_status: targetRow.proofStatus,
          }
        : null,
      first_request_outcome: firstRequestOutcome,
      first_request_outcome_label: firstRequestOutcomeLabel,
      outcome_state_key: "firstRequestOutcomeByProspectKey",
      metric_status: metricStatus,
      metric_status_label: metricStatusLabel,
      weekly_scorecard_sync_reviewed: weeklySyncReviewed,
      weekly_scorecard_sync_review_state_key: "weeklyScorecardSyncReviewedByService",
      weekly_scorecard_sync_gate: weeklyScorecardSyncGate,
      weekly_scorecard_sync_contract: "manual_weekly_scorecard_sync_gate",
      sync_fields: syncFields,
      source_surfaces: [
        "local_services_pilot_daily_log",
        "local_services_day_one_recap",
        "local_services_pilot_week_one_review",
      ],
      proof_summary: {
        category_signal: score?.signalLabel ?? "Unproven",
        category_proof_summary: score?.proofSummary ?? "No category score yet",
        proof_progress: proofProgress,
        proof_counts: counts,
        paid_pilot_ready: readiness.readyToPilot,
      },
      guardrails,
    },
    null,
    2,
  );

  return {
    title: "Weekly scorecard sync checklist",
    description:
      "Review the exact day-one outcome, metric state, and source surfaces before a human copies data into the private pilot scorecard.",
    eyebrow: "Scorecard sync",
    modeLabel: "Weekly sync mode",
    copyLabel: "Copy weekly sync checklist",
    reviewTitle: "Manual weekly scorecard checklist",
    reviewDescription:
      "This checklist only prepares a reviewed copy packet. It does not mutate docs, CRM, analytics, billing, bookings, or messages.",
    executionActionLabel: "Open week-one review",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Weekly scorecard sync gate", value: weeklyScorecardSyncGate },
      { label: "Service", value: actionLayer.serviceTitle },
      { label: "Target company", value: targetCompany },
      { label: "First request outcome", value: firstRequestOutcomeLabel },
      { label: "Metric status", value: metricStatusLabel },
      { label: "Weekly sync reviewed", value: weeklySyncReviewed ? "Recorded" : "Not recorded" },
      { label: "Latest manual signal", value: latestLaneActivityLabel },
      { label: "Contract", value: "manual_weekly_scorecard_sync_gate" },
      { label: "Guardrail", value: "Manual scorecard copy only; no external side effects" },
    ],
    checklist: [
      "Confirm the selected target matches the private pilot scorecard row.",
      "Confirm firstRequestOutcomeByProspectKey is recorded before copying.",
      "Confirm metrics are review-ready before treating the week as synced.",
      "Record weeklyScorecardSyncReviewedByService only after the private scorecard has been manually updated.",
      "Copy day-one recap and daily log references into the private tracker manually.",
      "Do not mutate Markdown docs, CRM, analytics, billing, bookings, or customer messages.",
    ],
  };
}

function buildLocalServicePilotMetricsTrackerExport(
  template: LocalServiceDemoTemplate,
  status: LocalServicePilotMetricStatus,
): LocalServicePilotWorkspaceExport {
  const statusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[status];
  const metricLines = template.detail.pilotKit.metrics.map(
    (metric) => `- ${metric.label}: baseline=${metric.baseline}; target=${metric.target}`,
  );
  const humanLines = [
    `Pilot metrics tracker: ${template.title}`,
    `Service: ${template.ref}`,
    "Export scope: browser-local pilot metric plan",
    `Storage key: ${LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY}`,
    `Metric status: ${statusLabel}`,
    "",
    "Metrics:",
    ...metricLines,
    "",
    "Manual metric capture rule: this tracker does not sync analytics, write CRM, or update Markdown scorecards automatically.",
    "Operator action: review live pilot numbers, then manually sync the weekly summary into the pilot scorecard.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_pilot_metrics_tracker",
      export_kind: "browser_local_metric_tracking_state",
      storage_key: LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY,
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      metric_status: status,
      metric_status_label: statusLabel,
      metrics: template.detail.pilotKit.metrics.map((metric) => ({
        label: metric.label,
        baseline: metric.baseline,
        target: metric.target,
        capture_source: "manual_operator_review",
      })),
      guardrails: [
        "manual_metric_capture",
        "no_external_analytics_sync",
        "no_crm_write",
        "manual_scorecard_sync_required",
      ],
    },
    null,
    2,
  );

  return {
    title: "Pilot metrics tracker",
    description:
      "Export the selected local-services lane metrics as a reviewed operator note or JSON payload. It stays browser-local and does not sync analytics or write CRM.",
    eyebrow: "Pilot metrics tracker",
    modeLabel: "Metrics export mode",
    copyLabel: "Copy pilot metrics tracker",
    reviewTitle: "Operator metric checklist",
    reviewDescription:
      "This tracker is a manual pilot artifact only: no analytics sync, no CRM write, no scorecard mutation.",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Service", value: `${template.ref} - ${template.title}` },
      { label: "Metric status", value: statusLabel },
      { label: "Metrics tracked", value: String(template.detail.pilotKit.metrics.length) },
      { label: "Review cadence", value: "daily capture, weekly scorecard sync" },
      { label: "Guardrail", value: "Manual metric capture, no analytics sync, no CRM write" },
    ],
    checklist: [
      "Capture baseline from real calls, chats, bookings, or dispatcher notes.",
      "Review missed-call recovery, response time, bookings, edits, and cancellation signals together.",
      "Sync only reviewed weekly numbers into the pilot scorecard or CRM.",
      "Do not treat this tracker as proof that external analytics were synced.",
    ],
  };
}

function buildLocalServicePilotDailyLogExport(
  template: LocalServiceDemoTemplate,
  prospect: LocalServiceOutreachProspect | undefined,
  pilotStatus: LocalServicePilotStatus,
  status: LocalServicePilotMetricStatus,
  firstRequestOutcome: LocalServiceFirstRequestOutcome,
): LocalServicePilotWorkspaceExport {
  const pilotStatusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[pilotStatus];
  const statusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[status];
  const firstRequestOutcomeLabel = LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS[firstRequestOutcome];
  const prospectLabel = prospect ? prospect.company : "No selected company";
  const weeklyScorecardSyncGate =
    firstRequestOutcome === "not_recorded"
      ? "Blocked until first request outcome is recorded"
      : status === "review_ready"
        ? "Ready for manual weekly scorecard sync"
        : "Outcome captured; metrics still need review-ready status";
  const dailyFields = [
    {
      label: "Inbound requests",
      value: "manual count from calls, Telegram, website, and ads",
      source: "operator tally",
    },
    {
      label: "Missed-call recovery",
      value: "manual count of missed or delayed requests recovered",
      source: "phone/Telegram review",
    },
    {
      label: "First reply time",
      value: "manual median or representative response-time note",
      source: "operator estimate",
    },
    {
      label: "Quotes / slots / dispatch cards",
      value: "manual count of job cards prepared for review",
      source: "pilot workspace",
    },
    {
      label: "Manual operator edits",
      value: "manual count or note on what had to be rewritten",
      source: "operator review",
    },
    {
      label: "Confirmed bookings / dispatches",
      value: "manual count after owner approval",
      source: "private scorecard",
    },
    {
      label: "No-shows / cancellations",
      value: "manual count plus reason when known",
      source: "owner/operator note",
    },
    {
      label: "Operator note",
      value: "one sentence: what still blocked trust or speed today?",
      source: "human note",
    },
  ];
  const fieldLines = dailyFields.map((field) => `- ${field.label}: ${field.value} (${field.source})`);
  const humanLines = [
    `Pilot daily log: ${template.title}`,
    `Service: ${template.ref}`,
    "Export scope: manual daily operating loop",
    `Storage key: ${LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY}`,
    `Selected company: ${prospectLabel}`,
    `Pilot status: ${pilotStatusLabel}`,
    `Metric status: ${statusLabel}`,
    `First request outcome: ${firstRequestOutcomeLabel}`,
    `Outcome state key: firstRequestOutcomeByProspectKey`,
    `Weekly scorecard sync gate: ${weeklyScorecardSyncGate}`,
    "Weekly sync contract: manual_weekly_scorecard_sync_gate",
    "",
    "Daily capture fields:",
    ...fieldLines,
    "",
    "First request outcome rule: record the observed result after the first operator-supervised request before weekly scorecard sync.",
    "Daily operating rule: this log is a reviewed template only. It does not sync analytics, write CRM, create bookings, or update Markdown scorecards automatically.",
    "Operator action: fill the private daily numbers, then manually copy the reviewed summary into the pilot scorecard or spreadsheet.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_pilot_daily_log",
      export_kind: "manual_daily_operating_loop",
      storage_key: LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY,
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      selected_company: prospectLabel,
      selected_prospect_id: prospect?.id ?? null,
      pilot_status: pilotStatus,
      pilot_status_label: pilotStatusLabel,
      metric_status: status,
      metric_status_label: statusLabel,
      first_request_outcome: firstRequestOutcome,
      first_request_outcome_label: firstRequestOutcomeLabel,
      outcome_state_key: "firstRequestOutcomeByProspectKey",
      weekly_scorecard_sync_gate: weeklyScorecardSyncGate,
      weekly_scorecard_sync_contract: "manual_weekly_scorecard_sync_gate",
      daily_capture_fields: dailyFields,
      guardrails: [
        "manual_daily_capture",
        "manual_first_request_outcome_note",
        "manual_weekly_scorecard_sync_gate",
        "no_external_analytics_sync",
        "no_crm_write",
        "no_calendar_booking_created",
        "no_customer_message_sent",
        "manual_scorecard_sync_required",
      ],
    },
    null,
    2,
  );

  return {
    title: "Pilot daily log",
    description:
      "Prepare the daily operating-loop note for the selected local-services lane. It is a manual capture template, not analytics sync or CRM.",
    eyebrow: "Pilot daily log",
    modeLabel: "Daily log mode",
    copyLabel: "Copy pilot daily log",
    reviewTitle: "Daily operating loop",
    reviewDescription:
      "Fill these numbers manually from real calls, chats, bookings, and operator notes before scorecard sync.",
    executionActionLabel: "Open pilot runbook",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Service", value: `${template.ref} - ${template.title}` },
      { label: "Selected company", value: prospectLabel },
      { label: "Pilot status", value: pilotStatusLabel },
      { label: "Metric status", value: statusLabel },
      { label: "First request outcome", value: firstRequestOutcomeLabel },
      { label: "Weekly scorecard sync gate", value: weeklyScorecardSyncGate },
      { label: "Capture cadence", value: "once per pilot day" },
      { label: "Fields", value: dailyFields.map((field) => field.label).join(", ") },
      { label: "Guardrail", value: "Manual daily capture, no analytics sync, no CRM write" },
    ],
    checklist: [
      "Count only real pilot activity from the current day.",
      "Record the first request outcome before weekly scorecard sync.",
      "Keep weekly scorecard sync blocked until outcome is recorded and metrics are review-ready.",
      "Separate captured requests from confirmed bookings or dispatches.",
      "Write one operator note about what still required rewriting.",
      "Sync reviewed numbers manually into the scorecard or spreadsheet.",
      "Do not treat this daily log as proof that external analytics were synced.",
    ],
  };
}

function buildLocalServicePilotWeekOneReviewExport(
  template: LocalServiceDemoTemplate,
  prospect: LocalServiceOutreachProspect | undefined,
  pilotStatus: LocalServicePilotStatus,
  metricStatus: LocalServicePilotMetricStatus,
  firstRequestOutcome: LocalServiceFirstRequestOutcome,
  ownerDecision: LocalServiceWeekOneOwnerDecision,
  weeklySyncReviewed: boolean,
  activityLog: LocalServicePilotActivityEvent[] = [],
): LocalServicePilotWorkspaceExport {
  const pilotStatusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[pilotStatus];
  const metricStatusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus];
  const firstRequestOutcomeLabel = LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS[firstRequestOutcome];
  const ownerDecisionLabel = LOCAL_SERVICE_WEEK_ONE_OWNER_DECISION_LABELS[ownerDecision];
  const prospectLabel = prospect ? `${prospect.company} - ${prospect.segment}` : "No prospect selected";
  const weeklyScorecardSyncGate =
    firstRequestOutcome === "not_recorded"
      ? "Blocked until first request outcome is recorded"
      : metricStatus === "review_ready"
        ? "Ready for manual weekly scorecard sync"
        : "Outcome captured; metrics still need review-ready status";
  const latestRelevantActivity =
    activityLog.find(
      (event) =>
        event.serviceId === template.id &&
        (prospect ? event.prospectId === prospect.id || event.company === prospect.company : true),
    ) ?? activityLog.find((event) => event.serviceId === template.id);
  const latestRelevantActivityLabel = latestRelevantActivity
    ? `${latestRelevantActivity.label}: ${latestRelevantActivity.value}`
    : "No manual activity recorded yet";
  const latestRelevantActivityTime = latestRelevantActivity?.createdAt ?? "not recorded";
  const decisionReadinessLabel =
    firstRequestOutcome === "not_recorded"
      ? "Blocked: first request outcome missing"
      : metricStatus !== "review_ready"
        ? "Needs week-one metric review"
        : weeklySyncReviewed
          ? "Owner decision ready"
          : "Blocked: weekly scorecard sync not reviewed";
  const dayOneRecapHandoffStatus =
    firstRequestOutcome === "not_recorded" ? "waiting_for_day_one_recap" : "day_one_recap_ready";
  const ownerDecisionStatus =
    ownerDecision === "not_recorded" ? "waiting_for_owner_decision" : "owner_decision_recorded";
  const continueCriteria = [
    "operator used the job-card output without rewriting it from scratch",
    "at least one missed or delayed request was recovered",
    "first reply time improved",
    "owner asks to keep the flow running",
    "there is a clear paid use case",
  ];
  const stopCriteria = [
    "no real requests are routed through the pilot",
    "no one owns approvals",
    "the company wants a custom marketplace or CRM project",
    "every request is too custom for the P0 dispatcher flow",
  ];
  const decisionFields = [
    {
      label: "Decision",
      value: "continue, pause, or stop after owner review",
    },
    {
      label: "Proof",
      value: "missed request recovered, faster reply, booking/dispatch, or reduced rewrite work",
    },
    {
      label: "Owner note",
      value: "one sentence from the business owner or dispatcher",
    },
    {
      label: "Week-two focus",
      value: "one measurable workflow to improve next",
    },
  ];
  const ownerReadySummary = [
    {
      label: "Decision readiness",
      value: decisionReadinessLabel,
    },
    {
      label: "Day-one recap handoff",
      value: "day_one_recap_to_week_one_review",
    },
    {
      label: "Weekly scorecard sync gate",
      value: weeklyScorecardSyncGate,
    },
    {
      label: "Weekly sync reviewed",
      value: weeklySyncReviewed ? "Recorded in browser-local state" : "Not recorded yet",
    },
    {
      label: "Latest manual signal",
      value: latestRelevantActivityLabel,
    },
    {
      label: "Owner question",
      value: "continue, pause, or stop this pilot for week two",
    },
    {
      label: "Recorded owner decision",
      value: ownerDecisionLabel,
    },
  ];
  const humanLines = [
    `Pilot week-one review: ${template.title}`,
    `Service: ${template.ref}`,
    `Selected company: ${prospectLabel}`,
    `Pilot status: ${pilotStatusLabel}`,
    `Metric status: ${metricStatusLabel}`,
    `First request outcome: ${firstRequestOutcomeLabel}`,
    `Outcome state key: firstRequestOutcomeByProspectKey`,
    `Owner decision: ${ownerDecisionLabel}`,
    `Owner decision state key: weekOneOwnerDecisionByProspectKey`,
    "Export scope: manual week-one decision pack",
    `Decision readiness: ${decisionReadinessLabel}`,
    `Weekly scorecard sync gate: ${weeklyScorecardSyncGate}`,
    "Weekly sync contract: manual_weekly_scorecard_sync_gate",
    `Weekly sync reviewed: ${weeklySyncReviewed ? "yes" : "no"}`,
    "Weekly sync review state key: weeklyScorecardSyncReviewedByService",
    `Day-one recap handoff: ${dayOneRecapHandoffStatus}`,
    `Owner decision status: ${ownerDecisionStatus}`,
    "",
    "Owner-ready summary:",
    ...ownerReadySummary.map((field) => `- ${field.label}: ${field.value}`),
    `- Latest manual signal time: ${latestRelevantActivityTime}`,
    "",
    "Continue if at least two are true:",
    ...continueCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Stop early if any are true:",
    ...stopCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Review fields:",
    ...decisionFields.map((field) => `- ${field.label}: ${field.value}`),
    "",
    "Decision rule: the operator records the decision manually after owner review. The shell does not decide, message customers, change billing, or write CRM.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_pilot_week_one_review",
      export_kind: "manual_week_one_decision_pack",
      storage_key: LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY,
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      prospect_id: prospect?.id ?? null,
      prospect_company: prospect?.company ?? null,
      pilot_status: pilotStatus,
      pilot_status_label: pilotStatusLabel,
      metric_status: metricStatus,
      metric_status_label: metricStatusLabel,
      first_request_outcome: firstRequestOutcome,
      first_request_outcome_label: firstRequestOutcomeLabel,
      outcome_state_key: "firstRequestOutcomeByProspectKey",
      owner_decision: ownerDecision,
      owner_decision_label: ownerDecisionLabel,
      owner_decision_state_key: "weekOneOwnerDecisionByProspectKey",
      owner_decision_status: ownerDecisionStatus,
      decision_readiness: decisionReadinessLabel,
      weekly_scorecard_sync_gate: weeklyScorecardSyncGate,
      weekly_scorecard_sync_contract: "manual_weekly_scorecard_sync_gate",
      weekly_scorecard_sync_reviewed: weeklySyncReviewed,
      weekly_scorecard_sync_review_state_key: "weeklyScorecardSyncReviewedByService",
      day_one_recap_handoff: {
        source_surface: "local_services_day_one_recap",
        target_surface: "local_services_pilot_week_one_review",
        contract: "day_one_recap_to_week_one_review",
        status: dayOneRecapHandoffStatus,
      },
      owner_ready_summary: ownerReadySummary,
      latest_manual_signal: {
        label: latestRelevantActivity?.label ?? null,
        value: latestRelevantActivity?.value ?? null,
        created_at: latestRelevantActivity?.createdAt ?? null,
      },
      evidence_pack_handoff: {
        source_surface: "local_services_pilot_week_one_review",
        target_surface: "local_services_pilot_evidence_pack",
        contract: "week_one_owner_decision_to_evidence_pack",
        status: ownerDecisionStatus,
      },
      continue_criteria: continueCriteria,
      stop_criteria: stopCriteria,
      decision_fields: decisionFields,
      guardrails: [
        "manual_week_one_review",
        "manual_first_request_outcome_review",
        "manual_weekly_scorecard_sync_gate",
        "weeklyScorecardSyncReviewedByService",
        "day_one_recap_to_week_one_review",
        "week_one_owner_decision_to_evidence_pack",
        "owner_review_required",
        "owner_decision_manual_only",
        "no_autonomous_pilot_decision",
        "no_crm_write",
        "no_billing_change",
        "no_customer_message_sent",
        "manual_scorecard_sync_required",
      ],
    },
    null,
    2,
  );

  return {
    title: "Pilot week-one review",
    description:
      "Prepare a manual continue, pause, or stop review for the selected local-services pilot after the first operating week.",
    eyebrow: "Pilot review",
    modeLabel: "Review mode",
    copyLabel: "Copy week-one review",
    reviewTitle: "Continue / stop decision",
    reviewDescription:
      "Use this only after real pilot activity exists. The owner or operator makes the decision outside the shell.",
    executionActionLabel: "Open pilot runbook",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Service", value: `${template.ref} - ${template.title}` },
      { label: "Company", value: prospectLabel },
      { label: "Pilot status", value: pilotStatusLabel },
      { label: "Metric status", value: metricStatusLabel },
      { label: "First request outcome", value: firstRequestOutcomeLabel },
      { label: "Owner decision", value: ownerDecisionLabel },
      { label: "Decision readiness", value: decisionReadinessLabel },
      { label: "Weekly scorecard sync gate", value: weeklyScorecardSyncGate },
      { label: "Weekly sync reviewed", value: weeklySyncReviewed ? "Recorded" : "Not recorded" },
      { label: "Owner-ready summary", value: ownerReadySummary.map((field) => field.label).join(", ") },
      { label: "Day-one recap handoff", value: "day_one_recap_to_week_one_review" },
      { label: "Evidence pack handoff", value: "week_one_owner_decision_to_evidence_pack" },
      { label: "Guardrail", value: "Manual review only, no autonomous pilot decision" },
    ],
    checklist: [
      "Confirm at least one real pilot day was logged before using this review.",
      "Confirm the first request outcome is recorded before choosing continue, pause, or stop.",
      "Confirm manual_weekly_scorecard_sync_gate is ready before treating the scorecard as week-one reviewed.",
      "Confirm weeklyScorecardSyncReviewedByService is recorded after the private scorecard was manually updated.",
      "Review Owner-ready summary before sharing the week-one decision with the owner.",
      "Confirm day_one_recap_to_week_one_review came from a reviewed day-one recap.",
      "Record Continue, Pause, or Stop in weekOneOwnerDecisionByProspectKey before copying the evidence pack.",
      "Count continue criteria and stop criteria separately.",
      "Write the owner or dispatcher note in a private scorecard or spreadsheet.",
      "Choose one week-two focus if the pilot continues.",
      "Do not treat this review as a billing, CRM, or customer-message action.",
    ],
  };
}

function buildLocalServicePilotEvidencePackExport(
  template: LocalServiceDemoTemplate,
  prospect: LocalServiceOutreachProspect | undefined,
  pilotStatus: LocalServicePilotStatus,
  metricStatus: LocalServicePilotMetricStatus,
  firstRequestOutcome: LocalServiceFirstRequestOutcome,
  ownerDecision: LocalServiceWeekOneOwnerDecision,
  weeklySyncReviewed: boolean,
): LocalServicePilotWorkspaceExport {
  const pilotStatusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[pilotStatus];
  const metricStatusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus];
  const firstRequestOutcomeLabel = LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS[firstRequestOutcome];
  const ownerDecisionLabel = LOCAL_SERVICE_WEEK_ONE_OWNER_DECISION_LABELS[ownerDecision];
  const prospectLabel = prospect ? `${prospect.company} - ${prospect.segment}` : "No prospect selected";
  const weeklyScorecardSyncGate =
    firstRequestOutcome === "not_recorded"
      ? "Blocked until first request outcome is recorded"
      : metricStatus === "review_ready"
        ? "Ready for manual weekly scorecard sync"
        : "Outcome captured; metrics still need review-ready status";
  const evidenceReadiness =
    ownerDecision === "not_recorded"
      ? "Blocked until week-one owner decision is recorded"
      : !weeklySyncReviewed
        ? "Blocked until weekly scorecard sync is reviewed"
        : "Ready for redacted evidence review";
  const evidenceItems = [
    {
      label: "Before / after intake",
      value: "one redacted screenshot or operator note comparing old intake to the pilot flow",
    },
    {
      label: "Anonymized job card",
      value: "one job card with name, phone, address, and private media removed",
    },
    {
      label: "Customer confirmation",
      value: "one operator-approved draft confirmation with private customer data redacted",
    },
    {
      label: "Master handoff",
      value: "one operator/master handoff showing district, service type, urgency, and approval state",
    },
    {
      label: "Scorecard rows",
      value: "week-one and week-two reviewed metrics from the private scorecard or spreadsheet",
    },
    {
      label: "Owner quote",
      value: "one short quote from the owner or dispatcher about time saved, trust, or blockers",
    },
    {
      label: "Decision",
      value: "recorded week-one owner decision plus clear continue, paid pilot, one-week extension, or stop decision",
    },
  ];
  const weekTwoOptions = [
    "continue as a paid pilot",
    "continue free for one more week only if data is incomplete but demand is real",
    "stop and move to the next account",
  ];
  const readinessCriteria = [
    "a named owner wants the flow",
    "at least one job was saved, recovered, or made faster",
    "the operator trusts the approval gate",
    "the scope stays inside phone, Telegram, job cards, and handoff",
  ];
  const humanLines = [
    `Pilot evidence pack: ${template.title}`,
    `Service: ${template.ref}`,
    `Selected company: ${prospectLabel}`,
    `Pilot status: ${pilotStatusLabel}`,
    `Metric status: ${metricStatusLabel}`,
    `First request outcome: ${firstRequestOutcomeLabel}`,
    `Outcome state key: firstRequestOutcomeByProspectKey`,
    `Week-one owner decision: ${ownerDecisionLabel}`,
    `Owner decision state key: weekOneOwnerDecisionByProspectKey`,
    `Weekly scorecard sync gate: ${weeklyScorecardSyncGate}`,
    "Weekly sync contract: manual_weekly_scorecard_sync_gate",
    `Weekly sync reviewed: ${weeklySyncReviewed ? "yes" : "no"}`,
    "Weekly sync review state key: weeklyScorecardSyncReviewedByService",
    `Evidence readiness: ${evidenceReadiness}`,
    "Week-one handoff: week_one_owner_decision_to_evidence_pack",
    "Export scope: manual week-two evidence pack",
    "",
    "Evidence items:",
    ...evidenceItems.map((item) => `- ${item.label}: ${item.value}`),
    "",
    "Week-two decision options:",
    ...weekTwoOptions.map((option) => `- ${option}`),
    "",
    "Paid-pilot readiness:",
    ...readinessCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Redaction rule: do not store private customer data in public docs. Redact names, phone numbers, exact addresses, and private media before sharing externally.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_pilot_evidence_pack",
      export_kind: "manual_week_two_evidence_pack",
      storage_key: LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY,
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      prospect_id: prospect?.id ?? null,
      prospect_company: prospect?.company ?? null,
      pilot_status: pilotStatus,
      pilot_status_label: pilotStatusLabel,
      metric_status: metricStatus,
      metric_status_label: metricStatusLabel,
      first_request_outcome: firstRequestOutcome,
      first_request_outcome_label: firstRequestOutcomeLabel,
      outcome_state_key: "firstRequestOutcomeByProspectKey",
      owner_decision: ownerDecision,
      owner_decision_label: ownerDecisionLabel,
      owner_decision_state_key: "weekOneOwnerDecisionByProspectKey",
      weekly_scorecard_sync_gate: weeklyScorecardSyncGate,
      weekly_scorecard_sync_contract: "manual_weekly_scorecard_sync_gate",
      weekly_scorecard_sync_reviewed: weeklySyncReviewed,
      weekly_scorecard_sync_review_state_key: "weeklyScorecardSyncReviewedByService",
      evidence_readiness: evidenceReadiness,
      week_one_review_handoff: {
        source_surface: "local_services_pilot_week_one_review",
        target_surface: "local_services_pilot_evidence_pack",
        contract: "week_one_owner_decision_to_evidence_pack",
        status: ownerDecision === "not_recorded" ? "waiting_for_owner_decision" : "owner_decision_recorded",
      },
      evidence_items: evidenceItems,
      week_two_decision_options: weekTwoOptions,
      paid_pilot_readiness: readinessCriteria,
      guardrails: [
        "manual_week_two_evidence_pack",
        "manual_first_request_outcome_evidence",
        "manual_weekly_scorecard_sync_gate",
        "weeklyScorecardSyncReviewedByService",
        "week_one_owner_decision_to_evidence_pack",
        "owner_decision_manual_only",
        "no_private_customer_data_in_public_docs",
        "redact_names_phone_addresses_media",
        "no_autonomous_pilot_decision",
        "no_crm_write",
        "no_billing_change",
        "no_customer_message_sent",
      ],
    },
    null,
    2,
  );

  return {
    title: "Pilot evidence pack",
    description:
      "Prepare the redacted week-two proof pack for owner review, paid-pilot readiness, or a clean stop decision.",
    eyebrow: "Pilot evidence",
    modeLabel: "Evidence mode",
    copyLabel: "Copy evidence pack",
    reviewTitle: "Week-two evidence pack",
    reviewDescription:
      "Use this after a serious pilot has real proof. Redact private customer data before external sharing.",
    executionActionLabel: "Open pilot runbook",
    scorecardActionLabel: "Open pilot scorecard",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Service", value: `${template.ref} - ${template.title}` },
      { label: "Company", value: prospectLabel },
      { label: "First request outcome", value: firstRequestOutcomeLabel },
      { label: "Week-one owner decision", value: ownerDecisionLabel },
      { label: "Weekly scorecard sync gate", value: weeklyScorecardSyncGate },
      { label: "Weekly sync reviewed", value: weeklySyncReviewed ? "Recorded" : "Not recorded" },
      { label: "Evidence readiness", value: evidenceReadiness },
      { label: "Week-one handoff", value: "week_one_owner_decision_to_evidence_pack" },
      { label: "Evidence items", value: String(evidenceItems.length) },
      { label: "Decision options", value: weekTwoOptions.join(", ") },
      { label: "Guardrail", value: "Manual redacted evidence pack, no private customer data in public docs" },
    ],
    checklist: [
      "Include only redacted screenshots, notes, and job-card excerpts.",
      "Include the first request outcome before paid-pilot readiness is reviewed.",
      "Include the week-one owner decision before paid-pilot readiness is reviewed.",
      "Include weeklyScorecardSyncReviewedByService proof before treating the private scorecard as reviewed.",
      "Attach week-one and week-two scorecard rows from the private tracker.",
      "Record one owner or dispatcher quote.",
      "Pick one clear continue, paid pilot, extension, or stop decision.",
      "Do not treat this pack as a CRM, billing, or customer-message action.",
    ],
  };
}

function buildLocalServicePilotMessagePreview(
  template: LocalServiceDemoTemplate,
  prospect: LocalServiceOutreachProspect | undefined,
  status: LocalServicePilotStatus,
): LocalServicePilotMessagePreview {
  const statusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[status];
  const wizard = template.detail.pilotKit.outreachWizard;
  const company = prospect?.company ?? "No prospect selected";
  const segment = prospect?.segment ?? "unknown";
  const messageText = wizard.testMessage;
  const humanLines = [
    `Preview / Test message modal: ${template.title}`,
    `Selected company: ${company}`,
    `Segment: ${segment}`,
    `Current scorecard state: ${statusLabel}`,
    "",
    "Audience:",
    wizard.audience,
    "",
    "Test message:",
    messageText,
    "",
    "Operator confirmation:",
    wizard.confirmationGate,
    "",
    "Execution rule: this preview does not send outreach, write CRM, or update the pilot scorecard.",
    "Operator action: copy only after manual review, send manually in the approved channel, then log the outcome.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_test_message_preview",
      export_kind: "operator_review_preview",
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      prospect: prospect
        ? {
            id: prospect.id,
            company: prospect.company,
            segment: prospect.segment,
            channel_fit: prospect.channelFit,
            why_now: prospect.whyNow,
            scorecard_focus: prospect.scorecardFocus,
            next_step: prospect.nextStep,
          }
        : null,
      current_status: status,
      current_status_label: statusLabel,
      audience: wizard.audience,
      test_message: messageText,
      confirmation_gate: wizard.confirmationGate,
      guardrails: [
        "manual_confirmation_required_before_outreach",
        "no_outbound_message_sent",
        "no_crm_write",
        "manual_scorecard_sync_required",
      ],
    },
    null,
    2,
  );

  return {
    title: "Preview / Test message modal",
    description:
      "Review the exact first-contact message, selected company, audience fit, and approval gate before any manual outreach.",
    modeLabel: "Message preview mode",
    copyPreviewLabel: "Copy test message preview",
    copyMessageLabel: "Copy test message",
    messageText,
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Service", value: `${template.ref} - ${template.title}` },
      { label: "Selected company", value: company },
      { label: "Segment", value: segment },
      { label: "Current status", value: statusLabel },
      { label: "Guardrail", value: "No outbound message sent; manual confirmation required" },
    ],
    checklist: [
      "Confirm the company matches the selected local-services lane.",
      "Review the message wording and remove anything that sounds like an automated blast.",
      "Send manually only after the operator approves the exact message and channel.",
      "Log the result in the pilot scorecard after the manual contact.",
    ],
  };
}

function buildLocalServicePilotConfirmationSummary(
  template: LocalServiceDemoTemplate,
  prospect: LocalServiceOutreachProspect | undefined,
): LocalServicePilotConfirmationSummary {
  const wizard = template.detail.pilotKit.outreachWizard;
  const statusLabel = "Ready for manual outreach";
  const company = prospect?.company ?? "No prospect selected";
  const segment = prospect?.segment ?? "unknown";
  const channel = prospect?.channelFit ?? template.channel;
  const messageText = wizard.testMessage;
  const checklist = [
    "Company is selected from the repo-owned outreach list.",
    "Channel fit is reviewed by the operator before contact.",
    "Exact message was inspected in the Preview / Test message modal.",
    "Operator sends manually outside the shell and logs the result afterward.",
  ];
  const humanLines = [
    `Operator confirmation summary: ${template.title}`,
    `Status: ${statusLabel}`,
    `Selected company: ${company}`,
    `Segment: ${segment}`,
    `Channel: ${channel}`,
    "",
    "Exact message:",
    messageText,
    "",
    "Approval checklist:",
    ...checklist.map((item) => `- ${item}`),
    "",
    "Manual execution rule: this confirmation does not send outreach, write CRM, or update the scorecard.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_operator_confirmation",
      export_kind: "manual_outreach_confirmation_summary",
      confirmation_status: "ready_for_manual_outreach",
      confirmation_status_label: statusLabel,
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      selected_company: company,
      selected_segment: segment,
      channel,
      exact_message: messageText,
      approval_checklist: checklist,
      guardrails: [
        "operator_confirmation_required",
        "ready_for_manual_outreach_only",
        "no_outbound_message_sent",
        "no_crm_write",
        "manual_scorecard_sync_required",
      ],
    },
    null,
    2,
  );

  return {
    title: "Operator confirmation summary",
    description:
      "Final review surface before a human performs manual outreach outside the product shell.",
    modeLabel: "Confirmation summary mode",
    copyLabel: "Copy confirmation summary",
    statusLabel,
    messageText,
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Status", value: statusLabel },
      { label: "Selected company", value: company },
      { label: "Segment", value: segment },
      { label: "Channel", value: channel },
      { label: "Guardrail", value: "Ready for manual outreach only; no outbound send" },
    ],
    checklist,
  };
}

function buildLocalServicePilotLaunchPacket(
  template: LocalServiceDemoTemplate,
  prospect: LocalServiceOutreachProspect | undefined,
  pilotStatus: LocalServicePilotStatus,
  testCallPassed: boolean,
  testCallProgress: string,
): LocalServicePilotWorkspaceExport {
  const wizard = template.detail.pilotKit.outreachWizard;
  const pilotStatusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[pilotStatus];
  const company = prospect?.company ?? "No prospect selected";
  const segment = prospect?.segment ?? "unknown";
  const channel = prospect?.channelFit ?? template.channel;
  const draftReady = pilotStatus === "draft_ready";
  const launchReady = testCallPassed && draftReady;
  const dryRunStatus = testCallPassed ? "Dry run passed" : `Dry run required (${testCallProgress})`;
  const launchReadiness = launchReady
    ? "Ready for first manual contact"
    : testCallPassed
      ? "Needs ready draft"
      : "Needs dry run passed";
  const nextOperatorAction = launchReady
    ? "Send manually in the approved channel, then mark Contacted manually in the scorecard."
    : testCallPassed
      ? "Open Operator confirmation, inspect the message, then record the selected draft as ready."
      : "Finish the setup dry run and record Test call passed before preparing first contact.";
  const approvalChecklist = [
    "Dry-run gate is passed before any first contact.",
    "Selected company, service lane, and channel fit match the outreach list.",
    "Message draft is reviewed in Preview / Test message before a human sends it.",
    "Operator sends manually outside the shell and logs Contacted manually afterward.",
  ];
  const humanLines = [
    `First manual contact packet: ${template.title}`,
    `Launch readiness: ${launchReadiness}`,
    `Dry-run status: ${dryRunStatus}`,
    `Selected company: ${company}`,
    `Segment: ${segment}`,
    `Channel: ${channel}`,
    `Draft status: ${pilotStatusLabel}`,
    "",
    "Message draft:",
    wizard.testMessage,
    "",
    "Approval checklist:",
    ...approvalChecklist.map((item) => `- ${item}`),
    "",
    `Next operator action: ${nextOperatorAction}`,
    "Manual execution rule: this launch packet does not send outreach, write CRM, create a calendar event, or mutate docs.",
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_pilot_launch_packet",
      export_kind: "operator_approved_manual_contact_packet",
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      selected_prospect: prospect
        ? {
            id: prospect.id,
            company: prospect.company,
            segment: prospect.segment,
            channel_fit: prospect.channelFit,
            why_now: prospect.whyNow,
            scorecard_focus: prospect.scorecardFocus,
            next_step: prospect.nextStep,
          }
        : null,
      dry_run_passed: testCallPassed,
      dry_run_status: dryRunStatus,
      test_call_progress: testCallProgress,
      draft_status: pilotStatus,
      draft_status_label: pilotStatusLabel,
      launch_ready: launchReady,
      launch_readiness: launchReadiness,
      channel,
      message_draft: wizard.testMessage,
      approval_checklist: approvalChecklist,
      next_operator_action: nextOperatorAction,
      guardrails: [
        "dry_run_required_before_first_contact",
        "operator_approval_required",
        "manual_send_only",
        "no_outbound_message_sent",
        "no_crm_write",
        "manual_scorecard_sync_required",
      ],
    },
    null,
    2,
  );

  return {
    title: "Pilot launch packet",
    description:
      "Preview the first manual contact packet with dry-run status, selected company, draft state, approval checklist, and next operator action.",
    eyebrow: "Launch packet preview",
    modeLabel: "Launch packet mode",
    copyLabel: "Copy launch packet",
    reviewTitle: "First manual contact checklist",
    reviewDescription:
      "This packet is a launch-readiness artifact only: no outbound message, no CRM write, no calendar event, no scorecard mutation.",
    scorecardActionLabel: "Open pilot scorecard",
    executionActionLabel: "Open outreach execution pack",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Launch readiness", value: launchReadiness },
      { label: "Dry-run gate", value: dryRunStatus },
      { label: "Selected company", value: company },
      { label: "Draft status", value: pilotStatusLabel },
      { label: "Next action", value: nextOperatorAction },
      { label: "Guardrail", value: "Manual send only; no outbound message or CRM write" },
    ],
    checklist: approvalChecklist,
  };
}

function buildLocalServiceDiscoveryCallPrep(
  template: LocalServiceDemoTemplate,
  prospect: LocalServiceOutreachProspect | undefined,
  status: LocalServicePilotStatus,
  metricStatus: LocalServicePilotMetricStatus,
): LocalServiceDiscoveryCallPrep {
  const statusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[status];
  const metricStatusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus];
  const company = prospect?.company ?? "No prospect selected";
  const segment = prospect?.segment ?? "unknown";
  const readyToBook = status === "reply_received";
  const callReadiness = readyToBook
    ? "Reply received - ready to book discovery call"
    : "Needs reply before booking discovery call";
  const discoveryQuestions = [
    `What happens today when a ${template.title.toLowerCase()} request comes by phone or Telegram after hours?`,
    "How many requests per week are missed, delayed, or lost because the first response is late?",
    "Which details must the assistant collect before a dispatcher or owner can approve the booking?",
    "What price, slot, master, or address fields must always stay human-approved?",
    "Can we test a 14-day pilot on real missed calls/messages without changing the existing CRM?",
  ];
  const successCriteria = template.detail.pilotKit.metrics.map(
    (metric) => `${metric.label}: baseline ${metric.baseline}; target ${metric.target}`,
  );
  const guardrails = [
    "operator_reviews_call_notes_before_customer_followup",
    "no_calendar_booking_created",
    "no_crm_write",
    "no_outbound_message_sent",
    "manual_scorecard_sync_required",
  ];
  const humanLines = [
    `Discovery call prep: ${template.title}`,
    `Selected company: ${company}`,
    `Segment: ${segment}`,
    `Current status: ${statusLabel}`,
    `Call readiness: ${callReadiness}`,
    `Metric status: ${metricStatusLabel}`,
    "",
    "Call objective:",
    "Confirm a real 14-day pilot with phone-first intake, operator-approved booking, and manual scorecard sync.",
    "",
    "Questions to ask:",
    ...discoveryQuestions.map((question) => `- ${question}`),
    "",
    "Pilot success criteria:",
    ...successCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Next operator action:",
    readyToBook
      ? "Book the discovery call manually, then update the pilot scorecard after the conversation."
      : "Wait for a real reply before booking; use the message preview and confirmation surfaces first.",
    "",
    "Guardrails:",
    ...guardrails.map((guardrail) => `- ${guardrail}`),
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_discovery_call_prep",
      export_kind: "operator_review_call_brief",
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      prospect: prospect
        ? {
            id: prospect.id,
            company: prospect.company,
            segment: prospect.segment,
            channel_fit: prospect.channelFit,
            why_now: prospect.whyNow,
            scorecard_focus: prospect.scorecardFocus,
            next_step: prospect.nextStep,
          }
        : null,
      current_status: status,
      current_status_label: statusLabel,
      call_readiness: callReadiness,
      ready_to_book_discovery_call: readyToBook,
      metric_status: metricStatus,
      metric_status_label: metricStatusLabel,
      call_objective:
        "Confirm a 14-day phone-first pilot with operator-approved booking and manual scorecard sync.",
      discovery_questions: discoveryQuestions,
      success_criteria: successCriteria,
      guardrails,
    },
    null,
    2,
  );

  return {
    title: "Discovery call prep",
    description:
      "Operator-reviewed call brief for a company that replied. It prepares the first pilot conversation without creating a calendar event, writing CRM, or sending follow-up.",
    modeLabel: "Discovery prep mode",
    copyLabel: "Copy discovery call prep",
    statusLabel,
    callReadiness,
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Service", value: `${template.ref} - ${template.title}` },
      { label: "Selected company", value: company },
      { label: "Current status", value: statusLabel },
      { label: "Call readiness", value: callReadiness },
      { label: "Metric status", value: metricStatusLabel },
      { label: "Guardrail", value: "Manual booking only; no calendar, CRM, or outbound send" },
    ],
    discoveryQuestions,
    successCriteria,
    guardrails,
  };
}

function buildLocalServiceDayOneSetupBrief(
  template: LocalServiceDemoTemplate,
  prospect: LocalServiceOutreachProspect | undefined,
  status: LocalServicePilotStatus,
  metricStatus: LocalServicePilotMetricStatus,
): LocalServiceDayOneSetupBrief {
  const statusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[status];
  const metricStatusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[metricStatus];
  const company = prospect?.company ?? "No prospect selected";
  const setupReadiness =
    status === "reply_received"
      ? "Discovery reply captured - ready to prepare day-one setup"
      : "Needs replied company before day-one setup";
  const businessProfile = [
    { label: "Company", value: company },
    { label: "Service lane", value: `${template.ref} - ${template.title}` },
    { label: "Segment", value: prospect?.segment ?? "unknown" },
    { label: "Channel fit", value: prospect?.channelFit ?? template.channel },
    { label: "Pilot offer", value: template.detail.pilotKit.offerSummary },
  ];
  const setupTasks = [
    {
      label: "Lock business profile",
      value: "Confirm service area, work hours, owner/dispatcher name, and approved callback language.",
      owner: "Founder",
    },
    {
      label: "Load knowledge sources",
      value: `${template.detail.phoneIntake.length} intake prompts, ${template.detail.estimateInputs.length} estimate inputs, ${template.detail.approvalPolicy.length} approval rules, and Telegram replay sample.`,
      owner: "Operator",
    },
    {
      label: "Define approval rules",
      value: "Keep final price, appointment slot, master assignment, and customer-facing send behind human approval.",
      owner: "Owner",
    },
    {
      label: "Prepare test call/message",
      value: "Use the sample input and Telegram fallback to run one dry test before any live channel activation.",
      owner: "Operator",
    },
    {
      label: "Capture baseline",
      value: "Record current request volume, missed-call pain, response time, booking rate, and manual edits.",
      owner: "Founder",
    },
  ];
  const testPlan = [
    `Run one scripted phone test: ${template.detail.sampleInput}`,
    `Run one Telegram/media test: ${template.detail.telegramIntake.inboundMessage}`,
    "Confirm the generated customer confirmation stays draft-only.",
    "Confirm the master/operator handoff includes the required approval fields.",
    "Copy the reviewed setup brief into the private pilot notes after owner approval.",
  ];
  const guardrails = [
    "no_phone_channel_activation",
    "no_telegram_or_whatsapp_activation",
    "no_calendar_booking_created",
    "no_crm_write",
    "no_customer_message_sent",
    "manual_owner_approval_required",
  ];
  const humanLines = [
    `Day-one setup brief: ${template.title}`,
    `Selected company: ${company}`,
    `Current status: ${statusLabel}`,
    `Metric status: ${metricStatusLabel}`,
    `Setup readiness: ${setupReadiness}`,
    "",
    "Business profile:",
    ...businessProfile.map((item) => `- ${item.label}: ${item.value}`),
    "",
    "Day-one setup tasks:",
    ...setupTasks.map((task) => `- ${task.label} (${task.owner}): ${task.value}`),
    "",
    "Test call plan:",
    ...testPlan.map((step) => `- ${step}`),
    "",
    "Guardrails:",
    ...guardrails.map((guardrail) => `- ${guardrail}`),
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_day_one_setup_brief",
      export_kind: "operator_review_setup_handoff",
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      selected_company: company,
      selected_status: status,
      selected_status_label: statusLabel,
      metric_status: metricStatus,
      metric_status_label: metricStatusLabel,
      setup_readiness: setupReadiness,
      business_profile: businessProfile,
      setup_tasks: setupTasks,
      test_plan: testPlan,
      guardrails,
    },
    null,
    2,
  );

  return {
    title: "Day-one setup brief",
    description:
      "Operator-reviewed setup handoff for the first pilot day. It turns the discovery call into business profile, knowledge source, approval-rule, and test-call prep without activating channels.",
    modeLabel: "Day-one setup mode",
    copyLabel: "Copy day-one setup brief",
    setupReadiness,
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Selected company", value: company },
      { label: "Service", value: `${template.ref} - ${template.title}` },
      { label: "Current status", value: statusLabel },
      { label: "Metric status", value: metricStatusLabel },
      { label: "Setup readiness", value: setupReadiness },
      { label: "Guardrail", value: "No channel activation, no CRM write, no customer send" },
    ],
    businessProfile,
    setupTasks,
    testPlan,
    guardrails,
  };
}

function buildLocalServicePilotAnalystBrief(
  template: LocalServiceDemoTemplate,
  prospect: LocalServiceOutreachProspect | undefined,
  status: LocalServicePilotStatus,
  counts: Record<LocalServicePilotStatus, number>,
): LocalServicePilotAnalystBrief {
  const wizard = template.detail.pilotKit.outreachWizard;
  const company = prospect?.company ?? "No prospect selected";
  const segment = prospect?.segment ?? "unknown";
  const statusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[status];
  const nextActionByStatus: Record<LocalServicePilotStatus, string> = {
    not_contacted: "Open the preview modal, confirm the exact message, then record ready for manual outreach.",
    draft_ready: "Send manually outside the shell and immediately log contacted manually in the scorecard.",
    contacted_manually: "Wait for reply, then log reply received or rejected for now before adding another follow-up.",
    reply_received: "Book the 7-minute demo and capture the next objection in the pilot scorecard.",
    rejected_for_now: "Move this lane to the next candidate and keep the rejected reason for the weekly review.",
  };
  const bottleneckByStatus: Record<LocalServicePilotStatus, string> = {
    not_contacted: "The bottleneck is operator confirmation: the message exists, but the company is not ready to contact yet.",
    draft_ready: "The bottleneck is execution outside the product: the draft is ready, but no manual contact is logged.",
    contacted_manually: "The bottleneck is reply tracking: the outreach happened, but no reply outcome is recorded.",
    reply_received: "The bottleneck is conversion: reply exists, but the demo and objection notes must be closed.",
    rejected_for_now: "The bottleneck is candidate quality: move to the next account instead of overworking this one.",
  };
  const suggestedQuestions = [
    {
      question: "Who is the best candidate for this pilot?",
      answer: `${company} is the current best candidate for ${template.title} because ${prospect?.whyNow ?? template.statusNote}`,
      action: prospect?.nextStep ?? "Select a company from the outreach list before contacting anyone.",
    },
    {
      question: "Where is the bottleneck?",
      answer: bottleneckByStatus[status],
      action: nextActionByStatus[status],
    },
    {
      question: "What should we say next?",
      answer: wizard.testMessage,
      action: "Use the Preview / Test message modal first, then send manually only after operator confirmation.",
    },
    {
      question: "What should the operator check?",
      answer: `${prospect?.scorecardFocus ?? "Company fit, channel fit, and owner availability"} before any outreach.`,
      action: "Keep the no-send guardrail: copy notes only, then update local scorecard state after the human action.",
    },
  ];
  const guardrails = [
    "No external LLM call is made from this analyst brief.",
    "No outbound message is sent.",
    "No CRM write or scorecard sync happens automatically.",
    "Operator must confirm the company, channel, message, and manual next step.",
  ];
  const humanLines = [
    `Ask AI about pilot: ${template.title}`,
    `Selected company: ${company}`,
    `Segment: ${segment}`,
    `Current scorecard state: ${statusLabel}`,
    `Funnel snapshot: ${counts.not_contacted} not contacted, ${counts.draft_ready} draft ready, ${counts.contacted_manually} contacted manually, ${counts.reply_received} replies, ${counts.rejected_for_now} rejected.`,
    "",
    "Suggested questions:",
    ...suggestedQuestions.flatMap((item) => [
      `Q: ${item.question}`,
      `A: ${item.answer}`,
      `Action: ${item.action}`,
      "",
    ]),
    "Guardrails:",
    ...guardrails.map((item) => `- ${item}`),
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_pilot_ai_analyst",
      export_kind: "deterministic_operator_assist",
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      selected_company: company,
      selected_segment: segment,
      current_status: status,
      current_status_label: statusLabel,
      funnel_counts: counts,
      suggested_questions: suggestedQuestions,
      guardrails,
    },
    null,
    2,
  );

  return {
    title: "Ask AI about pilot",
    description:
      "Short suggested questions for the operator over the selected lane, company, scorecard state, and pilot funnel.",
    modeLabel: "Analyst brief mode",
    copyLabel: "Copy analyst brief",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Service", value: `${template.ref} - ${template.title}` },
      { label: "Selected company", value: company },
      { label: "Current status", value: statusLabel },
      { label: "Next operator action", value: nextActionByStatus[status] },
      { label: "Guardrail", value: "Deterministic brief only; no send and no external LLM call" },
    ],
    suggestedQuestions,
    guardrails,
  };
}

function buildLocalServiceAgentSetupBrief(template: LocalServiceDemoTemplate): LocalServiceAgentSetupBrief {
  const setupSteps = [
    {
      id: "business_profile" as const,
      label: "Business profile",
      value: `${template.title}, ${template.channel}, service ref ${template.ref}`,
      status: "Ready",
    },
    {
      id: "knowledge_sources" as const,
      label: "Knowledge sources",
      value: `${template.detail.phoneIntake.length} intake prompts, ${template.detail.estimateInputs.length} estimate inputs, ${template.detail.approvalPolicy.length} approval rules`,
      status: "Loaded",
    },
    {
      id: "agent_behavior" as const,
      label: "Agent behavior",
      value: "Collect facts first, prepare the job card, and keep price, slot, and dispatch behind operator approval.",
      status: "Gated",
    },
    {
      id: "test_call_message" as const,
      label: "Test call/message",
      value: `Use sample call plus Telegram replay: ${template.detail.telegramIntake.normalizedFields.join(", ")}`,
      status: "Ready to test",
    },
    {
      id: LOCAL_SERVICE_SETUP_READY_STEP_ID,
      label: "Ready for pilot test",
      value: "Pilot can start only after owner/operator confirms setup and sends the first test manually.",
      status: "Operator review",
    },
  ];
  const trainingCards = [
    {
      label: "Business profile",
      value: `Service lane: ${template.title}; channel: ${template.channel}; offer: ${template.detail.pilotKit.offerSummary}`,
    },
    {
      label: "Knowledge sources",
      value: [
        ...template.detail.phoneIntake.slice(0, 2),
        ...template.detail.estimateInputs.slice(0, 2),
        ...template.detail.approvalPolicy.slice(0, 1),
      ].join(" | "),
    },
    {
      label: "Agent behavior",
      value: "Ask district, issue/scope, preferred time, media availability, and callback details before drafting any customer or master handoff.",
    },
    {
      label: "Test call/message",
      value: `${template.detail.sampleInput} Telegram fallback: ${template.detail.telegramIntake.inboundMessage}`,
    },
  ];
  const guardrails = [
    "No phone number is provisioned from this setup view.",
    "No Telegram, WhatsApp, CRM, analytics, or billing integration is activated.",
    "No customer-facing message is sent by the product shell.",
    "Operator must approve the setup before the first live pilot test.",
  ];
  const humanLines = [
    `Agent setup / training state: ${template.title}`,
    `Service ref: ${template.ref}`,
    `Channel: ${template.channel}`,
    "",
    "7-minute setup:",
    ...setupSteps.map((step, index) => `${index + 1}. ${step.label} [${step.status}] - ${step.value}`),
    "",
    "Training cards:",
    ...trainingCards.flatMap((card) => [`${card.label}:`, card.value, ""]),
    "Guardrails:",
    ...guardrails.map((item) => `- ${item}`),
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_agent_setup_training",
      export_kind: "deterministic_setup_checklist",
      service_id: template.id,
      service_ref: template.ref,
      service_title: template.title,
      channel: template.channel,
      setup_steps: setupSteps,
      training_cards: trainingCards,
      guardrails,
    },
    null,
    2,
  );

  return {
    title: "Agent setup / training state",
    description:
      "A 7-minute setup checklist for business profile, knowledge sources, agent behavior, and test call/message readiness.",
    modeLabel: "Setup brief mode",
    copyLabel: "Copy setup brief",
    humanText: humanLines.join("\n"),
    jsonText,
    rows: [
      { label: "Setup posture", value: "Ready for test call/message" },
      { label: "Business profile", value: `${template.ref} - ${template.title}` },
      { label: "Knowledge sources", value: "Phone intake, estimate inputs, approval policy, Telegram replay" },
      { label: "Agent behavior", value: "Collect, normalize, draft, then wait for operator approval" },
      { label: "Guardrail", value: "No integration activation; no autonomous send" },
    ],
    setupSteps,
    trainingCards,
    guardrails,
  };
}

const LOCAL_SERVICE_DEMO_TEMPLATES: LocalServiceDemoTemplate[] = [
  {
    id: "ac-repair-dispatch",
    title: "AC repair dispatch",
    ref: "LS-7101",
    summary: "Phone AI qualifies an AC repair request, checks district, and prepares a slot for operator approval.",
    statusNote: "Best first wedge for Tashkent summer demand: urgent, high intent, and expensive to miss.",
    channel: "Phone AI intake",
    tone: "violet",
    Icon: Wind,
    highlights: [
      { label: "Outcome", value: "Service visit ready" },
      { label: "Approval", value: "Operator confirms slot" },
      { label: "Evidence", value: "Call transcript" },
      { label: "Deliverable", value: "Dispatch job card" },
    ],
    detail: {
      sampleInput:
        "Customer calls because the AC stopped cooling in Yunusabad. They need a same-day visit after 18:00 and can send a short video in Telegram.",
      phoneIntake: [
        "Ask for district, full address, phone, and preferred visit window.",
        "Identify AC issue: no cooling, leak, noise, cleaning, install, or maintenance.",
        "Ask for brand/model when available and request photo or video via Telegram.",
      ],
      estimateInputs: [
        "service_type=AC repair",
        "district=Yunusabad",
        "urgency=same_day",
        "preferred_time=18:00-20:00",
      ],
      approvalPolicy: [
        "AI can prepare a visit slot, but operator approves the final technician assignment.",
        "No final price promise before the operator reviews issue type and travel window.",
      ],
      evidenceOutput: [
        "Call summary",
        "Requested photo/video flag",
        "Operator approval decision",
      ],
      handoffFields: ["customer_name", "phone", "district", "address", "issue_type", "preferred_time", "master_type"],
      telegramIntake: {
        inboundMessage:
          "Salom. Yunusobodda konditsioner sovutmayapti. Bugun 18:00 dan keyin usta kela oladimi?",
        normalizedFields: [
          "channel=telegram",
          "service_type=ac_repair",
          "district=Yunusabad",
          "preferred_time=after_18:00",
        ],
        replyDraft:
          "Manzil va telefon raqamingizni yuboring. Operator usta vaqtini va yakuniy narxni tasdiqlaydi.",
      },
      pilotKit: {
        offerSummary:
          "Capture missed AC calls, qualify district and urgency on the first touch, and hand operators an approval-ready same-day visit card.",
        demoScript: [
          "Show the phone intake collecting district, issue type, and preferred visit window.",
          "Show the Telegram fallback normalizing the same request into the shared job card.",
          "Show the operator approving the slot and copying the master handoff.",
        ],
        outreachFocus: [
          "Independent AC installers with 1-3 masters",
          "District-first HVAC repair shops in Yunusabad and Chilanzar",
          "After-hours service teams losing summer overflow calls",
        ],
        launchChecklist: [
          "Connect one after-hours phone line and one Telegram media handoff.",
          "Define district coverage and the same-day visit promise before launch.",
          "Lock the estimate floor/ceiling the operator may approve without escalation.",
          "Assign one dispatcher or owner as the approval owner for evening slots.",
        ],
        outreachWizard: {
          audience:
            "Start with AC repair teams from the 10-company outreach list that promise same-day or after-hours service in Tashkent.",
          testMessage:
            "Hi. We help AC repair teams answer missed phone and Telegram requests, collect district/issue/time, and hand you an approval-ready visit card. Can I show a 7-minute demo using a same-day AC repair example?",
          confirmationGate:
            "Operator selects the company, checks channel fit, previews the message, and confirms before any real outreach is sent.",
          prospects: [
            {
              id: "ac-master",
              company: "AC MASTER",
              segment: "AC repair",
              channelFit: "Phone-first repair and service demand",
              whyNow: "Summer overflow and same-day calls are expensive to miss.",
              scorecardFocus: "Missed-call pain, urgency, Telegram/media proof, approval owner",
              nextStep: "Preview the AC repair message, then log as demo candidate before contact.",
            },
            {
              id: "aircold",
              company: "Aircold",
              segment: "AC repair",
              channelFit: "Repair, installation, and maintenance intake",
              whyNow: "Warranty and repair language makes structured issue capture useful.",
              scorecardFocus: "Repeatable service scope, price estimate rules, first-response owner",
              nextStep: "Confirm channel fit and qualify whether same-day repair is promised.",
            },
            {
              id: "server-service",
              company: "Server Service",
              segment: "AC repair / installation",
              channelFit: "Same-day positioning across Tashkent",
              whyNow: "A dispatch card can standardize install/repair slot capture.",
              scorecardFocus: "District coverage, technician handoff, operator approval gate",
              nextStep: "Keep as second-wave AC account if AC MASTER or Aircold are slow.",
            },
          ],
        },
        metrics: [
          { label: "Inbound requests", baseline: "manual tally", target: "daily tracked" },
          { label: "Missed-call recovery", baseline: "unknown", target: "same-day callback" },
          { label: "Response time", baseline: "operator dependent", target: "<5 min first reply" },
          { label: "Bookings", baseline: "spreadsheet follow-up", target: "operator-approved slot" },
          { label: "Manual operator edits", baseline: "not measured", target: "<3 edits per job card" },
          { label: "No-show / cancellation", baseline: "ad hoc", target: "explicit weekly review" },
        ],
      },
      customerConfirmation:
        "We received your AC repair request. An operator will confirm the technician and final time shortly.",
      operatorHandoff:
        "Same-day AC repair lead in Yunusabad. Customer prefers 18:00-20:00 and can send video proof in Telegram.",
    },
    payload: {
      case_ref: "LS-7101",
      customer_name: "F. Karimov",
      phone: "+998 XX XXX XX XX",
      service_type: "ac_repair",
      district: "Yunusabad",
      address_status: "collected",
      urgency: "same_day",
      preferred_time: "18:00-20:00",
      photos_requested: true,
      estimate_inputs: ["issue_type", "district", "preferred_time", "brand_or_model"],
      operator_owner: "dispatcher_queue",
      handoff_status: "approval_required",
    },
    evidencePath: buildCaseEvidencePath("LS-7101"),
    bundlePath: buildCaseBundlePath("LS-7101"),
  },
  {
    id: "plumbing-emergency",
    title: "Plumbing emergency",
    ref: "LS-7204",
    summary: "AI triages a leak or clog, separates emergency from routine work, and alerts the operator.",
    statusNote: "Emergency triage is the clearest revenue case: delayed response sends the customer to a competitor.",
    channel: "Phone AI intake",
    tone: "rose",
    Icon: Wrench,
    highlights: [
      { label: "Outcome", value: "Emergency routed" },
      { label: "Approval", value: "Owner/dispatcher review" },
      { label: "Evidence", value: "Urgency trail" },
      { label: "Deliverable", value: "Master handoff" },
    ],
    detail: {
      sampleInput:
        "Customer reports water under the sink in Chilanzar. The AI asks whether water is still flowing, collects access details, and marks it urgent.",
      phoneIntake: [
        "Confirm leak, clog, install, replacement, or diagnostics.",
        "Ask if water is actively flowing and whether the main valve is closed.",
        "Collect district, address, access note, and callback number.",
      ],
      estimateInputs: [
        "service_type=plumbing",
        "emergency=true",
        "district=Chilanzar",
        "access_note=call before arrival",
      ],
      approvalPolicy: [
        "AI may provide safety guidance and mark urgency, but operator approves dispatch.",
        "After-hours rate disclosure must be shown before confirmation.",
      ],
      evidenceOutput: [
        "Emergency triage answers",
        "Safety guidance shown to customer",
        "Dispatch approval status",
      ],
      handoffFields: ["customer_name", "phone", "district", "address", "emergency_type", "access_note", "rate_disclosure"],
      telegramIntake: {
        inboundMessage:
          "Chilonzorda rakovina tagidan suv oqyapti. Hozir ham oqyapti, tez usta kerak.",
        normalizedFields: [
          "channel=telegram",
          "service_type=plumbing",
          "district=Chilanzar",
          "urgency=emergency",
        ],
        replyDraft:
          "Agar xavfsiz bo'lsa, asosiy suv kranini yoping. Operator tezkor chiqish va tarifni tasdiqlaydi.",
      },
      pilotKit: {
        offerSummary:
          "Turn urgent leak and clog calls into explicit emergency triage, faster callbacks, and operator-approved dispatch instead of chaotic after-hours texting.",
        demoScript: [
          "Show the intake separating emergency leaks from routine plumbing work.",
          "Show the safety guidance and evidence trail before dispatch approval.",
          "Show the operator handoff drawer with address, urgency, and rate disclosure.",
        ],
        outreachFocus: [
          "Emergency plumbers covering evenings and weekends",
          "Owner-led plumbing teams handling WhatsApp and phone manually",
          "Local services businesses where one missed urgent job pays for the pilot",
        ],
        launchChecklist: [
          "Define emergency versus routine tariff rules before the bot goes live.",
          "Keep the safety script approved for active leak, clog, and gas-risk calls.",
          "Assign one owner or dispatcher for after-hours approval and technician routing.",
          "Map district coverage so urgent jobs are escalated only to reachable masters.",
        ],
        outreachWizard: {
          audience:
            "Prioritize owner-led plumbers where one urgent missed call can pay for the pilot and where Telegram follow-up is already used.",
          testMessage:
            "Hi. We help plumbing teams triage urgent leak calls, collect address and access notes, show safety guidance, and prepare an operator-approved dispatch card. Can I show a 7-minute emergency plumbing demo?",
          confirmationGate:
            "Operator verifies the account is emergency-service relevant, checks the tariff language, then confirms the test message before outreach.",
          prospects: [
            {
              id: "santexniki-uz",
              company: "Santexniki.uz",
              segment: "Plumbing",
              channelFit: "Emergency posture with Telegram CTA",
              whyNow: "Urgent leaks and clogs punish delayed callbacks immediately.",
              scorecardFocus: "Emergency demand, Telegram dependence, rate disclosure, approval owner",
              nextStep: "Preview the emergency plumbing message and log as first-wave account.",
            },
            {
              id: "ibrat-qurilish-servis",
              company: "Ibrat Qurilish Servis",
              segment: "Plumbing / engineering networks",
              channelFit: "Repair, installation, and emergency call posture",
              whyNow: "The intake can separate emergency versus routine jobs before routing.",
              scorecardFocus: "Service scope, district coverage, dispatch owner, tariff rules",
              nextStep: "Use if the owner-led workflow is still phone/chat/manual.",
            },
          ],
        },
        metrics: [
          { label: "Inbound requests", baseline: "owner phone only", target: "all urgent leads captured" },
          { label: "Missed-call recovery", baseline: "callback if noticed", target: "urgent recovery queue" },
          { label: "Response time", baseline: "varies by owner", target: "<3 min triage reply" },
          { label: "Bookings", baseline: "manual dispatch notes", target: "approved dispatch card" },
          { label: "Manual operator edits", baseline: "full rewrite", target: "light review only" },
          { label: "No-show / cancellation", baseline: "not logged", target: "tracked by district and urgency" },
        ],
      },
      customerConfirmation:
        "Your plumbing request is marked urgent. Please close the water valve if safe. Our operator will confirm dispatch.",
      operatorHandoff:
        "Urgent plumbing lead in Chilanzar. Active leak under sink, customer asked to close valve, dispatch approval required.",
    },
    payload: {
      case_ref: "LS-7204",
      customer_name: "M. Saidova",
      phone: "+998 XX XXX XX XX",
      service_type: "plumbing",
      district: "Chilanzar",
      address_status: "collected",
      urgency: "emergency",
      active_leak: true,
      safety_guidance: "close_main_valve_if_safe",
      preferred_time: "as_soon_as_possible",
      estimate_inputs: ["emergency_type", "district", "after_hours_rate", "access_note"],
      operator_owner: "urgent_dispatch_queue",
      handoff_status: "approval_required",
    },
    evidencePath: buildCaseEvidencePath("LS-7204"),
    bundlePath: buildCaseBundlePath("LS-7204"),
  },
  {
    id: "cleaning-quote-booking",
    title: "Cleaning quote and booking",
    ref: "LS-7302",
    summary: "AI collects room, area, service type, and schedule details before producing an operator-reviewed quote.",
    statusNote: "Cleaning stays inside local services: same intake, estimate, slot, and handoff model.",
    channel: "Phone or Telegram intake",
    tone: "mint",
    Icon: Sparkles,
    highlights: [
      { label: "Outcome", value: "Quote inputs ready" },
      { label: "Approval", value: "Price reviewed" },
      { label: "Evidence", value: "Estimate inputs" },
      { label: "Deliverable", value: "Booking draft" },
    ],
    detail: {
      sampleInput:
        "Customer asks for after-renovation cleaning in Mirabad: 90 sqm apartment, 3 rooms, 2 bathrooms, windows included, weekend preferred.",
      phoneIntake: [
        "Ask property type, area in sqm, rooms, bathrooms, windows, and service type.",
        "Ask if this is after renovation, move-out, standard, deep clean, or recurring.",
        "Collect date preference, district, access note, and special requests.",
      ],
      estimateInputs: [
        "area_sqm=90",
        "service_type=after_renovation",
        "rooms=3",
        "bathrooms=2",
        "windows=included",
      ],
      approvalPolicy: [
        "AI can calculate an estimate range, but operator approves the final price.",
        "Recurring schedule and add-ons require confirmation before customer send.",
      ],
      evidenceOutput: [
        "Needs assessment",
        "Estimate inputs",
        "Approved quote and booking draft",
      ],
      handoffFields: ["customer_name", "phone", "district", "area_sqm", "service_type", "preferred_date", "estimate_range"],
      telegramIntake: {
        inboundMessage:
          "Mirabadda remontdan keyin 90 kv uy tozalash kerak. 3 xona, 2 sanuzel, oynalar ham bor. Dam olish kuni bo'ladimi?",
        normalizedFields: [
          "channel=telegram",
          "service_type=cleaning_quote",
          "district=Mirabad",
          "area_sqm=90",
        ],
        replyDraft:
          "Ma'lumotlar qabul qilindi. Operator yakuniy narx va bo'sh brigada vaqtini tasdiqlaydi.",
      },
      pilotKit: {
        offerSummary:
          "Convert cleaning quote calls and Telegram messages into complete estimate inputs, reviewed pricing, and fewer operator back-and-forths before booking.",
        demoScript: [
          "Show the intake capturing property size, service type, and preferred date.",
          "Show the Telegram message normalized into the same estimate fields.",
          "Show the customer confirmation and handoff drawers after operator review.",
        ],
        outreachFocus: [
          "After-renovation cleaning teams",
          "Small agencies quoting by Telegram and phone",
          "Weekend-heavy crews where quote latency kills bookings",
        ],
        launchChecklist: [
          "Approve the pricing matrix for size, add-ons, and after-renovation work.",
          "Define which visit windows can be promised before manual review.",
          "Assign one manager as the final quote and booking approval owner.",
          "Route phone and Telegram requests into one queue so quote history stays together.",
        ],
        outreachWizard: {
          audience:
            "Start with cleaning teams that quote manually in Telegram and lose bookings when weekend or after-renovation estimates are delayed.",
          testMessage:
            "Hi. We help cleaning teams turn phone and Telegram quote requests into complete estimate inputs, reviewed pricing, and booking-ready confirmations. Can I show a 7-minute cleaning quote demo?",
          confirmationGate:
            "Operator checks service fit, pricing sensitivity, and owner availability before sending a test message or booking a demo.",
          prospects: [
            {
              id: "service-pro",
              company: "Service-Pro",
              segment: "Cleaning",
              channelFit: "Apartments, homes, and offices with pricing language",
              whyNow: "Quote delay and weekend demand are easy to show in a 7-minute demo.",
              scorecardFocus: "Pricing matrix, Telegram dependence, quote latency, approval owner",
              nextStep: "Preview the cleaning quote message and log as first-wave account.",
            },
            {
              id: "eco-fresh",
              company: "Eco Fresh",
              segment: "Cleaning",
              channelFit: "Offices, apartments, factories, and sites in Tashkent",
              whyNow: "Multiple service categories benefit from one normalized quote queue.",
              scorecardFocus: "Repeatable scope, property type fields, manager review rules",
              nextStep: "Use after Service-Pro if they show mixed phone and Telegram intake.",
            },
            {
              id: "cleantime",
              company: "CleanTime",
              segment: "Cleaning",
              channelFit: "Fast price calculation and broad cleaning categories",
              whyNow: "Time-to-quote is the cleanest demo promise for this lane.",
              scorecardFocus: "Quote speed, add-ons, weekend availability, no-show tracking",
              nextStep: "Keep as first-week follow-up if AC repair response is weak.",
            },
          ],
        },
        metrics: [
          { label: "Inbound requests", baseline: "chat by chat", target: "all quote requests logged" },
          { label: "Missed-call recovery", baseline: "manual callback", target: "same-shift follow-up" },
          { label: "Response time", baseline: "depends on manager", target: "<10 min quote reply" },
          { label: "Bookings", baseline: "quote thread only", target: "approved booking draft" },
          { label: "Manual operator edits", baseline: "pricing rebuilt manually", target: "only add-ons adjusted" },
          { label: "No-show / cancellation", baseline: "not segmented", target: "tracked by property type" },
        ],
      },
      customerConfirmation:
        "We collected your cleaning request and will confirm the final price and available team shortly.",
      operatorHandoff:
        "After-renovation cleaning quote in Mirabad. 90 sqm, 3 rooms, 2 bathrooms, windows included, weekend preferred.",
    },
    payload: {
      case_ref: "LS-7302",
      customer_name: "N. Akhmedova",
      phone: "+998 XX XXX XX XX",
      service_type: "cleaning_quote",
      property_type: "apartment",
      district: "Mirabad",
      area_sqm: 90,
      rooms: 3,
      bathrooms: 2,
      windows: "included",
      after_renovation: true,
      preferred_date: "weekend",
      recurring_frequency: "one_time",
      estimate_range: "operator_review_required",
      operator_owner: "cleaning_dispatch_queue",
      handoff_status: "approval_required",
    },
    evidencePath: buildCaseEvidencePath("LS-7302"),
    bundlePath: buildCaseBundlePath("LS-7302"),
  },
  {
    id: "measurement-visit-booking",
    title: "Measurement visit booking",
    ref: "LS-7406",
    summary: "AI qualifies windows, doors, ceilings, or fit-out requests and prepares a measurer visit.",
    statusNote: "Construction-adjacent P0: useful demand, same dispatcher workflow, no inventory or stock promise.",
    channel: "Phone or Telegram intake",
    tone: "amber",
    Icon: Ruler,
    highlights: [
      { label: "Outcome", value: "Measurer slot ready" },
      { label: "Approval", value: "Manager confirms visit" },
      { label: "Evidence", value: "Photos and sizes" },
      { label: "Deliverable", value: "Measurement job card" },
    ],
    detail: {
      sampleInput:
        "Customer wants windows and balcony glazing in Yashnabad. They can send photos, know the approximate opening sizes, and need a free measurement visit this week.",
      phoneIntake: [
        "Identify scope: windows, doors, balcony glazing, stretch ceiling, blinds, or fit-out measurement.",
        "Collect district, address, approximate quantity, measurements if known, and photo availability.",
        "Ask whether this is renovation, new apartment, office, or commercial space.",
      ],
      estimateInputs: [
        "service_type=measurement_visit",
        "scope=windows_and_balcony",
        "district=Yashnabad",
        "preferred_date=this_week",
      ],
      approvalPolicy: [
        "AI can prepare a measurement visit, but manager approves the measurer and final slot.",
        "No material availability, installation date, or final price is promised before human review.",
      ],
      evidenceOutput: [
        "Scope summary",
        "Photo and measurement request",
        "Manager-approved measurer visit",
      ],
      handoffFields: [
        "customer_name",
        "phone",
        "district",
        "address",
        "scope",
        "approx_quantity",
        "preferred_date",
        "photo_status",
      ],
      telegramIntake: {
        inboundMessage:
          "Yashnobodda balkon va derazalar uchun zamer kerak. Rasmlar yubora olaman, shu haftaga vaqt bormi?",
        normalizedFields: [
          "channel=telegram",
          "service_type=measurement_visit",
          "scope=windows_and_balcony",
          "district=Yashnabad",
        ],
        replyDraft:
          "Rasmlarni va manzilni yuboring. Menejer zamerchi vaqtini va keyingi qadamni tasdiqlaydi.",
      },
      pilotKit: {
        offerSummary:
          "Turn windows, doors, ceilings, and fit-out inquiries into a clean measurement visit card with photos, approximate sizes, district, and manager-approved slot.",
        demoScript: [
          "Show the intake separating measurement visits from material-only price questions.",
          "Show photo and approximate-size capture before any price or stock promise.",
          "Show the manager approving the measurer visit and copying the handoff.",
        ],
        outreachFocus: [
          "Window and door showrooms that offer free measurement",
          "Ceiling and fit-out teams selling both material and installation",
          "Renovation-adjacent companies where a missed request loses the whole project",
        ],
        launchChecklist: [
          "Define which scopes qualify for a free measurement visit.",
          "Approve the no-final-price script before the bot handles material questions.",
          "Map district coverage and measurer availability before taking live calls.",
          "Route photos from Telegram into the same operator-reviewed job card.",
        ],
        outreachWizard: {
          audience:
            "Use this lane for construction-adjacent companies after AC, plumbing, and cleaning: windows, doors, ceilings, blinds, and fit-out measurement teams.",
          testMessage:
            "Hi. We help window, door, and fit-out teams capture calls and Telegram requests, collect photos/sizes/address, and prepare a manager-approved measurement visit card. Can I show a 7-minute demo?",
          confirmationGate:
            "Operator verifies that the company books measurement visits, reviews the no-final-price language, then confirms before any outreach.",
          prospects: [
            {
              id: "imzo",
              company: "IMZO",
              segment: "Windows / doors",
              channelFit: "Free measurement and showroom-led requests",
              whyNow: "Measurement requests already require photos, address, scope, and manager follow-up.",
              scorecardFocus: "Measurement policy, district coverage, photo intake, final-price guardrail",
              nextStep: "Keep as benchmark or later pilot target; verify branch-level decision maker first.",
            },
            {
              id: "modern-systems",
              company: "Modern Systems",
              segment: "Windows / sliding systems",
              channelFit: "Manager callback and installation-service posture",
              whyNow: "Broad product scope needs structured intake before manager callback.",
              scorecardFocus: "Scope categories, measurement visit workflow, owner/manager approval",
              nextStep: "Use as a construction-adjacent demo account after first service pilots.",
            },
            {
              id: "brix-uz",
              company: "BRIX.UZ",
              segment: "Ceilings / fit-out",
              channelFit: "Product plus service quote requests",
              whyNow: "Ceiling and fit-out inquiries can start as measurement visits before quote approval.",
              scorecardFocus: "Quote-vs-visit separation, material questions, installation handoff",
              nextStep: "Keep for P1 materials-and-installation quote desk validation.",
            },
          ],
        },
        metrics: [
          { label: "Inbound requests", baseline: "phone or form callbacks", target: "all measurement requests logged" },
          { label: "Missed-call recovery", baseline: "manager dependent", target: "same-day measurement follow-up" },
          { label: "Response time", baseline: "manual callback", target: "<10 min first reply" },
          { label: "Bookings", baseline: "chat or notebook", target: "manager-approved measurer slot" },
          { label: "Manual operator edits", baseline: "scope rebuilt manually", target: "scope and photos already captured" },
          { label: "No-show / cancellation", baseline: "not tracked", target: "tracked by district and scope" },
        ],
      },
      customerConfirmation:
        "We collected your measurement request. A manager will confirm the measurer visit and next step shortly.",
      operatorHandoff:
        "Measurement visit request in Yashnabad. Customer needs windows and balcony glazing, can send photos, and prefers this week.",
    },
    payload: {
      case_ref: "LS-7406",
      customer_name: "D. Rasulov",
      phone: "+998 XX XXX XX XX",
      service_type: "measurement_visit",
      scope: "windows_and_balcony",
      property_type: "apartment",
      district: "Yashnabad",
      address_status: "collected",
      approx_quantity: "3_windows_plus_balcony",
      photos_requested: true,
      measurements_known: "approximate",
      preferred_date: "this_week",
      estimate_inputs: ["scope", "district", "approx_quantity", "photos", "property_type"],
      operator_owner: "measurement_dispatch_queue",
      handoff_status: "approval_required",
    },
    evidencePath: buildCaseEvidencePath("LS-7406"),
    bundlePath: buildCaseBundlePath("LS-7406"),
  },
];

const LocalServicesDispatchDemoPanel = ({
  activeServiceId,
  recordingMode,
  setupWizardMode,
  onSelectService,
  onClose,
  onCopyPayload,
  onCopyText,
  onOpenDispatchDrawer,
  onOpenPath,
  onOpenSetupWizard,
}: {
  activeServiceId: string | null;
  recordingMode: boolean;
  setupWizardMode: boolean;
  onSelectService: (id: string) => void;
  onClose: () => void;
  onCopyPayload: (template: LocalServiceDemoTemplate) => void;
  onCopyText: (text: string, label: string) => void;
  onOpenDispatchDrawer: (kind?: LocalServiceExportKind) => void;
  onOpenPath: (path: string) => void;
  onOpenSetupWizard: (serviceId: string) => void;
}) => {
  const selectedTemplate =
    LOCAL_SERVICE_DEMO_TEMPLATES.find((template) => template.id === activeServiceId) ??
    LOCAL_SERVICE_DEMO_TEMPLATES[0];
  const selectedPayloadPreview = buildLocalServicePayloadPreview(selectedTemplate);
  const intakeEvidence = buildLocalServiceIntakeEvidence(selectedTemplate, selectedPayloadPreview);
  const [pilotWorkspaceState, setPilotWorkspaceState] = useState<LocalServicePilotWorkspaceState>(() =>
    readLocalServicePilotWorkspaceState(),
  );
  const [pilotWorkspaceExportOpen, setPilotWorkspaceExportOpen] = useState(false);
  const [pilotWorkspaceExportMode, setPilotWorkspaceExportMode] = useState<PlaybookExportMode>("human");
  const [pilotMetricsTrackerOpen, setPilotMetricsTrackerOpen] = useState(false);
  const [pilotMetricsTrackerMode, setPilotMetricsTrackerMode] = useState<PlaybookExportMode>("human");
  const [pilotDailyLogOpen, setPilotDailyLogOpen] = useState(false);
  const [pilotDailyLogMode, setPilotDailyLogMode] = useState<PlaybookExportMode>("human");
  const [pilotWeekOneReviewOpen, setPilotWeekOneReviewOpen] = useState(false);
  const [pilotWeekOneReviewMode, setPilotWeekOneReviewMode] = useState<PlaybookExportMode>("human");
  const [pilotEvidencePackOpen, setPilotEvidencePackOpen] = useState(false);
  const [pilotEvidencePackMode, setPilotEvidencePackMode] = useState<PlaybookExportMode>("human");
  const [founderBatchReviewOpen, setFounderBatchReviewOpen] = useState(false);
  const [founderBatchReviewMode, setFounderBatchReviewMode] = useState<PlaybookExportMode>("human");
  const [pilotOpsConfirmationOpen, setPilotOpsConfirmationOpen] = useState(false);
  const [pilotOpsConfirmationMode, setPilotOpsConfirmationMode] = useState<PlaybookExportMode>("human");
  const [readinessProofOpen, setReadinessProofOpen] = useState(false);
  const [readinessProofMode, setReadinessProofMode] = useState<PlaybookExportMode>("human");
  const [paidPilotProposalPreviewOpen, setPaidPilotProposalPreviewOpen] = useState(false);
  const [paidPilotProposalPreviewMode, setPaidPilotProposalPreviewMode] = useState<PlaybookExportMode>("human");
  const [proposalApprovalHandoffOpen, setProposalApprovalHandoffOpen] = useState(false);
  const [proposalApprovalHandoffMode, setProposalApprovalHandoffMode] = useState<PlaybookExportMode>("human");
  const [pilotKickoffGateOpen, setPilotKickoffGateOpen] = useState(false);
  const [pilotKickoffGateMode, setPilotKickoffGateMode] = useState<PlaybookExportMode>("human");
  const [dayOneOperatorRunSheetOpen, setDayOneOperatorRunSheetOpen] = useState(false);
  const [dayOneOperatorRunSheetMode, setDayOneOperatorRunSheetMode] = useState<PlaybookExportMode>("human");
  const [dayOneRecapOpen, setDayOneRecapOpen] = useState(false);
  const [dayOneRecapMode, setDayOneRecapMode] = useState<PlaybookExportMode>("human");
  const [weeklyScorecardSyncOpen, setWeeklyScorecardSyncOpen] = useState(false);
  const [weeklyScorecardSyncMode, setWeeklyScorecardSyncMode] = useState<PlaybookExportMode>("human");
  const [pilotMessagePreviewOpen, setPilotMessagePreviewOpen] = useState(false);
  const [pilotMessagePreviewMode, setPilotMessagePreviewMode] = useState<PlaybookExportMode>("human");
  const [pilotOperatorConfirmationOpen, setPilotOperatorConfirmationOpen] = useState(false);
  const [pilotOperatorConfirmationMode, setPilotOperatorConfirmationMode] = useState<PlaybookExportMode>("human");
  const [pilotLaunchPacketOpen, setPilotLaunchPacketOpen] = useState(false);
  const [pilotLaunchPacketMode, setPilotLaunchPacketMode] = useState<PlaybookExportMode>("human");
  const [pilotAnalystOpen, setPilotAnalystOpen] = useState(false);
  const [pilotAnalystMode, setPilotAnalystMode] = useState<PlaybookExportMode>("human");
  const [discoveryCallPrepOpen, setDiscoveryCallPrepOpen] = useState(false);
  const [discoveryCallPrepMode, setDiscoveryCallPrepMode] = useState<PlaybookExportMode>("human");
  const [dayOneSetupOpen, setDayOneSetupOpen] = useState(false);
  const [dayOneSetupMode, setDayOneSetupMode] = useState<PlaybookExportMode>("human");
  const [agentSetupOpen, setAgentSetupOpen] = useState(false);
  const [agentSetupMode, setAgentSetupMode] = useState<PlaybookExportMode>("human");
  const [intakeEvidenceOpen, setIntakeEvidenceOpen] = useState(false);
  const [intakeEvidenceMode, setIntakeEvidenceMode] = useState<PlaybookExportMode>("human");
  const [pilotFunnelStatusFilter, setPilotFunnelStatusFilter] = useState<LocalServicePilotStatusFilter>("all");
  const [pilotFunnelServiceFilter, setPilotFunnelServiceFilter] = useState("all");
  const [pilotFunnelColumns, setPilotFunnelColumns] = useState(DEFAULT_LOCAL_SERVICE_PILOT_COLUMNS);
  const outreachProspects = selectedTemplate.detail.pilotKit.outreachWizard.prospects;
  const selectedOutreachProspectId =
    pilotWorkspaceState.selectedProspectByService[selectedTemplate.id] ?? outreachProspects[0]?.id ?? "";
  const selectedOutreachProspect =
    outreachProspects.find((prospect) => prospect.id === selectedOutreachProspectId) ?? outreachProspects[0];
  const scorecardDraftKey = `${selectedTemplate.id}:${selectedOutreachProspect?.id ?? "none"}`;
  const currentPilotStatus = pilotWorkspaceState.statusByProspectKey[scorecardDraftKey] ?? "not_contacted";
  const currentPilotStatusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[currentPilotStatus];
  const currentFirstRequestOutcome =
    pilotWorkspaceState.firstRequestOutcomeByProspectKey[scorecardDraftKey] ?? "not_recorded";
  const currentFirstRequestOutcomeLabel =
    LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS[currentFirstRequestOutcome];
  const currentWeekOneOwnerDecision =
    pilotWorkspaceState.weekOneOwnerDecisionByProspectKey[scorecardDraftKey] ?? "not_recorded";
  const currentWeekOneOwnerDecisionLabel =
    LOCAL_SERVICE_WEEK_ONE_OWNER_DECISION_LABELS[currentWeekOneOwnerDecision];
  const currentMetricStatus = pilotWorkspaceState.metricStatusByService[selectedTemplate.id] ?? "not_started";
  const currentMetricStatusLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[currentMetricStatus];
  const currentWeeklyScorecardSyncReviewed =
    pilotWorkspaceState.weeklyScorecardSyncReviewedByService[selectedTemplate.id] === true;
  const currentWeeklyScorecardSyncReviewedLabel = currentWeeklyScorecardSyncReviewed ? "Recorded" : "Not recorded";
  const pilotWizardSteps = [
    {
      label: "Offer preview",
      value: selectedTemplate.detail.pilotKit.offerSummary,
      status: "Ready",
    },
    {
      label: "Audience from outreach list",
      value: selectedTemplate.detail.pilotKit.outreachWizard.audience,
      status: selectedOutreachProspect ? "Selected" : "Needs selection",
    },
    {
      label: "Message/test preview",
      value: selectedTemplate.detail.pilotKit.outreachWizard.testMessage,
      status: currentPilotStatus === "draft_ready" ? "Preview complete" : "Review",
    },
    {
      label: "Operator confirmation",
      value: selectedTemplate.detail.pilotKit.outreachWizard.confirmationGate,
      status: currentPilotStatus === "draft_ready" ? "Draft ready" : "Manual approval",
    },
  ];
  const allPilotProspects = useMemo(
    () =>
      LOCAL_SERVICE_DEMO_TEMPLATES.flatMap((template) =>
        template.detail.pilotKit.outreachWizard.prospects.map((prospect) => ({
          key: `${template.id}:${prospect.id}`,
          serviceId: template.id,
          serviceTitle: template.title,
          tone: template.tone,
          prospect,
        })),
      ),
    [],
  );
  const pilotFunnelCounts = useMemo(() => {
    const counts: Record<LocalServicePilotStatus, number> = {
      not_contacted: 0,
      draft_ready: 0,
      contacted_manually: 0,
      reply_received: 0,
      rejected_for_now: 0,
    };
    for (const item of allPilotProspects) {
      const status = pilotWorkspaceState.statusByProspectKey[item.key] ?? "not_contacted";
      counts[status] += 1;
    }
    return counts;
  }, [allPilotProspects, pilotWorkspaceState.statusByProspectKey]);
  const pilotFunnelRows = useMemo(
    () =>
      allPilotProspects.map((item) => {
        const status = pilotWorkspaceState.statusByProspectKey[item.key] ?? "not_contacted";
        return {
          ...item,
          status,
          statusLabel: LOCAL_SERVICE_PILOT_STATUS_LABELS[status],
        };
      }),
    [allPilotProspects, pilotWorkspaceState.statusByProspectKey],
  );
  const founderContactRows = useMemo<LocalServiceFounderContactRow[]>(
    () =>
      pilotFunnelRows.slice(0, 10).map((row) => {
        const proof = pilotWorkspaceState.contactProofByProspectKey[row.key] ?? {};
        const manualMessageSent =
          proof.manualMessageSent === true || row.status === "contacted_manually" || row.status === "reply_received";
        const channelChecked = proof.channelChecked === true || manualMessageSent || row.status !== "not_contacted";
        const discoveryCallCompleted = proof.discoveryCallCompleted === true;
        const demoBooked = proof.demoBooked === true;
        const pilotCandidate = proof.pilotCandidate === true;
        const proofStatus = pilotCandidate
          ? "Pilot candidate"
          : demoBooked
            ? "Demo booked"
            : discoveryCallCompleted
              ? "Discovery call done"
              : row.status === "reply_received"
                ? "Reply captured"
                : row.status === "rejected_for_now"
                  ? "Clear rejection"
                  : manualMessageSent
                    ? "Manual send logged"
                    : channelChecked
                      ? "Channel checked"
                      : "No proof yet";
        return {
          ...row,
          channelChecked,
          manualMessageSent,
          discoveryCallCompleted,
          demoBooked,
          pilotCandidate,
          proofStatus,
        };
      }),
    [pilotFunnelRows, pilotWorkspaceState.contactProofByProspectKey],
  );
  const founderContactCounts = useMemo(
    () => ({
      channelChecked: founderContactRows.filter((row) => row.channelChecked).length,
      manualMessageSent: founderContactRows.filter((row) => row.manualMessageSent).length,
      repliesOrRejections: founderContactRows.filter(
        (row) => row.status === "reply_received" || row.status === "rejected_for_now",
      ).length,
      discoveryCalls: founderContactRows.filter((row) => row.discoveryCallCompleted).length,
      demosBooked: founderContactRows.filter((row) => row.demoBooked).length,
      pilotCandidates: founderContactRows.filter((row) => row.pilotCandidate).length,
    }),
    [founderContactRows],
  );
  const categoryPilotScores = useMemo(
    () => buildLocalServiceCategoryPilotScores(founderContactRows),
    [founderContactRows],
  );
  const leadingCategoryPilotScore = categoryPilotScores[0];
  const leadingCategoryActionLayer = useMemo(
    () => buildLocalServiceLeadingCategoryActionLayer(leadingCategoryPilotScore, founderContactRows),
    [founderContactRows, leadingCategoryPilotScore],
  );
  const leadingCategoryTemplate =
    LOCAL_SERVICE_DEMO_TEMPLATES.find((template) => template.id === leadingCategoryActionLayer.serviceId) ??
    selectedTemplate;
  const leadingCategorySetupCompletion =
    pilotWorkspaceState.setupStepCompletionByService[leadingCategoryActionLayer.serviceId] ?? {};
  const leadingCategorySetupReady =
    pilotWorkspaceState.setupReadyByService[leadingCategoryActionLayer.serviceId] === true;
  const leadingCategoryTestCallPassed =
    pilotWorkspaceState.testCallPassedByService[leadingCategoryActionLayer.serviceId] === true;
  const leadingCategoryTestCallChecklist =
    pilotWorkspaceState.testCallChecklistByService[leadingCategoryActionLayer.serviceId] ?? {};
  const leadingCategoryTestCallProgress = `${
    LOCAL_SERVICE_TEST_CALL_CHECK_IDS.filter((id) => leadingCategoryTestCallChecklist[id] === true).length
  }/${LOCAL_SERVICE_TEST_CALL_CHECK_IDS.length}`;
  const leadingCategoryMetricStatus =
    pilotWorkspaceState.metricStatusByService[leadingCategoryActionLayer.serviceId] ?? "not_started";
  const leadingCategoryFounderRows = founderContactRows.filter(
    (row) => row.serviceId === leadingCategoryActionLayer.serviceId,
  );
  const leadingCategoryOutcomeTargetRow =
    leadingCategoryFounderRows.find((row) => row.pilotCandidate) ??
    leadingCategoryFounderRows.find((row) => row.demoBooked) ??
    leadingCategoryFounderRows.find((row) => row.discoveryCallCompleted) ??
    leadingCategoryFounderRows.find((row) => row.status === "reply_received") ??
    leadingCategoryFounderRows[0];
  const leadingCategoryFirstRequestOutcome = leadingCategoryOutcomeTargetRow
    ? pilotWorkspaceState.firstRequestOutcomeByProspectKey[leadingCategoryOutcomeTargetRow.key] ?? "not_recorded"
    : "not_recorded";
  const leadingCategoryFirstRequestOutcomeLabel =
    LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS[leadingCategoryFirstRequestOutcome];
  const leadingCategoryWeeklyScorecardSyncGate = !leadingCategoryOutcomeTargetRow
    ? "Blocked until a day-one target is selected"
    : leadingCategoryFirstRequestOutcome === "not_recorded"
      ? "Blocked until first request outcome is recorded"
      : leadingCategoryMetricStatus === "review_ready"
        ? "Ready for manual weekly scorecard sync"
        : "Outcome captured; metrics still need review-ready status";
  const leadingCategoryWeeklyScorecardSyncReviewed =
    pilotWorkspaceState.weeklyScorecardSyncReviewedByService[leadingCategoryActionLayer.serviceId] === true;
  const canRecordLeadingCategoryWeeklySync =
    Boolean(leadingCategoryOutcomeTargetRow) &&
    leadingCategoryFirstRequestOutcome !== "not_recorded" &&
    leadingCategoryMetricStatus === "review_ready";
  const recordedLeadingCategoryWeekOneOwnerDecision =
    leadingCategoryFounderRows
      .map((row) => pilotWorkspaceState.weekOneOwnerDecisionByProspectKey[row.key] ?? "not_recorded")
      .find((decision) => decision !== "not_recorded") ?? "not_recorded";
  const selectedLeadingCategoryWeekOneOwnerDecision =
    selectedTemplate.id === leadingCategoryActionLayer.serviceId ? currentWeekOneOwnerDecision : "not_recorded";
  const leadingCategoryWeekOneOwnerDecision =
    selectedLeadingCategoryWeekOneOwnerDecision !== "not_recorded"
      ? selectedLeadingCategoryWeekOneOwnerDecision
      : recordedLeadingCategoryWeekOneOwnerDecision;
  const leadingCategoryProposalApprovalDecision =
    pilotWorkspaceState.proposalApprovalByService[leadingCategoryActionLayer.serviceId] ?? "not_reviewed";
  const leadingCategoryProposalApprovalLabel =
    LOCAL_SERVICE_PROPOSAL_APPROVAL_LABELS[leadingCategoryProposalApprovalDecision];
  const leadingCategoryKickoffDecision =
    pilotWorkspaceState.kickoffDecisionByService[leadingCategoryActionLayer.serviceId] ?? "not_reviewed";
  const leadingCategoryKickoffDecisionLabel = LOCAL_SERVICE_KICKOFF_DECISION_LABELS[leadingCategoryKickoffDecision];
  const leadingCategoryPilotReadiness = useMemo(
    () =>
      buildLocalServiceLeadingCategoryPilotReadiness(
        leadingCategoryActionLayer,
        leadingCategoryPilotScore,
        leadingCategorySetupCompletion,
        leadingCategorySetupReady,
        leadingCategoryTestCallPassed,
        leadingCategoryMetricStatus,
        leadingCategoryWeekOneOwnerDecision,
      ),
    [
      founderContactRows,
      leadingCategoryActionLayer,
      leadingCategoryMetricStatus,
      leadingCategoryPilotScore,
      leadingCategorySetupCompletion,
      leadingCategorySetupReady,
      leadingCategoryTestCallPassed,
      leadingCategoryWeekOneOwnerDecision,
    ],
  );
  const leadingCategoryReadinessActionPlan = useMemo(
    () => buildLocalServicePilotReadinessActionPlan(leadingCategoryActionLayer, leadingCategoryPilotReadiness),
    [leadingCategoryActionLayer, leadingCategoryPilotReadiness],
  );
  const founderReviewReadyServices = LOCAL_SERVICE_DEMO_TEMPLATES.filter(
    (template) => (pilotWorkspaceState.metricStatusByService[template.id] ?? "not_started") === "review_ready",
  ).length;
  const founderProofChecklist = [
    {
      label: "10 manual contacts attempted",
      status: `${founderContactCounts.manualMessageSent}/10 manual sends logged`,
      done: founderContactCounts.manualMessageSent >= 10,
    },
    {
      label: "3 replies or clear rejections",
      status: `${founderContactCounts.repliesOrRejections}/3 replies or rejections`,
      done: founderContactCounts.repliesOrRejections >= 3,
    },
    {
      label: "1 discovery call completed",
      status: `${founderContactCounts.discoveryCalls}/1 discovery call`,
      done: founderContactCounts.discoveryCalls >= 1,
    },
    {
      label: "1 pilot candidate found",
      status: `${founderContactCounts.pilotCandidates}/1 candidate`,
      done: founderContactCounts.pilotCandidates >= 1,
    },
    {
      label: "Week-one review ready",
      status: `${founderReviewReadyServices}/${LOCAL_SERVICE_DEMO_TEMPLATES.length} service lanes ready`,
      done: founderReviewReadyServices > 0,
    },
  ];
  const founderProofProgress = `${founderProofChecklist.filter((item) => item.done).length}/${founderProofChecklist.length}`;
  const founderDecisionGate = useMemo(
    () => buildLocalServiceFounderDecisionGate(founderContactRows, founderContactCounts),
    [founderContactCounts, founderContactRows],
  );
  const pilotOpsTodayRow =
    founderContactRows.find((row) => !row.channelChecked) ??
    founderContactRows.find((row) => !row.manualMessageSent) ??
    founderContactRows.find((row) => row.status !== "reply_received" && row.status !== "rejected_for_now") ??
    founderContactRows.find((row) => !row.discoveryCallCompleted) ??
    founderContactRows.find((row) => !row.demoBooked) ??
    founderContactRows.find((row) => !row.pilotCandidate) ??
    founderContactRows[0];
  const pilotOpsTodayAction = !pilotOpsTodayRow
    ? "No target loaded. Open the outreach list before running the pilot."
    : !pilotOpsTodayRow.channelChecked
      ? "Verify the owner contact channel manually before any message."
      : !pilotOpsTodayRow.manualMessageSent
        ? "Send the approved first-contact message manually outside the shell, then mark Manual sent."
        : pilotOpsTodayRow.status !== "reply_received" && pilotOpsTodayRow.status !== "rejected_for_now"
          ? "Wait for the owner reply, then mark Reply or Rejected."
          : !pilotOpsTodayRow.discoveryCallCompleted
            ? "Run the discovery call only if the owner pain is real, then mark Discovery call."
            : !pilotOpsTodayRow.demoBooked
              ? "Book a demo only after discovery confirms fit."
              : !pilotOpsTodayRow.pilotCandidate
                ? "Mark Pilot candidate only when the owner agrees to an operator-supervised pilot."
                : "Open batch review and decide continue, revise, or stop.";
  const pilotOpsTodayProof = !pilotOpsTodayRow
    ? "outreach_list_target_required"
    : !pilotOpsTodayRow.channelChecked
      ? "channelChecked"
      : !pilotOpsTodayRow.manualMessageSent
        ? "manualMessageSent"
        : pilotOpsTodayRow.status !== "reply_received" && pilotOpsTodayRow.status !== "rejected_for_now"
          ? "reply_or_rejection_status"
          : !pilotOpsTodayRow.discoveryCallCompleted
            ? "discoveryCallCompleted"
            : !pilotOpsTodayRow.demoBooked
              ? "demoBooked"
              : !pilotOpsTodayRow.pilotCandidate
                ? "pilotCandidate"
                : "founder_batch_review";
  const pilotOpsTodayHandoffText = [
    "local_services_pilot_ops_today",
    `Storage key: ${LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY}`,
    "Manual execution view. No outbound send, CRM write, booking, billing, analytics sync, or Markdown mutation.",
    `Current account: ${pilotOpsTodayRow ? pilotOpsTodayRow.prospect.company : "none"}`,
    `Service lane: ${pilotOpsTodayRow ? pilotOpsTodayRow.serviceTitle : "none"}`,
    `Segment: ${pilotOpsTodayRow ? pilotOpsTodayRow.prospect.segment : "none"}`,
    `Status: ${pilotOpsTodayRow ? pilotOpsTodayRow.statusLabel : "none"}`,
    `Next manual action: ${pilotOpsTodayAction}`,
    `Proof to capture: ${pilotOpsTodayProof}`,
    "Proof update rail: local_services_pilot_proof_update_rail",
    `Owner next step: ${pilotOpsTodayRow ? pilotOpsTodayRow.prospect.nextStep : "none"}`,
    `Batch proof progress: ${founderProofProgress}`,
    `Decision gate: ${founderDecisionGate.verdictLabel}`,
    "Operator rule: update only browser-local proof markers after the real manual action happens.",
  ].join("\n");
  const pilotOpsConfirmationExport = buildLocalServicePilotOpsConfirmationExport(
    pilotOpsTodayRow,
    pilotOpsTodayAction,
    pilotOpsTodayProof,
    founderProofProgress,
    founderDecisionGate,
  );
  const founderContactWorkspaceText = [
    "local_services_founder_contact_workspace",
    `Storage key: ${LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY}`,
    "Manual-only worksheet. No outbound send, CRM write, calendar event, billing action, analytics sync, or Markdown mutation.",
    "Platform frame: NEWO-style AI employee platform for local service categories, validated through operator-approved pilots.",
    `Proof progress: ${founderProofProgress}`,
    `Stop / Continue decision gate: ${founderDecisionGate.verdictLabel}`,
    `Decision action: ${founderDecisionGate.action}`,
    `Target lane: ${founderDecisionGate.targetLane}`,
    `Category pilot score: ${
      leadingCategoryPilotScore
        ? `${leadingCategoryPilotScore.serviceTitle} / ${leadingCategoryPilotScore.score} / ${leadingCategoryPilotScore.signalLabel}`
        : "none"
    }`,
    `Leading category action layer: ${leadingCategoryActionLayer.posture}`,
    `Leading category action: ${leadingCategoryActionLayer.action}`,
    `Pilot setup readiness: ${leadingCategoryPilotReadiness.readinessLabel} / ${leadingCategoryPilotReadiness.progressLabel}`,
    `Paid pilot gate: ${leadingCategoryPilotReadiness.paidPilotGate}`,
    `Pilot readiness next action: ${leadingCategoryPilotReadiness.nextAction}`,
    `Readiness action plan: ${leadingCategoryReadinessActionPlan.primarySurface}`,
    `Readiness primary action: ${leadingCategoryReadinessActionPlan.primaryAction}`,
    `Readiness operator script: ${leadingCategoryReadinessActionPlan.operatorScript}`,
    `Day-one outcome target: ${leadingCategoryOutcomeTargetRow ? leadingCategoryOutcomeTargetRow.prospect.company : "none"}`,
    `Day-one outcome capture: ${leadingCategoryFirstRequestOutcomeLabel}`,
    `Weekly scorecard sync gate: ${leadingCategoryWeeklyScorecardSyncGate}`,
    `Pilot ops today: ${pilotOpsTodayRow ? pilotOpsTodayRow.prospect.company : "none"}`,
    `Pilot ops next manual action: ${pilotOpsTodayAction}`,
    `Pilot ops proof to capture: ${pilotOpsTodayProof}`,
    "Pilot proof update rail: local_services_pilot_proof_update_rail",
    "No category expansion without proof.",
    `Manual sends logged: ${founderContactCounts.manualMessageSent}/10`,
    `Replies or clear rejections: ${founderContactCounts.repliesOrRejections}/3`,
    `Discovery calls: ${founderContactCounts.discoveryCalls}/1`,
    `Pilot candidates: ${founderContactCounts.pilotCandidates}/1`,
    "",
    "Category scores:",
    ...categoryPilotScores.map(
      (score) =>
        `${score.rank}. ${score.serviceTitle} | ${score.score} | ${score.signalLabel} | ${score.proofSummary} | next: ${score.nextAction}`,
    ),
    "",
    "Next manual batch:",
    ...leadingCategoryActionLayer.nextManualBatch.map(
      (item) => `- ${item.company} | ${item.segment} | ${item.statusLabel} | next: ${item.nextStep}`,
    ),
    "",
    "Discovery questions:",
    ...leadingCategoryActionLayer.discoveryQuestions.map((question) => `- ${question}`),
    "",
    "Pilot setup checklist:",
    ...leadingCategoryActionLayer.pilotSetupChecklist.map((item) => `- ${item}`),
    "",
    "Integration hold:",
    ...leadingCategoryActionLayer.integrationHold.map((item) => `- ${item}`),
    "",
    "Pilot setup readiness:",
    ...leadingCategoryPilotReadiness.checklist.map(
      (item) => `- ${item.done ? "done" : "blocked"} | ${item.label}: ${item.status}`,
    ),
    "",
    "Pilot readiness blockers:",
    ...(leadingCategoryPilotReadiness.blockers.length > 0
      ? leadingCategoryPilotReadiness.blockers.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "Readiness action plan:",
    ...formatLocalServiceReadinessActionPlanText(leadingCategoryReadinessActionPlan).split("\n"),
    "",
    "First 10 contacts:",
    ...founderContactRows.map(
      (row, index) =>
        `${index + 1}. ${row.prospect.company} | ${row.serviceTitle} | ${row.statusLabel} | ${row.proofStatus} | next: ${row.prospect.nextStep}`,
    ),
  ].join("\n");
  const founderBatchReviewExport = buildLocalServiceFounderBatchReviewExport(
    founderContactRows,
    founderContactCounts,
    founderProofChecklist,
    founderProofProgress,
    founderDecisionGate,
    categoryPilotScores,
    leadingCategoryActionLayer,
    leadingCategoryPilotReadiness,
    leadingCategoryReadinessActionPlan,
    pilotWorkspaceState.activityLog,
  );
  const readinessProofExport = buildLocalServiceReadinessProofDrawer(
    founderContactRows,
    founderContactCounts,
    founderProofChecklist,
    founderProofProgress,
    leadingCategoryPilotScore,
    leadingCategoryActionLayer,
    leadingCategoryPilotReadiness,
    leadingCategoryReadinessActionPlan,
    leadingCategorySetupCompletion,
    leadingCategorySetupReady,
    leadingCategoryTestCallPassed,
    leadingCategoryMetricStatus,
    pilotWorkspaceState.activityLog,
  );
  const paidPilotProposalPreviewExport = buildLocalServicePaidPilotProposalPreview(
    leadingCategoryTemplate,
    founderContactRows,
    founderContactCounts,
    founderProofProgress,
    leadingCategoryPilotScore,
    leadingCategoryActionLayer,
    leadingCategoryPilotReadiness,
    leadingCategoryReadinessActionPlan,
    leadingCategoryMetricStatus,
  );
  const proposalApprovalHandoffExport = buildLocalServiceProposalApprovalHandoff(
    leadingCategoryTemplate,
    founderContactRows,
    founderContactCounts,
    founderProofProgress,
    leadingCategoryPilotScore,
    leadingCategoryActionLayer,
    leadingCategoryPilotReadiness,
    leadingCategoryMetricStatus,
    leadingCategoryProposalApprovalDecision,
  );
  const pilotKickoffGateExport = buildLocalServicePilotKickoffGate(
    leadingCategoryTemplate,
    founderContactRows,
    founderContactCounts,
    founderProofProgress,
    leadingCategoryPilotScore,
    leadingCategoryActionLayer,
    leadingCategoryPilotReadiness,
    leadingCategorySetupReady,
    leadingCategoryTestCallPassed,
    leadingCategoryTestCallProgress,
    leadingCategoryMetricStatus,
    leadingCategoryProposalApprovalDecision,
    leadingCategoryKickoffDecision,
  );
  const dayOneOperatorRunSheet = buildLocalServiceDayOneOperatorRunSheet(
    leadingCategoryTemplate,
    founderContactRows,
    founderContactCounts,
    founderProofProgress,
    leadingCategoryPilotScore,
    leadingCategoryActionLayer,
    leadingCategoryPilotReadiness,
    leadingCategorySetupReady,
    leadingCategoryTestCallPassed,
    leadingCategoryTestCallProgress,
    leadingCategoryMetricStatus,
    leadingCategoryKickoffDecision,
    leadingCategoryFirstRequestOutcome,
  );
  const dayOneRecapExport = buildLocalServiceDayOneRecapExport(
    leadingCategoryTemplate,
    founderContactRows,
    founderContactCounts,
    founderProofProgress,
    leadingCategoryPilotScore,
    leadingCategoryActionLayer,
    leadingCategoryPilotReadiness,
    pilotWorkspaceState.firstRequestOutcomeByProspectKey,
    leadingCategoryMetricStatus,
    pilotWorkspaceState.activityLog,
  );
  const weeklyScorecardSyncChecklist = buildLocalServiceWeeklyScorecardSyncChecklist(
    leadingCategoryTemplate,
    founderContactRows,
    founderContactCounts,
    founderProofProgress,
    leadingCategoryPilotScore,
    leadingCategoryActionLayer,
    leadingCategoryPilotReadiness,
    pilotWorkspaceState.firstRequestOutcomeByProspectKey,
    leadingCategoryMetricStatus,
    leadingCategoryWeeklyScorecardSyncReviewed,
    pilotWorkspaceState.activityLog,
  );
  const filteredPilotFunnelRows = useMemo(
    () =>
      pilotFunnelRows.filter((row) => {
        if (pilotFunnelServiceFilter !== "all" && row.serviceId !== pilotFunnelServiceFilter) return false;
        if (pilotFunnelStatusFilter !== "all" && row.status !== pilotFunnelStatusFilter) return false;
        return true;
      }),
    [pilotFunnelRows, pilotFunnelServiceFilter, pilotFunnelStatusFilter],
  );
  const pilotFunnelFiltersActive = pilotFunnelServiceFilter !== "all" || pilotFunnelStatusFilter !== "all";
  const pilotWorkspaceExport = useMemo(
    () => buildLocalServicePilotWorkspaceExport(pilotFunnelRows, pilotFunnelCounts, pilotWorkspaceState.activityLog),
    [pilotFunnelCounts, pilotFunnelRows, pilotWorkspaceState.activityLog],
  );
  const pilotMetricsTrackerExport = useMemo(
    () => buildLocalServicePilotMetricsTrackerExport(selectedTemplate, currentMetricStatus),
    [currentMetricStatus, selectedTemplate],
  );
  const pilotDailyLogExport = useMemo(
    () =>
      buildLocalServicePilotDailyLogExport(
        selectedTemplate,
        selectedOutreachProspect,
        currentPilotStatus,
        currentMetricStatus,
        currentFirstRequestOutcome,
      ),
    [
      currentFirstRequestOutcome,
      currentMetricStatus,
      currentPilotStatus,
      selectedOutreachProspect,
      selectedTemplate,
    ],
  );
  const pilotWeekOneReviewExport = useMemo(
    () =>
      buildLocalServicePilotWeekOneReviewExport(
        selectedTemplate,
        selectedOutreachProspect,
        currentPilotStatus,
        currentMetricStatus,
        currentFirstRequestOutcome,
        currentWeekOneOwnerDecision,
        currentWeeklyScorecardSyncReviewed,
        pilotWorkspaceState.activityLog,
      ),
    [
      currentFirstRequestOutcome,
      currentMetricStatus,
      currentPilotStatus,
      currentWeekOneOwnerDecision,
      currentWeeklyScorecardSyncReviewed,
      pilotWorkspaceState.activityLog,
      selectedOutreachProspect,
      selectedTemplate,
    ],
  );
  const pilotEvidencePackExport = useMemo(
    () =>
      buildLocalServicePilotEvidencePackExport(
        selectedTemplate,
        selectedOutreachProspect,
        currentPilotStatus,
        currentMetricStatus,
        currentFirstRequestOutcome,
        currentWeekOneOwnerDecision,
        currentWeeklyScorecardSyncReviewed,
      ),
    [
      currentFirstRequestOutcome,
      currentMetricStatus,
      currentPilotStatus,
      currentWeekOneOwnerDecision,
      currentWeeklyScorecardSyncReviewed,
      selectedOutreachProspect,
      selectedTemplate,
    ],
  );
  const pilotMessagePreview = useMemo(
    () => buildLocalServicePilotMessagePreview(selectedTemplate, selectedOutreachProspect, currentPilotStatus),
    [currentPilotStatus, selectedOutreachProspect, selectedTemplate],
  );
  const pilotOperatorConfirmation = useMemo(
    () => buildLocalServicePilotConfirmationSummary(selectedTemplate, selectedOutreachProspect),
    [selectedOutreachProspect, selectedTemplate],
  );
  const pilotAnalystBrief = useMemo(
    () =>
      buildLocalServicePilotAnalystBrief(
        selectedTemplate,
        selectedOutreachProspect,
        currentPilotStatus,
        pilotFunnelCounts,
      ),
    [currentPilotStatus, pilotFunnelCounts, selectedOutreachProspect, selectedTemplate],
  );
  const discoveryCallPrep = useMemo(
    () =>
      buildLocalServiceDiscoveryCallPrep(
        selectedTemplate,
        selectedOutreachProspect,
        currentPilotStatus,
        currentMetricStatus,
      ),
    [currentMetricStatus, currentPilotStatus, selectedOutreachProspect, selectedTemplate],
  );
  const dayOneSetupBrief = useMemo(
    () =>
      buildLocalServiceDayOneSetupBrief(
        selectedTemplate,
        selectedOutreachProspect,
        currentPilotStatus,
        currentMetricStatus,
      ),
    [currentMetricStatus, currentPilotStatus, selectedOutreachProspect, selectedTemplate],
  );
  const agentSetupBrief = useMemo(() => buildLocalServiceAgentSetupBrief(selectedTemplate), [selectedTemplate]);
  const setupStepCompletion = pilotWorkspaceState.setupStepCompletionByService[selectedTemplate.id] ?? {};
  const setupWizardPrerequisiteSteps = agentSetupBrief.setupSteps.filter(
    (step) => step.id !== LOCAL_SERVICE_SETUP_READY_STEP_ID,
  );
  const completedSetupStepCount = agentSetupBrief.setupSteps.filter((step) => setupStepCompletion[step.id]).length;
  const completedSetupPrerequisiteCount = setupWizardPrerequisiteSteps.filter(
    (step) => setupStepCompletion[step.id],
  ).length;
  const setupWizardTotal = agentSetupBrief.setupSteps.length;
  const setupWizardProgress = `${completedSetupStepCount}/${setupWizardTotal}`;
  const setupReadyForPilot = pilotWorkspaceState.setupReadyByService[selectedTemplate.id] === true;
  const canMarkReadyForPilot =
    setupWizardPrerequisiteSteps.length > 0 &&
    completedSetupPrerequisiteCount === setupWizardPrerequisiteSteps.length;
  const testCallChecklist = pilotWorkspaceState.testCallChecklistByService[selectedTemplate.id] ?? {};
  const testCallChecks: {
    id: LocalServiceTestCallCheckId;
    label: string;
    value: string;
    status: string;
  }[] = [
    {
      id: "sample_input_reviewed",
      label: "Sample inbound reviewed",
      value: selectedTemplate.detail.sampleInput,
      status: "Inbound source",
    },
    {
      id: "expected_fields_matched",
      label: "Expected extracted fields matched",
      value: [
        ...selectedTemplate.detail.telegramIntake.normalizedFields,
        ...selectedTemplate.detail.estimateInputs,
      ].join(", "),
      status: "Field extraction",
    },
    {
      id: "approval_gate_confirmed",
      label: "Approval gate confirmed",
      value: selectedTemplate.detail.approvalPolicy.join(" "),
      status: "Operator approval",
    },
    {
      id: "handoff_preview_confirmed",
      label: "Handoff preview confirmed",
      value: selectedTemplate.detail.operatorHandoff,
      status: "Manual handoff",
    },
  ];
  const completedTestCallCheckCount = testCallChecks.filter((check) => testCallChecklist[check.id]).length;
  const testCallProgress = `${completedTestCallCheckCount}/${testCallChecks.length}`;
  const testCallChecksComplete = LOCAL_SERVICE_TEST_CALL_CHECK_IDS.every((id) => testCallChecklist[id] === true);
  const testCallPassed = pilotWorkspaceState.testCallPassedByService[selectedTemplate.id] === true;
  const canRecordTestCallPassed = setupReadyForPilot && testCallChecksComplete;
  const setupStateLines = [
    "Saved setup state:",
    `Service: ${selectedTemplate.ref} - ${selectedTemplate.title}`,
    `Setup progress: ${setupWizardProgress}`,
    `Ready for pilot test: ${setupReadyForPilot ? "yes" : "no"}`,
    `Test call progress: ${testCallProgress}`,
    `Test call passed: ${testCallPassed ? "yes" : "no"}`,
    ...agentSetupBrief.setupSteps.map(
      (step) => `- ${step.label}: ${setupStepCompletion[step.id] ? "complete" : "pending"}`,
    ),
    "Test call/message checklist:",
    ...testCallChecks.map((check) => `- ${check.label}: ${testCallChecklist[check.id] ? "passed" : "pending"}`),
  ];
  const setupBriefWithState = `${agentSetupBrief.humanText}\n\n${setupStateLines.join("\n")}`;
  const nextManualBatch = filteredPilotFunnelRows
    .filter((item) => item.status !== "reply_received" && item.status !== "rejected_for_now")
    .slice(0, 4);
  const pilotExecutionChecklist: LocalServicePilotExecutionStep[] = [
    {
      label: "Pass test call/message",
      status: testCallPassed ? "Test call passed" : `Test call progress ${testCallProgress}`,
      owner: "Operator",
      detail: "Complete the setup dry run before any live pilot channel, outreach, or dispatch workflow is connected.",
      done: testCallPassed,
    },
    {
      label: "Prepare first manual batch",
      status:
        testCallPassed && nextManualBatch.length > 0
          ? "Ready for first manual batch"
          : testCallPassed
            ? "Needs unfiltered candidate"
            : "Needs test call passed",
      owner: "Founder",
      detail: "Pick the first companies from the filtered outreach list only after the dry-run gate is passed.",
      done: testCallPassed && nextManualBatch.length > 0,
    },
    {
      label: "Record ready drafts",
      status: `${pilotFunnelCounts.draft_ready} draft ready`,
      owner: "Operator",
      detail: "Use Preview / Test message and Operator confirmation after the setup dry run is recorded.",
      done: testCallPassed && pilotFunnelCounts.draft_ready > 0,
    },
    {
      label: "Log manual contact",
      status: `${pilotFunnelCounts.contacted_manually + pilotFunnelCounts.reply_received} contacted or replied`,
      owner: "Founder",
      detail: "After sending outside the product, mark Contacted manually in the browser-local scorecard.",
      done: pilotFunnelCounts.contacted_manually > 0 || pilotFunnelCounts.reply_received > 0,
    },
    {
      label: "Book discovery call",
      status: `${pilotFunnelCounts.reply_received} reply received`,
      owner: "Founder",
      detail: "When a company replies, open Discovery call prep before booking the conversation manually.",
      done: pilotFunnelCounts.reply_received > 0,
    },
    {
      label: "Start metric capture",
      status: currentMetricStatusLabel,
      owner: "Operator",
      detail: "Open Day-one setup brief first, then use Open metrics tracker after the pilot conversation starts.",
      done: currentMetricStatus !== "not_started",
    },
  ];
  const completedPilotExecutionStepCount = pilotExecutionChecklist.filter((step) => step.done).length;
  const pilotExecutionProgress = `${completedPilotExecutionStepCount}/${pilotExecutionChecklist.length}`;
  const dryRunGateLabel = testCallPassed ? "Dry run passed" : "Dry run required";
  const selectedDraftReady = currentPilotStatus === "draft_ready";
  const manualLaunchGateLabel =
    testCallPassed && selectedDraftReady ? "Manual launch ready" : "Manual launch blocked";
  const pilotLaunchPacket = useMemo(
    () =>
      buildLocalServicePilotLaunchPacket(
        selectedTemplate,
        selectedOutreachProspect,
        currentPilotStatus,
        testCallPassed,
        testCallProgress,
      ),
    [currentPilotStatus, selectedOutreachProspect, selectedTemplate, testCallPassed, testCallProgress],
  );
  const pilotActivityLog = pilotWorkspaceState.activityLog;
  const latestPilotActivity = pilotActivityLog[0];
  const pilotActivityLogText = [
    "local_services_manual_activity_log",
    `Service: ${selectedTemplate.title}`,
    `Selected company: ${selectedOutreachProspect?.company ?? "Not selected"}`,
    "Recorded in browser only. No outbound send, CRM write, calendar event, analytics sync, billing action, or Markdown mutation.",
    "Events:",
    ...(pilotActivityLog.length > 0
      ? pilotActivityLog.map(
          (event) =>
            `- ${event.createdAt} | ${event.serviceTitle} | ${event.company ?? "service"} | ${event.label}: ${event.value}`,
        )
      : ["- No manual activity recorded yet."]),
  ].join("\n");
  const scorecardDraftRows = selectedOutreachProspect
    ? [
        { label: "Company", value: selectedOutreachProspect.company },
        { label: "Segment", value: selectedOutreachProspect.segment },
        { label: "Channel fit", value: selectedOutreachProspect.channelFit },
        { label: "Qualification focus", value: selectedOutreachProspect.scorecardFocus },
        { label: "Next step", value: selectedOutreachProspect.nextStep },
        { label: "Status", value: currentPilotStatusLabel },
        { label: "First request outcome", value: currentFirstRequestOutcomeLabel },
        { label: "Weekly sync reviewed", value: currentWeeklyScorecardSyncReviewedLabel },
        { label: "Week-one owner decision", value: currentWeekOneOwnerDecisionLabel },
      ]
    : [];
  const outcomeChainSummary = [
    {
      label: "Scorecard draft",
      value: currentFirstRequestOutcomeLabel,
      detail: "Saved under firstRequestOutcomeByProspectKey.",
    },
    {
      label: "Daily log",
      value: currentMetricStatusLabel,
      detail: "Carried into local_services_pilot_daily_log.",
    },
    {
      label: "Week-one review",
      value: currentWeekOneOwnerDecisionLabel,
      detail: currentWeeklyScorecardSyncReviewed
        ? "Private scorecard sync reviewed before owner handoff."
        : "Wait for weeklyScorecardSyncReviewedByService before owner handoff.",
    },
    {
      label: "Evidence pack",
      value: "Paid-pilot readiness",
      detail: "Carried into local_services_pilot_evidence_pack after redaction.",
    },
  ];
  const hidePilotPlanning = recordingMode || setupWizardMode;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_SERVICE_PILOT_WORKSPACE_STORAGE_KEY, JSON.stringify(pilotWorkspaceState));
    } catch {
      // Disabled storage should not block the demo flow.
    }
  }, [pilotWorkspaceState]);

  const updatePilotWorkspaceStatusForTarget = (
    target: {
      key: string;
      serviceId: string;
      serviceTitle: string;
      prospect?: LocalServiceOutreachProspect;
    },
    status: LocalServicePilotStatus,
  ) => {
    const nextStatusLabel = LOCAL_SERVICE_PILOT_STATUS_LABELS[status];
    setPilotWorkspaceState((prev) => ({
      ...prev,
      statusByProspectKey: {
        ...prev.statusByProspectKey,
        [target.key]: status,
      },
      activityLog: appendLocalServicePilotActivity(prev.activityLog, {
        kind: "status_change",
        label: "Pilot status recorded",
        value: nextStatusLabel,
        serviceId: target.serviceId,
        serviceTitle: target.serviceTitle,
        prospectId: target.prospect?.id,
        company: target.prospect?.company,
      }),
    }));
  };
  const updatePilotWorkspaceStatus = (status: LocalServicePilotStatus) => {
    updatePilotWorkspaceStatusForTarget(
      {
        key: scorecardDraftKey,
        serviceId: selectedTemplate.id,
        serviceTitle: selectedTemplate.title,
        prospect: selectedOutreachProspect,
      },
      status,
    );
  };
  const recordReadyForManualOutreach = () => updatePilotWorkspaceStatus("draft_ready");

  const updateFirstRequestOutcomeForTarget = (
    target: {
      key: string;
      serviceId: string;
      serviceTitle: string;
      prospect?: LocalServiceOutreachProspect;
    },
    outcome: LocalServiceFirstRequestOutcome,
  ) => {
    const nextOutcomeLabel = LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_LABELS[outcome];
    setPilotWorkspaceState((prev) => ({
      ...prev,
      firstRequestOutcomeByProspectKey: {
        ...prev.firstRequestOutcomeByProspectKey,
        [target.key]: outcome,
      },
      weeklyScorecardSyncReviewedByService: {
        ...prev.weeklyScorecardSyncReviewedByService,
        [target.serviceId]: false,
      },
      activityLog: appendLocalServicePilotActivity(prev.activityLog, {
        kind: "outcome_change",
        label: "First request outcome recorded",
        value: nextOutcomeLabel,
        serviceId: target.serviceId,
        serviceTitle: target.serviceTitle,
        prospectId: target.prospect?.id,
        company: target.prospect?.company,
      }),
    }));
  };
  const updateFirstRequestOutcome = (outcome: LocalServiceFirstRequestOutcome) => {
    updateFirstRequestOutcomeForTarget(
      {
        key: scorecardDraftKey,
        serviceId: selectedTemplate.id,
        serviceTitle: selectedTemplate.title,
        prospect: selectedOutreachProspect,
      },
      outcome,
    );
  };
  const updateLeadingCategoryFirstRequestOutcome = (outcome: LocalServiceFirstRequestOutcome) => {
    if (!leadingCategoryOutcomeTargetRow) return;
    updateFirstRequestOutcomeForTarget(
      {
        key: leadingCategoryOutcomeTargetRow.key,
        serviceId: leadingCategoryOutcomeTargetRow.serviceId,
        serviceTitle: leadingCategoryOutcomeTargetRow.serviceTitle,
        prospect: leadingCategoryOutcomeTargetRow.prospect,
      },
      outcome,
    );
  };

  const updateWeekOneOwnerDecision = (decision: LocalServiceWeekOneOwnerDecision) => {
    const nextDecisionLabel = LOCAL_SERVICE_WEEK_ONE_OWNER_DECISION_LABELS[decision];
    setPilotWorkspaceState((prev) => ({
      ...prev,
      weekOneOwnerDecisionByProspectKey: {
        ...prev.weekOneOwnerDecisionByProspectKey,
        [scorecardDraftKey]: decision,
      },
      activityLog: appendLocalServicePilotActivity(prev.activityLog, {
        kind: "owner_decision",
        label: "Week-one owner decision recorded",
        value: nextDecisionLabel,
        serviceId: selectedTemplate.id,
        serviceTitle: selectedTemplate.title,
        prospectId: selectedOutreachProspect?.id,
        company: selectedOutreachProspect?.company,
      }),
    }));
  };

  const updateProposalApprovalDecision = (decision: LocalServiceProposalApprovalDecision) => {
    const nextDecisionLabel = LOCAL_SERVICE_PROPOSAL_APPROVAL_LABELS[decision];
    setPilotWorkspaceState((prev) => ({
      ...prev,
      proposalApprovalByService: {
        ...prev.proposalApprovalByService,
        [leadingCategoryActionLayer.serviceId]: decision,
      },
      activityLog: appendLocalServicePilotActivity(prev.activityLog, {
        kind: "proposal_approval",
        label: "Proposal approval decision recorded",
        value: nextDecisionLabel,
        serviceId: leadingCategoryActionLayer.serviceId,
        serviceTitle: leadingCategoryActionLayer.serviceTitle,
      }),
    }));
  };

  const updateKickoffDecision = (decision: LocalServiceKickoffDecision) => {
    const nextDecisionLabel = LOCAL_SERVICE_KICKOFF_DECISION_LABELS[decision];
    setPilotWorkspaceState((prev) => ({
      ...prev,
      kickoffDecisionByService: {
        ...prev.kickoffDecisionByService,
        [leadingCategoryActionLayer.serviceId]: decision,
      },
      activityLog: appendLocalServicePilotActivity(prev.activityLog, {
        kind: "kickoff_decision",
        label: "Kickoff decision recorded",
        value: nextDecisionLabel,
        serviceId: leadingCategoryActionLayer.serviceId,
        serviceTitle: leadingCategoryActionLayer.serviceTitle,
      }),
    }));
  };

  const updateWeeklyScorecardSyncReviewed = (reviewed: boolean) => {
    setPilotWorkspaceState((prev) => ({
      ...prev,
      weeklyScorecardSyncReviewedByService: {
        ...prev.weeklyScorecardSyncReviewedByService,
        [leadingCategoryActionLayer.serviceId]: reviewed,
      },
      activityLog: appendLocalServicePilotActivity(prev.activityLog, {
        kind: "weekly_sync_review",
        label: "Weekly scorecard sync reviewed",
        value: reviewed ? "Reviewed for private scorecard sync" : "Review reset",
        serviceId: leadingCategoryActionLayer.serviceId,
        serviceTitle: leadingCategoryActionLayer.serviceTitle,
      }),
    }));
  };

  const updatePilotMetricStatus = (status: LocalServicePilotMetricStatus) => {
    const nextMetricLabel = LOCAL_SERVICE_PILOT_METRIC_STATUS_LABELS[status];
    setPilotWorkspaceState((prev) => ({
      ...prev,
      metricStatusByService: {
        ...prev.metricStatusByService,
        [selectedTemplate.id]: status,
      },
      weeklyScorecardSyncReviewedByService: {
        ...prev.weeklyScorecardSyncReviewedByService,
        [selectedTemplate.id]: false,
      },
      activityLog: appendLocalServicePilotActivity(prev.activityLog, {
        kind: "metric_change",
        label: "Metric capture recorded",
        value: nextMetricLabel,
        serviceId: selectedTemplate.id,
        serviceTitle: selectedTemplate.title,
        prospectId: selectedOutreachProspect?.id,
        company: selectedOutreachProspect?.company,
      }),
    }));
  };
  const updateFounderContactProof = (
    row: LocalServicePilotFunnelRow,
    field: LocalServiceFounderContactField,
    checked: boolean,
  ) => {
    const fieldLabel = LOCAL_SERVICE_FOUNDER_CONTACT_FIELD_LABELS[field];
    setPilotWorkspaceState((prev) => {
      const currentProof = prev.contactProofByProspectKey[row.key] ?? {};
      const nextStatusByProspectKey = { ...prev.statusByProspectKey };
      if (field === "manualMessageSent" && checked) {
        const currentStatus = nextStatusByProspectKey[row.key] ?? "not_contacted";
        if (currentStatus === "not_contacted" || currentStatus === "draft_ready") {
          nextStatusByProspectKey[row.key] = "contacted_manually";
        }
      }
      return {
        ...prev,
        statusByProspectKey: nextStatusByProspectKey,
        contactProofByProspectKey: {
          ...prev.contactProofByProspectKey,
          [row.key]: {
            ...currentProof,
            [field]: checked,
          },
        },
        activityLog: appendLocalServicePilotActivity(prev.activityLog, {
          kind: "contact_proof",
          label: "Founder proof recorded",
          value: `${fieldLabel}: ${checked ? "yes" : "no"}`,
          serviceId: row.serviceId,
          serviceTitle: row.serviceTitle,
          prospectId: row.prospect.id,
          company: row.prospect.company,
        }),
      };
    });
  };
  const pilotOpsProofRailActions = pilotOpsTodayRow
    ? [
        {
          label: "Mark channel checked",
          stateLabel: pilotOpsTodayRow.channelChecked ? "Recorded" : "Needed",
          active: pilotOpsTodayRow.channelChecked,
          recommended: pilotOpsTodayProof === "channelChecked",
          onClick: () => updateFounderContactProof(pilotOpsTodayRow, "channelChecked", !pilotOpsTodayRow.channelChecked),
        },
        {
          label: "Mark manual sent",
          stateLabel: pilotOpsTodayRow.manualMessageSent ? "Recorded" : "Needed",
          active: pilotOpsTodayRow.manualMessageSent,
          recommended: pilotOpsTodayProof === "manualMessageSent",
          onClick: () =>
            updateFounderContactProof(pilotOpsTodayRow, "manualMessageSent", !pilotOpsTodayRow.manualMessageSent),
        },
        {
          label: "Mark reply",
          stateLabel: pilotOpsTodayRow.status === "reply_received" ? "Recorded" : "Optional",
          active: pilotOpsTodayRow.status === "reply_received",
          recommended: pilotOpsTodayProof === "reply_or_rejection_status",
          onClick: () => updatePilotWorkspaceStatusForTarget(pilotOpsTodayRow, "reply_received"),
        },
        {
          label: "Mark rejected",
          stateLabel: pilotOpsTodayRow.status === "rejected_for_now" ? "Recorded" : "Optional",
          active: pilotOpsTodayRow.status === "rejected_for_now",
          recommended: pilotOpsTodayProof === "reply_or_rejection_status",
          onClick: () => updatePilotWorkspaceStatusForTarget(pilotOpsTodayRow, "rejected_for_now"),
        },
        {
          label: "Mark discovery call",
          stateLabel: pilotOpsTodayRow.discoveryCallCompleted ? "Recorded" : "Needed",
          active: pilotOpsTodayRow.discoveryCallCompleted,
          recommended: pilotOpsTodayProof === "discoveryCallCompleted",
          onClick: () =>
            updateFounderContactProof(
              pilotOpsTodayRow,
              "discoveryCallCompleted",
              !pilotOpsTodayRow.discoveryCallCompleted,
            ),
        },
        {
          label: "Mark demo booked",
          stateLabel: pilotOpsTodayRow.demoBooked ? "Recorded" : "Needed",
          active: pilotOpsTodayRow.demoBooked,
          recommended: pilotOpsTodayProof === "demoBooked",
          onClick: () => updateFounderContactProof(pilotOpsTodayRow, "demoBooked", !pilotOpsTodayRow.demoBooked),
        },
        {
          label: "Mark pilot candidate",
          stateLabel: pilotOpsTodayRow.pilotCandidate ? "Recorded" : "Needed",
          active: pilotOpsTodayRow.pilotCandidate,
          recommended: pilotOpsTodayProof === "pilotCandidate",
          onClick: () =>
            updateFounderContactProof(pilotOpsTodayRow, "pilotCandidate", !pilotOpsTodayRow.pilotCandidate),
        },
      ]
    : [];
  const updateSetupStepCompletion = (stepId: LocalServiceSetupStepId, complete: boolean) => {
    setPilotWorkspaceState((prev) => {
      const currentCompletion = prev.setupStepCompletionByService[selectedTemplate.id] ?? {};
      const nextCompletion = {
        ...currentCompletion,
        [stepId]: complete,
      };
      const nextReadyByService = { ...prev.setupReadyByService };
      const nextTestCallPassedByService = { ...prev.testCallPassedByService };
      if (stepId !== LOCAL_SERVICE_SETUP_READY_STEP_ID && !complete) {
        nextCompletion[LOCAL_SERVICE_SETUP_READY_STEP_ID] = false;
        nextReadyByService[selectedTemplate.id] = false;
        nextTestCallPassedByService[selectedTemplate.id] = false;
      }
      if (stepId === LOCAL_SERVICE_SETUP_READY_STEP_ID) {
        nextReadyByService[selectedTemplate.id] = complete;
        if (!complete) {
          nextTestCallPassedByService[selectedTemplate.id] = false;
        }
      }
      return {
        ...prev,
        setupStepCompletionByService: {
          ...prev.setupStepCompletionByService,
          [selectedTemplate.id]: nextCompletion,
        },
        setupReadyByService: nextReadyByService,
        testCallPassedByService: nextTestCallPassedByService,
      };
    });
  };
  const markReadyForPilotTest = () => {
    setPilotWorkspaceState((prev) => {
      const currentCompletion = prev.setupStepCompletionByService[selectedTemplate.id] ?? {};
      return {
        ...prev,
        setupStepCompletionByService: {
          ...prev.setupStepCompletionByService,
          [selectedTemplate.id]: {
            ...currentCompletion,
            [LOCAL_SERVICE_SETUP_READY_STEP_ID]: true,
          },
        },
        setupReadyByService: {
          ...prev.setupReadyByService,
          [selectedTemplate.id]: true,
        },
      };
    });
  };
  const resetSetupProgress = () => {
    setPilotWorkspaceState((prev) => ({
      ...prev,
      setupStepCompletionByService: {
        ...prev.setupStepCompletionByService,
        [selectedTemplate.id]: {},
      },
      setupReadyByService: {
        ...prev.setupReadyByService,
        [selectedTemplate.id]: false,
      },
      testCallChecklistByService: {
        ...prev.testCallChecklistByService,
        [selectedTemplate.id]: {},
      },
      testCallPassedByService: {
        ...prev.testCallPassedByService,
        [selectedTemplate.id]: false,
      },
    }));
  };
  const updateTestCallCheck = (checkId: LocalServiceTestCallCheckId, complete: boolean) => {
    setPilotWorkspaceState((prev) => {
      const currentChecklist = prev.testCallChecklistByService[selectedTemplate.id] ?? {};
      return {
        ...prev,
        testCallChecklistByService: {
          ...prev.testCallChecklistByService,
          [selectedTemplate.id]: {
            ...currentChecklist,
            [checkId]: complete,
          },
        },
        testCallPassedByService: {
          ...prev.testCallPassedByService,
          [selectedTemplate.id]: complete ? prev.testCallPassedByService[selectedTemplate.id] === true : false,
        },
      };
    });
  };
  const recordTestCallPassed = () => {
    if (!canRecordTestCallPassed) return;
    setPilotWorkspaceState((prev) => ({
      ...prev,
      testCallPassedByService: {
        ...prev.testCallPassedByService,
        [selectedTemplate.id]: true,
      },
    }));
  };
  const resetTestCall = () => {
    setPilotWorkspaceState((prev) => ({
      ...prev,
      testCallChecklistByService: {
        ...prev.testCallChecklistByService,
        [selectedTemplate.id]: {},
      },
      testCallPassedByService: {
        ...prev.testCallPassedByService,
        [selectedTemplate.id]: false,
      },
    }));
  };

  return (
    <section
      aria-label="Local services dispatcher demo"
      className="mx-8 mb-5 rounded-md border border-border/70 bg-card/35 overflow-hidden shadow-[0_18px_40px_-28px_rgba(0,0,0,0.65)]"
    >
      <div className="px-5 py-4 border-b border-border/60 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex h-5 items-center px-2 rounded-[5px] bg-[hsl(var(--tint-mint)/0.14)] text-[10px] font-mono uppercase tracking-[0.12em] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.24)]">
              local-services-dispatch
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">phone + operator approval</span>
          </div>
          <h2 className="font-serif text-[22px] leading-tight tracking-tight text-foreground">
            AI Dispatcher for Local Services.
          </h2>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-relaxed max-w-3xl">
            The phone assistant collects the request, prepares the estimate inputs, and leaves a
            job card for operator-approved booking. No autonomous dispatch or final pricing in P0.
          </p>
        </div>
        <div className="hidden xl:grid grid-cols-3 gap-2 min-w-[420px]">
          {[
            ["Channel", "Phone, Telegram"],
            ["Market", "Tashkent services"],
            ["Gate", "Operator review"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                {label}
              </div>
              <div className="mt-1 font-mono text-[11px] text-foreground truncate">{value}</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-smooth"
          aria-label="Close local services dispatcher demo"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {recordingMode && (
          <section
            aria-label="90-second recording mode"
            className="rounded-md border border-[hsl(var(--tint-mint)/0.28)] bg-[hsl(var(--tint-mint)/0.09)] px-4 py-3"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--tint-mint-fg))]">
                  <Camera className="h-3.5 w-3.5" strokeWidth={1.8} />
                  90-second recording mode
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-foreground max-w-3xl">
                  Recording path: product promise, job card, intake, evidence, pilot readiness, evidence pack.
                  Outreach tables and scorecard controls are hidden during recording.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onOpenPath(LOCAL_SERVICES_DEMO_RECORDING_CHECKLIST_PATH)}
                  className="h-8"
                >
                  Open recording checklist
                </Button>
                <span className="inline-flex rounded-[5px] bg-background/45 px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.24)]">
                  No autonomous send
                </span>
                <span className="inline-flex rounded-[5px] bg-background/45 px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.24)]">
                  no live claims
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {["Product promise", "Job card", "Intake", "Evidence", "Pilot readiness", "Evidence pack"].map(
                (item, index) => (
                  <div key={item} className="rounded-md bg-background/35 px-3 py-2">
                    <div className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</div>
                    <div className="mt-1 text-[11.5px] font-medium text-foreground">{item}</div>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {setupWizardMode && (
          <>
          <section
            aria-label="7-minute setup wizard"
            className="rounded-md border border-[hsl(var(--tint-violet)/0.28)] bg-[hsl(var(--tint-violet)/0.08)] px-4 py-3"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--tint-violet-fg))]">
                  <UserRoundCog className="h-3.5 w-3.5" strokeWidth={1.8} />
                  7-minute setup wizard
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-foreground max-w-3xl">
                  Setup path: business profile, knowledge sources, agent behavior, test call/message, ready.
                  Outreach tables and scorecard controls are hidden so the first demo stays focused on setup.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-[5px] bg-background/45 px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-violet-fg))] ring-1 ring-inset ring-[hsl(var(--tint-violet)/0.24)]">
                    Setup progress {setupWizardProgress}
                  </span>
                  <span
                    className={`inline-flex rounded-[5px] px-2 py-1 font-mono text-[10px] ring-1 ring-inset ${
                      setupReadyForPilot
                        ? "bg-[hsl(var(--tint-mint)/0.12)] text-[hsl(var(--tint-mint-fg))] ring-[hsl(var(--tint-mint)/0.22)]"
                        : "bg-background/45 text-muted-foreground ring-border/60"
                    }`}
                  >
                    {setupReadyForPilot ? "Ready for pilot test" : "Setup in progress"}
                  </span>
                  <span className="inline-flex rounded-[5px] bg-background/45 px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-violet-fg))] ring-1 ring-inset ring-[hsl(var(--tint-violet)/0.24)]">
                    Saved in this browser
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setAgentSetupMode("human");
                    setAgentSetupOpen(true);
                  }}
                  className="h-8"
                >
                  <UserRoundCog className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open setup checklist
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDayOneSetupMode("human");
                    setDayOneSetupOpen(true);
                  }}
                  className="h-8"
                >
                  <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open day-one setup
                </Button>
                <Button
                  size="sm"
                  onClick={() => onCopyText(setupBriefWithState, agentSetupBrief.copyLabel)}
                  className="h-8"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Copy setup brief
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetSetupProgress}
                  className="h-8"
                >
                  Reset setup progress
                </Button>
                <span className="inline-flex rounded-[5px] bg-background/45 px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-violet-fg))] ring-1 ring-inset ring-[hsl(var(--tint-violet)/0.24)]">
                  No channel activation
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {agentSetupBrief.setupSteps.map((step, index) => {
                const complete = setupStepCompletion[step.id] === true;
                const readyStep = step.id === LOCAL_SERVICE_SETUP_READY_STEP_ID;
                const disabled = readyStep && !canMarkReadyForPilot && !setupReadyForPilot;
                return (
                <div
                  key={step.label}
                  className={`rounded-md border px-3 py-2.5 ${
                    complete
                      ? "border-[hsl(var(--tint-mint)/0.24)] bg-[hsl(var(--tint-mint)/0.08)]"
                      : "border-border/40 bg-background/35"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-[hsl(var(--tint-violet)/0.12)] font-mono text-[10px] text-[hsl(var(--tint-violet-fg))] ring-1 ring-inset ring-[hsl(var(--tint-violet)/0.22)]">
                      {complete ? <Check className="h-3 w-3" strokeWidth={2} /> : index + 1}
                    </span>
                    <div className="text-[11.5px] font-medium text-foreground">{step.label}</div>
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-muted-foreground/70">
                    {complete ? "Complete" : step.status}
                  </div>
                  <button
                    type="button"
                    aria-pressed={complete}
                    disabled={disabled}
                    onClick={() =>
                      readyStep
                        ? markReadyForPilotTest()
                        : updateSetupStepCompletion(step.id, !complete)
                    }
                    className={`mt-2 inline-flex h-7 items-center rounded-[5px] px-2 text-[10px] font-medium ring-1 ring-inset transition-smooth ${
                      disabled
                        ? "cursor-not-allowed bg-secondary/20 text-muted-foreground/45 ring-border/40"
                        : complete
                          ? "bg-[hsl(var(--tint-mint)/0.12)] text-[hsl(var(--tint-mint-fg))] ring-[hsl(var(--tint-mint)/0.22)]"
                          : "bg-secondary/45 text-muted-foreground ring-border/60 hover:text-foreground"
                    }`}
                  >
                    {readyStep
                      ? setupReadyForPilot
                        ? "Ready for pilot test"
                        : "Mark ready for pilot test"
                      : complete
                        ? "Completed"
                        : "Mark complete"}
                  </button>
                </div>
                );
              })}
            </div>
          </section>
          <section
            aria-label="Test call/message panel"
            className="rounded-md border border-[hsl(var(--tint-mint)/0.26)] bg-[hsl(var(--tint-mint)/0.07)] px-4 py-3"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--tint-mint-fg))]">
                  <PhoneCall className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Test call/message panel
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-foreground max-w-3xl">
                  Operator test step after setup: replay the sample inbound call or message, compare extracted fields,
                  verify the approval gate, and record the first pass before pilot activation.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-[5px] bg-background/45 px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.24)]">
                    Test call progress {testCallProgress}
                  </span>
                  <span
                    className={`inline-flex rounded-[5px] px-2 py-1 font-mono text-[10px] ring-1 ring-inset ${
                      testCallPassed
                        ? "bg-[hsl(var(--tint-mint)/0.12)] text-[hsl(var(--tint-mint-fg))] ring-[hsl(var(--tint-mint)/0.22)]"
                        : "bg-background/45 text-muted-foreground ring-border/60"
                    }`}
                  >
                    {testCallPassed ? "Test call passed" : "Test call pending"}
                  </span>
                  <span className="inline-flex rounded-[5px] bg-background/45 px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.24)]">
                    browser-local
                  </span>
                  <span className="inline-flex rounded-[5px] bg-background/45 px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.24)]">
                    No live channel activation
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!canRecordTestCallPassed}
                  onClick={recordTestCallPassed}
                  className="h-8"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  {testCallPassed ? "Test call passed" : "Record test passed"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onCopyText(setupBriefWithState, "Copy test call brief")} className="h-8">
                  <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Copy test call brief
                </Button>
                <Button size="sm" variant="ghost" onClick={resetTestCall} className="h-8">
                  Reset test call
                </Button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.85fr)_minmax(320px,1.05fr)]">
              <section className="rounded-md border border-border/40 bg-background/35 px-3 py-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  <MessageSquareText className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Sample inbound
                </div>
                <p className="mt-2 rounded-md border border-border/50 bg-card/25 px-3 py-2 text-[12px] leading-relaxed text-foreground">
                  {selectedTemplate.detail.sampleInput}
                </p>
                <p className="mt-2 rounded-md border border-border/50 bg-card/25 px-3 py-2 text-[12px] leading-relaxed text-foreground">
                  {selectedTemplate.detail.telegramIntake.inboundMessage}
                </p>
              </section>
              <section className="rounded-md border border-border/40 bg-background/35 px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Expected extracted fields
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...selectedTemplate.detail.telegramIntake.normalizedFields, ...selectedTemplate.detail.estimateInputs].map(
                    (field) => (
                      <span
                        key={field}
                        className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                      >
                        {field}
                      </span>
                    ),
                  )}
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Approval gate
                </div>
                <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground">
                  {selectedTemplate.detail.approvalPolicy.map((item) => (
                    <li key={item} className="flex gap-2">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-md border border-border/40 bg-background/35 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Pass/fail checklist
                  </div>
                  <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    {setupReadyForPilot ? "Setup ready" : "Complete setup first"}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {testCallChecks.map((check) => {
                    const complete = testCallChecklist[check.id] === true;
                    return (
                      <div
                        key={check.id}
                        className={`rounded-md border px-3 py-2.5 ${
                          complete
                            ? "border-[hsl(var(--tint-mint)/0.24)] bg-[hsl(var(--tint-mint)/0.08)]"
                            : "border-border/40 bg-card/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11.5px] font-medium text-foreground">{check.label}</div>
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                              {check.status}
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-pressed={complete}
                            onClick={() => updateTestCallCheck(check.id, !complete)}
                            className={`inline-flex h-7 shrink-0 items-center rounded-[5px] px-2 text-[10px] font-medium ring-1 ring-inset transition-smooth ${
                              complete
                                ? "bg-[hsl(var(--tint-mint)/0.12)] text-[hsl(var(--tint-mint-fg))] ring-[hsl(var(--tint-mint)/0.22)]"
                                : "bg-secondary/45 text-muted-foreground ring-border/60 hover:text-foreground"
                            }`}
                          >
                            {complete ? "Check passed" : "Mark check passed"}
                          </button>
                        </div>
                        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{check.value}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </section>
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {LOCAL_SERVICE_DEMO_TEMPLATES.map((template) => {
            const { Icon } = template;
            const selected = template.id === selectedTemplate.id;
            return (
              <article
                key={template.id}
                className={`rounded-md border p-4 transition-smooth ${
                  selected ? "border-transparent bg-card/55 ring-1 ring-inset" : "border-border/60 bg-card/30"
                }`}
                style={
                  selected
                    ? {
                        borderColor: `hsl(var(--tint-${template.tone}) / 0.34)`,
                        ["--tw-ring-color" as const]: `hsl(var(--tint-${template.tone}) / 0.3)`,
                      }
                    : undefined
                }
              >
                <div className="flex items-start gap-3">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset"
                    style={{
                      backgroundColor: `hsl(var(--tint-${template.tone}) / 0.14)`,
                      color: `hsl(var(--tint-${template.tone}-fg))`,
                      ["--tw-ring-color" as const]: `hsl(var(--tint-${template.tone}) / 0.24)`,
                    }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
                        {template.title}
                      </h3>
                      <Pill tone={template.tone} size="sm">
                        {template.ref}
                      </Pill>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {template.summary}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  {template.highlights.map((highlight) => (
                    <div key={highlight.label} className="rounded-md bg-background/35 px-2.5 py-2">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                        {highlight.label}
                      </div>
                      <div className="mt-1 text-foreground">{highlight.value}</div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  {template.statusNote}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onSelectService(template.id)} className="h-8">
                    Inspect service
                  </Button>
                  <Button size="sm" onClick={() => onOpenPath(template.evidencePath)} className="h-8">
                    Evidence
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onOpenPath(template.bundlePath)} className="h-8">
                    Handoff bundle
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        <section
          className={`rounded-md border border-border/60 bg-card/25 p-4 ${hidePilotPlanning ? "hidden" : ""}`}
          aria-label="Pilot funnel summary"
          aria-hidden={hidePilotPlanning}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                <BriefcaseBusiness className="h-3.5 w-3.5" strokeWidth={1.8} />
                Pilot funnel summary
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground max-w-3xl">
                Browser-local view of all outreach candidates. It helps plan the manual batch without sending
                messages, updating CRM, or changing the Markdown scorecard automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPilotWorkspaceExportMode("human");
                  setPilotWorkspaceExportOpen(true);
                }}
                className="h-7"
              >
                Open pilot export
              </Button>
              <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                {allPilotProspects.length} candidates
              </span>
              <span className="inline-flex rounded-[5px] bg-[hsl(var(--tint-amber)/0.13)] px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-amber-fg))] ring-1 ring-inset ring-[hsl(var(--tint-amber)/0.22)]">
                browser-local
              </span>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-md border border-border/50 bg-background/35 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                All candidates
              </div>
              <div className="mt-1 font-mono text-[18px] text-foreground">{allPilotProspects.length}</div>
            </div>
            {LOCAL_SERVICE_PILOT_STATUS_ORDER.map((status) => (
              <div key={status} className="rounded-md border border-border/50 bg-background/35 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  {LOCAL_SERVICE_PILOT_STATUS_LABELS[status]}
                </div>
                <div className="mt-1 font-mono text-[18px] text-foreground">{pilotFunnelCounts[status]}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-md border border-border/50 bg-background/35 px-3 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  <Search className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Outreach list filters
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground max-w-3xl">
                  Narrow the manual pilot list by service or status, then choose which scorecard columns stay visible.
                  These controls only change the browser view.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  Filtered candidates: {filteredPilotFunnelRows.length}
                </span>
                {pilotFunnelFiltersActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPilotFunnelServiceFilter("all");
                      setPilotFunnelStatusFilter("all");
                    }}
                    className="h-7"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.58fr)]">
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Service filter
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={pilotFunnelServiceFilter === "all" ? "default" : "secondary"}
                      onClick={() => setPilotFunnelServiceFilter("all")}
                      className="h-7"
                    >
                      All services
                    </Button>
                    {LOCAL_SERVICE_DEMO_TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        size="sm"
                        variant={pilotFunnelServiceFilter === template.id ? "default" : "secondary"}
                        onClick={() => setPilotFunnelServiceFilter(template.id)}
                        className="h-7"
                      >
                        {template.title}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Status filter
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={pilotFunnelStatusFilter === "all" ? "default" : "secondary"}
                      onClick={() => setPilotFunnelStatusFilter("all")}
                      className="h-7"
                    >
                      All statuses
                    </Button>
                    {LOCAL_SERVICE_PILOT_STATUS_ORDER.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={pilotFunnelStatusFilter === status ? "default" : "secondary"}
                        onClick={() => setPilotFunnelStatusFilter(status)}
                        className="h-7"
                      >
                        {LOCAL_SERVICE_PILOT_STATUS_LABELS[status]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border/50 bg-card/25 px-3 py-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Column settings
                </div>
                <div className="mt-2 grid gap-2">
                  {(Object.keys(LOCAL_SERVICE_PILOT_COLUMN_LABELS) as LocalServicePilotColumnKey[]).map((column) => (
                    <button
                      key={column}
                      type="button"
                      aria-pressed={pilotFunnelColumns[column]}
                      onClick={() =>
                        setPilotFunnelColumns((prev) => ({
                          ...prev,
                          [column]: !prev[column],
                        }))
                      }
                      className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/35 px-3 py-2 text-left text-[12px] text-foreground transition-smooth hover:bg-card/40"
                    >
                      <span>{LOCAL_SERVICE_PILOT_COLUMN_LABELS[column]}</span>
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-[5px] ring-1 ring-inset ${
                          pilotFunnelColumns[column]
                            ? "bg-[hsl(var(--tint-mint)/0.12)] text-[hsl(var(--tint-mint-fg))] ring-[hsl(var(--tint-mint)/0.22)]"
                            : "bg-secondary/45 text-muted-foreground ring-border/50"
                        }`}
                      >
                        {pilotFunnelColumns[column] && <Check className="h-3 w-3" strokeWidth={2} />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Filtered outreach list
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    Pick a company here to load it into the selected service scorecard action.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  View only, no send
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {filteredPilotFunnelRows.length === 0 ? (
                  <div className="rounded-md border border-border/50 bg-background/35 px-3 py-3 text-[12px] text-muted-foreground">
                    No candidates match these filters. Clear filters to return to the full outreach list.
                  </div>
                ) : (
                  filteredPilotFunnelRows.map((row) => (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => {
                        onSelectService(row.serviceId);
                        setPilotWorkspaceState((prev) => ({
                          ...prev,
                          selectedProspectByService: {
                            ...prev.selectedProspectByService,
                            [row.serviceId]: row.prospect.id,
                          },
                        }));
                      }}
                      className="rounded-md border border-border/50 bg-background/35 px-3 py-2.5 text-left transition-smooth hover:bg-card/40"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-foreground">{row.prospect.company}</span>
                        <span className="rounded-[5px] bg-secondary/45 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {row.prospect.segment}
                        </span>
                        {pilotFunnelColumns.status && (
                          <span className="rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-0.5 text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                            {row.statusLabel}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
                        {pilotFunnelColumns.service && (
                          <div className="rounded-[5px] bg-card/30 px-2 py-1.5">
                            <span className="text-muted-foreground">Service: </span>
                            <span className="text-foreground">{row.serviceTitle}</span>
                          </div>
                        )}
                        {pilotFunnelColumns.channelFit && (
                          <div className="rounded-[5px] bg-card/30 px-2 py-1.5">
                            <span className="text-muted-foreground">Channel fit: </span>
                            <span className="text-foreground">{row.prospect.channelFit}</span>
                          </div>
                        )}
                        {pilotFunnelColumns.nextStep && (
                          <div className="rounded-[5px] bg-card/30 px-2 py-1.5 sm:col-span-2">
                            <span className="text-muted-foreground">Next step: </span>
                            <span className="text-foreground">{row.prospect.nextStep}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div
            className="mt-3 rounded-md border border-border/50 bg-background/35 px-3 py-3"
            aria-label="First 10 contacts workspace"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  <PhoneCall className="h-3.5 w-3.5" strokeWidth={1.8} />
                  First 10 contacts workspace
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground max-w-3xl">
                  Browser-local worksheet for the first real Tashkent pilot attempts. It records proof posture only:
                  channel checked, manual send, reply/rejection, discovery call, demo booking, and pilot candidate.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setFounderBatchReviewMode("human");
                    setFounderBatchReviewOpen(true);
                  }}
                  className="h-7"
                >
                  Open batch review
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onCopyText(founderContactWorkspaceText, "Founder contact workspace copied")}
                  className="h-7"
                >
                  Copy founder workspace
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
                  className="h-7"
                >
                  Open founder execution log
                </Button>
                <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  Proof progress {founderProofProgress}
                </span>
                <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  Manual-only worksheet
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
              {[
                { label: "Channel checked", value: `${founderContactCounts.channelChecked}/10` },
                { label: "Manual sent", value: `${founderContactCounts.manualMessageSent}/10` },
                { label: "Replies / rejections", value: `${founderContactCounts.repliesOrRejections}/3` },
                { label: "Discovery calls", value: `${founderContactCounts.discoveryCalls}/1` },
                { label: "Demos booked", value: `${founderContactCounts.demosBooked}/1` },
                { label: "Pilot candidates", value: `${founderContactCounts.pilotCandidates}/1` },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-border/50 bg-card/25 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    {item.label}
                  </div>
                  <div className="mt-1 font-mono text-[18px] text-foreground">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Pilot ops today
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground max-w-3xl">
                    One-screen execution queue for the next real manual pilot action. It tells the operator which
                    account to handle, what to do outside the shell, and which proof marker to update afterward.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onCopyText(pilotOpsTodayHandoffText, "Pilot ops today copied")}
                    className="h-7"
                  >
                    Copy pilot ops handoff
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPilotOpsConfirmationOpen(true)}
                    className="h-7"
                  >
                    Open ops confirmation
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
                    className="h-7"
                  >
                    Open outreach execution pack
                  </Button>
                  <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    local_services_pilot_ops_today
                  </span>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-[11px] lg:grid-cols-4">
                <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                  <span className="text-muted-foreground">Current account</span>
                  <span className="ml-2 font-medium text-foreground">
                    {pilotOpsTodayRow ? pilotOpsTodayRow.prospect.company : "No account selected"}
                  </span>
                </div>
                <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                  <span className="text-muted-foreground">Service lane</span>
                  <span className="ml-2 font-medium text-foreground">
                    {pilotOpsTodayRow ? pilotOpsTodayRow.serviceTitle : "No service lane"}
                  </span>
                </div>
                <div className="rounded-[5px] bg-background/35 px-2 py-1.5 lg:col-span-2">
                  <span className="text-muted-foreground">Next manual action</span>
                  <span className="ml-2 font-medium text-foreground">{pilotOpsTodayAction}</span>
                </div>
                <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                  <span className="text-muted-foreground">Proof to capture</span>
                  <span className="ml-2 font-mono text-[10px] text-foreground">{pilotOpsTodayProof}</span>
                </div>
                <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                  <span className="text-muted-foreground">Batch progress</span>
                  <span className="ml-2 font-medium text-foreground">{founderProofProgress}</span>
                </div>
                <div className="rounded-[5px] bg-background/35 px-2 py-1.5 lg:col-span-2">
                  <span className="text-muted-foreground">Owner next step</span>
                  <span className="ml-2 font-medium text-foreground">
                    {pilotOpsTodayRow ? pilotOpsTodayRow.prospect.nextStep : "Load a target from the outreach list."}
                  </span>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-border/50 bg-background/30 px-3 py-2.5">
                <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Pilot proof update rail
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                      Browser-local shortcut for the current account only. Use it after the real manual action, then
                      reopen ops confirmation or batch review before a continue/stop decision.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    local_services_pilot_proof_update_rail
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pilotOpsProofRailActions.map((action) => (
                    <Button
                      key={action.label}
                      size="sm"
                      variant={action.active || action.recommended ? "default" : "secondary"}
                      onClick={action.onClick}
                      className="h-7"
                    >
                      {action.recommended ? "Recommended: " : ""}
                      {action.label}
                      <span className="ml-1.5 text-[10px] opacity-75">{action.stateLabel}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
              <div className="rounded-md border border-border/50 bg-card/25 px-3 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      First 10 manual contacts
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                      Mark only what happened outside the product. These buttons update browser-local state and activity
                      log only.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    No outbound side effect
                  </span>
                </div>

                <div className="mt-3 grid gap-2">
                  {founderContactRows.map((row, index) => (
                    <div key={row.key} className="rounded-md border border-border/50 bg-background/35 px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-secondary/45 px-1.5 font-mono text-[10px] text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="text-[12px] font-semibold text-foreground">{row.prospect.company}</span>
                        <span className="rounded-[5px] bg-secondary/45 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {row.serviceTitle}
                        </span>
                        <span className="rounded-[5px] bg-card/45 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {row.prospect.segment}
                        </span>
                        <span className="ml-auto rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-0.5 text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                          {row.proofStatus}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-[11px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                        <div className="rounded-[5px] bg-card/30 px-2 py-1.5">
                          <span className="text-muted-foreground">Next action: </span>
                          <span className="text-foreground">{row.prospect.nextStep}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              ["channelChecked", row.channelChecked],
                              ["manualMessageSent", row.manualMessageSent],
                              ["discoveryCallCompleted", row.discoveryCallCompleted],
                              ["demoBooked", row.demoBooked],
                              ["pilotCandidate", row.pilotCandidate],
                            ] as [LocalServiceFounderContactField, boolean][]
                          ).map(([field, checked]) => (
                            <Button
                              key={field}
                              size="sm"
                              variant={checked ? "default" : "secondary"}
                              onClick={() => updateFounderContactProof(row, field, !checked)}
                              className="h-7"
                            >
                              {LOCAL_SERVICE_FOUNDER_CONTACT_FIELD_LABELS[field]}
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant={row.status === "reply_received" ? "default" : "secondary"}
                            onClick={() => updatePilotWorkspaceStatusForTarget(row, "reply_received")}
                            className="h-7"
                          >
                            Reply
                          </Button>
                          <Button
                            size="sm"
                            variant={row.status === "rejected_for_now" ? "default" : "secondary"}
                            onClick={() => updatePilotWorkspaceStatusForTarget(row, "rejected_for_now")}
                            className="h-7"
                          >
                            Rejected
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-border/50 bg-card/25 px-3 py-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Pilot proof checklist
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  Stop building if this list does not move after 10 targeted manual contacts. Continue only when real
                  owner pain appears.
                </p>
                <div className="mt-3 grid gap-2">
                  {founderProofChecklist.map((item) => {
                    const ProofIcon = item.done ? CheckCircle2 : Clock;
                    return (
                      <div key={item.label} className="rounded-md border border-border/50 bg-background/35 px-3 py-2">
                        <div className="flex items-start gap-2">
                          <ProofIcon
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                              item.done ? "text-[hsl(var(--tint-mint-fg))]" : "text-muted-foreground"
                            }`}
                            strokeWidth={1.8}
                          />
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-foreground">{item.label}</div>
                            <div className="mt-1 font-mono text-[10px] text-muted-foreground">{item.status}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-md border border-border/50 bg-background/35 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      Stop / Continue decision gate
                    </span>
                    <span
                      className={`ml-auto rounded-[5px] px-2 py-0.5 font-mono text-[10px] ring-1 ring-inset ${
                        founderDecisionGate.tone === "continue"
                          ? "bg-[hsl(var(--tint-mint)/0.12)] text-[hsl(var(--tint-mint-fg))] ring-[hsl(var(--tint-mint)/0.22)]"
                          : founderDecisionGate.tone === "stop"
                            ? "bg-[hsl(var(--destructive)/0.10)] text-destructive ring-[hsl(var(--destructive)/0.22)]"
                            : "bg-secondary/45 text-muted-foreground ring-border/60"
                      }`}
                    >
                      {founderDecisionGate.verdictLabel}
                    </span>
                  </div>
                  <div className="mt-2 text-[12px] font-semibold text-foreground">{founderDecisionGate.posture}</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    {founderDecisionGate.action}
                  </p>
                  <div className="mt-2 grid gap-2 text-[11px]">
                    <div className="rounded-[5px] bg-card/30 px-2 py-1.5">
                      <span className="text-muted-foreground">Platform frame: </span>
                      <span className="text-foreground">
                        NEWO-style AI employee platform for local service categories, validated through
                        operator-approved pilots.
                      </span>
                    </div>
                    <div className="rounded-[5px] bg-card/30 px-2 py-1.5">
                      <span className="text-muted-foreground">Target lane: </span>
                      <span className="text-foreground">{founderDecisionGate.targetLane}</span>
                    </div>
                    <div className="rounded-[5px] bg-card/30 px-2 py-1.5">
                      <span className="text-muted-foreground">Proof summary: </span>
                      <span className="text-foreground">{founderDecisionGate.proofSummary}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-md border border-border/50 bg-background/35 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      Category pilot score
                    </span>
                    <span className="ml-auto rounded-[5px] bg-secondary/45 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      No category expansion without proof
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    Ranks AC, plumbing, cleaning, and measurement using the same manual proof markers as the first
                    batch, so category strategy follows real operator demand.
                  </p>
                  {leadingCategoryPilotScore ? (
                    <div className="mt-2 rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1.5 text-[11px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                      <span className="font-semibold">Leading category: </span>
                      <span>
                        {leadingCategoryPilotScore.serviceTitle} / score {leadingCategoryPilotScore.score} /{" "}
                        {leadingCategoryPilotScore.signalLabel}
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-2">
                    {categoryPilotScores.map((score) => (
                      <div key={score.serviceId} className="rounded-md border border-border/50 bg-card/25 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-secondary/45 px-1.5 font-mono text-[10px] text-muted-foreground">
                            #{score.rank}
                          </span>
                          <span className="text-[12px] font-semibold text-foreground">{score.serviceTitle}</span>
                          <span className="ml-auto rounded-[5px] bg-secondary/45 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                            score {score.score}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 text-[11px]">
                          <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                            <span className="text-muted-foreground">Signal: </span>
                            <span className="text-foreground">{score.signalLabel}</span>
                          </div>
                          <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                            <span className="text-muted-foreground">Proof: </span>
                            <span className="text-foreground">{score.proofSummary}</span>
                          </div>
                          <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                            <span className="text-muted-foreground">Next: </span>
                            <span className="text-foreground">{score.nextAction}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          Leading category action layer
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                          Converts the leading score into the next manual batch, discovery questions, pilot setup
                          checklist, and integration hold.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          onSelectService(leadingCategoryActionLayer.serviceId);
                          setPilotFunnelServiceFilter(leadingCategoryActionLayer.serviceId);
                        }}
                        className="h-7"
                      >
                        Focus leading category
                      </Button>
                    </div>
                    <div className="mt-3 rounded-[5px] bg-background/35 px-2 py-1.5 text-[11px]">
                      <span className="text-muted-foreground">Action: </span>
                      <span className="text-foreground">{leadingCategoryActionLayer.action}</span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      <div className="rounded-md border border-border/50 bg-background/35 px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          Next manual batch
                        </div>
                        <div className="mt-2 grid gap-1.5 text-[11px] text-muted-foreground">
                          {leadingCategoryActionLayer.nextManualBatch.map((item) => (
                            <div key={`${item.company}:${item.statusLabel}`} className="rounded-[5px] bg-card/30 px-2 py-1.5">
                              <span className="font-semibold text-foreground">{item.company}</span>
                              <span> / {item.segment} / </span>
                              <span>{item.statusLabel}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/50 bg-background/35 px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          Discovery questions
                        </div>
                        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
                          {leadingCategoryActionLayer.discoveryQuestions.slice(0, 3).map((question) => (
                            <li key={question}>{question}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-md border border-border/50 bg-background/35 px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          Pilot setup checklist
                        </div>
                        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
                          {leadingCategoryActionLayer.pilotSetupChecklist.slice(0, 3).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-md border border-border/50 bg-background/35 px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          Integration hold
                        </div>
                        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
                          {leadingCategoryActionLayer.integrationHold.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-3 rounded-md border border-border/50 bg-background/35 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          Pilot setup readiness
                        </span>
                        <span
                          className={`ml-auto rounded-[5px] px-2 py-0.5 font-mono text-[10px] ring-1 ring-inset ${
                            leadingCategoryPilotReadiness.readyToPilot
                              ? "bg-[hsl(var(--tint-mint)/0.12)] text-[hsl(var(--tint-mint-fg))] ring-[hsl(var(--tint-mint)/0.22)]"
                              : "bg-[hsl(var(--tint-amber)/0.12)] text-[hsl(var(--tint-amber-fg))] ring-[hsl(var(--tint-amber)/0.24)]"
                          }`}
                        >
                          {leadingCategoryPilotReadiness.progressLabel}
                        </span>
                      </div>
                      <div className="mt-2 text-[12px] font-semibold text-foreground">
                        {leadingCategoryPilotReadiness.readinessLabel}
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                        {leadingCategoryPilotReadiness.paidPilotGate}
                      </p>
                      <div className="mt-2 rounded-[5px] bg-card/30 px-2 py-1.5 text-[11px]">
                        <span className="text-muted-foreground">Next action: </span>
                        <span className="text-foreground">{leadingCategoryPilotReadiness.nextAction}</span>
                      </div>
                      <div className="mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-3">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                              Readiness action plan
                            </div>
                            <div className="mt-2 grid gap-1.5 text-[11px]">
                              <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                                <span className="text-muted-foreground">Primary surface: </span>
                                <span className="text-foreground">{leadingCategoryReadinessActionPlan.primarySurface}</span>
                              </div>
                              <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                                <span className="text-muted-foreground">Primary action: </span>
                                <span className="text-foreground">{leadingCategoryReadinessActionPlan.primaryAction}</span>
                              </div>
                              <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                                <span className="text-muted-foreground">Operator script: </span>
                                <span className="text-foreground">{leadingCategoryReadinessActionPlan.operatorScript}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setReadinessProofMode("human");
                                setReadinessProofOpen(true);
                              }}
                              className="h-7"
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Open proof drawer
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setPaidPilotProposalPreviewMode("human");
                                setPaidPilotProposalPreviewOpen(true);
                              }}
                              className="h-7"
                            >
                              <BriefcaseBusiness className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Open proposal preview
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setProposalApprovalHandoffMode("human");
                                setProposalApprovalHandoffOpen(true);
                              }}
                              className="h-7"
                            >
                              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Open approval handoff
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setPilotKickoffGateMode("human");
                                setPilotKickoffGateOpen(true);
                              }}
                              className="h-7"
                            >
                              <CalendarCheck className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Open kickoff gate
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setDayOneOperatorRunSheetMode("human");
                                setDayOneOperatorRunSheetOpen(true);
                              }}
                              className="h-7"
                            >
                              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Open run sheet
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setDayOneRecapMode("human");
                                setDayOneRecapOpen(true);
                              }}
                              className="h-7"
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Open day-one recap
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => onOpenSetupWizard(leadingCategoryActionLayer.serviceId)}
                              className="h-7"
                            >
                              <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Continue setup/test path
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                onCopyText(
                                  formatLocalServiceReadinessActionPlanText(leadingCategoryReadinessActionPlan),
                                  leadingCategoryReadinessActionPlan.copyLabel,
                                )
                              }
                              className="h-7"
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Copy readiness action plan
                            </Button>
                          </div>
                        </div>
                        <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
                          {leadingCategoryReadinessActionPlan.noGo.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                              Proposal approval state
                            </div>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                              Browser-local decision for the paid-pilot proposal handoff. Kickoff stays blocked until
                              readiness is complete and this state is approved.
                            </p>
                          </div>
                          <span className="rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                            {leadingCategoryProposalApprovalLabel}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {LOCAL_SERVICE_PROPOSAL_APPROVAL_ACTIONS.map((action) => (
                            <Button
                              key={action.decision}
                              size="sm"
                              variant={
                                leadingCategoryProposalApprovalDecision === action.decision ? "default" : "secondary"
                              }
                              onClick={() => updateProposalApprovalDecision(action.decision)}
                              className="h-7"
                            >
                              {action.label}
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateProposalApprovalDecision("not_reviewed")}
                            className="h-7"
                          >
                            Reset proposal approval
                          </Button>
                          <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground">
                            proposalApprovalByService
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                              Kickoff decision state
                            </div>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                              Browser-local decision for moving the approved paid-pilot handoff into the day-one run
                              sheet. It does not activate phone, messaging, CRM, analytics, billing, booking, or sends.
                            </p>
                          </div>
                          <span className="rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                            {leadingCategoryKickoffDecisionLabel}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {LOCAL_SERVICE_KICKOFF_DECISION_ACTIONS.map((action) => (
                            <Button
                              key={action.decision}
                              size="sm"
                              variant={leadingCategoryKickoffDecision === action.decision ? "default" : "secondary"}
                              onClick={() => updateKickoffDecision(action.decision)}
                              className="h-7"
                            >
                              {action.label}
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateKickoffDecision("not_reviewed")}
                            className="h-7"
                          >
                            Reset kickoff decision
                          </Button>
                          <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground">
                            kickoffDecisionByService
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                              Day-one outcome capture gate
                            </div>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                              Records the first operator-supervised request result for the leading category target
                              before manual weekly scorecard sync. This writes only `firstRequestOutcomeByProspectKey`.
                            </p>
                          </div>
                          <span className="rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                            {leadingCategoryFirstRequestOutcomeLabel}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-[11px] lg:grid-cols-3">
                          <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                            <span className="text-muted-foreground">Target</span>
                            <span className="ml-2 font-medium text-foreground">
                              {leadingCategoryOutcomeTargetRow
                                ? leadingCategoryOutcomeTargetRow.prospect.company
                                : "No day-one target selected"}
                            </span>
                          </div>
                          <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                            <span className="text-muted-foreground">Weekly scorecard sync gate</span>
                            <span className="ml-2 font-medium text-foreground">{leadingCategoryWeeklyScorecardSyncGate}</span>
                          </div>
                          <div className="rounded-[5px] bg-background/35 px-2 py-1.5">
                            <span className="text-muted-foreground">Weekly sync reviewed</span>
                            <span className="ml-2 font-medium text-foreground">
                              {leadingCategoryWeeklyScorecardSyncReviewed ? "Recorded" : "Not recorded"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_ACTIONS.map((action) => (
                            <Button
                              key={action.outcome}
                              size="sm"
                              variant={leadingCategoryFirstRequestOutcome === action.outcome ? "default" : "secondary"}
                              onClick={() => updateLeadingCategoryFirstRequestOutcome(action.outcome)}
                              disabled={!leadingCategoryOutcomeTargetRow}
                              className="h-7"
                            >
                              {action.label}
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateLeadingCategoryFirstRequestOutcome("not_recorded")}
                            disabled={!leadingCategoryOutcomeTargetRow}
                            className="h-7"
                          >
                            Reset day-one outcome
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setWeeklyScorecardSyncMode("human");
                              setWeeklyScorecardSyncOpen(true);
                            }}
                            className="h-7"
                          >
                            <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                            Open weekly sync checklist
                          </Button>
                          <Button
                            size="sm"
                            variant={leadingCategoryWeeklyScorecardSyncReviewed ? "default" : "secondary"}
                            onClick={() => updateWeeklyScorecardSyncReviewed(true)}
                            disabled={!canRecordLeadingCategoryWeeklySync}
                            className="h-7"
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                            Record weekly sync reviewed
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateWeeklyScorecardSyncReviewed(false)}
                            className="h-7"
                          >
                            Reset weekly sync review
                          </Button>
                          <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground">
                            firstRequestOutcomeByProspectKey
                          </span>
                          <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground">
                            manual_weekly_scorecard_sync_gate
                          </span>
                          <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground">
                            weeklyScorecardSyncReviewedByService
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {leadingCategoryPilotReadiness.checklist.map((item) => {
                          const ReadinessIcon = item.done ? CheckCircle2 : Clock;
                          return (
                            <div key={item.label} className="rounded-[5px] bg-card/30 px-2 py-1.5">
                              <div className="flex items-start gap-2">
                                <ReadinessIcon
                                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                    item.done ? "text-[hsl(var(--tint-mint-fg))]" : "text-muted-foreground"
                                  }`}
                                  strokeWidth={1.8}
                                />
                                <div className="min-w-0">
                                  <div className="text-[11px] font-semibold text-foreground">{item.label}</div>
                                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.status}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 rounded-[5px] bg-secondary/35 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        Paid pilot gate: no selling, phone activation, Telegram/WhatsApp activation, CRM sync, calendar
                        booking, analytics sync, billing, or customer send until every readiness gate is complete.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-md bg-secondary/35 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  Manual execution rule: this workspace does not send outreach, create bookings, write CRM, sync
                  analytics, bill, or mutate Markdown docs.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-border/50 bg-background/35 px-3 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Pilot execution checklist
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground max-w-3xl">
                  A 14-day pilot operating loop for founder/operator validation. It starts with the browser-local
                  dry-run gate and mirrors existing statuses without sending outreach, writing CRM, or mutating docs.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  Pilot checklist progress {pilotExecutionProgress}
                </span>
                <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {dryRunGateLabel}
                </span>
                <span
                  className={`inline-flex rounded-[5px] px-2 py-1 font-mono text-[10px] ring-1 ring-inset ${
                    manualLaunchGateLabel === "Manual launch ready"
                      ? "bg-[hsl(var(--tint-mint)/0.12)] text-[hsl(var(--tint-mint-fg))] ring-[hsl(var(--tint-mint)/0.22)]"
                      : "bg-[hsl(var(--tint-amber)/0.12)] text-[hsl(var(--tint-amber-fg))] ring-[hsl(var(--tint-amber)/0.24)]"
                  }`}
                >
                  {manualLaunchGateLabel}
                </span>
                <span className="inline-flex rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                  Founder/operator validation
                </span>
                <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  No autonomous send
                </span>
                <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  Manual activity log {pilotActivityLog.length}
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              {pilotExecutionChecklist.map((step, index) => {
                const StepIcon = step.done ? CheckCircle2 : Clock;
                return (
                  <div key={step.label} className="rounded-md border border-border/50 bg-card/25 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-secondary/45 font-mono text-[10px] text-muted-foreground">
                        {index + 1}
                      </span>
                      <StepIcon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          step.done ? "text-[hsl(var(--tint-mint-fg))]" : "text-muted-foreground"
                        }`}
                        strokeWidth={1.8}
                      />
                    </div>
                    <div className="mt-2 text-[12px] font-semibold text-foreground">{step.label}</div>
                    <div className="mt-1 rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                      {step.status}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{step.detail}</p>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      Owner: {step.owner}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPilotLaunchPacketMode("human");
                  setPilotLaunchPacketOpen(true);
                }}
                className="h-7"
              >
                Open launch packet
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDiscoveryCallPrepMode("human");
                  setDiscoveryCallPrepOpen(true);
                }}
                className="h-7"
              >
                Open discovery prep
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDayOneSetupMode("human");
                  setDayOneSetupOpen(true);
                }}
                className="h-7"
              >
                Open day-one setup
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenPath(LOCAL_SERVICES_PILOT_RUNBOOK_PATH)}
                className="h-7"
              >
                Open pilot runbook
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
                className="h-7"
              >
                Open outreach execution pack
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
                className="h-7"
              >
                Open pilot scorecard
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
                className="h-7"
              >
                Open founder execution log
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
            <div className="rounded-md bg-background/35 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Next manual batch
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {nextManualBatch.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSelectService(item.serviceId);
                      setPilotWorkspaceState((prev) => ({
                        ...prev,
                        selectedProspectByService: {
                          ...prev.selectedProspectByService,
                          [item.serviceId]: item.prospect.id,
                        },
                      }));
                    }}
                    className="rounded-md border border-border/50 bg-card/25 px-3 py-2 text-left transition-smooth hover:bg-card/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-semibold text-foreground">{item.prospect.company}</span>
                      <span className="rounded-[5px] bg-secondary/45 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {item.statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {item.serviceTitle} · {item.prospect.channelFit}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-background/35 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Manual execution rule
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                Treat these statuses as operator notes only. Contacted manually means a human contacted the
                company outside the shell; the product did not send anything.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenPath(LOCAL_SERVICES_OUTREACH_LIST_PATH)}
                  className="h-7"
                >
                  Open outreach list
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
                  className="h-7"
                >
                  Open outreach execution pack
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
                  className="h-7"
                >
                  Open pilot scorecard
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
                  className="h-7"
                >
                  Open founder execution log
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onCopyText(pilotActivityLogText, "Copy activity log")}
                  className="h-7"
                >
                  Copy activity log
                </Button>
              </div>
              <div className="mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Manual activity log
                  </div>
                  <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    local_services_manual_activity_log
                  </span>
                  <span className="inline-flex rounded-[5px] bg-[hsl(var(--tint-amber)/0.12)] px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-amber-fg))] ring-1 ring-inset ring-[hsl(var(--tint-amber)/0.24)]">
                    No external side effects
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                  Last manual action:{" "}
                  {latestPilotActivity
                    ? `${latestPilotActivity.label} - ${latestPilotActivity.value} for ${
                        latestPilotActivity.company ?? latestPilotActivity.serviceTitle
                      }`
                    : "No manual activity recorded yet."}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Recorded in browser only. The log mirrors scorecard and metric actions; it does not send outreach,
                  write CRM, create calendar events, sync analytics, bill, or mutate Markdown docs.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="rounded-lg border border-border/60 bg-card/35 p-4"
          aria-label={`${selectedTemplate.title} local service detail`}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill tone={selectedTemplate.tone} size="sm">
                  Selected service
                </Pill>
                <Pill tone="slate" size="sm">
                  {selectedTemplate.channel}
                </Pill>
                <Pill tone="amber" size="sm">
                  Operator-approved booking
                </Pill>
              </div>
              <h3 className="mt-2 text-[15px] font-semibold tracking-tight text-foreground">
                {selectedTemplate.title}
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground max-w-3xl">
                {selectedTemplate.detail.sampleInput}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onCopyPayload(selectedTemplate)} className="h-8">
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                Copy dispatch payload
              </Button>
              <Button size="sm" variant="secondary" onClick={onOpenDispatchDrawer} className="h-8">
                Open dispatch drawer
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setIntakeEvidenceMode("human");
                  setIntakeEvidenceOpen(true);
                }}
                className="h-8"
              >
                Open intake evidence
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onOpenPath(selectedTemplate.evidencePath)} className="h-8">
                Evidence link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenPath(selectedTemplate.bundlePath)} className="h-8">
                Handoff bundle
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <section className="rounded-md bg-background/35 px-3 py-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    <PhoneCall className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Phone intake
                  </div>
                  <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground">
                    {selectedTemplate.detail.phoneIntake.map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-md bg-background/35 px-3 py-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Pricing and slot inputs
                  </div>
                  <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground">
                    {selectedTemplate.detail.estimateInputs.map((item) => (
                      <li key={item} className="font-mono text-[11px] text-foreground">
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <section className="rounded-md bg-background/35 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Approval policy
                  </div>
                  <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground">
                    {selectedTemplate.detail.approvalPolicy.map((item) => (
                      <li key={item} className="flex gap-2">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-md bg-background/35 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      Evidence output
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIntakeEvidenceMode("human");
                        setIntakeEvidenceOpen(true);
                      }}
                      className="h-7"
                    >
                      Transcript + evidence
                    </Button>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground">
                    {selectedTemplate.detail.evidenceOutput.map((item) => (
                      <li key={item} className="flex gap-2">
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section className="rounded-md bg-background/35 px-3 py-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  <MessageSquareText className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Telegram intake prototype
                </div>
                <p className="mt-2 rounded-md border border-border/50 bg-card/25 px-3 py-2 text-[12px] leading-relaxed text-foreground">
                  {selectedTemplate.detail.telegramIntake.inboundMessage}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      Normalized fields
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedTemplate.detail.telegramIntake.normalizedFields.map((field) => (
                        <span
                          key={field}
                          className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      Reply draft
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                      {selectedTemplate.detail.telegramIntake.replyDraft}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-md bg-background/35 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    <BriefcaseBusiness className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Pilot readiness
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenPath(LOCAL_SERVICES_PILOT_OFFER_PATH)}
                      className="h-7"
                    >
                      Open offer doc
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenPath(LOCAL_SERVICES_DEMO_SCRIPT_PATH)}
                      className="h-7"
                    >
                      Open demo script
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenPath(LOCAL_SERVICES_DEMO_RECORDING_CHECKLIST_PATH)}
                      className="h-7"
                    >
                      Open recording checklist
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenPath(LOCAL_SERVICES_OUTREACH_LIST_PATH)}
                      className="h-7"
                    >
                      Open outreach list
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
                      className="h-7"
                    >
                      Open outreach execution pack
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
                      className="h-7"
                    >
                      Open pilot scorecard
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
                      className="h-7"
                    >
                      Open founder execution log
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                        One-page offer
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                        {selectedTemplate.detail.pilotKit.offerSummary}
                      </p>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                        Outreach focus
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedTemplate.detail.pilotKit.outreachFocus.map((item) => (
                          <span
                            key={item}
                            className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      90-second demo script
                    </div>
                    <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground">
                      {selectedTemplate.detail.pilotKit.demoScript.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Launch checklist
                  </div>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {selectedTemplate.detail.pilotKit.launchChecklist.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 rounded-md border border-border/50 bg-card/25 px-3 py-2.5 text-[12px] leading-relaxed text-foreground"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                        <UserRoundCog className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Agent setup / training state
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                        7-minute setup path before any live channel is connected.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                        {setupReadyForPilot ? "Ready for pilot test" : `Setup progress ${setupWizardProgress}`}
                      </span>
                      <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        Saved setup state
                      </span>
                      <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        Test call progress {testCallProgress}
                      </span>
                      {testCallPassed && (
                        <span className="inline-flex rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                          Test call passed
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAgentSetupMode("human");
                          setAgentSetupOpen(true);
                        }}
                        className="h-8"
                      >
                        <UserRoundCog className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                        Open setup checklist
                      </Button>
                    </div>
                  </div>
                  <ol className="mt-3 grid gap-2 md:grid-cols-5">
                    {agentSetupBrief.setupSteps.map((step, index) => (
                      <li
                        key={step.label}
                        className={`rounded-md px-3 py-2.5 ${
                          setupStepCompletion[step.id]
                            ? "bg-[hsl(var(--tint-mint)/0.08)] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.2)]"
                            : "bg-background/35"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                            {setupStepCompletion[step.id] ? <Check className="h-3 w-3" strokeWidth={2} /> : index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                              {step.label}
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                              {setupStepCompletion[step.id] ? "Complete" : step.status}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["Business profile", "Knowledge sources", "Agent behavior", "Test call/message", "No channel activation"].map((item) => (
                      <span
                        key={item}
                        className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                        Pilot metrics
                      </div>
                      <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        {currentMetricStatusLabel}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPilotMetricsTrackerMode("human");
                        setPilotMetricsTrackerOpen(true);
                      }}
                      className="h-7"
                    >
                      Open metrics tracker
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPilotDailyLogMode("human");
                        setPilotDailyLogOpen(true);
                      }}
                      className="h-7"
                    >
                      Open daily log
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPilotWeekOneReviewMode("human");
                        setPilotWeekOneReviewOpen(true);
                      }}
                      className="h-7"
                    >
                      Open week-one review
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPilotEvidencePackMode("human");
                        setPilotEvidencePackOpen(true);
                      }}
                      className="h-7"
                    >
                      Open evidence pack
                    </Button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedTemplate.detail.pilotKit.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-md border border-border/50 bg-card/25 px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          {metric.label}
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          Baseline: <span className="text-foreground">{metric.baseline}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Target: <span className="text-foreground">{metric.target}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 rounded-md border border-border/50 bg-card/25 px-3 py-2.5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          Metric capture state
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                          Browser-local pilot metrics only. Manual capture, no analytics sync, no CRM write.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {LOCAL_SERVICE_PILOT_METRIC_STATUS_ACTIONS.map((action) => (
                          <Button
                            key={action.status}
                            size="sm"
                            variant={currentMetricStatus === action.status ? "default" : "secondary"}
                            onClick={() => updatePilotMetricStatus(action.status)}
                            className="h-7"
                          >
                            {action.label}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updatePilotMetricStatus("not_started")}
                          className="h-7"
                        >
                          Reset metrics
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={`mt-3 rounded-md border border-border/50 bg-card/25 px-3 py-3 ${
                    hidePilotPlanning ? "hidden" : ""
                  }`}
                  aria-hidden={hidePilotPlanning}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Pilot outreach wizard
                    </div>
                    <span className="inline-flex rounded-[5px] bg-[hsl(var(--tint-amber)/0.13)] px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-amber-fg))] ring-1 ring-inset ring-[hsl(var(--tint-amber)/0.22)]">
                      operator-approved
                    </span>
                  </div>
                  <div className="mt-3 rounded-md border border-border/50 bg-background/35 px-3 py-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          4-step outreach wizard
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                          Prepare the first contact in order, then stop for human confirmation before outreach.
                        </p>
                      </div>
                      <span className="inline-flex w-fit rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        no outbound send
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        Wizard progress
                      </span>
                      <span className="inline-flex rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1 font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                        {currentPilotStatus === "draft_ready"
                          ? "Ready for manual outreach recorded"
                          : "Awaiting operator confirmation"}
                      </span>
                    </div>
                    <ol className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {pilotWizardSteps.map((step, index) => (
                        <li key={step.label} className="rounded-md bg-card/30 px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-[hsl(var(--tint-violet)/0.14)] font-mono text-[10px] text-[hsl(var(--tint-violet-fg))] ring-1 ring-inset ring-[hsl(var(--tint-violet)/0.24)]">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                {step.label}
                              </div>
                              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                                {step.status}
                              </div>
                            </div>
                          </div>
                          <p className="mt-2 text-[12px] leading-relaxed text-foreground">{step.value}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="mt-3 rounded-md border border-border/50 bg-background/35 px-3 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          Pilot scorecard action
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                          Select a company from the outreach list, review the test message, then log a
                          scorecard draft. No outbound message is sent from this shell.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenPath(LOCAL_SERVICES_OUTREACH_LIST_PATH)}
                          className="h-7"
                        >
                          Open outreach list
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
                          className="h-7"
                        >
                          Open outreach execution pack
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
                          className="h-7"
                        >
                          Open pilot scorecard
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
                          className="h-7"
                        >
                          Open founder execution log
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          Selected company
                        </div>
                        <div className="mt-2 grid gap-2">
                          {outreachProspects.map((prospect) => {
                            const selected = prospect.id === selectedOutreachProspectId;
                            return (
                              <button
                                key={prospect.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => {
                                  setPilotWorkspaceState((prev) => ({
                                    ...prev,
                                    selectedProspectByService: {
                                      ...prev.selectedProspectByService,
                                      [selectedTemplate.id]: prospect.id,
                                    },
                                  }));
                                }}
                                className={`rounded-md border px-3 py-2 text-left transition-smooth ${
                                  selected
                                    ? "border-transparent bg-card/55 ring-1 ring-inset"
                                    : "border-border/50 bg-card/25 hover:bg-card/40"
                                }`}
                                style={
                                  selected
                                    ? {
                                        borderColor: `hsl(var(--tint-${selectedTemplate.tone}) / 0.34)`,
                                        ["--tw-ring-color" as const]: `hsl(var(--tint-${selectedTemplate.tone}) / 0.3)`,
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[12px] font-semibold text-foreground">
                                    {prospect.company}
                                  </span>
                                  <span className="rounded-[5px] bg-secondary/45 px-2 py-0.5 text-[10px] text-muted-foreground">
                                    {prospect.segment}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                                  {prospect.whyNow}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-md bg-card/25 px-3 py-2.5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                Test message preview
                              </div>
                              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                                Open the preview modal before any manual first contact.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPilotMessagePreviewOpen(true)}
                              className="h-8"
                            >
                              <MessageSquareText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Open preview modal
                            </Button>
                          </div>
                          <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                            {selectedTemplate.detail.pilotKit.outreachWizard.testMessage}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {[
                              "Preview test message",
                              "Confirm manually",
                              "Log outcome in scorecard",
                              "No outbound message sent",
                            ].map((item) => (
                              <span
                                key={item}
                                className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-md bg-card/25 px-3 py-2.5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                Operator confirmation summary
                              </div>
                              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                                Final check before a human sends anything outside the shell.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPilotOperatorConfirmationOpen(true)}
                              className="h-8"
                            >
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Open confirmation summary
                            </Button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={currentPilotStatus === "draft_ready" ? "secondary" : "default"}
                              onClick={recordReadyForManualOutreach}
                              className="h-8"
                            >
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Record ready for manual outreach
                            </Button>
                            <span className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground">
                              Local status only, no send
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-md border border-border/50 bg-background/35 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                Selected company
                              </div>
                              <div className="mt-1 text-[12px] text-foreground">
                                {pilotOperatorConfirmation.rows.find((row) => row.label === "Selected company")?.value}
                              </div>
                            </div>
                            <div className="rounded-md border border-border/50 bg-background/35 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                Status
                              </div>
                              <div className="mt-1 inline-flex rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1 text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                                Ready for manual outreach
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md bg-card/25 px-3 py-2.5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                AI analyst
                              </div>
                              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                                Suggested questions over the selected company, funnel state, and next manual step.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setPilotAnalystMode("human");
                                setPilotAnalystOpen(true);
                              }}
                              className="h-8"
                            >
                              <Sparkles className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                              Ask AI about pilot
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {pilotAnalystBrief.rows.slice(1, 5).map((row) => (
                              <div key={row.label} className="rounded-md border border-border/50 bg-background/35 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                  {row.label}
                                </div>
                                <div className="mt-1 text-[12px] leading-relaxed text-foreground">
                                  {row.value}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {["Best candidate", "Bottleneck", "Next message", "No external LLM call"].map((item) => (
                              <span
                                key={item}
                                className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-md bg-card/25 px-3 py-2.5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                Pilot workspace state
                              </div>
                              <div className="mt-1 inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground">
                                Saved in this browser
                              </div>
                            </div>
                            <span className="rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1 text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                              {currentPilotStatusLabel}
                            </span>
                          </div>
                          <dl className="mt-2 space-y-1.5 text-[11px]">
                            {scorecardDraftRows.map((row) => (
                              <div key={row.label} className="grid grid-cols-[132px_minmax(0,1fr)] gap-2">
                                <dt className="text-muted-foreground">{row.label}</dt>
                                <dd className="text-foreground">{row.value}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {LOCAL_SERVICE_PILOT_STATUS_ACTIONS.map((action) => (
                              <Button
                                key={action.status}
                                size="sm"
                                variant={currentPilotStatus === action.status ? "default" : "secondary"}
                                onClick={() => updatePilotWorkspaceStatus(action.status)}
                                className="h-7"
                              >
                                {action.label}
                              </Button>
                            ))}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updatePilotWorkspaceStatus("not_contacted")}
                              className="h-7"
                            >
                              Reset to not contacted
                            </Button>
                          </div>
                          <div className="mt-3 rounded-md border border-border/50 bg-background/35 px-3 py-2.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                  First request outcome
                                </div>
                                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                                  Manual outcome state after the first operator-supervised request. This records only
                                  `firstRequestOutcomeByProspectKey`; it does not create a booking, write CRM, or
                                  mutate the Markdown scorecard.
                                </p>
                              </div>
                              <span className="rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                                {currentFirstRequestOutcomeLabel}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {LOCAL_SERVICE_FIRST_REQUEST_OUTCOME_ACTIONS.map((action) => (
                                <Button
                                  key={action.outcome}
                                  size="sm"
                                  variant={currentFirstRequestOutcome === action.outcome ? "default" : "secondary"}
                                  onClick={() => updateFirstRequestOutcome(action.outcome)}
                                  className="h-7"
                                >
                                  {action.label}
                                </Button>
                              ))}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateFirstRequestOutcome("not_recorded")}
                                className="h-7"
                              >
                                Reset outcome
                              </Button>
                            </div>
                            <div className="mt-3 border-t border-border/45 pt-3">
                              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                Outcome chain summary
                              </div>
                              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                {outcomeChainSummary.map((item) => (
                                  <div key={item.label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-2 text-[11px]">
                                    <span className="text-muted-foreground">{item.label}</span>
                                    <span className="min-w-0 text-foreground">
                                      <span className="font-medium">{item.value}</span>
                                      <span className="block text-[10.5px] leading-relaxed text-muted-foreground">
                                        {item.detail}
                                      </span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="mt-3 border-t border-border/45 pt-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                    Week-one owner decision state
                                  </div>
                                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                                    Records only `weekOneOwnerDecisionByProspectKey` before the evidence pack. No
                                    billing change, CRM write, customer message, or autonomous pilot decision.
                                  </p>
                                </div>
                                <span className="rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                                  {currentWeekOneOwnerDecisionLabel}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {LOCAL_SERVICE_WEEK_ONE_OWNER_DECISION_ACTIONS.map((action) => (
                                  <Button
                                    key={action.decision}
                                    size="sm"
                                    variant={
                                      currentWeekOneOwnerDecision === action.decision ? "default" : "secondary"
                                    }
                                    onClick={() => updateWeekOneOwnerDecision(action.decision)}
                                    className="h-7"
                                  >
                                    {action.label}
                                  </Button>
                                ))}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateWeekOneOwnerDecision("not_recorded")}
                                  className="h-7"
                                >
                                  Reset owner decision
                                </Button>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {[
                                  "Continue / Pause / Stop",
                                  "weekOneOwnerDecisionByProspectKey",
                                  "week_one_owner_decision_to_evidence_pack",
                                  "No external action",
                                ].map((item) => (
                                  <span
                                    key={item}
                                    className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          {currentPilotStatus !== "not_contacted" && (
                            <p className="mt-2 rounded-md bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1.5 text-[11px] text-[hsl(var(--tint-mint-fg))]">
                              Pilot workspace state persisted locally. Sync it into the pilot scorecard only after manual review.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-md bg-background/35 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Customer confirmation draft
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenDispatchDrawer("customer")}
                    className="h-7"
                  >
                    Open customer drawer
                  </Button>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                  {selectedTemplate.detail.customerConfirmation}
                </p>
              </section>
            </div>

            <div className="space-y-3">
              <section className="rounded-md bg-background/35 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Master/operator handoff
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenDispatchDrawer("handoff")}
                    className="h-7"
                  >
                    Open handoff drawer
                  </Button>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                  {selectedTemplate.detail.operatorHandoff}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedTemplate.detail.handoffFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex rounded-[5px] bg-secondary/45 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </section>

              <section className="rounded-md bg-background/35 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                      Dispatch payload preview
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {selectedTemplate.ref} stays approval-gated before customer or master send.
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => onCopyPayload(selectedTemplate)} className="h-8">
                    <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                    Copy
                  </Button>
                </div>
                <div className="mt-3 rounded-md border border-border/60 bg-card/30 px-3 py-3">
                  <dl className="space-y-2 text-[11px]">
                    {Object.entries(selectedPayloadPreview.payload).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-[128px_minmax(0,1fr)] gap-3">
                        <dt className="font-mono text-muted-foreground truncate">{key}</dt>
                        <dd className="text-foreground break-words">{formatPayloadValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
      <LocalServicePilotWorkspaceExportDrawer
        open={pilotWorkspaceExportOpen}
        onOpenChange={setPilotWorkspaceExportOpen}
        exportView={pilotWorkspaceExport}
        mode={pilotWorkspaceExportMode}
        onModeChange={setPilotWorkspaceExportMode}
        onCopy={onCopyText}
        readyRecorded={selectedDraftReady}
        onRecordReady={recordReadyForManualOutreach}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={pilotMetricsTrackerOpen}
        onOpenChange={setPilotMetricsTrackerOpen}
        exportView={pilotMetricsTrackerExport}
        mode={pilotMetricsTrackerMode}
        onModeChange={setPilotMetricsTrackerMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={pilotDailyLogOpen}
        onOpenChange={setPilotDailyLogOpen}
        exportView={pilotDailyLogExport}
        mode={pilotDailyLogMode}
        onModeChange={setPilotDailyLogMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_PILOT_RUNBOOK_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={pilotWeekOneReviewOpen}
        onOpenChange={setPilotWeekOneReviewOpen}
        exportView={pilotWeekOneReviewExport}
        mode={pilotWeekOneReviewMode}
        onModeChange={setPilotWeekOneReviewMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_PILOT_RUNBOOK_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={pilotEvidencePackOpen}
        onOpenChange={setPilotEvidencePackOpen}
        exportView={pilotEvidencePackExport}
        mode={pilotEvidencePackMode}
        onModeChange={setPilotEvidencePackMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_PILOT_RUNBOOK_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={founderBatchReviewOpen}
        onOpenChange={setFounderBatchReviewOpen}
        exportView={founderBatchReviewExport}
        mode={founderBatchReviewMode}
        onModeChange={setFounderBatchReviewMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={pilotOpsConfirmationOpen}
        onOpenChange={setPilotOpsConfirmationOpen}
        exportView={pilotOpsConfirmationExport}
        mode={pilotOpsConfirmationMode}
        onModeChange={setPilotOpsConfirmationMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={readinessProofOpen}
        onOpenChange={setReadinessProofOpen}
        exportView={readinessProofExport}
        mode={readinessProofMode}
        onModeChange={setReadinessProofMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={paidPilotProposalPreviewOpen}
        onOpenChange={setPaidPilotProposalPreviewOpen}
        exportView={paidPilotProposalPreviewExport}
        mode={paidPilotProposalPreviewMode}
        onModeChange={setPaidPilotProposalPreviewMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={proposalApprovalHandoffOpen}
        onOpenChange={setProposalApprovalHandoffOpen}
        exportView={proposalApprovalHandoffExport}
        mode={proposalApprovalHandoffMode}
        onModeChange={setProposalApprovalHandoffMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={pilotKickoffGateOpen}
        onOpenChange={setPilotKickoffGateOpen}
        exportView={pilotKickoffGateExport}
        mode={pilotKickoffGateMode}
        onModeChange={setPilotKickoffGateMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_FOUNDER_EXECUTION_LOG_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={dayOneOperatorRunSheetOpen}
        onOpenChange={setDayOneOperatorRunSheetOpen}
        exportView={dayOneOperatorRunSheet}
        mode={dayOneOperatorRunSheetMode}
        onModeChange={setDayOneOperatorRunSheetMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => {
          setPilotDailyLogMode("human");
          setPilotDailyLogOpen(true);
        }}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={dayOneRecapOpen}
        onOpenChange={setDayOneRecapOpen}
        exportView={dayOneRecapExport}
        mode={dayOneRecapMode}
        onModeChange={setDayOneRecapMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => {
          setPilotWeekOneReviewMode("human");
          setPilotWeekOneReviewOpen(true);
        }}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={weeklyScorecardSyncOpen}
        onOpenChange={setWeeklyScorecardSyncOpen}
        exportView={weeklyScorecardSyncChecklist}
        mode={weeklyScorecardSyncMode}
        onModeChange={setWeeklyScorecardSyncMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => {
          setPilotWeekOneReviewMode("human");
          setPilotWeekOneReviewOpen(true);
        }}
      />
      <LocalServicePilotMessagePreviewSheet
        open={pilotMessagePreviewOpen}
        onOpenChange={setPilotMessagePreviewOpen}
        preview={pilotMessagePreview}
        mode={pilotMessagePreviewMode}
        onModeChange={setPilotMessagePreviewMode}
        onCopy={onCopyText}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
      />
      <LocalServicePilotOperatorConfirmationSheet
        open={pilotOperatorConfirmationOpen}
        onOpenChange={setPilotOperatorConfirmationOpen}
        confirmation={pilotOperatorConfirmation}
        mode={pilotOperatorConfirmationMode}
        onModeChange={setPilotOperatorConfirmationMode}
        onCopy={onCopyText}
        readyRecorded={currentPilotStatus === "draft_ready"}
        onRecordReady={recordReadyForManualOutreach}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
      />
      <LocalServicePilotWorkspaceExportDrawer
        open={pilotLaunchPacketOpen}
        onOpenChange={setPilotLaunchPacketOpen}
        exportView={pilotLaunchPacket}
        mode={pilotLaunchPacketMode}
        onModeChange={setPilotLaunchPacketMode}
        onCopy={onCopyText}
        readyRecorded={currentPilotStatus === "draft_ready"}
        onRecordReady={recordReadyForManualOutreach}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
      />
      <LocalServicePilotAnalystSheet
        open={pilotAnalystOpen}
        onOpenChange={setPilotAnalystOpen}
        brief={pilotAnalystBrief}
        mode={pilotAnalystMode}
        onModeChange={setPilotAnalystMode}
        onCopy={onCopyText}
        onOpenPreview={() => setPilotMessagePreviewOpen(true)}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenExecutionPack={() => onOpenPath(LOCAL_SERVICES_OUTREACH_EXECUTION_PACK_PATH)}
      />
      <LocalServiceDiscoveryCallPrepSheet
        open={discoveryCallPrepOpen}
        onOpenChange={setDiscoveryCallPrepOpen}
        prep={discoveryCallPrep}
        mode={discoveryCallPrepMode}
        onModeChange={setDiscoveryCallPrepMode}
        onCopy={onCopyText}
        onOpenMetrics={() => setPilotMetricsTrackerOpen(true)}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
        onOpenRunbook={() => onOpenPath(LOCAL_SERVICES_PILOT_RUNBOOK_PATH)}
        onOpenDayOneSetup={() => {
          setDayOneSetupMode("human");
          setDayOneSetupOpen(true);
        }}
      />
      <LocalServiceDayOneSetupSheet
        open={dayOneSetupOpen}
        onOpenChange={setDayOneSetupOpen}
        brief={dayOneSetupBrief}
        mode={dayOneSetupMode}
        onModeChange={setDayOneSetupMode}
        onCopy={onCopyText}
        onOpenAgentSetup={() => setAgentSetupOpen(true)}
        onOpenMetrics={() => setPilotMetricsTrackerOpen(true)}
        onOpenDailyLog={() => {
          setPilotDailyLogMode("human");
          setPilotDailyLogOpen(true);
        }}
        onOpenScorecard={() => onOpenPath(LOCAL_SERVICES_PILOT_SCORECARD_PATH)}
      />
      <LocalServiceAgentSetupSheet
        open={agentSetupOpen}
        onOpenChange={setAgentSetupOpen}
        brief={agentSetupBrief}
        mode={agentSetupMode}
        onModeChange={setAgentSetupMode}
        onCopy={onCopyText}
        onOpenOffer={() => onOpenPath(LOCAL_SERVICES_PILOT_OFFER_PATH)}
        onOpenDemoScript={() => onOpenPath(LOCAL_SERVICES_DEMO_SCRIPT_PATH)}
      />
      <LocalServiceIntakeEvidenceSheet
        open={intakeEvidenceOpen}
        onOpenChange={setIntakeEvidenceOpen}
        evidence={intakeEvidence}
        mode={intakeEvidenceMode}
        onModeChange={setIntakeEvidenceMode}
        onCopy={onCopyText}
        onOpenEvidence={() => onOpenPath(selectedTemplate.evidencePath)}
        onOpenBundle={() => onOpenPath(selectedTemplate.bundlePath)}
      />
    </section>
  );
};

const LocalServiceIntakeEvidenceSheet = ({
  open,
  onOpenChange,
  evidence,
  mode,
  onModeChange,
  onCopy,
  onOpenEvidence,
  onOpenBundle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidence: LocalServiceIntakeEvidence;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  onOpenEvidence: () => void;
  onOpenBundle: () => void;
}) => {
  const renderedText = mode === "human" ? evidence.humanText : evidence.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Saved intake evidence
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {evidence.title}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {evidence.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {evidence.modeLabel}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Review the transcript and canonical evidence link before copying anything into handoff notes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mode === "human" ? "default" : "secondary"}
                  onClick={() => onModeChange("human")}
                  className="h-8"
                >
                  Human-readable
                </Button>
                <Button
                  size="sm"
                  variant={mode === "json" ? "default" : "secondary"}
                  onClick={() => onModeChange("json")}
                  className="h-8"
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {evidence.rows.map((row) => (
                <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {row.label}
                  </div>
                  <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  Transcript preview
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Phone intake plus Telegram fallback, normalized into the same job-card evidence posture.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={onOpenEvidence} className="h-8">
                  Evidence link
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenBundle} className="h-8">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Handoff bundle
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {evidence.transcript.map((entry) => (
                <div key={`${entry.speaker}-${entry.text}`} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {entry.speaker}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-foreground">{entry.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
              Evidence guardrails
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {evidence.checklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {mode === "human" ? "Human-readable evidence note" : "JSON evidence payload"}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Copy only as an internal evidence note; this does not save to CRM or external channels.
                </p>
              </div>
              <Button size="sm" onClick={() => onCopy(renderedText, evidence.copyLabel)} className="h-8">
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                {evidence.copyLabel}
              </Button>
            </div>
            <pre className="max-h-[42vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
              {renderedText}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const LocalServiceDispatchDrawer = ({
  open,
  onOpenChange,
  template,
  exportKind,
  mode,
  onModeChange,
  onCopy,
  onOpenBundle,
  onOpenEvidence,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: LocalServiceDemoTemplate | null;
  exportKind: LocalServiceExportKind;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  onOpenBundle: () => void;
  onOpenEvidence: () => void;
}) => {
  const payloadPreview = template ? buildLocalServicePayloadPreview(template) : null;
  const exportView =
    template && payloadPreview ? buildLocalServiceDispatchExport(template, payloadPreview, exportKind) : null;
  const renderedText = mode === "human" ? exportView?.humanText : exportView?.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Local services dispatch export
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {exportView?.title ?? "Dispatch payload drawer"}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {exportView?.description ??
              "Select a local-services card to prepare an operator-reviewed dispatch export."}
          </SheetDescription>
        </SheetHeader>

        {exportView && renderedText && (
          <div className="flex-1 min-h-0 overflow-auto">
            <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                    {exportView.modeLabel}
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Switch between the dispatcher note and the JSON payload before external send.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={mode === "human" ? "default" : "secondary"}
                    onClick={() => onModeChange("human")}
                    className="h-8"
                  >
                    Human-readable
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === "json" ? "default" : "secondary"}
                    onClick={() => onModeChange("json")}
                    className="h-8"
                  >
                    JSON
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {exportView.rows.map((row) => (
                  <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                      {row.label}
                    </div>
                    <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="px-7 py-5 border-b border-border/50 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                    Operator approval checklist
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Keeps phone booking, pricing, and master dispatch behind a human approval gate.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={onOpenEvidence} className="h-8">
                    Evidence
                  </Button>
                  <Button size="sm" variant="secondary" onClick={onOpenBundle} className="h-8">
                    <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                    {exportView.surfaceActionLabel}
                  </Button>
                </div>
              </div>
              <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
                {exportView.checklist.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="px-7 py-5 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                    {mode === "human" ? "Human-readable dispatch handoff" : "JSON payload"}
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Copy only after the operator confirms the customer-facing booking posture.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onCopy(renderedText, exportView.copyLabel)}
                  className="h-8"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  {exportView.copyLabel}
                </Button>
              </div>
              <pre className="max-h-[42vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
                {renderedText}
              </pre>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

const LocalServicePilotWorkspaceExportDrawer = ({
  open,
  onOpenChange,
  exportView,
  mode,
  onModeChange,
  onCopy,
  readyRecorded,
  onRecordReady,
  onOpenScorecard,
  onOpenExecutionPack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportView: LocalServicePilotWorkspaceExport;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  readyRecorded?: boolean;
  onRecordReady?: () => void;
  onOpenScorecard: () => void;
  onOpenExecutionPack: () => void;
}) => {
  const renderedText = mode === "human" ? exportView.humanText : exportView.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              {exportView.eyebrow ?? "Pilot workspace export"}
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {exportView.title}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {exportView.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {exportView.modeLabel}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Switch between the operator-readable funnel note and the JSON payload for manual CRM or scorecard sync.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mode === "human" ? "default" : "secondary"}
                  onClick={() => onModeChange("human")}
                  className="h-8"
                >
                  Human-readable
                </Button>
                <Button
                  size="sm"
                  variant={mode === "json" ? "default" : "secondary"}
                  onClick={() => onModeChange("json")}
                  className="h-8"
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {exportView.rows.map((row) => (
                <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {row.label}
                  </div>
                  <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {exportView.reviewTitle ?? "Operator review checklist"}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {exportView.reviewDescription ??
                    "This export is a planning artifact only: no outbound message, no CRM write, no scorecard mutation."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {onRecordReady ? (
                  <Button
                    size="sm"
                    variant={readyRecorded ? "secondary" : "default"}
                    onClick={onRecordReady}
                    className="h-8"
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                    Record ready for manual outreach
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" onClick={onOpenExecutionPack} className="h-8">
                  <FileText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  {exportView.executionActionLabel ?? "Open outreach execution pack"}
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenScorecard} className="h-8">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  {exportView.scorecardActionLabel ?? "Open pilot scorecard"}
                </Button>
              </div>
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {exportView.checklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {mode === "human" ? "Human-readable pilot export" : "JSON pilot payload"}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Copy only after the operator confirms this browser-local state is current.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onCopy(renderedText, exportView.copyLabel)}
                className="h-8"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                {exportView.copyLabel}
              </Button>
            </div>
            <pre className="max-h-[42vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
              {renderedText}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const LocalServicePilotMessagePreviewSheet = ({
  open,
  onOpenChange,
  preview,
  mode,
  onModeChange,
  onCopy,
  onOpenScorecard,
  onOpenExecutionPack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: LocalServicePilotMessagePreview;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  onOpenScorecard: () => void;
  onOpenExecutionPack: () => void;
}) => {
  const renderedText = mode === "human" ? preview.humanText : preview.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Test message preview
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {preview.title}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {preview.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {preview.modeLabel}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Inspect the message in human-readable or JSON form before operator approval.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mode === "human" ? "default" : "secondary"}
                  onClick={() => onModeChange("human")}
                  className="h-8"
                >
                  Human-readable
                </Button>
                <Button
                  size="sm"
                  variant={mode === "json" ? "default" : "secondary"}
                  onClick={() => onModeChange("json")}
                  className="h-8"
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {preview.rows.map((row) => (
                <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {row.label}
                  </div>
                  <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  Manual approval checklist
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  The preview is safe to inspect and copy; real outreach still happens outside this shell.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={onOpenExecutionPack} className="h-8">
                  <FileText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open outreach execution pack
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenScorecard} className="h-8">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open pilot scorecard
                </Button>
              </div>
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {preview.checklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  Exact test message
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Copying this text does not send it. Operator sends manually after confirmation.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onCopy(preview.messageText, preview.copyMessageLabel)}
                className="h-8"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                {preview.copyMessageLabel}
              </Button>
            </div>
            <div className="rounded-md border border-border/60 bg-card/30 px-3 py-3 text-[12.5px] leading-relaxed text-foreground">
              {preview.messageText}
            </div>
          </section>

          <section className="px-7 py-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {mode === "human" ? "Human-readable preview" : "JSON preview payload"}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Copy this reviewed preview into the execution pack or scorecard notes if useful.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onCopy(renderedText, preview.copyPreviewLabel)}
                className="h-8"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                {preview.copyPreviewLabel}
              </Button>
            </div>
            <pre className="max-h-[36vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
              {renderedText}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const LocalServicePilotOperatorConfirmationSheet = ({
  open,
  onOpenChange,
  confirmation,
  mode,
  onModeChange,
  onCopy,
  readyRecorded,
  onRecordReady,
  onOpenScorecard,
  onOpenExecutionPack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmation: LocalServicePilotConfirmationSummary;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  readyRecorded: boolean;
  onRecordReady: () => void;
  onOpenScorecard: () => void;
  onOpenExecutionPack: () => void;
}) => {
  const renderedText = mode === "human" ? confirmation.humanText : confirmation.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Operator confirmation
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {confirmation.title}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {confirmation.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {confirmation.modeLabel}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Confirm the selected company, channel, exact message, and manual approval posture.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mode === "human" ? "default" : "secondary"}
                  onClick={() => onModeChange("human")}
                  className="h-8"
                >
                  Human-readable
                </Button>
                <Button
                  size="sm"
                  variant={mode === "json" ? "default" : "secondary"}
                  onClick={() => onModeChange("json")}
                  className="h-8"
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="inline-flex rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1 text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
              {confirmation.statusLabel}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {confirmation.rows.map((row) => (
                <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {row.label}
                  </div>
                  <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  Approval checklist
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  This is the final shell check before the operator leaves the product to contact the company.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={readyRecorded ? "secondary" : "default"}
                  onClick={onRecordReady}
                  className="h-8"
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Record ready for manual outreach
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenExecutionPack} className="h-8">
                  <FileText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open outreach execution pack
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenScorecard} className="h-8">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open pilot scorecard
                </Button>
              </div>
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {confirmation.checklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                Exact message
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Visible here for final confirmation only. No outbound send happens from this shell.
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-card/30 px-3 py-3 text-[12.5px] leading-relaxed text-foreground">
              {confirmation.messageText}
            </div>
          </section>

          <section className="px-7 py-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {mode === "human" ? "Human-readable confirmation" : "JSON confirmation payload"}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Copy after the operator confirms this is the message they will send manually.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onCopy(renderedText, confirmation.copyLabel)}
                className="h-8"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                {confirmation.copyLabel}
              </Button>
            </div>
            <pre className="max-h-[36vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
              {renderedText}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const LocalServicePilotAnalystSheet = ({
  open,
  onOpenChange,
  brief,
  mode,
  onModeChange,
  onCopy,
  onOpenPreview,
  onOpenScorecard,
  onOpenExecutionPack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief: LocalServicePilotAnalystBrief;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  onOpenPreview: () => void;
  onOpenScorecard: () => void;
  onOpenExecutionPack: () => void;
}) => {
  const renderedText = mode === "human" ? brief.humanText : brief.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              AI analyst
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {brief.title}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {brief.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {brief.modeLabel}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  This is a deterministic operator assist view, not a live model call.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mode === "human" ? "default" : "secondary"}
                  onClick={() => onModeChange("human")}
                  className="h-8"
                >
                  Human-readable
                </Button>
                <Button
                  size="sm"
                  variant={mode === "json" ? "default" : "secondary"}
                  onClick={() => onModeChange("json")}
                  className="h-8"
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {brief.rows.map((row) => (
                <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {row.label}
                  </div>
                  <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  Suggested questions
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Short operator prompts for the selected lane, company, and funnel state.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={onOpenPreview} className="h-8">
                  <MessageSquareText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open preview modal
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenExecutionPack} className="h-8">
                  <FileText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open outreach execution pack
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenScorecard} className="h-8">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open pilot scorecard
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {brief.suggestedQuestions.map((item) => (
                <div key={item.question} className="rounded-md border border-border/60 bg-card/30 px-3 py-3">
                  <div className="text-[12px] font-semibold text-foreground">{item.question}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{item.answer}</p>
                  <div className="mt-2 rounded-[5px] bg-secondary/45 px-2 py-1 text-[10px] text-muted-foreground">
                    Action: {item.action}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
              Guardrails
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {brief.guardrails.map((item) => (
                <li key={item} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {mode === "human" ? "Human-readable analyst brief" : "JSON analyst payload"}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Copy only as an internal planning note; it is not customer-facing outreach.
                </p>
              </div>
              <Button size="sm" onClick={() => onCopy(renderedText, brief.copyLabel)} className="h-8">
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                {brief.copyLabel}
              </Button>
            </div>
            <pre className="max-h-[36vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
              {renderedText}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const LocalServiceDiscoveryCallPrepSheet = ({
  open,
  onOpenChange,
  prep,
  mode,
  onModeChange,
  onCopy,
  onOpenMetrics,
  onOpenScorecard,
  onOpenRunbook,
  onOpenDayOneSetup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prep: LocalServiceDiscoveryCallPrep;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  onOpenMetrics: () => void;
  onOpenScorecard: () => void;
  onOpenRunbook: () => void;
  onOpenDayOneSetup: () => void;
}) => {
  const renderedText = mode === "human" ? prep.humanText : prep.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Discovery call
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {prep.title}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {prep.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {prep.modeLabel}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Prepare the founder call as an internal brief before any manual booking or follow-up.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mode === "human" ? "default" : "secondary"}
                  onClick={() => onModeChange("human")}
                  className="h-8"
                >
                  Human-readable
                </Button>
                <Button
                  size="sm"
                  variant={mode === "json" ? "default" : "secondary"}
                  onClick={() => onModeChange("json")}
                  className="h-8"
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="inline-flex rounded-[5px] bg-[hsl(var(--tint-amber)/0.13)] px-2 py-1 text-[10px] text-[hsl(var(--tint-amber-fg))] ring-1 ring-inset ring-[hsl(var(--tint-amber)/0.22)]">
              {prep.callReadiness}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {prep.rows.map((row) => (
                <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {row.label}
                  </div>
                  <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  Questions to ask
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Keep the conversation focused on real missed revenue, approval rules, and pilot fit.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={onOpenRunbook} className="h-8">
                  <FileText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open pilot runbook
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenDayOneSetup} className="h-8">
                  <UserRoundCog className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open day-one setup
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenMetrics} className="h-8">
                  <Clock className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open metrics tracker
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenScorecard} className="h-8">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open pilot scorecard
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {prep.discoveryQuestions.map((question) => (
                <div
                  key={question}
                  className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground"
                >
                  {question}
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
              Pilot success criteria
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {prep.successCriteria.map((criterion) => (
                <li key={criterion} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
              Guardrails
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {prep.guardrails.map((guardrail) => (
                <li key={guardrail} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{guardrail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {mode === "human" ? "Human-readable call brief" : "JSON call brief"}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Copy after the operator confirms the selected company and current funnel state.
                </p>
              </div>
              <Button size="sm" onClick={() => onCopy(renderedText, prep.copyLabel)} className="h-8">
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                {prep.copyLabel}
              </Button>
            </div>
            <pre className="max-h-[36vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
              {renderedText}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const LocalServiceDayOneSetupSheet = ({
  open,
  onOpenChange,
  brief,
  mode,
  onModeChange,
  onCopy,
  onOpenAgentSetup,
  onOpenMetrics,
  onOpenDailyLog,
  onOpenScorecard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief: LocalServiceDayOneSetupBrief;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  onOpenAgentSetup: () => void;
  onOpenMetrics: () => void;
  onOpenDailyLog: () => void;
  onOpenScorecard: () => void;
}) => {
  const renderedText = mode === "human" ? brief.humanText : brief.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <UserRoundCog className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Day-one setup
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {brief.title}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {brief.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {brief.modeLabel}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Convert the discovery call into setup tasks before activating any live channel.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mode === "human" ? "default" : "secondary"}
                  onClick={() => onModeChange("human")}
                  className="h-8"
                >
                  Human-readable
                </Button>
                <Button
                  size="sm"
                  variant={mode === "json" ? "default" : "secondary"}
                  onClick={() => onModeChange("json")}
                  className="h-8"
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="inline-flex rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] px-2 py-1 text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
              {brief.setupReadiness}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {brief.rows.map((row) => (
                <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {row.label}
                  </div>
                  <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
              Business profile lock
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {brief.businessProfile.map((item) => (
                <div key={item.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {item.label}
                  </div>
                  <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  Setup tasks
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Operator-owned day-one work before the first real test call or message.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={onOpenAgentSetup} className="h-8">
                  <UserRoundCog className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open setup checklist
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenMetrics} className="h-8">
                  <Clock className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open metrics tracker
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenDailyLog} className="h-8">
                  <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open daily log
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenScorecard} className="h-8">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open pilot scorecard
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {brief.setupTasks.map((task) => (
                <div key={task.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold text-foreground">{task.label}</span>
                    <span className="rounded-[5px] bg-secondary/45 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      Owner: {task.owner}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{task.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
              Test call plan
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {brief.testPlan.map((step) => (
                <li key={step} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
              Guardrails
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {brief.guardrails.map((guardrail) => (
                <li key={guardrail} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{guardrail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {mode === "human" ? "Human-readable setup handoff" : "JSON setup handoff"}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Copy only after the operator confirms the day-one profile and test plan.
                </p>
              </div>
              <Button size="sm" onClick={() => onCopy(renderedText, brief.copyLabel)} className="h-8">
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                {brief.copyLabel}
              </Button>
            </div>
            <pre className="max-h-[36vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
              {renderedText}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const LocalServiceAgentSetupSheet = ({
  open,
  onOpenChange,
  brief,
  mode,
  onModeChange,
  onCopy,
  onOpenOffer,
  onOpenDemoScript,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief: LocalServiceAgentSetupBrief;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  onOpenOffer: () => void;
  onOpenDemoScript: () => void;
}) => {
  const renderedText = mode === "human" ? brief.humanText : brief.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <UserRoundCog className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Agent setup
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {brief.title}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {brief.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {brief.modeLabel}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Review setup in human-readable or JSON form before a pilot test.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mode === "human" ? "default" : "secondary"}
                  onClick={() => onModeChange("human")}
                  className="h-8"
                >
                  Human-readable
                </Button>
                <Button
                  size="sm"
                  variant={mode === "json" ? "default" : "secondary"}
                  onClick={() => onModeChange("json")}
                  className="h-8"
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {brief.rows.map((row) => (
                <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {row.label}
                  </div>
                  <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  7-minute setup
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Business profile to ready state, without activating live channels.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={onOpenOffer} className="h-8">
                  <FileText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open offer doc
                </Button>
                <Button size="sm" variant="secondary" onClick={onOpenDemoScript} className="h-8">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Open demo script
                </Button>
              </div>
            </div>
            <ol className="grid gap-2">
              {brief.setupSteps.map((step, index) => (
                <li key={step.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] bg-[hsl(var(--tint-mint)/0.12)] font-mono text-[10px] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-foreground">{step.label}</span>
                        <span className="rounded-[5px] bg-secondary/45 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {step.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{step.value}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
              Training cards
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {brief.trainingCards.map((card) => (
                <div key={card.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-3">
                  <div className="text-[12px] font-semibold text-foreground">{card.label}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{card.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="px-7 py-5 border-b border-border/50 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
              Guardrails
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {brief.guardrails.map((item) => (
                <li key={item} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-7 py-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                  {mode === "human" ? "Human-readable setup brief" : "JSON setup payload"}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Copy as an internal setup note only; this does not activate integrations.
                </p>
              </div>
              <Button size="sm" onClick={() => onCopy(renderedText, brief.copyLabel)} className="h-8">
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                {brief.copyLabel}
              </Button>
            </div>
            <pre className="max-h-[36vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
              {renderedText}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

function buildPlaybookOperatorExport(
  template: PlaybookTemplate,
  payloadPreview: PlaybookPayloadPreview,
  wiki: RuntimeCaseWiki | undefined,
): PlaybookOperatorExport {
  const { caseValue } = template;
  const outcome = template.highlights.find((item) => item.label === "Outcome")?.value ?? caseValue.stage;
  const approval = template.highlights.find((item) => item.label === "Approval")?.value ?? "Operator review";
  const evidence = template.highlights.find((item) => item.label === "Evidence")?.value ?? payloadPreview.surfaceLabel;
  const deliverable = template.highlights.find((item) => item.label === "Deliverable")?.value ?? template.title;
  const nextAction =
    wiki?.recommendedNextAction?.title ??
    wiki?.recommendedNextAction?.summary ??
    payloadPreview.payload.next_action?.toString() ??
    template.statusNote;
  const blocker =
    wiki?.highlights.topBlockingQuestion?.question ??
    payloadPreview.payload.current_blocker?.toString() ??
    "No blocking question in the current Case Wiki snapshot.";
  const status = wiki?.overview.status ?? caseValue.status;
  const exportReady =
    wiki?.operatorPreviewPack?.compliance?.enforcement?.exportReady ??
    wiki?.compliance?.enforcement?.exportReady;
  const compliance =
    exportReady === false
      ? "review required before external send"
      : exportReady === true
        ? "ready for approved export"
        : "operator review required";
  const payloadFieldSummary = Object.entries(payloadPreview.payload)
    .map(([key, value]) => `${key}=${formatPayloadValue(value)}`)
    .join("; ");
  const drawerTitle =
    template.id === "crm-handoff"
      ? "CRM payload drawer"
      : template.id === "consultation-booking"
        ? "Consultation handoff drawer"
        : "Operator handoff drawer";
  const surfaceActionLabel =
    template.id === "crm-handoff"
      ? "Open Case Vault"
      : template.id === "consultation-booking"
        ? "Open Presentation bundle"
        : `Open ${payloadPreview.surfaceLabel}`;
  const rows = [
    { label: "Case", value: `${caseValue.ref} - ${caseValue.client}` },
    { label: "Route", value: `${caseValue.visa} - ${caseValue.country}` },
    { label: "Outcome", value: outcome },
    { label: "Approval", value: approval },
    { label: "Evidence", value: evidence },
    { label: "Deliverable", value: deliverable },
    { label: "Status", value: status },
    { label: "Compliance", value: compliance },
    { label: "Payload fields", value: payloadFieldSummary },
    { label: "Surface", value: payloadPreview.surfacePath },
  ];
  const checklist = [
    `Confirm owner: ${wiki?.recommendedNextAction?.owner ?? caseValue.owner}`,
    `Review blocker: ${blocker}`,
    `Open canonical surface: ${payloadPreview.surfaceLabel}`,
    "Copy the human-readable handoff or JSON payload only after operator review.",
  ];
  const humanLines = [
    `${drawerTitle}: ${template.title}`,
    `Case: ${caseValue.ref} - ${caseValue.client}`,
    `Route: ${caseValue.visa} - ${caseValue.country}`,
    `Outcome: ${outcome}`,
    `Approval: ${approval}`,
    `Evidence: ${evidence}`,
    `Deliverable: ${deliverable}`,
    `Status: ${status}`,
    `Next action: ${nextAction}`,
    `Current blocker: ${blocker}`,
    `Payload fields: ${payloadFieldSummary}`,
    `Canonical surface: ${payloadPreview.surfaceLabel} (${payloadPreview.surfacePath})`,
    `Compliance: ${compliance}`,
  ];
  const jsonText = JSON.stringify(
    {
      export_surface: drawerTitle,
      case_ref: caseValue.ref,
      client: caseValue.client,
      owner: caseValue.owner,
      canonical_surface: {
        label: payloadPreview.surfaceLabel,
        path: payloadPreview.surfacePath,
      },
      human_summary: Object.fromEntries(rows.map((row) => [row.label.toLowerCase().replace(/\s+/g, "_"), row.value])),
      checklist,
      payload: payloadPreview.payload,
    },
    null,
    2,
  );

  return {
    title: drawerTitle,
    description:
      template.id === "crm-handoff"
        ? "Review the CRM-ready handoff before copying into the agency system."
        : template.id === "consultation-booking"
          ? "Review the consultation packet handoff before opening the presentation bundle."
          : "Review the operator handoff before moving to the canonical surface.",
    modeLabel: template.id === "crm-handoff" ? "CRM export mode" : "Handoff export mode",
    copyLabel: template.id === "crm-handoff" ? "Copy CRM export" : "Copy handoff export",
    surfaceActionLabel,
    humanText: humanLines.join("\n"),
    jsonText,
    rows,
    checklist,
  };
}

const PlaybookTemplateCard = ({
  template,
  selected,
  onSelect,
}: {
  template: PlaybookTemplate;
  selected: boolean;
  onSelect: () => void;
}) => {
  const { Icon, caseValue } = template;
  return (
    <article
      className={`rounded-md border p-4 transition-smooth ${
        selected
          ? "border-transparent bg-card/55 ring-1 ring-inset"
          : "border-border/60 bg-card/30"
      }`}
      style={
        selected
          ? {
              borderColor: `hsl(var(--tint-${template.tone}) / 0.34)`,
              ["--tw-ring-color" as const]: `hsl(var(--tint-${template.tone}) / 0.3)`,
            }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset"
          style={{
            backgroundColor: `hsl(var(--tint-${template.tone}) / 0.14)`,
            color: `hsl(var(--tint-${template.tone}-fg))`,
            ["--tw-ring-color" as const]: `hsl(var(--tint-${template.tone}) / 0.24)`,
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
              {template.title}
            </h3>
            <Pill tone={template.tone} size="sm">
              {caseValue.ref}
            </Pill>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {template.summary}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-background/35 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
            Client
          </div>
          <div className="mt-1 text-foreground truncate">{caseValue.client}</div>
        </div>
        <div className="rounded-md bg-background/35 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
            Stage
          </div>
          <div className="mt-1 text-foreground truncate">{caseValue.stage}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        {template.highlights.map((highlight) => (
          <div key={highlight.label} className="rounded-md bg-background/35 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              {highlight.label}
            </div>
            <div className="mt-1 text-foreground">{highlight.value}</div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
        {template.statusNote}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={onSelect} className="h-8">
          Inspect template
        </Button>
        <Button size="sm" onClick={template.onPrimary} className="h-8">
          {template.primaryLabel}
        </Button>
        <Button size="sm" variant="secondary" onClick={template.onSecondary} className="h-8">
          {template.secondaryLabel}
        </Button>
      </div>
    </article>
  );
};

const PlaybookTemplateDetailPanel = ({
  template,
  payloadPreview,
  onCopyPayload,
  onOpenExportDrawer,
}: {
  template: PlaybookTemplate;
  payloadPreview: PlaybookPayloadPreview;
  onCopyPayload: () => void;
  onOpenExportDrawer: () => void;
}) => {
  const { Icon, caseValue } = template;
  return (
    <section
      className="mt-3 rounded-lg border border-border/60 bg-card/35 p-4"
      aria-label={`${template.title} detail`}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Pill tone={template.tone} size="sm">
              Selected template
            </Pill>
            <Pill tone="slate" size="sm">
              {caseValue.ref}
            </Pill>
          </div>
          <div className="mt-2 flex items-start gap-3">
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset"
              style={{
                backgroundColor: `hsl(var(--tint-${template.tone}) / 0.14)`,
                color: `hsl(var(--tint-${template.tone}-fg))`,
                ["--tw-ring-color" as const]: `hsl(var(--tint-${template.tone}) / 0.24)`,
              }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                {template.title}
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {template.summary}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={template.onPrimary} className="h-8">
            {template.primaryLabel}
          </Button>
          <Button size="sm" variant="secondary" onClick={template.onSecondary} className="h-8">
            {template.secondaryLabel}
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenExportDrawer} className="h-8">
            Open export drawer
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="space-y-3">
          <section className="rounded-md bg-background/35 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              Sample input
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-foreground">
              {template.detail.sampleInput}
            </p>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-md bg-background/35 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Approval policy
              </div>
              <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground">
                {template.detail.approvalPolicy.map((item) => (
                  <li key={item} className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md bg-background/35 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Evidence output
              </div>
              <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground">
                {template.detail.evidenceOutput.map((item) => (
                  <li key={item} className="flex gap-2">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="rounded-md bg-background/35 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Payload preview
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {payloadPreview.surfaceLabel}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={onCopyPayload} className="h-8">
                <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                Copy payload
              </Button>
            </div>
            <div className="mt-3 rounded-md border border-border/60 bg-card/30 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Surface path
              </div>
              <div className="mt-1 break-all font-mono text-[10.5px] leading-relaxed text-foreground">
                {payloadPreview.surfacePath}
              </div>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[10.5px] leading-relaxed text-foreground">
              {JSON.stringify(payloadPreview.payload, null, 2)}
            </pre>
          </section>
        </div>

        <aside className="rounded-md bg-background/35 px-3 py-3">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Client
              </div>
              <div className="mt-1 text-foreground">{caseValue.client}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Stage
              </div>
              <div className="mt-1 text-foreground">{caseValue.stage}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Owner
              </div>
              <div className="mt-1 text-foreground">{caseValue.owner}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Visa route
              </div>
              <div className="mt-1 text-foreground">{caseValue.visa}</div>
            </div>
          </div>

          <section className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              CRM fields
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {template.detail.crmFields.map((field) => (
                <Pill key={field} tone="slate" size="sm">
                  {field}
                </Pill>
              ))}
            </div>
          </section>

          <div className="mt-4 rounded-md border border-border/60 bg-card/30 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              Operator note
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              {template.statusNote}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};

const PlaybookExportDrawer = ({
  open,
  onOpenChange,
  template,
  payloadPreview,
  wiki,
  mode,
  onModeChange,
  onCopy,
  onOpenSurface,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PlaybookTemplate | null;
  payloadPreview: PlaybookPayloadPreview | null;
  wiki: RuntimeCaseWiki | undefined;
  mode: PlaybookExportMode;
  onModeChange: (mode: PlaybookExportMode) => void;
  onCopy: (text: string, label: string) => void;
  onOpenSurface: () => void;
}) => {
  const exportView =
    template && payloadPreview
      ? buildPlaybookOperatorExport(template, payloadPreview, wiki)
      : null;
  const renderedText = mode === "human" ? exportView?.humanText : exportView?.jsonText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Integration-ready export
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            {exportView?.title ?? "Operator handoff drawer"}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            {exportView?.description ??
              "Select a playbook template to prepare an operator-reviewed export."}
          </SheetDescription>
        </SheetHeader>

        {exportView && renderedText && (
          <div className="flex-1 min-h-0 overflow-auto">
            <section className="px-7 pt-6 pb-5 border-b border-border/50 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                    {exportView.modeLabel}
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Switch between a human-readable operator note and the JSON payload for integration review.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={mode === "human" ? "default" : "secondary"}
                    onClick={() => onModeChange("human")}
                    className="h-8"
                  >
                    Human-readable
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === "json" ? "default" : "secondary"}
                    onClick={() => onModeChange("json")}
                    className="h-8"
                  >
                    JSON
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {exportView.rows.map((row) => (
                  <div key={row.label} className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                      {row.label}
                    </div>
                    <div className="mt-1 break-words text-[12px] leading-relaxed text-foreground">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="px-7 py-5 border-b border-border/50 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                    Operator review checklist
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Keeps CRM and consultation handoff actions explicit before export.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={onOpenSurface} className="h-8">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  {exportView.surfaceActionLabel}
                </Button>
              </div>
              <ul className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
                {exportView.checklist.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="px-7 py-5 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                    {mode === "human" ? "Human-readable handoff" : "JSON payload"}
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Copy only after the operator confirms the approval and evidence posture.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onCopy(renderedText, exportView.copyLabel)}
                  className="h-8"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  {exportView.copyLabel}
                </Button>
              </div>
              <pre className="max-h-[42vh] overflow-auto rounded-md border border-border/60 bg-card/30 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground">
                {renderedText}
              </pre>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export const LiveDesk = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cases, deviceNodes, addDraftCase, getCaseWikiByRef } = useWorkspaceRuntime();
  const requestCounts = useAllRequestCounts();
  const requestStaleness = useAllRequestStaleness();
  const { isVip, toggleVip } = useVipCases();
  const [query, setQuery] = useState("");
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [playbookExportDrawerOpen, setPlaybookExportDrawerOpen] = useState(false);
  const [playbookExportMode, setPlaybookExportMode] = useState<PlaybookExportMode>("human");
  const [localServiceDispatchDrawerOpen, setLocalServiceDispatchDrawerOpen] = useState(false);
  const [localServiceDispatchMode, setLocalServiceDispatchMode] = useState<PlaybookExportMode>("human");
  const [localServiceExportKind, setLocalServiceExportKind] = useState<LocalServiceExportKind>("dispatch");
  // Marker for the most recently created case — drives a brief fresh-glow on
  // its row so the operator can spot the new entry in the dense list.
  // Cleared shortly after to keep the animation a one-shot affair.
  const [freshRef, setFreshRef] = useState<string | null>(null);

  // Node filter — driven entirely by ?node=ID URL param so deep-links from
  // /app/nodes "Open related cases" land in a pre-filtered desk. We
  // intentionally don't persist this to localStorage (unlike onlyMine /
  // mineOnly / vipOnly) — it's a contextual lens, not a long-running
  // preference; surviving reloads is enough.
  const [searchParams, setSearchParams] = useSearchParams();
  const nodeFilterId = searchParams.get("node");
  const nodeFilterMeta = useMemo(
    () => (nodeFilterId ? deviceNodes.find((n) => n.id === nodeFilterId) ?? null : null),
    [deviceNodes, nodeFilterId],
  );
  // Aggregate infra-impact filter — driven by ?infra=degraded coming from the
  // Topbar pill. Narrows to cases whose sourceNode is currently non-healthy.
  // Independent of nodeFilterId (which targets one specific device); the two
  // never compose meaningfully so we let nodeFilterId win when both are set.
  const infraFilter = searchParams.get("infra"); // "degraded" | null
  // SLA-burning lens — driven by ?burning=1 from the Topbar alert band.
  // Narrows the desk to non-resolved cases under the 1h SLA threshold so
  // the operator lands directly on what's about to breach.
  const burningFilter = searchParams.get("burning") === "1";
  const visaIntakeDemo = searchParams.get("demo") === "visa-intake";
  const localServicesDispatchDemo = searchParams.get("demo") === "local-services-dispatch";
  const localServicesRecordingMode = localServicesDispatchDemo && searchParams.get("recording") === "90s";
  const localServicesSetupWizardMode = localServicesDispatchDemo && searchParams.get("setup") === "7min";
  const activePlaybookId = searchParams.get("playbook");
  const activeLocalServiceId = searchParams.get("service");
  const activeLocalServiceTemplate = useMemo(
    () =>
      LOCAL_SERVICE_DEMO_TEMPLATES.find((template) => template.id === activeLocalServiceId) ??
      LOCAL_SERVICE_DEMO_TEMPLATES[0],
    [activeLocalServiceId],
  );
  const nonHealthyNodeIds = useMemo(
    () => new Set(deviceNodes.filter((n) => n.status !== "healthy").map((n) => n.id)),
    [deviceNodes],
  );
  const clearNodeFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("node");
      next.delete("infra");
      next.delete("burning");
      return next;
    });
  };
  const openVisaIntakeDemo = () => {
    setLocalServiceDispatchDrawerOpen(false);
    setQuery("");
    setOnlyMine(false);
    setMineOnly(false);
    setVipOnly(false);
    clearSelection();
    setFocusedRef(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("node");
      next.delete("infra");
      next.delete("burning");
      next.set("demo", "visa-intake");
      next.set("playbook", "missing-documents");
      next.delete("service");
      next.delete("recording");
      next.delete("setup");
      return next;
    });
  };
  const closeVisaIntakeDemo = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("demo");
      return next;
    });
  };
  const openLocalServicesDispatchDemo = () => {
    setPlaybookExportDrawerOpen(false);
    setQuery("");
    setOnlyMine(false);
    setMineOnly(false);
    setVipOnly(false);
    clearSelection();
    setFocusedRef(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("node");
      next.delete("infra");
      next.delete("burning");
      next.delete("playbook");
      next.set("demo", "local-services-dispatch");
      next.set("service", "ac-repair-dispatch");
      next.delete("recording");
      next.delete("setup");
      return next;
    });
  };
  const openLocalServicesRecordingMode = () => {
    setPlaybookExportDrawerOpen(false);
    setQuery("");
    setOnlyMine(false);
    setMineOnly(false);
    setVipOnly(false);
    clearSelection();
    setFocusedRef(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("node");
      next.delete("infra");
      next.delete("burning");
      next.delete("playbook");
      next.set("demo", "local-services-dispatch");
      next.set("service", "ac-repair-dispatch");
      next.set("recording", "90s");
      next.delete("setup");
      return next;
    });
  };
  const closeLocalServicesRecordingMode = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("recording");
      return next;
    });
  };
  const openLocalServicesSetupWizard = (serviceId?: string) => {
    setPlaybookExportDrawerOpen(false);
    setQuery("");
    setOnlyMine(false);
    setMineOnly(false);
    setVipOnly(false);
    clearSelection();
    setFocusedRef(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("node");
      next.delete("infra");
      next.delete("burning");
      next.delete("playbook");
      next.set("demo", "local-services-dispatch");
      next.set("service", serviceId ?? activeLocalServiceId ?? "ac-repair-dispatch");
      next.set("setup", "7min");
      next.delete("recording");
      return next;
    });
  };
  const closeLocalServicesSetupWizard = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("setup");
      return next;
    });
  };
  const closeLocalServicesDispatchDemo = () => {
    setLocalServiceDispatchDrawerOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("demo");
      next.delete("service");
      next.delete("recording");
      next.delete("setup");
      return next;
    });
  };
  // "My requests" inbox mode — when on, hides every case with zero outstanding
  // doc requests in this session. Pairs with the violet "N requested" badge in
  // the row so operators have a one-click view of what's still pending a
  // client reply. We treat it as a hard filter (not a sort) so the count in
  // the header reflects only what's actually shown.
  //
  // Persisted to localStorage so the filter survives page refresh — operators
  // who curate their desk to "only my outstanding requests" expect that view
  // to stick across reloads, not silently reset to the full board. Lazy
  // initializer keeps the read off the render-hot path; SSR-safe via the
  // `typeof window` guard.
  const STORAGE_KEY = "liveDesk:onlyMine";
  const [onlyMine, setOnlyMine] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private mode / disabled storage — degrade gracefully to in-memory only.
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (onlyMine) window.localStorage.setItem(STORAGE_KEY, "1");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Quota / disabled storage — best-effort, no user-facing failure.
    }
  }, [onlyMine]);

  // "Mine only" — narrows the desk to cases owned by CURRENT_OPERATOR.
  // Composes additively with "My requests": both filters AND together so an
  // operator can ask "show me only the cases I own AND that have outstanding
  // requests" — the natural inbox query for a single-operator daily flow.
  // Persisted in its own localStorage key so the two pills stay independent.
  const MINE_STORAGE_KEY = "liveDesk:mineOnly";
  const [mineOnly, setMineOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(MINE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (mineOnly) window.localStorage.setItem(MINE_STORAGE_KEY, "1");
      else window.localStorage.removeItem(MINE_STORAGE_KEY);
    } catch {
      /* best-effort */
    }
  }, [mineOnly]);

  // "VIP only" — third independent lens, narrows the desk to cases the
  // operator has flagged via the client-tooltip Star toggle. Persisted under
  // its own key so it composes with mineOnly + onlyMine without bleed.
  const VIP_STORAGE_KEY = "liveDesk:vipOnly";
  const [vipOnly, setVipOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(VIP_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (vipOnly) window.localStorage.setItem(VIP_STORAGE_KEY, "1");
      else window.localStorage.removeItem(VIP_STORAGE_KEY);
    } catch {
      /* best-effort */
    }
  }, [vipOnly]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    statusGroups.reduce(
      (acc, g) => ({ ...acc, [g.key]: g.defaultCollapsed }),
      {} as Record<string, boolean>,
    ),
  );
  const [focusedRef, setFocusedRef] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lastSelectedRef, setLastSelectedRef] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Total outstanding-request count drives both the toggle badge and the
  // disabled state — there's nothing to filter to if no requests are live.
  const totalOutstanding = useMemo(() => {
    let sum = 0;
    requestCounts.forEach((n) => (sum += n));
    return sum;
  }, [requestCounts]);

  // How many cases the current operator owns — drives the count badge on
  // the "Mine only" pill and the disabled state when the operator owns none.
  const mineTotal = useMemo(
    () => cases.filter((c) => c.owner === CURRENT_OPERATOR).length,
    [cases],
  );

  // Total VIP-flagged cases across the board — drives the "VIP only" pill
  // count badge and its disabled state.
  const vipTotal = useMemo(
    () => cases.filter((c) => isVip(c.ref)).length,
    [cases, isVip],
  );

  const filtered = useMemo(
    () =>
      cases.filter((c) => {
        if (nodeFilterId && c.sourceNodeId !== nodeFilterId) return false;
        if (infraFilter === "degraded") {
          if (c.status === "resolved") return false;
          if (!nonHealthyNodeIds.has(c.sourceNodeId)) return false;
        }
        if (burningFilter) {
          if (c.status === "resolved") return false;
          const m = parseSlaMinutes(c.sla);
          if (m === null || m >= 60) return false;
        }
        if (onlyMine && (requestCounts.get(c.ref) ?? 0) === 0) return false;
        if (mineOnly && c.owner !== CURRENT_OPERATOR) return false;
        if (vipOnly && !isVip(c.ref)) return false;
        if (!query.trim()) return true;
        return `${c.ref} ${c.client} ${c.visa} ${c.stage} ${c.owner}`
          .toLowerCase()
          .includes(query.toLowerCase());
      }),
    [burningFilter, cases, infraFilter, isVip, mineOnly, nodeFilterId, nonHealthyNodeIds, onlyMine, query, requestCounts, vipOnly]
  );

  const visaIntakeDemoCase = useMemo(
    () =>
      cases.find((c) => c.ref === "VS-2841") ??
      cases.find((c) => c.status === "needs_action" && c.documents.some((doc) => doc.state === "missing")) ??
      cases[0],
    [cases],
  );

  const playbookTemplates = useMemo<PlaybookTemplate[]>(() => {
    const countMissingDocuments = (value: WorkspaceCase) =>
      value.documents.filter((doc) => doc.state === "missing").length;
    const findLatestEvent = (value: WorkspaceCase, pattern: RegExp) =>
      [...value.events].reverse().find((event) => pattern.test(event.title))?.title ?? null;
    const leadQualificationCase =
      cases.find((c) => c.ref === "VS-2838") ??
      cases.find((c) => c.stage === "Lead intake") ??
      cases[0];
    const missingDocumentsCase =
      cases.find((c) => c.ref === "VS-2841") ??
      cases.find((c) => c.documents.some((doc) => doc.state === "missing") && c.status !== "resolved") ??
      cases[0];
    const consultationCase =
      cases.find((c) => c.ref === "VS-2840") ??
      cases.find((c) => /consultation/i.test(c.stage)) ??
      cases[0];
    const crmHandoffCase =
      cases.find((c) => c.ref === "VS-2837") ??
      cases.find((c) => /crm/i.test(c.stage) || c.status === "resolved") ??
      cases[0];

    return [
      leadQualificationCase && {
        id: "lead-qualification",
        title: "Visa lead qualification",
        summary: "Start from intake, confirm fit, and move the case into the operator desk.",
        statusNote: "Uses the lead-intake case path and keeps the first operator review attached to a live case.",
        highlights: [
          { label: "Outcome", value: `${leadQualificationCase.visa} fit` },
          { label: "Approval", value: "Console review only" },
          { label: "Evidence", value: "Console trail" },
          { label: "Deliverable", value: `${countMissingDocuments(leadQualificationCase)} requested docs` },
        ],
        detail: {
          sampleInput:
            "New lead from Japan for the Highly Skilled Pro route. Passport scan, resume, and diploma are still missing after intake.",
          approvalPolicy: [
            "No external send before the operator confirms the visa fit and missing-document ask.",
            "Escalate only if intake facts contradict the auto-classified route.",
          ],
          evidenceOutput: [
            "Lead-intake console timeline",
            "Auto-classification event trail",
            "Missing-document count preview",
          ],
          crmFields: ["lead_status", "visa_route", "country", "missing_documents"],
        },
        tone: "violet",
        Icon: ClipboardCheck,
        caseValue: leadQualificationCase,
        primaryLabel: "Open case",
        secondaryLabel: "7-minute path",
        onPrimary: () => navigate(`/app/console?ref=${encodeURIComponent(leadQualificationCase.ref)}`),
        onSecondary: openVisaIntakeDemo,
      },
      missingDocumentsCase && {
        id: "missing-documents",
        title: "Missing-document follow-up",
        summary: "Open the document chase directly where the missing evidence and approval live.",
        statusNote: "Routes straight into the document lane so the operator sees gaps before opening deeper runtime support.",
        highlights: [
          { label: "Outcome", value: `${countMissingDocuments(missingDocumentsCase)} missing docs` },
          { label: "Approval", value: "Reminder queued" },
          { label: "Evidence", value: "Evidence bundle" },
          { label: "Deliverable", value: "Protected follow-up" },
        ],
        detail: {
          sampleInput:
            "A. Petrov uploaded the employment contract, but passport scan, diploma apostille, insurance proof, and rental contract are still missing.",
          approvalPolicy: [
            "The external reminder stays protected until the operator approves the drafted follow-up.",
            "Review the document-focused console before opening deeper runtime support or replay.",
          ],
          evidenceOutput: [
            "Per-case evidence bundle",
            "Approval draft and trust signals",
            "Document gap timeline",
          ],
          crmFields: ["follow_up_status", "missing_documents", "next_contact_at", "approval_owner"],
        },
        tone: "amber",
        Icon: FileText,
        caseValue: missingDocumentsCase,
        primaryLabel: "Review docs",
        secondaryLabel: "Evidence",
        onPrimary: () =>
          navigate(`/app/console?ref=${encodeURIComponent(missingDocumentsCase.ref)}&focus=documents`),
        onSecondary: () => navigate(buildCaseEvidencePath(missingDocumentsCase)),
      },
      consultationCase && {
        id: "consultation-booking",
        title: "Consultation booking prep",
        summary: "Pick up the booking-ready case and review the consultation outcome or packet.",
        statusNote: "Keeps booking inside the main workflow lane instead of dropping the operator into generic demo fixtures.",
        highlights: [
          {
            label: "Outcome",
            value:
              findLatestEvent(consultationCase, /Calendar invite sent/i)?.replace(
                /^Calendar invite sent · /i,
                "",
              ) ?? "Consultation booked",
          },
          { label: "Approval", value: "No blocker" },
          { label: "Evidence", value: "Presentation bundle" },
          { label: "Deliverable", value: "Consult packet" },
        ],
        detail: {
          sampleInput:
            "Eligibility passed for L. Johansson and the calendar invite is already sent. Salary proof still needs review before the consult.",
          approvalPolicy: [
            "No extra approval gate while preparing the consultation packet.",
            "Escalate only if booking details or eligibility status drift from the case record.",
          ],
          evidenceOutput: [
            "Presentation bundle",
            "Consultation booking event trail",
            "Latest document review state",
          ],
          crmFields: ["consultation_at", "eligibility_status", "packet_status", "doc_blockers"],
        },
        tone: "mint",
        Icon: CalendarCheck,
        caseValue: consultationCase,
        primaryLabel: "Open bundle",
        secondaryLabel: "Open case",
        onPrimary: () => navigate(buildCaseBundlePath(consultationCase)),
        onSecondary: () => navigate(`/app/console?ref=${encodeURIComponent(consultationCase.ref)}`),
      },
      crmHandoffCase && {
        id: "crm-handoff",
        title: "CRM handoff summary",
        summary: "Review the resolved case through the handoff-oriented support surface and proof links.",
        statusNote: "Surfaces the CRM-ready posture without forcing raw replay or artifact-first navigation.",
        highlights: [
          { label: "Outcome", value: "CRM-ready handoff" },
          { label: "Approval", value: "Reviewer approved" },
          { label: "Evidence", value: "Case Vault" },
          { label: "Deliverable", value: "Resolved case proof" },
        ],
        detail: {
          sampleInput:
            "Resolved D7 case for M. Costa with all required documents verified and reviewer approval already completed.",
          approvalPolicy: [
            "No external send is needed; this lane is for internal operator handoff and CRM sync.",
            "Use Case Vault as the source of truth for resolved-case evidence and provenance.",
          ],
          evidenceOutput: [
            "Case Vault handoff surface",
            "Resolved case timeline",
            "Reviewer approval stamp",
          ],
          crmFields: ["case_status", "handoff_ready", "approved_by", "evidence_link"],
        },
        tone: "slate",
        Icon: BriefcaseBusiness,
        caseValue: crmHandoffCase,
        primaryLabel: "Open Case Vault",
        secondaryLabel: "Presentation bundle",
        onPrimary: () => navigate(buildCaseVaultPath(crmHandoffCase)),
        onSecondary: () => navigate(buildCaseBundlePath(crmHandoffCase)),
      },
    ].filter(Boolean) as PlaybookTemplate[];
  }, [cases, navigate, openVisaIntakeDemo]);

  const activePlaybookTemplate = useMemo(() => {
    if (playbookTemplates.length === 0) return null;
    return (
      playbookTemplates.find((template) => template.id === activePlaybookId) ??
      (visaIntakeDemo
        ? playbookTemplates.find((template) => template.id === "missing-documents")
        : null) ??
      playbookTemplates[0]
    );
  }, [activePlaybookId, playbookTemplates, visaIntakeDemo]);

  const activePlaybookWiki = useMemo(
    () =>
      activePlaybookTemplate
        ? getCaseWikiByRef(
            activePlaybookTemplate.caseValue.caseId ??
              activePlaybookTemplate.caseValue.sessionId ??
              activePlaybookTemplate.caseValue.ref,
          )
        : undefined,
    [activePlaybookTemplate, getCaseWikiByRef],
  );

  const activePlaybookPayloadPreview = useMemo(
    () =>
      activePlaybookTemplate
        ? buildPlaybookPayloadPreview(activePlaybookTemplate, activePlaybookWiki)
        : null,
    [activePlaybookTemplate, activePlaybookWiki],
  );

  const copyActivePlaybookPayload = async () => {
    if (!activePlaybookTemplate || !activePlaybookPayloadPreview) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(activePlaybookPayloadPreview.payload, null, 2),
      );
      toast({
        title: "Payload copied",
        description: `${activePlaybookTemplate.title} · ${activePlaybookTemplate.caseValue.ref}`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard is unavailable in this browser.",
      });
    }
  };

  const openActivePlaybookExportDrawer = () => {
    setPlaybookExportMode(activePlaybookTemplate?.id === "crm-handoff" ? "json" : "human");
    setPlaybookExportDrawerOpen(true);
  };

  const copyPlaybookExport = async (text: string, label: string) => {
    if (!activePlaybookTemplate) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${label} copied`,
        description: `${activePlaybookTemplate.title} - ${activePlaybookTemplate.caseValue.ref}`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard is unavailable in this browser.",
      });
    }
  };

  const openActivePlaybookSurface = () => {
    if (!activePlaybookPayloadPreview) {
      return;
    }
    setPlaybookExportDrawerOpen(false);
    navigate(activePlaybookPayloadPreview.surfacePath);
  };

  const copyLocalServiceDispatchPayload = async (template: LocalServiceDemoTemplate) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildLocalServicePayloadPreview(template).payload, null, 2));
      toast({
        title: "Dispatch payload copied",
        description: `${template.title} - ${template.ref}`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard is unavailable in this browser.",
      });
    }
  };

  const openActiveLocalServiceDispatchDrawer = (kind: LocalServiceExportKind = "dispatch") => {
    setLocalServiceExportKind(kind);
    setLocalServiceDispatchMode("human");
    setLocalServiceDispatchDrawerOpen(true);
  };

  const copyLocalServiceDispatchExport = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${label} copied`,
        description: `${activeLocalServiceTemplate.title} - ${activeLocalServiceTemplate.ref}`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard is unavailable in this browser.",
      });
    }
  };

  const copyLocalServicePilotWorkspaceExport = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${label} copied`,
        description: "Browser-local pilot workspace export",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard is unavailable in this browser.",
      });
    }
  };

  const openActiveLocalServiceBundle = () => {
    setLocalServiceDispatchDrawerOpen(false);
    navigate(activeLocalServiceTemplate.bundlePath);
  };

  const openActiveLocalServiceEvidence = () => {
    setLocalServiceDispatchDrawerOpen(false);
    navigate(activeLocalServiceTemplate.evidencePath);
  };

  const openLocalServiceDemoPath = (path: string) => {
    if (path.startsWith("/workspace-docs/")) {
      window.location.assign(path);
      return;
    }
    navigate(path);
  };

  // Staleness threshold for the My-requests view secondary grouping. 24h is
  // the default "I should poke this again" horizon for an immigration-doc
  // request — anything older counts as awaiting a reply too long.
  const STALE_MS = 24 * 60 * 60 * 1000;
  const NOW_MS = Date.now();

  // Stable VIP-first reorder — lifts every VIP-flagged case to the top of
  // its bucket while preserving the relative order of both halves. Stable
  // partition (not a comparator) so we never mangle the upstream sort
  // (burn-down for "Needs action", oldest-first for staleness buckets, etc.).
  const liftVip = (items: typeof cases) => {
    if (vipTotal === 0) return items;
    const vips: typeof cases = [];
    const rest: typeof cases = [];
    for (const c of items) (isVip(c.ref) ? vips : rest).push(c);
    return vips.length === 0 ? items : [...vips, ...rest];
  };

  const grouped = useMemo(() => {
    // My-requests mode: replace status grouping with a staleness split so the
    // operator sees the rotting requests above the fresh ones at a glance.
    // We synthesise two pseudo-groups that mirror the shape statusGroups
    // produces (key/label/dotClass/tint/emphasis/items) so the existing render
    // pipeline works unchanged.
    if (onlyMine) {
      const stale: typeof cases = [];
      const recent: typeof cases = [];
      for (const c of filtered) {
        const at = requestStaleness.get(c.ref);
        const ageMs = at ? NOW_MS - new Date(at).getTime() : 0;
        if (ageMs >= STALE_MS) stale.push(c);
        else recent.push(c);
      }
      // Both buckets sorted oldest-first so the most-rotten case sits at the
      // top of "Awaiting reply >24h" and the oldest of the fresh ones leads
      // "Sent recently" — natural triage order.
      const byAge = (a: typeof cases[number], b: typeof cases[number]) => {
        const ta = requestStaleness.get(a.ref) ?? "";
        const tb = requestStaleness.get(b.ref) ?? "";
        return ta.localeCompare(tb);
      };
      stale.sort(byAge);
      recent.sort(byAge);
      return [
        {
          key: "stale" as const,
          label: "Awaiting reply · 24h+",
          dotClass: "bg-destructive",
          tint: "rose" as const,
          emphasis: "loud" as const,
          defaultCollapsed: false,
          items: liftVip(stale),
        },
        {
          key: "recent" as const,
          label: "Sent recently",
          dotClass: "bg-primary",
          tint: "violet" as const,
          emphasis: "normal" as const,
          defaultCollapsed: false,
          items: liftVip(recent),
        },
      ];
    }
    return statusGroups.map((g) => {
      const items = filtered.filter((c) => c.status === g.key);
      // Needs action sorted by burn — most urgent first. Other groups keep order.
      const sorted = g.key === "needs_action" ? sortByBurn(items) : items;
      // VIP cases float to the top of their bucket, beating burn-down /
      // default order — operator's "this client matters" flag wins over
      // algorithmic priority. Exception: Resolved — these need no action,
      // so lifting VIP there creates a false priority signal in a section
      // that's collapsed by default anyway.
      return { ...g, items: g.key === "resolved" ? sorted : liftVip(sorted) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, onlyMine, requestStaleness, NOW_MS, isVip, vipTotal]);

  // Flat list of currently visible rows (respects collapsed groups) — drives j/k navigation.
  const visibleRows = useMemo(() => {
    const rows: { ref: string; status: Status | "stale" | "recent" }[] = [];
    grouped.forEach((g) => {
      if (collapsed[g.key]) return;
      g.items.forEach((c) => rows.push({ ref: c.ref, status: g.key }));
    });
    return rows;
  }, [grouped, collapsed]);

  // Inline row actions — quiet, only visible on hover.
  const handleApprove = (e: React.MouseEvent | null, ref: string) => {
    e?.stopPropagation();
    toast({ title: "Approval sent", description: ref });
  };
  const handleReassign = (e: React.MouseEvent | null, ref: string) => {
    e?.stopPropagation();
    toast({ title: "Reassign", description: `${ref} · pick owner in Console` });
    navigate(`/app/console?ref=${encodeURIComponent(ref)}`);
  };
  const handleOpen = (e: React.MouseEvent | null, ref: string) => {
    e?.stopPropagation();
    navigate(`/app/console?ref=${encodeURIComponent(ref)}`);
  };
  const handleOpenBundle = (
    e: React.MouseEvent | null,
    value: WorkspaceCase,
  ) => {
    e?.stopPropagation();
    navigate(buildCaseBundlePath(value));
  };
  const handleOpenEvidence = (
    e: React.MouseEvent | null,
    value: WorkspaceCase,
  ) => {
    e?.stopPropagation();
    navigate(buildCaseEvidencePath(value));
  };
  const handleOpenCaseVault = (
    e: React.MouseEvent | null,
    value: WorkspaceCase,
  ) => {
    e?.stopPropagation();
    navigate(buildCaseVaultPath(value));
  };
  // VIP toggle from row context menu — mirrors the client-tooltip Star, but
  // accessible without hover-targeting a 12px icon. Toast confirms the
  // direction (flag / unflag) so the operator gets feedback when right-
  // clicking deep in a long list.
  const handleToggleVip = (ref: string, client: string) => {
    const nowVip = toggleVip(ref);
    toast({
      title: nowVip ? "Flagged as VIP" : "VIP flag removed",
      description: `${client} · ${ref}`,
    });
  };

  // Selection helpers ------------------------------------------------------
  const toggleSelected = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
    setLastSelectedRef(ref);
  };

  const selectRange = (toRef: string) => {
    const toIdx = visibleRows.findIndex((r) => r.ref === toRef);
    if (toIdx < 0) return;
    const fromIdx = lastSelectedRef
      ? visibleRows.findIndex((r) => r.ref === lastSelectedRef)
      : -1;
    const start = fromIdx < 0 ? toIdx : Math.min(fromIdx, toIdx);
    const end = fromIdx < 0 ? toIdx : Math.max(fromIdx, toIdx);
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) next.add(visibleRows[i].ref);
      return next;
    });
    setLastSelectedRef(toRef);
  };

  const clearSelection = () => {
    setSelected(new Set());
    setLastSelectedRef(null);
  };

  const toggleGroupSelection = (groupRefs: string[]) => {
    const allSelected = groupRefs.every((r) => selected.has(r));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) groupRefs.forEach((r) => next.delete(r));
      else groupRefs.forEach((r) => next.add(r));
      return next;
    });
  };

  // Bulk actions — fired from floating action bar.
  const bulkReassign = () => {
    toast({ title: "Bulk reassign", description: `${selected.size} cases · pick owner` });
    clearSelection();
  };
  const bulkSnooze = () => {
    toast({ title: "Snoozed", description: `${selected.size} cases · 24h` });
    clearSelection();
  };
  const bulkResolve = () => {
    toast({ title: "Marked resolved", description: `${selected.size} cases` });
    clearSelection();
  };
  const bulkExport = () => {
    toast({ title: "Export started", description: `${selected.size} cases · CSV` });
  };
  // Bulk VIP cleanup — only meaningful when at least one selected case is
  // currently flagged. Lifts every flag in the selection in a single pass
  // (rather than asking the operator to right-click each row), which is the
  // entire point of having selection in the first place.
  const bulkUnflagVip = () => {
    const refs = [...selected].filter((r) => isVip(r));
    refs.forEach((r) => toggleVip(r));
    toast({
      title: "VIP flags removed",
      description: `${refs.length} case${refs.length === 1 ? "" : "s"} unflagged`,
    });
    clearSelection();
  };

  // Keyboard navigation — j/k, Enter, a, e, /, Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Esc — blur typing context, then clear selection, then focus.
      if (e.key === "Escape") {
        if (isTyping) {
          (target as HTMLElement).blur();
          e.preventDefault();
        } else if (selected.size > 0) {
          clearSelection();
          e.preventDefault();
        } else if (focusedRef) {
          setFocusedRef(null);
          e.preventDefault();
        }
        return;
      }

      // "/" — focus filter input.
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      // "i" — toggle "My requests" inbox filter. Mirrors the header pill so
      // operators can flip the view without leaving the keyboard. Honours the
      // same gate as the pill: no-op when nothing is outstanding (avoids a
      // confusing "filter on, zero results, can't tell why" state).
      if (e.key === "i" && !isTyping) {
        if (totalOutstanding === 0) return;
        e.preventDefault();
        setOnlyMine((v) => !v);
        return;
      }

      // "m" — toggle "Mine only" filter (cases owned by current operator).
      // Same disabled gate as the pill: skip when the operator owns nothing.
      if (e.key === "m" && !isTyping) {
        if (mineTotal === 0) return;
        e.preventDefault();
        setMineOnly((v) => !v);
        return;
      }

      // "v" — toggle "VIP only" filter. Disabled when nothing is flagged so
      // the operator never lands on an empty board with no obvious cause.
      if (e.key === "v" && !isTyping) {
        if (vipTotal === 0) return;
        e.preventDefault();
        setVipOnly((v) => !v);
        return;
      }

      if (isTyping) return;
      if (visibleRows.length === 0) return;

      const currentIdx = focusedRef
        ? visibleRows.findIndex((r) => r.ref === focusedRef)
        : -1;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIdx < 0 ? 0 : Math.min(visibleRows.length - 1, currentIdx + 1);
        setFocusedRef(visibleRows[next].ref);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIdx < 0 ? 0 : Math.max(0, currentIdx - 1);
        setFocusedRef(visibleRows[prev].ref);
        return;
      }

      if (currentIdx < 0) return;
      const row = visibleRows[currentIdx];

      if (e.key === "Enter") {
        e.preventDefault();
        handleOpen(null, row.ref);
        return;
      }
      if (e.key === "a" && row.status === "needs_action") {
        e.preventDefault();
        handleApprove(null, row.ref);
        return;
      }
      if (e.key === "e") {
        e.preventDefault();
        handleReassign(null, row.ref);
        return;
      }
      // x — toggle selection on focused row. Shift+X — range select.
      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        if (e.shiftKey) selectRange(row.ref);
        else toggleSelected(row.ref);
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, focusedRef, selected, lastSelectedRef, totalOutstanding, mineTotal, vipTotal]);

  // Scroll focused row into view.
  useEffect(() => {
    if (!focusedRef) return;
    const el = rowRefs.current.get(focusedRef);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedRef]);

  return (
    <div className="relative flex flex-col h-full">
      {/* Header — generous breathing room, no boxed metric. The active-count
          is inline with the title only when no filter is engaged; once
          the operator narrows the desk the active-filter ribbon below
          carries the count, so we drop it here to avoid duplicating
          information at competing weights. */}
      <div className="flex items-start justify-between gap-4 px-8 pt-6 pb-5">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 min-w-0 flex-wrap">
            <h1 className="font-serif text-[26px] tracking-tight leading-none">Live Desk</h1>
            <span className="font-mono text-[10.5px] text-muted-foreground/70 tabular-nums">
              {filtered.length} active
            </span>
            {visaIntakeDemo && (
              <Pill tone="violet" size="sm">
                7-minute path
              </Pill>
            )}
            {localServicesDispatchDemo && (
              <Pill tone="mint" size="sm">
                Local services demo
              </Pill>
            )}
            {localServicesRecordingMode && (
              <Pill tone="amber" size="sm">
                90s recording
              </Pill>
            )}
            {localServicesSetupWizardMode && (
              <Pill tone="violet" size="sm">
                7-min setup
              </Pill>
            )}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground/85 max-w-2xl leading-relaxed">
            {localServicesDispatchDemo
              ? "Answer phone requests, collect service details, prepare estimates, and hand off operator-approved bookings."
              : "Qualify leads, chase missing documents, prepare consultations, and hand off clean case context before deeper runtime review."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            size="sm"
            variant={localServicesDispatchDemo ? "secondary" : "outline"}
            onClick={localServicesDispatchDemo ? closeLocalServicesDispatchDemo : openLocalServicesDispatchDemo}
            className="h-8 text-xs"
          >
            {localServicesDispatchDemo ? (
              <>
                <X className="mr-0 sm:mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Exit local demo</span>
                <span className="sm:hidden">Exit</span>
              </>
            ) : (
              <>
                <PhoneCall className="mr-0 sm:mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Local services demo</span>
                <span className="sm:hidden">Local</span>
              </>
            )}
          </Button>
          {localServicesDispatchDemo && (
            <Button
              size="sm"
              variant={localServicesRecordingMode ? "secondary" : "outline"}
              onClick={
                localServicesRecordingMode
                  ? closeLocalServicesRecordingMode
                  : openLocalServicesRecordingMode
              }
              className="h-8 text-xs"
            >
              <Camera className="mr-0 sm:mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">
                {localServicesRecordingMode ? "Exit recording" : "90s recording"}
              </span>
              <span className="sm:hidden">90s</span>
            </Button>
          )}
          {localServicesDispatchDemo && (
            <Button
              size="sm"
              variant={localServicesSetupWizardMode ? "secondary" : "outline"}
              onClick={
                localServicesSetupWizardMode
                  ? closeLocalServicesSetupWizard
                  : openLocalServicesSetupWizard
              }
              className="h-8 text-xs"
            >
              <UserRoundCog className="mr-0 sm:mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">
                {localServicesSetupWizardMode ? "Exit setup" : "7-min setup"}
              </span>
              <span className="sm:hidden">Setup</span>
            </Button>
          )}
          <Button
            size="sm"
            variant={visaIntakeDemo ? "secondary" : "outline"}
            onClick={visaIntakeDemo ? closeVisaIntakeDemo : openVisaIntakeDemo}
            className="h-8 text-xs"
          >
            {visaIntakeDemo ? (
              <>
                <X className="mr-0 sm:mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Exit demo</span>
                <span className="sm:hidden">Exit</span>
              </>
            ) : (
              <>
                <ClipboardCheck className="mr-0 sm:mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Start 7-minute demo</span>
                <span className="sm:hidden">Demo</span>
              </>
            )}
          </Button>
          {/* "Mine only" — narrows desk to cases owned by CURRENT_OPERATOR.
              Sits to the LEFT of "My requests" so the pair reads naturally
              as a sentence: "mine only, my requests". Uses the rose tint
              to differentiate from the violet "My requests" pill — at a
              glance an operator can tell which lens is active without
              reading the label. Disabled (visible) when the operator owns
              zero cases, same affordance pattern as My requests. */}
          <button
            onClick={() => mineTotal > 0 && setMineOnly((v) => !v)}
            disabled={mineTotal === 0}
            title={
              mineTotal === 0
                ? "You own no cases right now"
                : mineOnly
                  ? `Showing only cases owned by ${CURRENT_OPERATOR} · click to clear`
                  : `Show only cases owned by ${CURRENT_OPERATOR}`
            }
            aria-pressed={mineOnly}
            className={`hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium ring-1 ring-inset transition-smooth ${
              mineOnly
                ? ""
                : mineTotal === 0
                  ? "text-muted-foreground/50 ring-border/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground ring-border/70 hover:ring-border bg-secondary/30"
            }`}
            style={
              mineOnly
                ? {
                    backgroundColor: "hsl(var(--tint-rose) / 0.16)",
                    // @ts-expect-error css var
                    "--tw-ring-color": "hsl(var(--tint-rose) / 0.38)",
                    color: "hsl(var(--tint-rose-fg))",
                  }
                : undefined
            }
          >
            <User className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Mine only</span>
            {mineTotal > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-[4px] font-mono text-[10px] tabular-nums"
                style={{
                  backgroundColor: mineOnly
                    ? "hsl(var(--tint-rose) / 0.28)"
                    : "hsl(var(--secondary) / 0.8)",
                  color: mineOnly
                    ? "hsl(var(--tint-rose-fg))"
                    : "hsl(var(--muted-foreground))",
                }}
              >
                {mineTotal}
              </span>
            )}
          </button>
          {/* "VIP only" — third lens, narrows to operator-flagged clients.
              Amber tint matches the Star indicator the operator already
              learned in the client tooltip + Live Desk row markers. Same
              disabled-when-zero affordance pattern as the other two pills. */}
          <button
            onClick={() => vipTotal > 0 && setVipOnly((v) => !v)}
            disabled={vipTotal === 0}
            title={
              vipTotal === 0
                ? "No VIP cases flagged yet"
                : vipOnly
                  ? "Showing only VIP cases · click to clear"
                  : "Show only VIP-flagged cases"
            }
            aria-pressed={vipOnly}
            className={`hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium ring-1 ring-inset transition-smooth ${
              vipOnly
                ? ""
                : vipTotal === 0
                  ? "bg-secondary/30 text-muted-foreground/40 ring-border/40 cursor-not-allowed"
                  : "bg-secondary/40 text-muted-foreground ring-border/60 hover:text-foreground hover:bg-secondary/60"
            }`}
            style={
              vipOnly
                ? {
                    backgroundColor: "hsl(var(--tint-amber) / 0.16)",
                    color: "hsl(var(--tint-amber-fg))",
                    // @ts-expect-error css var
                    "--tw-ring-color": "hsl(var(--tint-amber) / 0.32)",
                  }
                : undefined
            }
          >
            <Star
              className={`h-3.5 w-3.5 ${vipOnly ? "fill-current" : ""}`}
              strokeWidth={1.75}
            />
            <span>VIP only</span>
            {vipTotal > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-[4px] font-mono text-[10px] tabular-nums"
                style={{
                  backgroundColor: vipOnly
                    ? "hsl(var(--tint-amber) / 0.28)"
                    : "hsl(var(--secondary) / 0.8)",
                  color: vipOnly
                    ? "hsl(var(--tint-amber-fg))"
                    : "hsl(var(--muted-foreground))",
                }}
              >
                {vipTotal}
              </span>
            )}
          </button>
          {/* "My requests" inbox toggle — narrows the desk to cases with at
              least one outstanding doc request this session. Disabled (but
              still visible) when nothing is outstanding so operators learn
              the affordance exists even on a clean board. */}
          <button
            onClick={() => totalOutstanding > 0 && setOnlyMine((v) => !v)}
            disabled={totalOutstanding === 0}
            title={
              totalOutstanding === 0
                ? "No outstanding requests"
                : onlyMine
                  ? "Showing only cases with outstanding requests · click to clear"
                  : "Show only cases with outstanding requests"
            }
            aria-pressed={onlyMine}
            className={`hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium ring-1 ring-inset transition-smooth ${
              onlyMine
                ? "text-primary"
                : totalOutstanding === 0
                  ? "text-muted-foreground/50 ring-border/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground ring-border/70 hover:ring-border bg-secondary/30"
            }`}
            style={
              onlyMine
                ? {
                    backgroundColor: "hsl(var(--tint-violet) / 0.16)",
                    // @ts-expect-error css var
                    "--tw-ring-color": "hsl(var(--tint-violet) / 0.38)",
                    color: "hsl(var(--tint-violet-fg))",
                  }
                : undefined
            }
          >
            <Inbox className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>My requests</span>
            {totalOutstanding > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-[4px] font-mono text-[10px] tabular-nums"
                style={{
                  backgroundColor: onlyMine
                    ? "hsl(var(--tint-violet) / 0.28)"
                    : "hsl(var(--secondary) / 0.8)",
                  color: onlyMine
                    ? "hsl(var(--tint-violet-fg))"
                    : "hsl(var(--muted-foreground))",
                }}
              >
                {totalOutstanding}
              </span>
            )}
          </button>
          <div className="hidden md:flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-secondary/30 w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter cases…  ( / )"
              className="bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none flex-1 min-w-0"
            />
            <kbd className="hidden lg:inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-background/60 ring-1 ring-inset ring-border/60 font-mono text-[9px] text-muted-foreground/80">
              /
            </kbd>
          </div>
          <Button
            size="sm"
            onClick={() => setNewCaseOpen(true)}
            className="h-8 text-xs bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            New case
          </Button>
        </div>
      </div>

      {localServicesDispatchDemo && (
        <LocalServicesDispatchDemoPanel
          activeServiceId={activeLocalServiceId}
          recordingMode={localServicesRecordingMode}
          setupWizardMode={localServicesSetupWizardMode}
          onSelectService={(id) =>
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("demo", "local-services-dispatch");
              next.set("service", id);
              next.delete("playbook");
              return next;
            })
          }
          onClose={closeLocalServicesDispatchDemo}
          onCopyPayload={copyLocalServiceDispatchPayload}
          onCopyText={copyLocalServicePilotWorkspaceExport}
          onOpenDispatchDrawer={openActiveLocalServiceDispatchDrawer}
          onOpenPath={openLocalServiceDemoPath}
          onOpenSetupWizard={openLocalServicesSetupWizard}
        />
      )}

      {!localServicesDispatchDemo && playbookTemplates.length > 0 && (
        <section className="px-8 pb-5" aria-label="Workflow playbook templates">
          <div className="flex items-center gap-2 mb-3">
            <Pill tone="slate" size="sm">
              Playbook templates
            </Pill>
            <p className="text-[11.5px] text-muted-foreground">
              Four workflow lanes for qualification, documents, booking, and handoff.
            </p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {playbookTemplates.map((template) => (
              <PlaybookTemplateCard
                key={template.id}
                template={template}
                selected={activePlaybookTemplate?.id === template.id}
                onSelect={() =>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("playbook", template.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
          {activePlaybookTemplate && activePlaybookPayloadPreview && (
            <PlaybookTemplateDetailPanel
              template={activePlaybookTemplate}
              payloadPreview={activePlaybookPayloadPreview}
              onCopyPayload={copyActivePlaybookPayload}
              onOpenExportDrawer={openActivePlaybookExportDrawer}
            />
          )}
        </section>
      )}

      <PlaybookExportDrawer
        open={playbookExportDrawerOpen}
        onOpenChange={setPlaybookExportDrawerOpen}
        template={activePlaybookTemplate}
        payloadPreview={activePlaybookPayloadPreview}
        wiki={activePlaybookWiki}
        mode={playbookExportMode}
        onModeChange={setPlaybookExportMode}
        onCopy={copyPlaybookExport}
        onOpenSurface={openActivePlaybookSurface}
      />

      <LocalServiceDispatchDrawer
        open={localServiceDispatchDrawerOpen}
        onOpenChange={setLocalServiceDispatchDrawerOpen}
        template={localServicesDispatchDemo ? activeLocalServiceTemplate : null}
        exportKind={localServiceExportKind}
        mode={localServiceDispatchMode}
        onModeChange={setLocalServiceDispatchMode}
        onCopy={copyLocalServiceDispatchExport}
        onOpenBundle={openActiveLocalServiceBundle}
        onOpenEvidence={openActiveLocalServiceEvidence}
      />

      <NewCaseSheet
        open={newCaseOpen}
        onOpenChange={setNewCaseOpen}
        existingCases={cases}
        onCreated={(draft) => {
          addDraftCase(draft);
          setFreshRef(draft.ref);
          const ref = draft.ref;
          // 2s matches the fresh-glow keyframe; clear the marker so re-renders
          // don't loop the animation.
          window.setTimeout(() => {
            setFreshRef((curr) => (curr === draft.ref ? null : curr));
          }, 2000);
          // Force-expand the section the new case lands in — otherwise the
          // fresh-glow plays inside a collapsed group and the operator sees
          // nothing. New cases are created in `in_flight`; in My-requests
          // mode they fall into `recent` (zero outstanding requests yet).
          setCollapsed((prev) => ({ ...prev, in_flight: false, recent: false }));
          // Auto-focus the new row so j/k navigation lands on it and the
          // operator's eye is drawn to the top of in-flight.
          setFocusedRef(draft.ref);
          toast({
            title: "Case created",
            description: `${ref} added to Live Desk · top of in-flight.`,
          });
        }}
      />

      {visaIntakeDemo && visaIntakeDemoCase && (
        <SevenMinuteVisaIntakePanel
          caseValue={visaIntakeDemoCase}
          onClose={closeVisaIntakeDemo}
          onOpenConsole={() =>
            navigate(`/app/console?ref=${encodeURIComponent(visaIntakeDemoCase.ref)}&focus=approval`)
          }
          onOpenBundle={() => navigate(buildCaseBundlePath(visaIntakeDemoCase))}
          onOpenEvidence={() => navigate(buildCaseEvidencePath(visaIntakeDemoCase))}
          onOpenCaseVault={() => navigate(buildCaseVaultPath(visaIntakeDemoCase))}
        />
      )}

      {/* Grouped list */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Active-filter ribbon — appears whenever "My requests" or "Mine
            only" is active (or both). Makes the narrowed view obvious
            (otherwise an empty desk reads as "nothing to do" rather than
            "filter is hiding things") and gives a one-click escape hatch
            back to the full board. When both filters are on we stack the
            two labels as inline chips so it's unambiguous which lenses are
            composed; the surrounding ribbon picks the violet tint to keep
            the visual language consistent across single- and multi-filter
            states. */}
        {(onlyMine || mineOnly || vipOnly || nodeFilterMeta || infraFilter === "degraded" || burningFilter) && (
          <div
            className="mx-8 mt-4 flex items-center gap-2.5 h-8 pl-2.5 pr-1.5 rounded-md ring-1 ring-inset"
            style={{
              backgroundColor: burningFilter ? "hsl(var(--tint-rose) / 0.08)" : "hsl(var(--tint-violet) / 0.08)",
              // @ts-expect-error css var
              "--tw-ring-color": burningFilter ? "hsl(var(--tint-rose) / 0.24)" : "hsl(var(--tint-violet) / 0.22)",
            }}
          >
            <div className="flex items-center gap-1.5">
              {burningFilter && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-rose) / 0.18)",
                    color: "hsl(var(--tint-rose-fg))",
                  }}
                  title="Cases under 1h SLA"
                >
                  <Flame className="h-3 w-3" strokeWidth={2} />
                  SLA burning
                </span>
              )}
              {nodeFilterMeta && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium font-mono tabular-nums"
                  style={{
                    backgroundColor:
                      nodeFilterMeta.status === "offline"
                        ? "hsl(var(--tint-crimson) / 0.18)"
                        : "hsl(var(--tint-violet) / 0.18)",
                    color:
                      nodeFilterMeta.status === "offline"
                        ? "hsl(var(--tint-crimson-fg))"
                        : "hsl(var(--tint-violet-fg))",
                  }}
                  title={`${nodeFilterMeta.label} · ${nodeFilterMeta.city}`}
                >
                  <Server className="h-3 w-3" strokeWidth={2} />
                  {nodeFilterMeta.id}
                </span>
              )}
              {infraFilter === "degraded" && !nodeFilterMeta && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-amber) / 0.18)",
                    color: "hsl(var(--tint-amber-fg))",
                  }}
                  title="Cases captured by non-healthy nodes"
                >
                  <Server className="h-3 w-3" strokeWidth={2} />
                  Degraded infra
                </span>
              )}
              {mineOnly && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-rose) / 0.18)",
                    color: "hsl(var(--tint-rose-fg))",
                  }}
                >
                  <User className="h-3 w-3" strokeWidth={2} />
                  Mine only
                </span>
              )}
              {vipOnly && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-amber) / 0.18)",
                    color: "hsl(var(--tint-amber-fg))",
                  }}
                >
                  <Star className="h-3 w-3 fill-current" strokeWidth={2} />
                  VIP only
                </span>
              )}
              {onlyMine && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-violet) / 0.18)",
                    color: "hsl(var(--tint-violet-fg))",
                  }}
                >
                  <Inbox className="h-3 w-3" strokeWidth={2} />
                  My requests
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {filtered.length === 0
                ? "no cases match"
                : `${filtered.length} case${filtered.length === 1 ? "" : "s"} match`}
            </span>
            <button
              onClick={() => {
                setOnlyMine(false);
                setMineOnly(false);
                setVipOnly(false);
                clearNodeFilter();
              }}
              className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-smooth"
            >
              <X className="h-3 w-3" strokeWidth={1.75} />
              Clear
            </button>
          </div>
        )}
        {grouped.map((g, gi) => {
          const muted = g.emphasis === "muted";
          return (
            <section
              key={g.key}
              className={`${gi === 0 ? "pt-5" : "pt-9"} ${muted ? "opacity-70 hover:opacity-100 transition-opacity" : ""}`}
            >
              {/* Status header — sticky tinted band */}
              <div className="sticky top-0 z-20 px-8 pb-1.5 bg-background/95 backdrop-blur-sm">
                <button
                  onClick={() =>
                    setCollapsed((s) => ({ ...s, [g.key]: !s[g.key] }))
                  }
                  className="group/hd relative w-full flex items-center gap-3 h-9 pl-3 pr-3.5 rounded-md text-left transition-smooth ring-1 ring-inset hover:brightness-150 shadow-[0_8px_16px_-10px_rgba(0,0,0,0.6)] overflow-hidden"
                  style={{
                    backgroundColor: `hsl(var(--tint-${g.tint}) / ${muted ? 0.06 : 0.1})`,
                    // @ts-expect-error css var
                    "--tw-ring-color": `hsl(var(--tint-${g.tint}) / ${muted ? 0.12 : 0.18})`,
                  }}
                >
                  {/* Active accent-bar — only for the expanded (in-focus)
                      group. Saturated tint rule on the left edge mirrors the
                      AppSidebar active-row pattern and the /evidence section
                      anchors, so "where am I working right now?" reads in a
                      single glance across the workspace. */}
                  {!collapsed[g.key] && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                      style={{ backgroundColor: `hsl(var(--tint-${g.tint}-fg) / ${muted ? 0.55 : 0.85})` }}
                    />
                  )}
                  <ChevronDown
                    className={`h-3 w-3 text-muted-foreground/80 transition-smooth shrink-0 ${
                      collapsed[g.key] ? "-rotate-90" : ""
                    }`}
                    strokeWidth={1.75}
                  />
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ring-2 ring-background/60 ${g.dotClass} ${
                      g.key === "needs_action" ? "animate-pulse-soft" : ""
                    }`}
                  />
                  <span
                    className="text-[12px] font-semibold tracking-tight"
                    style={{ color: `hsl(var(--tint-${g.tint}-fg))` }}
                  >
                    {g.label}
                  </span>
                  {g.key === "needs_action" && g.items.length > 0 && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 ml-1">
                      sorted by burn
                    </span>
                  )}
                  {(g.key === "stale" || g.key === "recent") && g.items.length > 0 && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 ml-1">
                      oldest first
                    </span>
                  )}
                  {(() => {
                    const vipInGroup = g.items.reduce((n, c) => n + (isVip(c.ref) ? 1 : 0), 0);
                    return (
                      <span className="ml-auto inline-flex items-center gap-1.5">
                        {vipInGroup > 0 && (
                          <span
                            className="inline-flex items-center gap-1 h-[18px] pl-1 pr-1.5 rounded-[5px] font-mono text-[10px] tabular-nums ring-1 ring-inset"
                            style={{
                              backgroundColor: "hsl(var(--tint-amber) / 0.14)",
                              color: "hsl(var(--tint-amber-fg))",
                              // @ts-expect-error css var
                              "--tw-ring-color": "hsl(var(--tint-amber) / 0.28)",
                            }}
                            title={`${vipInGroup} VIP case${vipInGroup === 1 ? "" : "s"} in this group`}
                          >
                            <Star className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
                            {vipInGroup}
                          </span>
                        )}
                        <span
                          className="inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-[5px] bg-background/40 font-mono text-[10px] tabular-nums ring-1 ring-inset"
                          style={{
                            color: `hsl(var(--tint-${g.tint}-fg) / 0.85)`,
                            // @ts-expect-error css var
                            "--tw-ring-color": `hsl(var(--tint-${g.tint}) / 0.20)`,
                          }}
                        >
                          {g.items.length.toString().padStart(2, "0")}
                        </span>
                      </span>
                    );
                  })()}
                </button>
              </div>

              {/* Per-group column header */}
              {!collapsed[g.key] && g.items.length > 0 && (() => {
                const groupRefs = g.items.map((c) => c.ref);
                const selectedInGroup = groupRefs.filter((r) => selected.has(r)).length;
                const allSelected = selectedInGroup === groupRefs.length;
                const someSelected = selectedInGroup > 0 && !allSelected;
                return (
                  <div
                    className={`${COLS} px-8 pt-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-medium`}
                  >
                    <button
                      onClick={() => toggleGroupSelection(groupRefs)}
                      title={allSelected ? "Deselect all in group" : "Select all in group"}
                      className={`h-3.5 w-3.5 rounded-[3px] ring-1 ring-inset transition-smooth flex items-center justify-center ${
                        allSelected || someSelected
                          ? "bg-primary/80 ring-primary/80"
                          : "bg-transparent ring-border/70 hover:ring-foreground/40"
                      }`}
                    >
                      {allSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
                      {someSelected && <span className="h-[2px] w-2 rounded-full bg-primary-foreground" />}
                    </button>
                    <span>Ref</span>
                    <span>Client</span>
                    <span>Stage</span>
                    <span>Owner</span>
                    <span className="text-right">SLA</span>
                    <span className="text-right">Updated</span>
                  </div>
                );
              })()}

              {!collapsed[g.key] &&
                g.items.map((c) => {
                  const isFocused = focusedRef === c.ref;
                  const isSelected = selected.has(c.ref);
                  const isFresh = freshRef === c.ref;
                  const hasSelection = selected.size > 0;
                  return (
                  <ContextMenu key={c.ref}>
                    <ContextMenuTrigger asChild>
                  <div
                    ref={(el) => {
                      if (el) rowRefs.current.set(c.ref, el);
                      else rowRefs.current.delete(c.ref);
                    }}
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      setFocusedRef(c.ref);
                      // When a selection is active, row click toggles selection instead of navigating.
                      // Shift+click extends the range from the last selected row.
                      if (hasSelection || e.shiftKey) {
                        if (e.shiftKey) selectRange(c.ref);
                        else toggleSelected(c.ref);
                        return;
                      }
                      navigate(`/app/console?ref=${encodeURIComponent(c.ref)}`);
                    }}
                    className={`${COLS} relative px-8 py-4 border-b border-border/30 transition-smooth cursor-pointer group focus:outline-none ${
                      isSelected
                        ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                        : isFocused
                          ? "bg-secondary/40 ring-1 ring-inset ring-primary/40"
                          : "hover:bg-secondary/30"
                    } ${isFresh ? "animate-fresh-glow" : ""}`}
                  >
                    {/* VIP priority accent — 1px amber rule on the left edge.
                        Reads as a status marker without interfering with the
                        row's selection/focus rings or background tints. */}
                    {isVip(c.ref) && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-0 bottom-0 w-px"
                        style={{ backgroundColor: "hsl(var(--tint-amber-fg))" }}
                      />
                    )}
                    {/* Bulk-select checkbox — visible on hover, when selected, or when any selection is active */}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (e.shiftKey) selectRange(c.ref);
                        else toggleSelected(c.ref);
                      }}
                      title={isSelected ? "Deselect (x)" : "Select (x · shift+x for range)"}
                      className={`h-3.5 w-3.5 rounded-[3px] ring-1 ring-inset transition-smooth flex items-center justify-center ${
                        isSelected
                          ? "bg-primary ring-primary opacity-100"
                          : hasSelection
                            ? "bg-transparent ring-border/70 opacity-100 hover:ring-foreground/40"
                            : "bg-transparent ring-border/70 opacity-0 group-hover:opacity-100 hover:ring-foreground/40"
                      }`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
                    </button>

                    {/* Ref */}
                    <span className="font-mono text-[11px] text-muted-foreground group-hover:text-foreground tabular-nums">
                      {c.ref}
                    </span>

                    {/* Client + visa pill + flag */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${g.dotClass} ${
                          g.key === "needs_action" ? "animate-pulse-soft" : ""
                        }`}
                      />
                      <span className="text-sm truncate">{c.client}</span>
                      {isVip(c.ref) && (
                        <span
                          aria-label="VIP client"
                          title="VIP client"
                          className="shrink-0 inline-flex"
                        >
                          <Star
                            className="h-3 w-3 fill-current"
                            style={{ color: "hsl(var(--tint-amber-fg))" }}
                            strokeWidth={1.5}
                          />
                        </span>
                      )}
                      <Pill tone={visaTone[c.visa] || "slate"} size="sm">
                        {c.visa}
                      </Pill>
                      <CountryChip code={c.country} />
                      {/* Node health indicator — surfaces *only* when the
                          capturing device isn't healthy. Healthy is the
                          default and silent: a dot on every row would just
                          be noise and hide the actually-degraded ones. The
                          colour follows project semantics (crimson = infra
                          failure, amber = degradation, slate = maintenance);
                          click jumps to /app/nodes?node=ID. Tooltip carries
                          the full context (ID + label + status) so the
                          operator can decide priority without leaving the
                          desk. */}
                      {(() => {
                        if (!c.sourceNodeId) return null;
                        const node: EdgeNode | undefined = deviceNodes.find(
                          (n) => n.id === c.sourceNodeId,
                        );
                        if (!node || node.status === "healthy") return null;
                        const meta = STATUS_META[node.status];
                        const dotColor = `hsl(var(--tint-${meta.tint}-fg))`;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Captured by ${node.id}, ${meta.label.toLowerCase()}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/app/nodes?node=${encodeURIComponent(node.id)}`,
                                  );
                                }}
                                className="shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full transition-smooth hover:bg-secondary/40"
                              >
                                <span className="relative inline-flex h-1.5 w-1.5">
                                  {meta.pulse && (
                                    <span
                                      className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                                      style={{ backgroundColor: dotColor }}
                                    />
                                  )}
                                  <span
                                    className="relative inline-flex h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: dotColor }}
                                  />
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[11px] py-1.5 px-2.5">
                              <div className="flex items-center gap-1.5">
                                <Server
                                  className="h-3 w-3"
                                  strokeWidth={1.75}
                                  style={{ color: dotColor }}
                                />
                                <span className="font-mono tabular-nums">{node.id}</span>
                                <span className="text-muted-foreground/70">·</span>
                                <span style={{ color: dotColor }}>
                                  {meta.label.toLowerCase()}
                                </span>
                              </div>
                              <div className="text-muted-foreground/80 mt-0.5">
                                {node.label} · {node.city}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </div>

                    {/* Stage with quiet glyph + optional stuck badge */}
                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground truncate min-w-0">
                      <StageIcon stage={c.stage} />
                      <span className="truncate">{c.stage}</span>
                      {(() => {
                        const reqCount = requestCounts.get(c.ref) ?? 0;
                        if (reqCount === 0) return null;
                        const age = shortAge(requestStaleness.get(c.ref), NOW_MS);
                        const isStale = (() => {
                          const at = requestStaleness.get(c.ref);
                          return at ? NOW_MS - new Date(at).getTime() >= STALE_MS : false;
                        })();
                        // Once a request crosses the 24h staleness mark we shift the
                        // badge to a rose tint so the row reads as "rotting" without
                        // the operator needing to flip into My-requests mode.
                        const tint = isStale ? "rose" : "violet";
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Clickable shortcut → jumps straight to the
                                  Operator Console with the Documents section
                                  scrolled into view. Stops propagation so the
                                  outer row click (which also opens the case,
                                  but to the approval hero) doesn't fire. */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/app/console?ref=${encodeURIComponent(c.ref)}&focus=documents`,
                                  );
                                }}
                                className="inline-flex items-center gap-1 h-4 px-1.5 rounded-sm font-mono text-[9px] uppercase tracking-wide shrink-0 transition-smooth hover:brightness-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 ring-1 ring-inset"
                                style={{
                                  color: `hsl(var(--tint-${tint}-fg))`,
                                  backgroundColor: `hsl(var(--tint-${tint}) / 0.10)`,
                                  ['--tw-ring-color' as any]: `hsl(var(--tint-${tint}) / 0.22)`,
                                }}
                                aria-label={`Open ${c.ref} documents · ${reqCount} requested${age ? ` · ${age} ago` : ""}`}
                              >
                                <span className="h-1 w-1 rounded-full bg-current opacity-70" />
                                {reqCount} requested
                                {age && (
                                  <>
                                    <span className="opacity-40">·</span>
                                    <span className="normal-case tracking-normal opacity-80">{age}</span>
                                  </>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-mono text-[10px]">
                              Open documents · {reqCount} requested
                              {age ? ` · oldest ${age} ago` : ""}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                      {(() => {
                        const stuck = stuckLabel(c.stageEnteredAt);
                        if (!stuck) return null;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center gap-1 h-4 px-1.5 rounded-sm font-mono text-[9px] uppercase tracking-wide shrink-0 ring-1 ring-inset ring-[hsl(var(--tint-amber)/0.22)]"
                                style={{
                                  color: "hsl(var(--tint-amber-fg))",
                                  backgroundColor: "hsl(var(--tint-amber) / 0.10)",
                                }}
                              >
                                stuck {stuck}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-mono text-[10px]">
                              In stage since {new Date(c.stageEnteredAt).toUTCString().slice(5, 22)}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </span>

                    {/* Owner — avatar + name. Hidden on row hover to make room for actions. */}
                    <span className="flex items-center gap-2 min-w-0 transition-opacity group-hover:opacity-0">
                      <OwnerAvatar name={c.owner} mine={c.owner === CURRENT_OPERATOR} />
                      <span className="text-[11px] text-muted-foreground truncate">
                        {c.owner}
                      </span>
                    </span>

                    {/* SLA — time + thin burn-down bar */}
                    <span className="flex flex-col items-end gap-1 min-w-0">
                      <span
                        className={`font-mono text-[11px] tabular-nums leading-none ${
                          c.slaWarn ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {c.sla}
                      </span>
                      {(() => {
                        const pct = slaBurnPercent(c.sla);
                        if (pct === null) return null;
                        return (
                          <span className="block w-12 h-[2px] rounded-full bg-secondary/60 overflow-hidden">
                            <span
                              className="block h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: c.slaWarn
                                  ? "hsl(var(--tint-rose-fg))"
                                  : "hsl(var(--muted-foreground) / 0.5)",
                              }}
                            />
                          </span>
                        );
                      })()}
                    </span>

                    {/* Updated — date in tooltip, stays terse in the row */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-right font-mono text-[10px] text-muted-foreground tabular-nums cursor-default">
                          {c.updated}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="font-mono text-[10px]">
                        Last updated · {c.updated}
                      </TooltipContent>
                    </Tooltip>

                    {/* Inline row-actions — appear on hover, sit over Owner column */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity pointer-events-none ${
                        selected.size > 0
                          ? "opacity-0"
                          : "opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto"
                      }`}
                      style={{
                        // Align with Owner column start: 32px (px-8) + sum of prior cols + gaps
                        // 32 + 88 + 24 + (1.4fr) + 24 + (1fr) + 24 — too dynamic; use right offset instead.
                        right: "calc(60px + 88px + 24px + 24px)",
                      }}
                    >
                      {g.key === "needs_action" && (
                        <button
                          onClick={(e) => handleApprove(e, c.ref)}
                          title="Approve (a)"
                          className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium ring-1 ring-inset transition-smooth hover:brightness-125"
                          style={{
                            backgroundColor: "hsl(var(--tint-mint) / 0.16)",
                            color: "hsl(var(--tint-mint-fg))",
                            // @ts-expect-error css var
                            "--tw-ring-color": "hsl(var(--tint-mint) / 0.22)",
                          }}
                        >
                          <Check className="h-3 w-3" strokeWidth={2.25} />
                          Approve
                        </button>
                      )}
                      <button
                        onClick={(e) => handleReassign(e, c.ref)}
                        title="Reassign owner"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <UserRoundCog className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={(e) => handleOpenBundle(e, c)}
                        title="Open presentation bundle"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <FileText className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={(e) => handleOpenEvidence(e, c)}
                        title="Open visual evidence"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <Camera className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={(e) => handleOpenCaseVault(e, c)}
                        title="Open Case Vault"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <Server className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={(e) => handleOpen(e, c.ref)}
                        title="Open in Console (↵)"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover/95 backdrop-blur-md border-border">
                      <ContextMenuItem
                        onSelect={() => handleOpen(null, c.ref)}
                        className="text-[12px] gap-2"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open in Console
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">↵</span>
                      </ContextMenuItem>
                      {g.key === "needs_action" && (
                        <ContextMenuItem
                          onSelect={() => handleApprove(null, c.ref)}
                          className="text-[12px] gap-2"
                          style={{ color: "hsl(var(--tint-mint-fg))" }}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2} />
                          Approve
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">a</span>
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem
                        onSelect={() => handleReassign(null, c.ref)}
                        className="text-[12px] gap-2"
                      >
                        <UserRoundCog className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Reassign owner
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">e</span>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => handleOpenBundle(null, c)}
                        className="text-[12px] gap-2"
                      >
                        <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open presentation bundle
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => handleOpenEvidence(null, c)}
                        className="text-[12px] gap-2"
                      >
                        <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open visual evidence
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => handleOpenCaseVault(null, c)}
                        className="text-[12px] gap-2"
                      >
                        <Server className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open Case Vault
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      {/* VIP toggle — labelled by current state so the action
                          reads as the verb, not the noun. Amber accent only on
                          the unflag direction (the destructive-ish path), so
                          it doesn't compete with the row's own VIP marker. */}
                      <ContextMenuItem
                        onSelect={() => handleToggleVip(c.ref, c.client)}
                        className="text-[12px] gap-2"
                        style={
                          isVip(c.ref)
                            ? { color: "hsl(var(--tint-amber-fg))" }
                            : undefined
                        }
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${isVip(c.ref) ? "fill-current" : ""}`}
                          strokeWidth={1.75}
                        />
                        {isVip(c.ref) ? "Remove VIP flag" : "Flag as VIP"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  );
                })}

              {!collapsed[g.key] && g.items.length === 0 && (
                <div className="px-8 py-3 text-[11px] text-muted-foreground/70 italic border-b border-border/40">
                  No cases.
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Floating bulk-action bar — appears when one or more cases are selected */}
      {selected.size > 0 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 animate-fade-up">
          <div className="flex items-center gap-1 h-11 pl-2 pr-2 rounded-xl bg-card/95 backdrop-blur-md ring-1 ring-inset ring-border shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)]">
            {/* Selection counter */}
            <div className="flex items-center gap-2 h-7 pl-2 pr-3 rounded-lg bg-primary/15 ring-1 ring-inset ring-primary/30">
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-primary text-primary-foreground font-mono text-[10px] tabular-nums font-semibold">
                {selected.size}
              </span>
              <span className="text-[11px] font-medium text-primary">
                selected
              </span>
            </div>
            <div className="h-5 w-px bg-border/80 mx-0.5" />
            <button
              onClick={bulkReassign}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] text-foreground/90 hover:bg-secondary/80 transition-smooth"
            >
              <UserRoundCog className="h-3.5 w-3.5" strokeWidth={1.75} />
              Reassign
            </button>
            <button
              onClick={bulkSnooze}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] text-foreground/90 hover:bg-secondary/80 transition-smooth"
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
              Snooze
            </button>
            <button
              onClick={bulkResolve}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] transition-smooth hover:brightness-125"
              style={{
                color: "hsl(var(--tint-mint-fg))",
                backgroundColor: "hsl(var(--tint-mint) / 0.14)",
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Mark resolved
            </button>
            <button
              onClick={bulkExport}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] text-foreground/90 hover:bg-secondary/80 transition-smooth"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              Export
            </button>
            {/* Bulk VIP unflag — only shown when the selection contains at
                least one flagged case, so the bar stays quiet for typical
                triage selections. Amber tint matches every other VIP cue. */}
            {(() => {
              const vipInSelection = [...selected].filter((r) => isVip(r)).length;
              if (vipInSelection === 0) return null;
              return (
                <button
                  onClick={bulkUnflagVip}
                  title={`Remove VIP flag from ${vipInSelection} case${vipInSelection === 1 ? "" : "s"}`}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] transition-smooth hover:brightness-125"
                  style={{
                    color: "hsl(var(--tint-amber-fg))",
                    backgroundColor: "hsl(var(--tint-amber) / 0.14)",
                  }}
                >
                  <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                  Unflag VIP
                  <span className="font-mono text-[10px] opacity-70">{vipInSelection}</span>
                </button>
              );
            })()}
            <div className="h-5 w-px bg-border/80 mx-0.5" />
            <button
              onClick={clearSelection}
              title="Clear selection (esc)"
              className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-smooth"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}

      {/* Footer — keyboard hints. Same dim-on-rest, brighten-on-hover
          treatment as /app/nodes so the rhythm reads as one product
          instead of three independently-styled surfaces. */}
      <div className="group/foot shrink-0 px-8 py-2 text-[10px] text-muted-foreground/80 border-t border-border/40 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4 flex-wrap opacity-45 group-hover/foot:opacity-100 transition-smooth">
          <ShortcutHint keys={["j", "k"]} label="navigate" />
          <ShortcutHint keys={["↵"]} label="open" />
          <ShortcutHint keys={["a"]} label="approve" dim={!focusedRef || visibleRows.find((r) => r.ref === focusedRef)?.status !== "needs_action"} />
          <ShortcutHint keys={["e"]} label="reassign" dim={!focusedRef} />
          <ShortcutHint keys={["x"]} label="select" dim={!focusedRef} />
          <ShortcutHint keys={["⇧", "x"]} label="range" dim={!focusedRef || !lastSelectedRef} />
          <ShortcutHint keys={["/"]} label="filter" />
          <ShortcutHint keys={["i"]} label="inbox" dim={totalOutstanding === 0} />
          <ShortcutHint keys={["m"]} label="mine" dim={mineTotal === 0} />
          <ShortcutHint keys={["esc"]} label={selected.size > 0 ? "clear selection" : "clear"} />
          <ShortcutHint keys={["?"]} label="all shortcuts" />
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="opacity-60 group-hover/foot:opacity-100 transition-smooth">{filtered.length} of {cases.length}</span>
          <span className="font-mono">synced 12s ago</span>
        </div>
      </div>
    </div>
  );
};
