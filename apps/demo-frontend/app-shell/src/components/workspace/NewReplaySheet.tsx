import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  Beaker,
  Play,
  Loader2,
  Search,
  Check,
  ArrowRight,
} from "lucide-react";
import {
  policySnapshots,
  outcomeTone,
  type PolicySnapshot,
  type SimulationRun,
  type RiskOutcome,
  type ReplayDelta,
  type ReasoningStep,
} from "@/data/simulationRuns";
import { workspaceCases, type WorkspaceCase } from "@/data/workspace";

interface NewReplaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (run: SimulationRun) => void;
  // When set (e.g. launched from the command palette via "Replay this case"),
  // pre-fills the case picker so the operator only has to choose a policy.
  initialCaseRef?: string | null;
}

// ─── Synthesis helpers ──────────────────────────────────────────────────────
// We synthesise the replay outcome client-side from two coarse inputs:
// the case's country tier + document completeness, and the chosen policy's
// known posture (current = balanced, draft-v3 = stricter, conservative-v2 =
// always review, experimental-fast = looser). This keeps the demo coherent
// — running the same case under conservative-v2 always tightens, etc. —
// without us hand-curating every (case × policy) cell.

const countryTier = (country: string): "A" | "B" | "C" =>
  country === "DE" || country === "NL" || country === "FR"
    ? "A"
    : country === "JP" || country === "BR" || country === "US"
      ? "B"
      : "C";

const docCompleteness = (c: WorkspaceCase) => {
  const total = c.documents.length;
  const ok = c.documents.filter((d) => d.state === "ok").length;
  return total === 0 ? 0 : ok / total;
};

// Map (case, policy) → synthesised outcome + confidence + reasoning. The
// numbers don't need to be defensible — they need to feel like the policy's
// posture is consistently applied across runs.
function synthesiseReplay(
  c: WorkspaceCase,
  policy: PolicySnapshot,
): {
  originalOutcome: RiskOutcome;
  replayedOutcome: RiskOutcome;
  originalConfidence: number;
  replayedConfidence: number;
  reasoning: ReasoningStep[];
  headline: string;
} {
  const tier = countryTier(c.country);
  const completeness = docCompleteness(c);

  // Original outcome — what the live desk decided. We approximate from the
  // case's stage/status: resolved+complete docs → safe, awaiting client →
  // review, needs_action with thin docs → block-ish.
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
    // Live policy — generally agrees with the original.
    reasoning.push(
      { label: `Country tier ${tier} · standard weighting`, signal: "neutral" },
      {
        label:
          completeness >= 0.75
            ? "Document set above completeness threshold"
            : "Document set thin — flagged for review",
        signal: completeness >= 0.75 ? "positive" : "negative",
      },
      { label: "Live policy heuristics applied", signal: "neutral" },
    );
    replayedConfidence = Math.max(
      40,
      Math.min(99, originalConfidence + (Math.random() < 0.5 ? -1 : 1)),
    );
  } else if (policy.id === "policy-draft-v3") {
    // Stricter — tier C always escalates one band.
    reasoning.push(
      { label: "Draft-v3 secondary reference letter requirement", signal: "negative" },
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
    } else if (originalOutcome === "review" && (tier === "C" || completeness < 0.5)) {
      replayedOutcome = "block";
      replayedConfidence = Math.min(95, originalConfidence + 9);
    } else {
      replayedConfidence = Math.max(50, originalConfidence - 6);
    }
  } else if (policy.id === "policy-conservative-v2") {
    // Archived — auto-approve disabled, everything routes through review at minimum.
    reasoning.push(
      { label: "Conservative-v2 disables all auto-approval paths", signal: "negative" },
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
    // Looser — tier A with decent docs auto-approves, but lower confidence.
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
    } else if (originalOutcome === "review" && tier === "A" && completeness >= 0.6) {
      replayedOutcome = "safe";
      replayedConfidence = Math.max(60, originalConfidence - 8);
    } else {
      // Same outcome, drop confidence to reflect aggressive heuristics.
      replayedConfidence = Math.max(50, originalConfidence - 14);
    }
  }

  // Headline reads like a post-flight summary, mirroring the curated demo set.
  const headline = buildHeadline(originalOutcome, replayedOutcome, policy.name);

  return {
    originalOutcome,
    replayedOutcome,
    originalConfidence,
    replayedConfidence,
    reasoning,
    headline,
  };
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

// Compute the delta classification the same way the curated data does.
function computeDelta(
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

// ─── Component ──────────────────────────────────────────────────────────────

export function NewReplaySheet({
  open,
  onOpenChange,
  onRun,
  initialCaseRef,
}: NewReplaySheetProps) {
  const [caseRef, setCaseRef] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);

  // Reset transient state every time the sheet opens — closing mid-flow
  // shouldn't leave a stale selection visible the next time it's launched.
  // If the launcher passed `initialCaseRef` (e.g. palette → "Replay this
  // case"), seed the picker with it so step 1 is already complete.
  useEffect(() => {
    if (open) {
      setCaseRef(initialCaseRef ?? null);
      setPolicyId(null);
      setQuery("");
      setRunning(false);
    }
  }, [open, initialCaseRef]);

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaceCases;
    return workspaceCases.filter(
      (c) =>
        c.ref.toLowerCase().includes(q) ||
        c.client.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.visa.toLowerCase().includes(q),
    );
  }, [query]);

  const selectedCase = caseRef
    ? workspaceCases.find((c) => c.ref === caseRef) ?? null
    : null;
  const selectedPolicy = policyId
    ? policySnapshots.find((p) => p.id === policyId) ?? null
    : null;

  const canRun = !!selectedCase && !!selectedPolicy && !running;

  const handleRun = () => {
    if (!selectedCase || !selectedPolicy) return;
    setRunning(true);
    // 1.5s simulated round-trip — long enough to register as a real run, short
    // enough not to feel like a demo bug. Mirrors the latency we show in the
    // run footer ("1.4s") so the UX feels consistent end-to-end.
    const startedAt = Date.now();
    setTimeout(() => {
      const synth = synthesiseReplay(selectedCase, selectedPolicy);
      const delta = computeDelta(
        synth.originalOutcome,
        synth.replayedOutcome,
        synth.originalConfidence,
        synth.replayedConfidence,
      );
      const newRun: SimulationRun = {
        id: `run-${selectedCase.ref}-${selectedPolicy.id}-${Date.now()}`,
        caseRef: selectedCase.ref,
        policyId: selectedPolicy.id,
        originalOutcome: synth.originalOutcome,
        replayedOutcome: synth.replayedOutcome,
        originalConfidence: synth.originalConfidence,
        replayedConfidence: synth.replayedConfidence,
        delta,
        ranAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        headline: synth.headline,
        reasoning: synth.reasoning,
      };
      onRun(newRun);
      setRunning(false);
      onOpenChange(false);
    }, 1500);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
      >
        {/* ─── Header ────────────────────────────────────────────────── */}
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <Beaker
              className="h-3.5 w-3.5 text-muted-foreground/70"
              strokeWidth={1.75}
            />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              New replay
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            Pick a case, then a policy snapshot.
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            The replay engine will re-evaluate the case under the chosen policy
            and surface the new decision, confidence, and reasoning trail.
          </SheetDescription>
        </SheetHeader>

        {/* ─── Body ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-auto">
          {/* Step 1 — case picker */}
          <section className="px-7 pt-6 pb-6 border-b border-border/60 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-secondary/70 text-[10px] font-mono text-muted-foreground/80">
                1
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">
                Case
              </span>
              {selectedCase && (
                <span className="ml-auto font-mono text-[11px] text-foreground/90 tabular-nums">
                  {selectedCase.ref}
                </span>
              )}
            </div>

            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ref, client, country…"
                className="w-full h-9 pl-8 pr-2.5 rounded-md bg-secondary/40 border border-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground/55 focus-visible:outline-none focus-visible:border-border focus-visible:bg-secondary/55 transition-smooth"
              />
            </div>

            <div className="max-h-64 overflow-auto rounded-md border border-border/50 divide-y divide-border/40">
              {filteredCases.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12px] text-muted-foreground/80">
                  No cases match.
                </p>
              ) : (
                filteredCases.map((c) => {
                  const active = c.ref === caseRef;
                  return (
                    <button
                      key={c.ref}
                      type="button"
                      onClick={() => setCaseRef(c.ref)}
                      className={
                        "relative w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] transition-smooth " +
                        (active
                          ? "bg-secondary/45 text-foreground"
                          : "hover:bg-secondary/25 text-foreground/85")
                      }
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-sm bg-[hsl(var(--tint-violet-fg))]/70"
                        />
                      )}
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/80 w-[58px] shrink-0">
                        {c.ref}
                      </span>
                      <span className="truncate flex-1 min-w-0">{c.client}</span>
                      <span className="font-mono text-[10.5px] text-muted-foreground/75 shrink-0">
                        {c.country}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground/70 truncate max-w-[120px] shrink-0">
                        {c.visa}
                      </span>
                      {active && (
                        <Check
                          className="h-3 w-3 text-[hsl(var(--tint-violet-fg))]/80 shrink-0"
                          strokeWidth={2.25}
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Step 2 — policy picker */}
          <section className="px-7 pt-6 pb-6 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-secondary/70 text-[10px] font-mono text-muted-foreground/80">
                2
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">
                Policy snapshot
              </span>
              {selectedPolicy && (
                <span className="ml-auto font-mono text-[11px] text-[hsl(var(--tint-violet-fg))]/85">
                  {selectedPolicy.name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              {policySnapshots.map((p) => {
                const active = p.id === policyId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPolicyId(p.id)}
                    className={
                      "relative text-left rounded-md border px-3.5 py-3 transition-smooth " +
                      (active
                        ? "border-border bg-secondary/40"
                        : "border-border/50 hover:border-border/80 bg-transparent hover:bg-secondary/20")
                    }
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-sm bg-[hsl(var(--tint-violet-fg))]/70"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "font-mono text-[12px] " +
                          (active
                            ? "text-[hsl(var(--tint-violet-fg))]/90"
                            : "text-foreground/90")
                        }
                      >
                        {p.name}
                      </span>
                      {p.isLive && (
                        <span
                          className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.12em] text-[9.5px]"
                          style={{ color: "hsl(var(--tint-violet-fg) / 0.85)" }}
                        >
                          <span
                            className="h-1 w-1 rounded-full"
                            style={{
                              backgroundColor: "hsl(var(--tint-violet-fg) / 0.85)",
                            }}
                          />
                          live
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground/75">
                        {p.author}
                      </span>
                      {active && (
                        <Check
                          className="h-3 w-3 text-[hsl(var(--tint-violet-fg))]/80"
                          strokeWidth={2.25}
                        />
                      )}
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground/85">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Preview strip — visible only once both pickers have a value, gives
              the operator a one-line dry-run of what they're about to fire. */}
          {selectedCase && selectedPolicy && (
            <div className="px-7 pb-6">
              <div className="rounded-md border border-border/50 bg-secondary/15 px-4 py-3 flex items-center gap-2 text-[12px]">
                <span className="font-mono text-[11px] text-muted-foreground/80">
                  {selectedCase.ref}
                </span>
                <span className="text-foreground/80 truncate">
                  {selectedCase.client}
                </span>
                <ArrowRight
                  className="h-3 w-3 text-muted-foreground/55 shrink-0"
                  strokeWidth={1.5}
                />
                <span className="font-mono text-[11px] text-[hsl(var(--tint-violet-fg))]/85">
                  {selectedPolicy.name}
                </span>
                <Pill tone="violet" size="sm" className="ml-auto">
                  ready
                </Pill>
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ────────────────────────────────────────────────── */}
        <div className="px-7 py-4 border-t border-border/70 flex items-center gap-3">
          <p className="text-[11px] text-muted-foreground leading-snug">
            {!selectedCase
              ? "Pick a case to continue."
              : !selectedPolicy
                ? "Pick a policy snapshot to continue."
                : running
                  ? "Replaying — usually under 2 seconds."
                  : "Ready to run. The new card will appear at the top of the grid."}
          </p>
          <Button
            onClick={handleRun}
            disabled={!canRun}
            className="ml-auto h-10 px-5 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <Loader2
                  className="mr-2 h-3.5 w-3.5 animate-spin"
                  strokeWidth={2}
                />
                Running…
              </>
            ) : (
              <>
                <Play className="mr-2 h-3.5 w-3.5" strokeWidth={2} />
                Run replay
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
