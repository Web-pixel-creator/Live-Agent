import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  RotateCw,
  ExternalLink,
  Copy,
  Beaker,
  FileText,
  Camera,
} from "lucide-react";
import {
  deltaTone,
  findCase,
  outcomeTone,
  type PolicySnapshot,
  type ReasoningStep,
  type SimulationRun,
} from "@/data/simulationRuns";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";
import { useNavigate } from "react-router-dom";
import {
  buildCaseBundlePath,
  buildCaseEvidencePath,
} from "@/lib/case-artifact-links";
import { findSimulationPolicy } from "@/lib/runtime-simulation-policies";
import { DiffColumn } from "./runDetail/DiffColumn";
import { WhatChanged } from "./runDetail/WhatChanged";
import { ErrorPanel } from "./runDetail/ErrorPanel";
import { PolicyBlurb } from "./runDetail/PolicyBlurb";
import { policyHashColor } from "./runDetail/policyHash";

interface RunDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: SimulationRun | null;
  policies: PolicySnapshot[];
}

// Format an ISO timestamp into a compact "Apr 20 · 05:42" line. Times are
// always rendered in the operator's locale so the page reads as "right now".
const formatTime = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} · ${time}`;
};

export function RunDetailDrawer({
  open,
  onOpenChange,
  run,
  policies,
}: RunDetailDrawerProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    governancePolicy,
    getCaseByRef,
    promoteGovernancePolicyTemplate,
  } = useWorkspaceRuntime();
  const [promoting, setPromoting] = useState(false);
  if (!run) return null;

  const c = getCaseByRef(run.caseRef) ?? findCase(run.caseRef);
  const policy = findSimulationPolicy(run.policyId, policies);
  const dTone = deltaTone[run.delta];
  const isError = run.delta === "error";
  const fromOutcome = outcomeTone[run.originalOutcome];
  const toOutcome = outcomeTone[run.replayedOutcome];
  const confDelta = run.replayedConfidence - run.originalConfidence;
  const promoteableTemplateId =
    !isError && policy?.runtimeGovernance?.promoteable
      ? policy.runtimeGovernance.templateId
      : null;

  // Synthetic "original reasoning" — the live policy's take on the case at
  // resolution time. We don't store this on each run (too much duplication),
  // so we derive a plausible parallel set from the case's stored signals.
  // Keeps both columns symmetric without ballooning the mock data file.
  const originalReasoning: ReasoningStep[] = c
    ? [
        {
          label: `Country tier ${c.country === "DE" || c.country === "NL" ? "A" : c.country === "JP" || c.country === "BR" ? "B" : "C"} · base risk weighting`,
          signal: "neutral",
        },
        {
          label:
            c.documents.filter((d) => d.state === "ok").length >= 3
              ? "Document set above completeness threshold"
              : "Document set thin — flagged",
          signal:
            c.documents.filter((d) => d.state === "ok").length >= 3
              ? "positive"
              : "negative",
        },
        {
          label: "Live policy heuristics applied at resolution time",
          signal: "neutral",
        },
      ]
    : [];

  const handlePromote = async () => {
    if (!policy || !promoteableTemplateId) {
      return;
    }
    try {
      setPromoting(true);
      const previousTemplate = governancePolicy?.complianceTemplate ?? "current";
      const promoted = await promoteGovernancePolicyTemplate(promoteableTemplateId);
      toast({
        title: `Live policy updated to ${policy.name}`,
        description: `${previousTemplate} -> ${promoted.effectiveTemplateId ?? promoteableTemplateId}`,
      });
      onOpenChange(false);
    } catch (error) {
      const description =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "governance policy promotion failed";
      toast({
        title: `Could not promote ${policy.name}`,
        description,
        variant: "destructive",
      });
    } finally {
      setPromoting(false);
    }
  };

  const handleRerun = () => {
    toast({
      title: "Re-running replay",
      description: `${run.caseRef} · ${policy?.name ?? "policy"}`,
    });
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText(run.caseRef);
    toast({
      title: "Case reference copied",
      description: run.caseRef,
    });
  };

  const handleOpenCase = () => {
    onOpenChange(false);
    navigate(`/app/console?ref=${encodeURIComponent(run.caseRef)}`);
  };

  const handleOpenBundle = () => {
    onOpenChange(false);
    navigate(buildCaseBundlePath(c ?? run.caseRef));
  };

  const handleOpenEvidence = () => {
    onOpenChange(false);
    navigate(buildCaseEvidencePath(c ?? run.caseRef));
  };

  const hashColor = policyHashColor(run.policyId, isError);

  // Quick action button — 32px circle, hairline border, mono icon. Mirrors
  // the action cluster pattern from Plan / Netair drawers: discoverable but
  // never competing with the headline for attention.
  const QuickAction = ({
    icon: Icon,
    label,
    onClick,
  }: {
    icon: typeof Copy;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-secondary/30 transition-smooth focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col gap-0 p-0"
      >
        {/* ─── Hero ─────────────────────────────────────────────────────────
            Mirrors the Plan / Netair "lead detail" hero rhythm: eyebrow row
            with delta chip, then a serif headline that owns the space, then
            metadata as a 4-col grid — no inline dots, no clock icons. The
            policy hash bar on the left edge carries the colour identity from
            the card click. */}
        <SheetHeader className="relative px-8 pt-7 pb-6 border-b border-border space-y-5 text-left overflow-hidden">
          {/* Policy hash bar — slimmer + softened so it acts as identity, not
              a beacon. The hash colour still leads on the policy name below. */}
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0 w-[2px] opacity-60"
            style={{ backgroundColor: hashColor }}
          />

          {/* Eyebrow row */}
          <div className="flex items-center gap-2">
            <Beaker
              className="h-3.5 w-3.5 text-[hsl(var(--tint-violet-fg))]"
              strokeWidth={1.75}
            />
            <span className="text-[10px] uppercase tracking-[0.22em] text-primary">
              Replay detail
            </span>
            <Pill tone={dTone.tint} size="sm" dot className="ml-1">
              {dTone.label}
            </Pill>
          </div>

          {/* Headline + quick actions */}
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
                {c?.client ?? run.caseRef}
              </SheetTitle>
              <SheetDescription className="mt-1.5 text-[13px] text-foreground/85 leading-snug">
                {run.headline}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <QuickAction
                icon={ExternalLink}
                label="Open case in Operator Console"
                onClick={handleOpenCase}
              />
              <QuickAction
                icon={FileText}
                label="Open presentation bundle"
                onClick={handleOpenBundle}
              />
              <QuickAction
                icon={Camera}
                label="Open visual evidence"
                onClick={handleOpenEvidence}
              />
              <QuickAction
                icon={Copy}
                label="Copy case reference"
                onClick={handleCopyId}
              />
              <QuickAction
                icon={RotateCw}
                label="Re-run replay"
                onClick={handleRerun}
              />
            </div>
          </div>

          {/* Metadata grid — 4 columns, eyebrow labels above mono values, no
              dividers. Reads as a calm reference block under the headline. */}
          <dl className="grid grid-cols-4 gap-x-6 gap-y-1 pt-1">
            <div className="min-w-0">
              <dt className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
                Case ref
              </dt>
              <dd className="mt-1 font-mono text-[12.5px] text-foreground tabular-nums truncate">
                {run.caseRef}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
                Policy
              </dt>
              {/* Error runs already carry rose in three places (left bar, error
                  pill, ErrorPanel) — colouring the name too tips the hero into
                  alarm-fatigue. Keep name in foreground for errors; the bar
                  alone carries identity. Non-error runs use the policy hash
                  colour so identity reads at a glance. */}
              <dd
                className="mt-1 font-mono text-[12.5px] truncate text-foreground"
                style={isError ? undefined : { color: hashColor }}
                title={policy?.name ?? "unknown"}
              >
                {policy?.name ?? "unknown"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
                Ran at
              </dt>
              <dd className="mt-1 font-mono text-[12.5px] text-foreground tabular-nums truncate">
                {formatTime(run.ranAt)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
                Duration
              </dt>
              <dd className="mt-1 font-mono text-[12.5px] text-foreground tabular-nums truncate">
                {(run.durationMs / 1000).toFixed(2)}s
              </dd>
            </div>
            {c && (
              <>
                <div className="col-span-2 min-w-0">
                  <dt className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
                    Visa
                  </dt>
                  <dd className="mt-1 text-[12.5px] text-foreground/90 truncate">
                    {c.visa}
                  </dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
                    Country
                  </dt>
                  <dd className="mt-1 font-mono text-[12.5px] text-foreground tabular-nums">
                    {c.country}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </SheetHeader>

        {/* ─── Body — scroll region ───────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isError ? (
            <ErrorPanel run={run} policyName={policy?.name ?? "unknown"} />
          ) : (
            <>
              {/* Outcome arrow strip — calm hairline divider, no fill plate.
                  Lets the two pills carry the colour story on their own. */}
              <div className="px-8 py-7 border-b border-border/60 flex items-center gap-5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 shrink-0">
                    Original
                  </span>
                  <Pill tone={fromOutcome.tint} size="md" dot>
                    {fromOutcome.label}
                  </Pill>
                </div>
                <ArrowRight
                  className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0"
                  strokeWidth={1.5}
                />
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 shrink-0">
                    Replayed
                  </span>
                  <Pill tone={toOutcome.tint} size="md" dot>
                    {toOutcome.label}
                  </Pill>
                </div>
                <div className="ml-auto flex items-baseline gap-2 font-mono text-[11px] tabular-nums">
                  <span className="text-muted-foreground/70">conf Δ</span>
                  <span
                    className={
                      confDelta === 0
                        ? "text-foreground/80"
                        : confDelta > 0
                          ? "text-[hsl(var(--tint-mint-fg))]/90"
                          : "text-[hsl(var(--tint-amber-fg))]/90"
                    }
                  >
                    {confDelta > 0 ? `+${confDelta}` : confDelta}
                  </span>
                </div>
              </div>

              {/* What changed — diff bullets between original & replayed
                  reasoning. Sits above the columns so the operator gets the
                  punchline first, then the supporting evidence. Wrapped with
                  py-6 to give it 24px breathing on both sides. */}
              <div className="py-2">
                <WhatChanged
                  original={originalReasoning}
                  replayed={run.reasoning}
                  sameOutcome={run.originalOutcome === run.replayedOutcome}
                />
              </div>

              {/* Side-by-side diff — extra horizontal padding on each column
                  side of the divider keeps the confidence bars from kissing
                  the centre line (which read as one merged bar before). */}
              <div className="grid grid-cols-2 px-8 py-8">
                <div className="pr-7 min-w-0">
                  <DiffColumn
                    label="Original decision"
                    outcome={run.originalOutcome}
                    confidence={run.originalConfidence}
                    reasoning={originalReasoning}
                    policyName="current · live"
                  />
                </div>
                <div className="border-l border-border/50 pl-7 min-w-0">
                  <DiffColumn
                    label="Replayed decision"
                    outcome={run.replayedOutcome}
                    confidence={run.replayedConfidence}
                    reasoning={run.reasoning}
                    policyName={policy?.name ?? "unknown"}
                    isReplayed
                  />
                </div>
              </div>

              {/* Policy snapshot blurb — short context for the operator deciding
                  whether to promote. */}
              <PolicyBlurb policy={policy} />
            </>
          )}
        </div>

        {/* ─── Footer actions ─────────────────────────────────────────── */}
        <div className="px-8 py-4 border-t border-border flex items-center gap-2">
          {!isError && policy && promoteableTemplateId && (
            <Button
              onClick={handlePromote}
              disabled={promoting}
              className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90"
            >
              {promoting ? (
                <RotateCw className="mr-2 h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Check className="mr-2 h-3.5 w-3.5" strokeWidth={2} />
              )}
              Promote {policy.name} to live
            </Button>
          )}
          {!isError && policy?.isLive && (
            <div className="text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "hsl(var(--tint-violet-fg))" }}
                />
                Already the live policy — nothing to promote.
              </span>
            </div>
          )}
          {!isError && policy && !policy.isLive && !promoteableTemplateId && (
            <div className="text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
                Curated replay snapshot only — no runtime promote path.
              </span>
            </div>
          )}
          {/* Re-run lives in the hero quick-action cluster — no need to
              duplicate it in the footer. The footer now stays focused on the
              one decision that matters here: promote (or not). */}
        </div>
      </SheetContent>
    </Sheet>
  );
}
