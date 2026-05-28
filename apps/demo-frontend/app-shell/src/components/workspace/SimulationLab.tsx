import { useEffect, useMemo, useState } from "react";
import {
  Beaker,
  Plus,
  SlidersHorizontal,
  History,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Minus,
  TrendingDown,
  TrendingUp,
  XCircle,
  Layers,
  Activity,
  GitCompare,
  ChevronDown,
} from "lucide-react";
import { Pill } from "@/components/ui/pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeStats,
  deltaTone,
  findCase,
  outcomeTone,
  simulationRuns as seedRuns,
  type PolicySnapshot,
  type ReplayDelta,
  type SimulationRun,
} from "@/data/simulationRuns";
import { buildRuntimeSimulationRuns } from "@/lib/runtime-simulation-runs";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";
import {
  buildSimulationPolicySnapshots,
  findSimulationPolicy,
} from "@/lib/runtime-simulation-policies";
import { RunDetailDrawer } from "./RunDetailDrawer";
import { NewReplaySheet } from "./NewReplaySheet";
import { toastWithUndo } from "@/lib/undoToast";
import { policyHashColor } from "./runDetail/policyHash";

// Compact relative time — keeps card meta in one row. Mirrors the language
// used elsewhere in the workspace (now / 8h / 2d) so the visual rhythm holds.
const shortAge = (iso: string, now: number) => {
  const ms = now - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
};

// Δ confidence formatter — signed, padded to keep card columns aligned.
const signedDelta = (a: number, b: number) => {
  const d = b - a;
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
};

const DELTA_FILTERS: {
  id: ReplayDelta | "all";
  label: string;
  Icon: typeof Minus;
}[] = [
  { id: "all", label: "All", Icon: Layers },
  { id: "tightened", label: "Tightened", Icon: ArrowDownRight },
  { id: "loosened", label: "Loosened", Icon: ArrowUpRight },
  { id: "confidence_drop", label: "Conf", Icon: TrendingDown },
  { id: "confidence_gain", label: "Conf", Icon: TrendingUp },
  { id: "no_change", label: "No change", Icon: Minus },
  { id: "error", label: "Errors", Icon: XCircle },
];

export function SimulationLab() {
  const {
    cases,
    runtimeActive,
    governancePolicy,
    governanceTemplateCatalog,
    governancePolicyUpdates,
  } = useWorkspaceRuntime();
  // `now` is captured once per mount so card "8h ago" labels stay stable
  // while the user scans the grid (otherwise relative times would jitter on
  // every re-render triggered by filter changes).
  const now = useMemo(() => Date.now(), []);
  const [deltaFilter, setDeltaFilter] = useState<ReplayDelta | "all">("all");
  const [policyFilter, setPolicyFilter] = useState<string>("all");
  // Drawer state — null when closed. We hold the run object directly (not its
  // id) so the drawer keeps rendering its previous run during the close-out
  // animation even after the underlying state nulls out.
  const [activeRun, setActiveRun] = useState<SimulationRun | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newSheetOpen, setNewSheetOpen] = useState(false);
  // Set when an external launcher (e.g. CommandPalette → "Replay this case")
  // wants the sheet to open with a case already chosen. Cleared after the
  // sheet closes so subsequent manual launches start blank.
  const [pendingCaseRef, setPendingCaseRef] = useState<string | null>(null);
  // Live runs list — seeded from the curated mock data and grown by every
  // successful "New replay" submission. Kept in component state (rather than
  // a global store) because the Lab is the only consumer and we want the
  // demo to reset on hard reload.
  const [createdRuns, setCreatedRuns] = useState<SimulationRun[]>([]);
  // Tracks the most recently created run so its card can pulse a violet
  // ring/glow for ~2s after landing in the grid. Cleared by a timer so the
  // animation only plays once — re-renders triggered by filters/drawer state
  // won't re-trigger the burst.
  const [freshRunId, setFreshRunId] = useState<string | null>(null);

  // External callers (CommandPalette) request a pre-filled replay via this
  // window event. Carrying the caseRef on the event detail keeps the palette
  // and the lab decoupled — no shared store, no prop drilling through routes.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ caseRef?: string }>).detail;
      setPendingCaseRef(detail?.caseRef ?? null);
      setNewSheetOpen(true);
    };
    window.addEventListener("simulation:new-replay", onOpen);
    return () => window.removeEventListener("simulation:new-replay", onOpen);
  }, []);

  const openRun = (r: SimulationRun) => {
    setActiveRun(r);
    setDrawerOpen(true);
  };

  // Prepend the freshly-synthesised run and surface an undo toast. Undo just
  // pulls the run back out by id — clean rollback, no other side effects.
  // Prepend the freshly-synthesised run, mark it as fresh for the highlight
  // animation, and surface an undo toast. Undo also clears `freshRunId` so
  // a rolled-back card doesn't leave a stale glow lingering on a phantom row.
  const handleRunCreated = (run: SimulationRun) => {
    setCreatedRuns((prev) => [run, ...prev]);
    setFreshRunId(run.id);
    // 2s matches the fresh-glow keyframe duration — clear the marker right
    // when the animation completes so subsequent re-renders don't re-trigger.
    window.setTimeout(() => {
      setFreshRunId((current) => (current === run.id ? null : current));
    }, 2000);
    // Auto-open the drawer ~700ms after the card lands so operators can read
    // reasoning without a second click. The delay lets the glow burst register
    // first (so the spatial origin is obvious) before the sheet slides over.
    // Skipped if the operator has already opened a different drawer in the
    // meantime — we don't want to hijack their attention.
    const autoOpenTimer = window.setTimeout(() => {
      setActiveRun((current) => {
        if (current) return current; // operator already opened something
        setDrawerOpen(true);
        return run;
      });
    }, 700);
    const policyName = findSimulationPolicy(run.policyId, policies)?.name ?? "policy";
    toastWithUndo(
      `Replay queued · ${run.caseRef} under ${policyName}`,
      () => {
        window.clearTimeout(autoOpenTimer);
        setCreatedRuns((prev) => prev.filter((r) => r.id !== run.id));
        setFreshRunId((current) => (current === run.id ? null : current));
        // If the auto-opened drawer is still showing this rolled-back run,
        // close it so the operator isn't left staring at a phantom card.
        setActiveRun((current) => {
          if (current?.id === run.id) {
            setDrawerOpen(false);
            return null;
          }
          return current;
        });
      },
      { undoneMessage: `Replay discarded · ${run.caseRef}` },
    );
  };

  const policies = useMemo(
    () =>
      buildSimulationPolicySnapshots(
        governancePolicy,
        governanceTemplateCatalog,
        governancePolicyUpdates,
      ),
    [governancePolicy, governancePolicyUpdates, governanceTemplateCatalog],
  );
  const runtimeRuns = useMemo(
    () => buildRuntimeSimulationRuns(cases, policies),
    [cases, policies],
  );
  const baseRuns =
    runtimeActive && runtimeRuns.length > 0 ? runtimeRuns : seedRuns;
  const runs = useMemo(() => {
    const shadowed = new Set(createdRuns.map((item) => item.id));
    return [
      ...createdRuns,
      ...baseRuns.filter((item) => !shadowed.has(item.id)),
    ];
  }, [baseRuns, createdRuns]);

  const sortedRuns = useMemo(
    () =>
      [...runs].sort(
        (a, b) => new Date(b.ranAt).getTime() - new Date(a.ranAt).getTime(),
      ),
    [runs],
  );

  const filteredRuns = useMemo(() => {
    return sortedRuns.filter((r) => {
      if (deltaFilter !== "all" && r.delta !== deltaFilter) return false;
      if (policyFilter !== "all" && r.policyId !== policyFilter) return false;
      return true;
    });
  }, [sortedRuns, deltaFilter, policyFilter]);

  const stats = useMemo(() => computeStats(sortedRuns), [sortedRuns]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      {/* Matches the Live Desk rhythm: px-8 latitude, no sticky/blur — the
          page just scrolls. Title block, stats, and filter ribbon are three
          separate breath-spaces with single hairline beneath the whole. */}
      <header className="relative border-b border-border overflow-hidden">
        {/* Soft radial wash anchored to the title — keeps the header from
            reading as a flat band without introducing a heavy hero. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(720px 280px at 12% 0%, hsl(var(--tint-violet-fg) / 0.10), transparent 65%)",
          }}
        />
        <div className="relative flex items-start justify-between gap-6 px-8 pt-7 pb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-[hsl(var(--tint-violet-bg))] ring-1 ring-inset ring-[hsl(var(--tint-violet-fg))]/25">
                <Beaker
                  className="h-3 w-3 text-[hsl(var(--tint-violet-fg))]"
                  strokeWidth={2}
                />
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                Simulation Lab · Replay
              </span>
            </div>
            <h1 className="font-serif text-[28px] leading-[1.15] tracking-[-0.01em] text-foreground">
              Replay any case under any policy snapshot.
            </h1>
            <p className="mt-2 text-[13px] text-muted-foreground max-w-xl leading-relaxed">
              Pick a resolved case, point it at a policy version, and see the
              decision the AI would emit today — risk band, confidence, and the
              factors that moved.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNewSheetOpen(true)}
            className="shrink-0 group/btn inline-flex items-center gap-2 h-9 pl-2 pr-3.5 rounded-md bg-secondary/60 ring-1 ring-inset ring-border text-foreground text-[13px] font-medium hover:bg-secondary hover:ring-[hsl(var(--tint-violet-fg))]/35 transition-smooth focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] bg-[hsl(var(--tint-violet-bg))] ring-1 ring-inset ring-[hsl(var(--tint-violet-fg))]/30 group-hover/btn:ring-[hsl(var(--tint-violet-fg))]/55 transition-smooth">
              <Plus
                className="h-3 w-3 text-[hsl(var(--tint-violet-fg))]"
                strokeWidth={2.25}
              />
            </span>
            New replay
          </button>
        </div>

        {/* Stat strip — quiet inline metrics with leading icons so the row
            reads instantly without colour alone carrying meaning. */}
        <div className="relative flex items-center gap-6 px-8 pb-5 text-[12px]">
          <StatItem
            Icon={Activity}
            tone="muted"
            value={stats.total}
            label="replays total"
          />
          <span className="h-3 w-px bg-border" />
          <StatItem
            Icon={GitCompare}
            tone="rose"
            value={stats.flipped}
            label="decisions flipped"
          />
          <StatItem
            Icon={ArrowLeftRight}
            tone="amber"
            value={stats.confidenceShifts}
            label="confidence shifts"
          />
          {stats.errored > 0 && (
            <StatItem
              Icon={AlertTriangle}
              tone="rose"
              value={stats.errored}
              label="errors"
            />
          )}
        </div>
      </header>

      {/* Filter ribbon */}
      <div className="flex items-center gap-3 px-8 py-3 border-b border-border bg-card/20">
        <SlidersHorizontal
          className="h-3.5 w-3.5 text-muted-foreground"
          strokeWidth={1.75}
        />
        <div className="flex items-center gap-0.5 shrink-0">
          {DELTA_FILTERS.map((f) => {
            const active = deltaFilter === f.id;
            const Icon = f.Icon;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setDeltaFilter(f.id)}
                className={
                  "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[11.5px] font-medium whitespace-nowrap transition-smooth " +
                  (active
                    ? "bg-secondary text-foreground ring-1 ring-inset ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50")
                }
              >
                <Icon className="h-3 w-3" strokeWidth={1.75} />
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="h-3 w-px bg-border ml-1 shrink-0" />
        <Select value={policyFilter} onValueChange={setPolicyFilter}>
          <SelectTrigger className="h-7 w-[180px] px-2.5 rounded-md bg-secondary/40 border border-border/60 text-[11.5px] text-foreground hover:bg-secondary/70 hover:border-border focus:ring-1 focus:ring-primary/40 transition-smooth font-mono shrink-0 [&>svg]:hidden gap-1.5">
            <Layers
              className="h-3 w-3 text-muted-foreground shrink-0"
              strokeWidth={1.75}
            />
            <span className="flex-1 text-left truncate">
              <SelectValue placeholder="all policies" />
            </span>
            <ChevronDown
              className="h-3 w-3 text-muted-foreground shrink-0 opacity-70"
              strokeWidth={2}
            />
          </SelectTrigger>
          <SelectContent className="font-mono text-[11.5px]">
            <SelectItem value="all">all policies</SelectItem>
            {policies.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="inline-flex items-center gap-2">
                  {p.name}
                  {p.isLive && (
                    <span
                      className="inline-flex items-center gap-1 uppercase tracking-[0.12em] text-[9px]"
                      style={{ color: "hsl(var(--tint-violet-fg))" }}
                    >
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{
                          backgroundColor: "hsl(var(--tint-violet-fg))",
                        }}
                      />
                      live
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground font-mono tabular-nums whitespace-nowrap shrink-0">
          {filteredRuns.length} of {sortedRuns.length}
        </span>
      </div>

      {/* ─── Run grid ───────────────────────────────────────────────────── */}
      {/* Generous outer padding (px-8 pt-8 pb-7) and gap-5 between cards lets
          each card own its space — the colour bar on the left edge needs a bit
          of latitude around it to read as identity, not as a divider. */}
      <div className="px-8 pt-8 pb-7">
        {filteredRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 ring-1 ring-inset ring-border mb-4">
              <History className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </span>
            <p className="text-[13px] text-foreground/80">
              No replays match this filter combination.
            </p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Try widening the delta band or pick a different policy.
            </p>
            <button
              onClick={() => {
                setDeltaFilter("all");
                setPolicyFilter("all");
              }}
              className="mt-4 inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-secondary/60 ring-1 ring-inset ring-border text-[12px] text-foreground hover:bg-secondary transition-smooth"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredRuns.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                policies={policies}
                now={now}
                fresh={run.id === freshRunId}
                onOpen={() => openRun(run)}
              />
            ))}
          </div>
        )}
      </div>

      <RunDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        run={activeRun}
        policies={policies}
      />
      <NewReplaySheet
        open={newSheetOpen}
        onOpenChange={(next) => {
          setNewSheetOpen(next);
          // Clear the pre-fill once the sheet closes so the next manual
          // launch (header button) starts from a blank picker.
          if (!next) setPendingCaseRef(null);
        }}
        onRun={handleRunCreated}
        cases={cases}
        policies={policies}
        initialCaseRef={pendingCaseRef}
      />
    </div>
  );
}

// Inline stat with leading icon. Tone drives the value+icon hue so each metric
// reads as its own little signal without needing a chip or heavy weight.
function StatItem({
  Icon,
  tone,
  value,
  label,
}: {
  Icon: typeof Minus;
  tone: "muted" | "rose" | "amber" | "violet" | "mint";
  value: number;
  label: string;
}) {
  const color =
    tone === "muted"
      ? "hsl(var(--foreground))"
      : `hsl(var(--tint-${tone}-fg))`;
  return (
    <div className="flex items-center gap-1.5">
      <Icon
        className="h-3 w-3 shrink-0 opacity-80"
        strokeWidth={1.75}
        style={{ color }}
      />
      <span className="font-mono tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Run card ───────────────────────────────────────────────────────────────
// Compact card; the drawer (next iteration) will own the full reasoning view.
// We surface only the signal density an operator scanning the grid needs:
// case ref + client, the delta chip, the outcome arrow, and the confidence Δ.
// Visual hash colour mapping moved to runDetail/policyHash.ts so the drawer
// header can reuse it — the colour identity then carries from card → drawer.

function RunCard({
  run,
  policies,
  now,
  fresh,
  onOpen,
}: {
  run: SimulationRun;
  policies: PolicySnapshot[];
  now: number;
  fresh: boolean;
  onOpen: () => void;
}) {
  const c = findCase(run.caseRef);
  const policy = findSimulationPolicy(run.policyId, policies);
  const dTone = deltaTone[run.delta];
  const fromOutcome = outcomeTone[run.originalOutcome];
  const toOutcome = outcomeTone[run.replayedOutcome];
  const confDelta = run.replayedConfidence - run.originalConfidence;
  const isError = run.delta === "error";
  const hashColor = policyHashColor(run.policyId, isError);

  return (
    <button
      type="button"
      onClick={onOpen}
      // `fresh` adds a 2s violet-ring + glow burst so a newly-created run
      // is impossible to miss in a dense grid. The animation is `both`-filled
      // so it doesn't snap back at the end — it eases all the way to nothing.
      className={
        "group/card relative overflow-hidden text-left rounded-md border border-border/50 bg-transparent hover:bg-secondary/25 hover:border-border/70 transition-smooth focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 " +
        (fresh ? "animate-fresh-glow" : "")
      }
    >
      {/* Soft delta tone-rail — barely-there 4px wash on the left edge tinted
          to the delta semantic. Kept very faint so the card stays calm; the
          delta chip in the top-right carries the loud signal. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-12 opacity-40 group-hover/card:opacity-60 transition-smooth pointer-events-none"
        style={{
          background: `linear-gradient(to right, hsl(var(--tint-${dTone.tint}-fg) / 0.04), transparent 85%)`,
        }}
      />
      {/* Policy identity rail — 2px violet-toned bar matching the sidebar +
          drawer hash. Slightly muted so it doesn't compete with content. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[2px] opacity-70 group-hover/card:opacity-90 transition-smooth"
        style={{ backgroundColor: hashColor }}
      />

      {/* Top strip: ref + delta chip */}
      <div className="relative flex items-center gap-2.5 px-5 pt-4 pb-2">
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {run.caseRef}
        </span>
        {c && (
          <span className="text-[12px] text-foreground truncate min-w-0">
            {c.client}
          </span>
        )}
        <Pill tone={dTone.tint} size="sm" className="ml-auto shrink-0">
          {dTone.label}
        </Pill>
      </div>

      {/* Headline */}
      <p className="relative px-5 text-[12.5px] leading-snug text-foreground/90 min-h-[34px]">
        {run.headline}
      </p>

      {/* Outcome arrow + confidence + sparkline */}
      <div className="relative flex items-center gap-2.5 px-5 mt-4">
        <Pill tone={fromOutcome.tint} size="sm">
          {fromOutcome.label}
        </Pill>
        <span className="text-muted-foreground/60 text-[11px]">→</span>
        <Pill tone={toOutcome.tint} size="sm">
          {toOutcome.label}
        </Pill>
        <div className="ml-auto flex items-center gap-2.5">
          <ConfidenceTrack
            from={run.originalConfidence}
            to={run.replayedConfidence}
            tone={
              confDelta === 0
                ? "slate"
                : confDelta > 0
                  ? "mint"
                  : "amber"
            }
          />
          <span className="flex items-baseline gap-1.5 font-mono text-[11px] tabular-nums">
            <span className="text-foreground">{run.replayedConfidence}</span>
            <span
              className={
                confDelta === 0
                  ? "text-muted-foreground"
                  : confDelta > 0
                    ? "text-[hsl(var(--tint-mint-fg))]"
                    : "text-[hsl(var(--tint-amber-fg))]"
              }
            >
              {signedDelta(run.originalConfidence, run.replayedConfidence)}
            </span>
          </span>
        </div>
      </div>

      {/* Footer — 3-column grid so policy / live-marker / age+duration each
          live in their own slot regardless of policy-name length. Keeps the
          right edge perfectly aligned across the whole grid. */}
      <div className="relative grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3 mt-4 border-t border-border/50 text-[10.5px] text-muted-foreground/85">
        <span className="font-mono truncate">{policy?.name ?? "unknown"}</span>
        {policy?.isLive ? (
          <span
            className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.12em] text-[9.5px]"
            style={{ color: "hsl(var(--tint-violet-fg) / 0.85)" }}
          >
            <span
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: "hsl(var(--tint-violet-fg) / 0.85)" }}
            />
            live
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums justify-self-end">
          <span>{shortAge(run.ranAt, now)}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{(run.durationMs / 1000).toFixed(1)}s</span>
          {isError && (
            <AlertTriangle
              className="h-3 w-3 ml-1"
              strokeWidth={2}
              style={{ color: "hsl(var(--tint-rose-fg))" }}
            />
          )}
        </span>
      </div>
    </button>
  );
}

// ─── Confidence track ───────────────────────────────────────────────────────
// Horizontal 0–100 bar showing the AI's confidence in the replayed decision.
// A faint tick marks where confidence used to be, so the shift is implicit:
// fill = current value, ghost-tick = previous. Reads as a meter, not a chart,
// which removes the "what is this line?" friction of the old sparkline.
function ConfidenceTrack({
  from,
  to,
  tone,
}: {
  from: number;
  to: number;
  tone: "mint" | "amber" | "slate";
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const fillPct = clamp(to);
  const tickPct = clamp(from);
  const color = `hsl(var(--tint-${tone}-fg))`;
  return (
    <div
      aria-hidden
      className="relative h-1 w-10 rounded-full bg-border/60 overflow-hidden shrink-0"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{ width: `${fillPct}%`, backgroundColor: color, opacity: 0.85 }}
      />
      {/* Ghost tick — previous value reference. Hidden when delta is zero
          (would just sit on top of the fill edge and add noise). */}
      {fillPct !== tickPct && (
        <div
          className="absolute top-[-1px] bottom-[-1px] w-px bg-foreground/40"
          style={{ left: `${tickPct}%` }}
        />
      )}
    </div>
  );
}
