import { Pill } from "@/components/ui/pill";
import type { WorkspaceCase } from "@/data/workspace";
import type { RuntimeCaseWiki } from "@/hooks/useWorkspaceRuntime";
import {
  buildRuntimeArtifactViewerPath,
  RUNTIME_ARTIFACT_VIEW_PRESETS,
} from "@/lib/runtime-artifact-viewer";
import {
  buildRuntimeSessionReplaySummary,
  fetchRuntimeSessionReplay,
  type RuntimeSessionReplaySummary,
} from "@/lib/runtime-session-replay";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Compass,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";

type SessionBoundaryPanelProps = {
  caseValue: WorkspaceCase;
  wiki: RuntimeCaseWiki | undefined;
};

function formatStatusLabel(value: string | null | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.replace(/[_-]+/g, " ").trim();
}

function toneForReplay(summary: RuntimeSessionReplaySummary | null): "mint" | "rose" | "violet" | "slate" {
  if (!summary) {
    return "slate";
  }
  if (summary.resumeReady === false || summary.approvalGateStatus === "pending") {
    return "rose";
  }
  if (summary.replayState === "verified" || summary.resumeReady === true) {
    return "mint";
  }
  return "violet";
}

export const SessionBoundaryPanel = ({
  caseValue,
  wiki,
}: SessionBoundaryPanelProps) => {
  const sessionId = caseValue.sessionId ?? wiki?.sessionId ?? null;
  const replayQuery = useQuery({
    queryKey: ["app-shell", "session-replay", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchRuntimeSessionReplay(sessionId ?? ""),
    staleTime: 30_000,
    retry: 1,
  });
  const replaySummary = buildRuntimeSessionReplaySummary(replayQuery.data);
  const tone = toneForReplay(replaySummary);
  const runtimeProofPath = buildRuntimeArtifactViewerPath(
    RUNTIME_ARTIFACT_VIEW_PRESETS.runtimeProof,
    { caseRef: caseValue.ref },
  );
  const boundarySummary =
    replaySummary?.workflowBoundarySummary ??
    replaySummary?.nextOperatorActionLabel ??
    "Load a repo-owned session replay to inspect the current workflow boundary.";
  const primaryStep =
    replaySummary?.primaryStepLabel ??
    replaySummary?.nextOperatorChecklist[0] ??
    "Open Session Ops to inspect the current boundary.";
  const proofIngress =
    replaySummary?.latestProofContextSource || replaySummary?.latestProofIngressSource
      ? `${replaySummary?.latestProofContextSource ?? "unknown"} via ${replaySummary?.latestProofIngressSource ?? "unknown"}`
      : "Not published";
  const turnIngress =
    replaySummary?.latestTurnContextSource || replaySummary?.latestTurnIngressSource
      ? `${replaySummary?.latestTurnContextSource ?? "unknown"} via ${replaySummary?.latestTurnIngressSource ?? "unknown"}`
      : "Not published";

  return (
    <section
      id="connections"
      className="relative mt-10 -mx-8 scroll-mt-24 px-8 py-6 bg-secondary/[0.04] border-y border-border/50"
    >
      <span
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${
          tone === "rose"
            ? "bg-[hsl(var(--tint-rose-fg))]"
            : tone === "mint"
              ? "bg-[hsl(var(--tint-mint-fg))]"
              : tone === "violet"
                ? "bg-[hsl(var(--tint-violet-fg))]"
                : "bg-border/70"
        }`}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary mb-3">
            Session Boundary
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[30px] leading-[1.1] tracking-tight">
              Replay boundary
            </h2>
            <Pill tone={tone} size="sm" dot>
              {replayQuery.isLoading
                ? "Loading"
                : formatStatusLabel(replaySummary?.replayState, "Awaiting replay")}
            </Pill>
            {replayQuery.isFetching ? (
              <Pill tone="slate" size="sm">
                Syncing
              </Pill>
            ) : null}
            {replaySummary?.workflowCurrentStage ? (
              <Pill tone="slate" size="sm">
                {replaySummary.workflowCurrentStage}
              </Pill>
            ) : null}
            {replaySummary?.workflowRoute ? (
              <Pill tone="slate" size="sm">
                {replaySummary.workflowRoute}
              </Pill>
            ) : null}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {boundarySummary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="slate" size="sm">
            support
          </Pill>
          <Link
            to={runtimeProofPath}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background/65 px-3 text-[12px] text-foreground/88 transition-smooth hover:border-border/80 hover:bg-secondary/[0.18]"
          >
            <Compass className="h-3.5 w-3.5" strokeWidth={1.75} />
            Inspect proof
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Workflow className="h-3.5 w-3.5" strokeWidth={1.75} />
            Primary step
          </div>
          <div className="mt-3 text-[15px] leading-relaxed text-foreground/92">{primaryStep}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {replaySummary?.primaryStepTargetLabel ? (
              <Pill tone="violet" size="sm">
                {replaySummary.primaryStepTargetLabel}
              </Pill>
            ) : null}
            {replaySummary?.nextOperatorStepProgressLabel ? (
              <Pill tone="slate" size="sm">
                {replaySummary.nextOperatorStepProgressLabel}
              </Pill>
            ) : null}
          </div>
        </article>

        <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {replaySummary?.approvalGateStatus === "pending" ? (
              <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Approval gate
          </div>
          <div className="mt-3 text-[15px] leading-relaxed text-foreground/92">
            {formatStatusLabel(replaySummary?.approvalGateStatus, "clear")}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {replaySummary?.approvalGateReason ??
              "No pending approval gate is blocking replay for this case."}
          </p>
        </article>

        <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Compass className="h-3.5 w-3.5" strokeWidth={1.75} />
            Latest proof
          </div>
          <div className="mt-3 text-[15px] leading-relaxed text-foreground/92">
            {replaySummary?.latestProofSummary ?? "No verified proof pointer has been published yet."}
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div>Proof ingress: {proofIngress}</div>
            <div>Turn ingress: {turnIngress}</div>
          </div>
        </article>

        <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Timer className="h-3.5 w-3.5" strokeWidth={1.75} />
            Recovery path
          </div>
          <div className="mt-3 text-[15px] leading-relaxed text-foreground/92">
            {replaySummary?.recoveryPathLabel ?? "Replay is waiting for the first runtime boundary snapshot."}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {replaySummary?.recoveryHandoffReason ??
              "Operator Session Ops remains the primary repo-owned recovery surface."}
          </p>
        </article>
      </div>

      {replaySummary?.primaryStepNeedsRefresh && replaySummary.primaryStepRefreshFollowupPath.length > 0 ? (
        <div className="mt-4 rounded-[22px] border border-border/60 bg-background/65 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              After refresh
            </div>
            {replaySummary.primaryStepRefreshDisposition ? (
              <Pill tone="slate" size="sm">
                {replaySummary.primaryStepRefreshDisposition}
              </Pill>
            ) : null}
            {replaySummary.primaryStepRefreshCompatibility ? (
              <Pill tone="slate" size="sm">
                {replaySummary.primaryStepRefreshCompatibility}
              </Pill>
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-2">
              <div className="text-sm leading-relaxed text-muted-foreground">
                {replaySummary.primaryStepRefreshEvidenceHint ??
                  "Refresh replay before the first operator step becomes executable."}
              </div>
              {replaySummary.primaryStepRefreshOutcomeLabel ? (
                <div className="text-sm leading-relaxed text-foreground/88">
                  {replaySummary.primaryStepRefreshOutcomeLabel}
                </div>
              ) : null}
              {replaySummary.primaryStepRefreshDetourHint ? (
                <div className="text-xs leading-relaxed text-muted-foreground">
                  {replaySummary.primaryStepRefreshDetourHint}
                </div>
              ) : null}
            </div>
            <ol className="space-y-1.5 text-xs leading-relaxed text-foreground/88">
              {replaySummary.primaryStepRefreshFollowupPath.map((entry) => (
                <li key={entry} className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} />
                  <span>{entry}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </section>
  );
};
