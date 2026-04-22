// Mock data for the Simulation Lab. Replays = "what would the AI decide today
// for a previously-resolved case under a chosen policy snapshot?". Outcomes
// are risk-centric (safe / review / block) and we always remember the original
// operator decision so the UI can show the delta side-by-side.
//
// Kept hand-curated rather than generated so the demo grid reads as a real
// regression report — every row tells a story (no-change baseline, a flipped
// approve→block, a confidence drop on a thin-doc case, etc.).

import { workspaceCases } from "./workspace";

/** Risk axis the AI emits for any single case under any policy. */
export type RiskOutcome = "safe" | "review" | "block";

/** What changed when we replayed under the chosen policy. Drives card tone. */
export type ReplayDelta =
  | "no_change"        // same outcome, similar confidence — baseline
  | "tightened"        // policy got stricter (safe→review, review→block)
  | "loosened"         // policy got softer (block→review, review→safe)
  | "confidence_drop"  // same outcome but much lower confidence — flag for ops
  | "confidence_gain"  // same outcome with much higher confidence
  | "error";           // replay failed (missing context, schema drift, etc.)

export interface PolicySnapshot {
  id: string;
  /** Short label shown on cards, e.g. "current". */
  name: string;
  /** Long-form blurb shown in the new-replay sheet. */
  description: string;
  /** Date the snapshot was authored, ISO. */
  authoredAt: string;
  /** Operator who last edited it. */
  author: string;
  /** Whether this is the live policy currently serving the desk. */
  isLive?: boolean;
  /** Optional runtime governance metadata when this snapshot maps to a real policy template. */
  runtimeGovernance?: {
    templateId: string | null;
    tenantId: string | null;
    source: string | null;
    promoteable: boolean;
    version: number | null;
    history?: Array<{
      createdAt: string;
      outcome: string | null;
      actorRole: string | null;
      reason: string | null;
      errorCode: string | null;
      version: number | null;
    }>;
  };
}

export const policySnapshots: PolicySnapshot[] = [
  {
    id: "policy-current",
    name: "current",
    description:
      "Live policy serving the operator desk. Conservative on missing-doc cases, auto-approves only when every required artifact is present and country tier is A/B.",
    authoredAt: "2026-04-12T09:24:00Z",
    author: "A. Petrova",
    isLive: true,
  },
  {
    id: "policy-draft-v3",
    name: "draft-v3",
    description:
      "Draft tightening: requires reference letter for every D-visa regardless of country tier, and bumps high-risk countries one step toward review. Not yet promoted.",
    authoredAt: "2026-04-18T15:02:00Z",
    author: "M. Chen",
  },
  {
    id: "policy-conservative-v2",
    name: "conservative-v2",
    description:
      "Archived snapshot from Q1 — auto-approve disabled entirely, every case routes through review. Useful as a 'panic baseline' to compare against.",
    authoredAt: "2026-02-03T11:40:00Z",
    author: "A. Petrova",
  },
  {
    id: "policy-experimental",
    name: "experimental-fast",
    description:
      "Aggressive auto-approval for tier-A countries with complete docs. Lower review queue but higher false-approval risk — for evaluation only.",
    authoredAt: "2026-04-15T08:18:00Z",
    author: "L. Okafor",
  },
];

export interface ReasoningStep {
  /** One-line factor the AI weighed. */
  label: string;
  /** Whether this factor pushed toward safe (+), block (-), or was neutral (=). */
  signal: "positive" | "negative" | "neutral";
}

/** A single replay execution against one case + one policy snapshot. */
export interface SimulationRun {
  id: string;
  source?: "curated" | "runtime";
  runtimeSource?: {
    caseId?: string | null;
    sessionId?: string | null;
  };
  caseRef: string;
  /** Snapshot id replayed. */
  policyId: string;
  /** What the operator originally decided when the case was live. */
  originalOutcome: RiskOutcome;
  /** What the policy under test would decide today. */
  replayedOutcome: RiskOutcome;
  /** 0–100, the AI's self-reported confidence in the replayed decision. */
  originalConfidence: number;
  replayedConfidence: number;
  /** Computed delta — drives the chip on the card. */
  delta: ReplayDelta;
  /** ISO timestamp of when this replay was executed. */
  ranAt: string;
  /** Wall-clock ms the run took. Cosmetic — feeds the run footer. */
  durationMs: number;
  /** One-line summary shown on the card. */
  headline: string;
  /** Step-by-step reasoning the new policy emitted. Shown in the drawer. */
  reasoning: ReasoningStep[];
  /** Optional error blob — only populated when delta === "error". */
  error?: string;
}

// Hand-picked replays. Cases reference workspaceCases so the drawer can pull
// client/visa/country without duplicating data. Sorted newest-first below.
export const simulationRuns: SimulationRun[] = [
  {
    id: "run-2841-current-1",
    caseRef: "VS-2841",
    policyId: "policy-current",
    originalOutcome: "safe",
    replayedOutcome: "safe",
    originalConfidence: 92,
    replayedConfidence: 91,
    delta: "no_change",
    ranAt: "2026-04-20T05:42:00Z",
    durationMs: 1840,
    headline: "Auto-approve held — same decision, parity confidence.",
    reasoning: [
      { label: "Country tier A · low base risk", signal: "positive" },
      { label: "All required documents present", signal: "positive" },
      { label: "Repeat client, prior approval", signal: "positive" },
      { label: "SLA burn under threshold", signal: "neutral" },
    ],
  },
  {
    id: "run-2836-draft-1",
    caseRef: "VS-2836",
    policyId: "policy-draft-v3",
    originalOutcome: "safe",
    replayedOutcome: "review",
    originalConfidence: 84,
    replayedConfidence: 71,
    delta: "tightened",
    ranAt: "2026-04-20T04:18:00Z",
    durationMs: 2210,
    headline: "Auto-approve → review · draft requires extra COI evidence.",
    reasoning: [
      { label: "Country tier B · base risk medium", signal: "neutral" },
      { label: "Country-of-origin docs flagged thin under draft-v3", signal: "negative" },
      { label: "Reference letter present", signal: "positive" },
      { label: "New rule: D-visa always needs secondary reference", signal: "negative" },
    ],
  },
  {
    id: "run-2838-draft-1",
    caseRef: "VS-2838",
    policyId: "policy-draft-v3",
    originalOutcome: "review",
    replayedOutcome: "block",
    originalConfidence: 68,
    replayedConfidence: 79,
    delta: "tightened",
    ranAt: "2026-04-20T03:55:00Z",
    durationMs: 1990,
    headline: "Review → block · passport scan still missing past 24h.",
    reasoning: [
      { label: "Required passport scan absent > 24h", signal: "negative" },
      { label: "Country tier C · elevated base risk", signal: "negative" },
      { label: "Operator previously requested doc, no response", signal: "negative" },
      { label: "Draft policy escalates after one ignored request cycle", signal: "negative" },
    ],
  },
  {
    id: "run-2839-conservative-1",
    caseRef: "VS-2839",
    policyId: "policy-conservative-v2",
    originalOutcome: "block",
    replayedOutcome: "block",
    originalConfidence: 88,
    replayedConfidence: 95,
    delta: "confidence_gain",
    ranAt: "2026-04-19T22:10:00Z",
    durationMs: 1620,
    headline: "Block held with higher conviction under archived baseline.",
    reasoning: [
      { label: "Reference letter language mismatch (non-EN)", signal: "negative" },
      { label: "Country tier C · auto-block under conservative-v2", signal: "negative" },
      { label: "No prior client history", signal: "negative" },
    ],
  },
  {
    id: "run-2841-experimental-1",
    caseRef: "VS-2841",
    policyId: "policy-experimental",
    originalOutcome: "safe",
    replayedOutcome: "safe",
    originalConfidence: 92,
    replayedConfidence: 78,
    delta: "confidence_drop",
    ranAt: "2026-04-19T18:34:00Z",
    durationMs: 1430,
    headline: "Same approve, but experimental policy lost 14pts confidence.",
    reasoning: [
      { label: "Country tier A · auto-safe shortcut applied", signal: "positive" },
      { label: "Experimental policy down-weights repeat-client signal", signal: "negative" },
      { label: "Document set within fast-track threshold", signal: "positive" },
    ],
  },
  {
    id: "run-2836-experimental-1",
    caseRef: "VS-2836",
    policyId: "policy-experimental",
    originalOutcome: "safe",
    replayedOutcome: "safe",
    originalConfidence: 84,
    replayedConfidence: 88,
    delta: "confidence_gain",
    ranAt: "2026-04-19T16:02:00Z",
    durationMs: 1310,
    headline: "Experimental fast-track confirms approve with +4pts conviction.",
    reasoning: [
      { label: "Country tier B · within fast-track corridor", signal: "positive" },
      { label: "Document completeness above experimental threshold", signal: "positive" },
      { label: "No flagged historical issues for client", signal: "positive" },
    ],
  },
  {
    id: "run-2838-conservative-1",
    caseRef: "VS-2838",
    policyId: "policy-conservative-v2",
    originalOutcome: "review",
    replayedOutcome: "review",
    originalConfidence: 68,
    replayedConfidence: 72,
    delta: "no_change",
    ranAt: "2026-04-19T11:48:00Z",
    durationMs: 1740,
    headline: "Review held — conservative policy agrees, slight conviction lift.",
    reasoning: [
      { label: "Missing passport scan triggers review", signal: "negative" },
      { label: "Conservative-v2 routes all incomplete to review", signal: "neutral" },
      { label: "Country tier C below auto-block threshold here", signal: "neutral" },
    ],
  },
  {
    id: "run-2839-draft-1",
    caseRef: "VS-2839",
    policyId: "policy-draft-v3",
    originalOutcome: "block",
    replayedOutcome: "review",
    originalConfidence: 88,
    replayedConfidence: 64,
    delta: "loosened",
    ranAt: "2026-04-19T08:12:00Z",
    durationMs: 2080,
    headline: "Block → review · draft accepts EN-translated reference letters.",
    reasoning: [
      { label: "Reference letter has EN translation attached", signal: "positive" },
      { label: "Draft-v3 accepts certified translations as primary", signal: "positive" },
      { label: "Country tier C still requires manual sign-off", signal: "negative" },
    ],
  },
  {
    id: "run-2836-conservative-1",
    caseRef: "VS-2836",
    policyId: "policy-conservative-v2",
    originalOutcome: "safe",
    replayedOutcome: "review",
    originalConfidence: 84,
    replayedConfidence: 100,
    delta: "tightened",
    ranAt: "2026-04-18T20:55:00Z",
    durationMs: 1280,
    headline: "Auto-approve → review · conservative-v2 disables fast-track.",
    reasoning: [
      { label: "Conservative-v2 hard-disables auto-approval", signal: "negative" },
      { label: "All cases routed through manual review by design", signal: "neutral" },
    ],
  },
  {
    id: "run-2841-draft-error",
    caseRef: "VS-2841",
    policyId: "policy-draft-v3",
    originalOutcome: "safe",
    replayedOutcome: "safe",
    originalConfidence: 92,
    replayedConfidence: 0,
    delta: "error",
    ranAt: "2026-04-18T14:20:00Z",
    durationMs: 410,
    headline: "Replay aborted — draft-v3 schema missing client-history field.",
    reasoning: [],
    error: "MissingFieldError: policy draft-v3 expects 'client.lifetime_visas' (added in v3.1)",
  },
];

// ─── Lookups & helpers ────────────────────────────────────────────────────────

export const findRun = (id: string): SimulationRun | undefined =>
  simulationRuns.find((r) => r.id === id);

export const findPolicy = (id: string): PolicySnapshot | undefined =>
  policySnapshots.find((p) => p.id === id);

/** Pull the full case row for a run — drawer uses this for client/visa/country. */
export const findCase = (caseRef: string) =>
  workspaceCases.find((c) => c.ref === caseRef);

/** Tone tokens per delta — keeps card colour decisions in one place so the
 *  cards / chips / drawer headers all agree. Maps to existing --tint-* tokens
 *  in index.css so we never invent ad-hoc colours. */
export const deltaTone: Record<
  ReplayDelta,
  { tint: "violet" | "rose" | "amber" | "mint" | "slate"; label: string }
> = {
  no_change: { tint: "slate", label: "no change" },
  tightened: { tint: "rose", label: "tightened" },
  loosened: { tint: "mint", label: "loosened" },
  confidence_drop: { tint: "amber", label: "confidence ↓" },
  confidence_gain: { tint: "violet", label: "confidence ↑" },
  error: { tint: "rose", label: "error" },
};

export const outcomeTone: Record<
  RiskOutcome,
  { tint: "mint" | "amber" | "rose"; label: string }
> = {
  safe: { tint: "mint", label: "safe" },
  review: { tint: "amber", label: "review" },
  block: { tint: "rose", label: "block" },
};

/** Aggregate stats for the page header — counted off the full run set. */
export const computeStats = (runs: SimulationRun[]) => {
  const total = runs.length;
  let flipped = 0;
  let errored = 0;
  let confidenceShifts = 0;
  for (const r of runs) {
    if (r.delta === "tightened" || r.delta === "loosened") flipped += 1;
    if (r.delta === "error") errored += 1;
    if (r.delta === "confidence_drop" || r.delta === "confidence_gain")
      confidenceShifts += 1;
  }
  return { total, flipped, errored, confidenceShifts };
};
