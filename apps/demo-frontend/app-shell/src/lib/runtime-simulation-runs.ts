import type { WorkspaceCase } from "../data/workspace";
import {
  findPolicy,
  outcomeTone,
  policySnapshots,
  type PolicySnapshot,
  type ReplayDelta,
  type ReasoningStep,
  type RiskOutcome,
  type SimulationRun,
} from "../data/simulationRuns";

const CURRENT_POLICY_ID = "policy-current";

const countryTier = (country: string): "A" | "B" | "C" =>
  country === "DE" || country === "NL" || country === "FR"
    ? "A"
    : country === "JP" || country === "BR" || country === "US"
      ? "B"
      : "C";

const docCompleteness = (workspaceCase: WorkspaceCase) => {
  const total = workspaceCase.documents.length;
  const ok = workspaceCase.documents.filter((item) => item.state === "ok").length;
  return total === 0 ? 0 : ok / total;
};

function deterministicConfidenceOffset(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return (hash % 3) - 1;
}

function buildHeadline(
  from: RiskOutcome,
  to: RiskOutcome,
  policyName: string,
): string {
  if (from === to) {
    return `${outcomeTone[to].label} held under ${policyName}.`;
  }
  return `${outcomeTone[from].label} → ${outcomeTone[to].label} · ${policyName} shifted the verdict.`;
}

export function computeSimulationDelta(
  from: RiskOutcome,
  to: RiskOutcome,
  fromConf: number,
  toConf: number,
): ReplayDelta {
  if (from === to) {
    const diff = toConf - fromConf;
    if (diff <= -10) return "confidence_drop";
    if (diff >= 10) return "confidence_gain";
    return "no_change";
  }
  const order: Record<RiskOutcome, number> = { safe: 0, review: 1, block: 2 };
  return order[to] > order[from] ? "tightened" : "loosened";
}

export function synthesiseReplay(
  workspaceCase: WorkspaceCase,
  policy: PolicySnapshot,
): {
  originalOutcome: RiskOutcome;
  replayedOutcome: RiskOutcome;
  originalConfidence: number;
  replayedConfidence: number;
  reasoning: ReasoningStep[];
  headline: string;
} {
  const tier = countryTier(workspaceCase.country);
  const completeness = docCompleteness(workspaceCase);

  const originalOutcome: RiskOutcome =
    completeness >= 0.75 && tier !== "C"
      ? "safe"
      : completeness < 0.4 || tier === "C"
        ? "block"
        : "review";
  const originalConfidence =
    originalOutcome === "safe"
      ? 88
      : originalOutcome === "block"
        ? 82
        : 70;

  let replayedOutcome: RiskOutcome = originalOutcome;
  let replayedConfidence = originalConfidence;
  const reasoning: ReasoningStep[] = [];

  if (policy.id === "policy-current") {
    reasoning.push(
      { label: `Country tier ${tier} · standard weighting`, signal: "neutral" },
      {
        label:
          completeness >= 0.75
            ? "Document set above completeness threshold"
            : "Document set thin · flagged for review",
        signal: completeness >= 0.75 ? "positive" : "negative",
      },
      { label: "Live policy heuristics applied", signal: "neutral" },
    );
    replayedConfidence = Math.max(
      40,
      Math.min(
        99,
        originalConfidence +
          deterministicConfidenceOffset(`${workspaceCase.ref}:${policy.id}`),
      ),
    );
  } else if (policy.id === "policy-draft-v3") {
    reasoning.push(
      {
        label: "Draft-v3 secondary reference letter requirement",
        signal: "negative",
      },
      {
        label:
          tier === "C"
            ? "Country tier C · escalated under draft-v3"
            : `Country tier ${tier} · within tolerance`,
        signal: tier === "C" ? "negative" : "neutral",
      },
      {
        label:
          completeness >= 0.75
            ? "Documents pass strict completeness gate"
            : "Documents fail strict completeness gate",
        signal: completeness >= 0.75 ? "positive" : "negative",
      },
    );
    if (originalOutcome === "safe" && (tier !== "A" || completeness < 0.85)) {
      replayedOutcome = "review";
      replayedConfidence = Math.max(50, originalConfidence - 12);
    } else if (
      originalOutcome === "review" &&
      (tier === "C" || completeness < 0.5)
    ) {
      replayedOutcome = "block";
      replayedConfidence = Math.min(95, originalConfidence + 9);
    } else {
      replayedConfidence = Math.max(50, originalConfidence - 6);
    }
  } else if (policy.id === "policy-conservative-v2") {
    reasoning.push(
      {
        label: "Conservative-v2 disables all auto-approval paths",
        signal: "negative",
      },
      { label: "Manual review mandatory regardless of signal", signal: "neutral" },
      {
        label:
          tier === "C"
            ? "Country tier C · routed straight to block"
            : `Country tier ${tier} · routed to manual review`,
        signal: tier === "C" ? "negative" : "neutral",
      },
    );
    if (originalOutcome === "safe") {
      replayedOutcome = "review";
      replayedConfidence = 100;
    } else {
      replayedConfidence = Math.min(98, originalConfidence + 6);
    }
  } else if (policy.id === "policy-experimental") {
    reasoning.push(
      {
        label:
          tier === "A"
            ? "Country tier A · fast-track corridor open"
            : `Country tier ${tier} · fast-track unavailable`,
        signal: tier === "A" ? "positive" : "neutral",
      },
      {
        label: "Experimental policy down-weights repeat-client signal",
        signal: "negative",
      },
      {
        label:
          completeness >= 0.5
            ? "Documents within experimental fast-track threshold"
            : "Documents below experimental threshold",
        signal: completeness >= 0.5 ? "positive" : "negative",
      },
    );
    if (originalOutcome === "block" && tier === "A" && completeness >= 0.5) {
      replayedOutcome = "review";
      replayedConfidence = Math.max(55, originalConfidence - 18);
    } else if (
      originalOutcome === "review" &&
      tier === "A" &&
      completeness >= 0.6
    ) {
      replayedOutcome = "safe";
      replayedConfidence = Math.max(60, originalConfidence - 8);
    } else {
      replayedConfidence = Math.max(50, originalConfidence - 14);
    }
  }

  return {
    originalOutcome,
    replayedOutcome,
    originalConfidence,
    replayedConfidence,
    reasoning,
    headline: buildHeadline(originalOutcome, replayedOutcome, policy.name),
  };
}

function resolveRunTimestamp(workspaceCase: WorkspaceCase): string {
  const latestEventTs = [...workspaceCase.events]
    .map((item) => item.at)
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0];
  return latestEventTs ?? workspaceCase.stageEnteredAt;
}

export function buildSimulationRun(params: {
  workspaceCase: WorkspaceCase;
  policy: PolicySnapshot;
  ranAt?: string;
  durationMs?: number;
  id?: string;
  source?: SimulationRun["source"];
}): SimulationRun {
  const {
    workspaceCase,
    policy,
    ranAt = new Date().toISOString(),
    durationMs = 1500,
    id = `run-${workspaceCase.ref}-${policy.id}-${Date.now()}`,
    source = workspaceCase.source === "runtime" ? "runtime" : "curated",
  } = params;
  const synth = synthesiseReplay(workspaceCase, policy);
  return {
    id,
    source,
    runtimeSource:
      source === "runtime"
        ? {
            caseId: workspaceCase.caseId ?? null,
            sessionId: workspaceCase.sessionId ?? null,
          }
        : undefined,
    caseRef: workspaceCase.ref,
    policyId: policy.id,
    originalOutcome: synth.originalOutcome,
    replayedOutcome: synth.replayedOutcome,
    originalConfidence: synth.originalConfidence,
    replayedConfidence: synth.replayedConfidence,
    delta: computeSimulationDelta(
      synth.originalOutcome,
      synth.replayedOutcome,
      synth.originalConfidence,
      synth.replayedConfidence,
    ),
    ranAt,
    durationMs,
    headline: synth.headline,
    reasoning: synth.reasoning,
  };
}

export function buildRuntimeSimulationRuns(
  cases: WorkspaceCase[],
): SimulationRun[] {
  const currentPolicy = findPolicy(CURRENT_POLICY_ID);
  if (!currentPolicy) {
    return [];
  }

  return cases
    .filter((item) => item.source === "runtime")
    .map((workspaceCase) =>
      buildSimulationRun({
        workspaceCase,
        policy: currentPolicy,
        ranAt: resolveRunTimestamp(workspaceCase),
        durationMs: 1200,
        id: `runtime-${workspaceCase.ref}-${currentPolicy.id}`,
        source: "runtime",
      }),
    )
    .sort((left, right) => right.ranAt.localeCompare(left.ranAt));
}

export function findCaseInCollection(
  cases: WorkspaceCase[],
  caseRef: string,
): WorkspaceCase | undefined {
  return cases.find((item) => item.ref === caseRef);
}

export function getDefaultPolicySnapshots(): PolicySnapshot[] {
  return policySnapshots;
}
