// Single source of truth for workspace counts surfaced in the sidebar.
// Live Desk shows the number of *active* cases (everything not resolved).
// Operator Console shows the number of *pending approvals* awaiting the operator.

export type CaseStatus =
  | "needs_action"
  | "in_flight"
  | "awaiting_client"
  | "resolved";

export type CaseEventActor = "AI" | "Client" | "Operator" | "System";

export interface CaseEvent {
  /** ISO timestamp of the event. */
  at: string;
  actor: CaseEventActor;
  title: string;
}

// Pending approval payload rendered as the Operator Console hero.
// `headline` is split: prefix + emphasis (italic, gradient) + suffix.
export interface CaseApproval {
  /** Eyebrow label, e.g. "Approval required · 1 of 1". */
  eyebrow: string;
  headline: { prefix: string; emphasis: string; suffix: string };
  /** Drafted body the operator is asked to approve, sent verbatim on Approve. */
  draft: string;
  /** Small chips under the draft, surfacing trust signals. */
  signals: { label: string; tone: "violet" | "rose" | "amber" | "mint" | "slate" }[];
}

export type DocState = "ok" | "missing" | "review";

export interface CaseDocument {
  name: string;
  state: DocState;
}

export interface WorkspaceCase {
  ref: string;
  caseId?: string;
  sessionId?: string | null;
  source?: "mock" | "runtime" | "draft";
  client: string;
  /** Client primary email — surfaced in the Console identity tooltip. */
  email: string;
  /** Client primary phone in international format (e.g. "+49 30 12345678"). */
  phone: string;
  visa: string;
  country: string;
  stage: string;
  /** ISO timestamp when this case entered its current stage. Drives the "stuck" badge. */
  stageEnteredAt: string;
  owner: string;
  status: CaseStatus;
  sla: string;
  slaWarn?: boolean;
  updated: string;
  /** Chronological event log shown in the Operator Console. */
  events: CaseEvent[];
  /** Present only when status === "needs_action" — drives the Console hero. */
  approval?: CaseApproval;
  /** Required documents for this case, with current verification state. */
  documents: CaseDocument[];
  /** Edge node that captured this case (kiosk/scanner/partner terminal that
   *  produced the lead). Drives "Open related cases" deep-linking from
   *  /app/nodes and the future per-node case rollups. Geo-correlated with
   *  client.country where possible — assigning a JP case to NODE-LON-04
   *  would break the operator's mental map. */
  sourceNodeId?: string;
}

// "Now" anchor for stuck calculations — keeps the demo deterministic across reloads.
// Tuned so VS-2841 (2d ago) and VS-2839 (3d ago) read as stuck, others fresh.
export const NOW_ISO = "2026-06-26T18:00:00Z";

export const workspaceCases: WorkspaceCase[] = [
  {
    ref: "VS-2841", client: "A. Petrov",
    email: "alex.petrov@kontur-mail.de", phone: "+49 30 4408 1729",
    visa: "EU Blue Card", country: "DE",
    stage: "Document follow-up", stageEnteredAt: "2026-06-24T14:00:00Z",
    owner: "Maya K.", status: "needs_action", sla: "2h 14m", slaWarn: true, updated: "Jun 26",
    sourceNodeId: "NODE-BER-01",
    events: [
      { at: "2026-06-22T08:14:00Z", actor: "AI",       title: "Lead intake completed" },
      { at: "2026-06-22T08:22:00Z", actor: "AI",       title: "Consultation booked · 18 Apr 14:00 CET" },
      { at: "2026-06-23T09:07:00Z", actor: "Client",   title: "Uploaded employment contract" },
      { at: "2026-06-23T09:08:00Z", actor: "AI",       title: "Document gap detected · passport scan" },
      { at: "2026-06-24T14:00:00Z", actor: "System",   title: "Stage → Document follow-up" },
      { at: "2026-06-26T15:42:00Z", actor: "Operator", title: "Maya K. drafted reminder · awaiting approval" },
    ],
    approval: {
      eyebrow: "Approval required · 1 of 1",
      headline: {
        prefix: "Send reminder for missing ",
        emphasis: "passport scan",
        suffix: " to A. Petrov?",
      },
      draft:
        "Здравствуйте, Александр.\n\nДля подачи заявки на EU Blue Card нам ещё нужен скан вашего\nзагранпаспорта (страница с фото) и апостиль диплома.\nЗагрузите файлы по ссылке: …",
      signals: [
        { label: "EN → RU translation", tone: "violet" },
        { label: "PII verified", tone: "mint" },
        { label: "Replay evidence", tone: "slate" },
      ],
    },
    documents: [
      { name: "Employment contract",   state: "ok" },
      { name: "Passport scan",         state: "missing" },
      { name: "Diploma apostille",     state: "missing" },
      { name: "Health insurance proof",state: "missing" },
      { name: "Rental contract",       state: "missing" },
      { name: "CV · EN",               state: "ok" },
      { name: "Photo · biometric",     state: "review" },
    ],
  },
  {
    ref: "VS-2836", client: "F. Haidari",
    email: "farah.haidari@protonmail.com", phone: "+1 416 555 0142",
    visa: "Humanitarian", country: "CA",
    stage: "Escalation", stageEnteredAt: "2026-06-26T09:00:00Z",
    owner: "A. Petrova", status: "needs_action", sla: "0h 42m", slaWarn: true, updated: "Jun 26",
    sourceNodeId: "NODE-TOR-07",
    events: [
      { at: "2026-06-25T11:02:00Z", actor: "Client",   title: "Submitted humanitarian application" },
      { at: "2026-06-25T11:14:00Z", actor: "AI",       title: "Risk flag · supporting evidence incomplete" },
      { at: "2026-06-26T09:00:00Z", actor: "System",   title: "Stage → Escalation" },
      { at: "2026-06-26T17:18:00Z", actor: "Operator", title: "A. Petrova requested manual review" },
    ],
    approval: {
      eyebrow: "Approval required · escalation review",
      headline: {
        prefix: "Escalate ",
        emphasis: "humanitarian case",
        suffix: " to senior reviewer for F. Haidari?",
      },
      draft:
        "Hi senior team,\n\nVS-2836 (F. Haidari · Humanitarian · CA) has been flagged by AI\nfor incomplete supporting evidence. Sara L. requests manual review\nbefore the 1h SLA window closes.\n\nKey gaps:\n  · Country-of-origin documentation\n  · Third-party affidavit (notarised)\n\nProceed with escalation?",
      signals: [
        { label: "AI risk flag · high", tone: "rose" },
        { label: "Sensitive case", tone: "amber" },
        { label: "Replay evidence", tone: "slate" },
      ],
    },
    documents: [
      { name: "Humanitarian application",  state: "ok" },
      { name: "Country-of-origin docs",    state: "missing" },
      { name: "Third-party affidavit",     state: "missing" },
      { name: "Passport scan",             state: "ok" },
      { name: "Medical history",           state: "review" },
      { name: "Witness statement",         state: "review" },
    ],
  },
  {
    ref: "VS-2840", client: "L. Johansson",
    email: "linnea.johansson@northmail.uk", phone: "+44 20 7946 0833",
    visa: "Skilled Worker", country: "UK",
    stage: "Consultation booked", stageEnteredAt: "2026-06-26T11:30:00Z",
    owner: "A. Petrova", status: "in_flight", sla: "1d 04h", updated: "Jun 26",
    sourceNodeId: "NODE-LON-04",
    events: [
      { at: "2026-06-26T10:48:00Z", actor: "Client",   title: "Requested consultation" },
      { at: "2026-06-26T11:02:00Z", actor: "AI",       title: "Eligibility check passed · 92% match" },
      { at: "2026-06-26T11:30:00Z", actor: "System",   title: "Stage → Consultation booked" },
      { at: "2026-06-26T11:31:00Z", actor: "AI",       title: "Calendar invite sent · 28 Jun 15:00 BST" },
    ],
    documents: [
      { name: "Passport scan",            state: "ok" },
      { name: "CV · EN",                  state: "ok" },
      { name: "Sponsorship certificate",  state: "review" },
      { name: "Salary proof · 12mo",      state: "missing" },
    ],
  },
  {
    ref: "VS-2838", client: "Y. Tanaka",
    email: "yuki.tanaka@kobomail.jp", phone: "+81 3 5678 9012",
    visa: "Highly Skilled Pro", country: "JP",
    stage: "Lead intake", stageEnteredAt: "2026-06-26T16:20:00Z",
    owner: "Auto", status: "in_flight", sla: "—", updated: "Jun 26",
    sourceNodeId: "NODE-TOK-02",
    events: [
      { at: "2026-06-26T16:18:00Z", actor: "Client",   title: "Started intake form" },
      { at: "2026-06-26T16:20:00Z", actor: "System",   title: "Stage → Lead intake" },
      { at: "2026-06-26T16:24:00Z", actor: "AI",       title: "Auto-classified as Highly Skilled Pro" },
    ],
    documents: [
      { name: "Intake form",        state: "ok" },
      { name: "Passport scan",      state: "missing" },
      { name: "Resume · JA",        state: "missing" },
      { name: "University diploma", state: "missing" },
    ],
  },
  {
    ref: "VS-2839", client: "R. Mehta",
    email: "rohan.mehta@brightlab.io", phone: "+1 415 555 0294",
    visa: "O-1A", country: "US",
    stage: "Awaiting CV translation", stageEnteredAt: "2026-06-23T10:00:00Z",
    owner: "Tom B.", status: "awaiting_client", sla: "3d 11h", updated: "Jun 25",
    sourceNodeId: "NODE-NYC-01",
    events: [
      { at: "2026-06-20T13:45:00Z", actor: "Client",   title: "Uploaded CV · JA original" },
      { at: "2026-06-20T13:46:00Z", actor: "AI",       title: "Translation queue · JA → EN" },
      { at: "2026-06-22T09:30:00Z", actor: "Operator", title: "Tom B. flagged terminology review" },
      { at: "2026-06-23T10:00:00Z", actor: "System",   title: "Stage → Awaiting CV translation" },
      { at: "2026-06-25T08:12:00Z", actor: "AI",       title: "Reminder sent to client · response pending" },
    ],
    documents: [
      { name: "Passport scan",         state: "ok" },
      { name: "CV · JA original",      state: "ok" },
      { name: "CV · EN translation",   state: "missing" },
      { name: "Letters of recommend.", state: "review" },
      { name: "Awards & press",        state: "ok" },
    ],
  },
  {
    ref: "VS-2837", client: "M. Costa",
    email: "miguel.costa@lisboa-mail.pt", phone: "+351 21 458 7261",
    visa: "D7 Passive Income", country: "PT",
    stage: "CRM update", stageEnteredAt: "2026-06-25T18:00:00Z",
    owner: "Auto", status: "resolved", sla: "done", updated: "Jun 25",
    sourceNodeId: "NODE-LIS-01",
    events: [
      { at: "2026-06-24T09:00:00Z", actor: "Client",   title: "Submitted income proof" },
      { at: "2026-06-24T09:08:00Z", actor: "AI",       title: "All required docs verified" },
      { at: "2026-06-25T17:55:00Z", actor: "Operator", title: "Approved by reviewer" },
      { at: "2026-06-25T18:00:00Z", actor: "System",   title: "Stage → CRM update · case resolved" },
    ],
    documents: [
      { name: "Passport scan",            state: "ok" },
      { name: "Income proof · 12mo",      state: "ok" },
      { name: "Bank statement · 6mo",     state: "ok" },
      { name: "Health insurance",         state: "ok" },
      { name: "Criminal record · clean",  state: "ok" },
    ],
  },
];

// Pending approvals queued for the Operator Console.
// Each entry corresponds to one case that needs an operator decision.
export interface PendingApproval {
  caseRef: string;
  kind: string;
}

export const pendingApprovals: PendingApproval[] = [
  { caseRef: "VS-2841", kind: "Send reminder · missing passport scan" },
];

// Derived counters consumed by the sidebar.
export const activeCaseCount = workspaceCases.filter(
  (c) => c.status !== "resolved",
).length;

export const pendingApprovalCount = pendingApprovals.length;

// Parse SLA strings like "2h 14m", "0h 42m", "1d 04h", "—", "done" into minutes.
// Returns null when SLA is not a finite duration (closed/auto cases).
export function parseSlaMinutes(sla: string): number | null {
  if (!sla || sla === "—" || sla === "done") return null;
  let minutes = 0;
  const d = sla.match(/(\d+)\s*d/);
  const h = sla.match(/(\d+)\s*h/);
  const m = sla.match(/(\d+)\s*m/);
  if (d) minutes += parseInt(d[1], 10) * 24 * 60;
  if (h) minutes += parseInt(h[1], 10) * 60;
  if (m) minutes += parseInt(m[1], 10);
  return minutes || null;
}

// Cases in Needs action burning down — SLA strictly under 1 hour.
export const slaBurningCases = workspaceCases.filter((c) => {
  if (c.status !== "needs_action") return false;
  const mins = parseSlaMinutes(c.sla);
  return mins !== null && mins < 60;
});

// Active cases whose source node is currently NOT healthy. Drives the Topbar
// infra-impact pill and the `?infra=degraded` filter on Live Desk so an
// operator can see at a glance how many of their open cases were captured by
// devices that are now offline / degraded / under maintenance — those rows
// often need re-routing or extra confirmation before approving anything that
// depends on the device's data freshness. Resolved cases are excluded
// (they're closed, the infra state no longer matters).
//
// Lazy import of `edgeNodes` would create a cycle — instead the data layer
// stays pure and the lookup happens at call site. We re-export the raw
// status-by-node map here so consumers don't repeat the lookup logic.
import { edgeNodes } from "./nodes";
const NON_HEALTHY_NODE_IDS = new Set(
  edgeNodes.filter((n) => n.status !== "healthy").map((n) => n.id),
);
export const degradedInfraCases = workspaceCases.filter(
  (c) => c.status !== "resolved" && NON_HEALTHY_NODE_IDS.has(c.sourceNodeId),
);

// SLA burn-down percent for the progress bar in Live Desk rows.
// Anchored to a 48h SLA budget — anything beyond that just stays at 100%.
const SLA_BUDGET_MIN = 48 * 60;
export function slaBurnPercent(sla: string): number | null {
  const mins = parseSlaMinutes(sla);
  if (mins === null) return null;
  const remaining = Math.max(0, Math.min(SLA_BUDGET_MIN, mins));
  // Lower remaining → higher burn (visual urgency grows as time runs out).
  return Math.round(((SLA_BUDGET_MIN - remaining) / SLA_BUDGET_MIN) * 100);
}

// "Stuck" detection — case has been in the same stage for ≥ 24h.
// Returns a short label like "2d" or "31h"; null when fresh.
export function stuckLabel(stageEnteredAt: string, nowIso: string = NOW_ISO): string | null {
  const entered = Date.parse(stageEnteredAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(entered) || !Number.isFinite(now)) return null;
  const hours = Math.floor((now - entered) / (1000 * 60 * 60));
  if (hours < 24) return null;
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
