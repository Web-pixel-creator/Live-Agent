import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Beaker, Play, Loader2, Search, Check, ArrowRight } from "lucide-react";
import {
  policySnapshots,
  type SimulationRun,
} from "@/data/simulationRuns";
import type { WorkspaceCase } from "@/data/workspace";
import { buildSimulationRun } from "@/lib/runtime-simulation-runs";

interface NewReplaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (run: SimulationRun) => void;
  cases: WorkspaceCase[];
  initialCaseRef?: string | null;
}

export function NewReplaySheet({
  open,
  onOpenChange,
  onRun,
  cases,
  initialCaseRef,
}: NewReplaySheetProps) {
  const [caseRef, setCaseRef] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (open) {
      setCaseRef(initialCaseRef ?? null);
      setPolicyId(null);
      setQuery("");
      setRunning(false);
    }
  }, [open, initialCaseRef]);

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return cases;
    }
    return cases.filter(
      (workspaceCase) =>
        workspaceCase.ref.toLowerCase().includes(normalized) ||
        workspaceCase.client.toLowerCase().includes(normalized) ||
        workspaceCase.country.toLowerCase().includes(normalized) ||
        workspaceCase.visa.toLowerCase().includes(normalized),
    );
  }, [cases, query]);

  const selectedCase = caseRef
    ? cases.find((workspaceCase) => workspaceCase.ref === caseRef) ?? null
    : null;
  const selectedPolicy = policyId
    ? policySnapshots.find((policy) => policy.id === policyId) ?? null
    : null;

  const canRun = Boolean(selectedCase) && Boolean(selectedPolicy) && !running;

  const handleRun = () => {
    if (!selectedCase || !selectedPolicy) {
      return;
    }
    setRunning(true);
    const startedAt = Date.now();
    setTimeout(() => {
      const newRun = buildSimulationRun({
        workspaceCase: selectedCase,
        policy: selectedPolicy,
        ranAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        id: `run-${selectedCase.ref}-${selectedPolicy.id}-${Date.now()}`,
        source: selectedCase.source === "runtime" ? "runtime" : "curated",
      });
      onRun(newRun);
      setRunning(false);
      onOpenChange(false);
    }, 1500);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <Beaker className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />
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

        <div className="flex-1 min-h-0 overflow-auto">
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
                onChange={(event) => setQuery(event.target.value)}
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
                filteredCases.map((workspaceCase) => {
                  const active = workspaceCase.ref === caseRef;
                  return (
                    <button
                      key={workspaceCase.ref}
                      type="button"
                      onClick={() => setCaseRef(workspaceCase.ref)}
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
                        {workspaceCase.ref}
                      </span>
                      <span className="truncate flex-1 min-w-0">{workspaceCase.client}</span>
                      <span className="font-mono text-[10.5px] text-muted-foreground/75 shrink-0">
                        {workspaceCase.country}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground/70 truncate max-w-[120px] shrink-0">
                        {workspaceCase.visa}
                      </span>
                      {workspaceCase.source === "runtime" && (
                        <Pill tone="violet" size="sm" className="shrink-0">
                          live
                        </Pill>
                      )}
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
              {policySnapshots.map((policy) => {
                const active = policy.id === policyId;
                return (
                  <button
                    key={policy.id}
                    type="button"
                    onClick={() => setPolicyId(policy.id)}
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
                        {policy.name}
                      </span>
                      {policy.isLive && (
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
                        {policy.author}
                      </span>
                      {active && (
                        <Check
                          className="h-3 w-3 text-[hsl(var(--tint-violet-fg))]/80"
                          strokeWidth={2.25}
                        />
                      )}
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground/85">
                      {policy.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedCase && selectedPolicy && (
            <div className="px-7 pb-6">
              <div className="rounded-md border border-border/50 bg-secondary/15 px-4 py-3 flex items-center gap-2 text-[12px]">
                <span className="font-mono text-[11px] text-muted-foreground/80">
                  {selectedCase.ref}
                </span>
                <span className="text-foreground/80 truncate">{selectedCase.client}</span>
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
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" strokeWidth={2} />
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
