import { AlertTriangle } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { outcomeTone, type SimulationRun } from "@/data/simulationRuns";

// Dedicated error layout — instead of empty diff columns, surface the failure
// message + stack-style blob so the operator can route it back to engineering.
export function ErrorPanel({
  run,
  policyName,
}: {
  run: SimulationRun;
  policyName: string;
}) {
  return (
    <div className="px-8 py-6 space-y-4">
      <div
        className="flex items-start gap-3 rounded-lg p-3.5 ring-1 ring-inset"
        style={{
          backgroundColor: "hsl(var(--tint-rose) / 0.06)",
          // @ts-expect-error css var
          "--tw-ring-color": "hsl(var(--tint-rose) / 0.18)",
        }}
      >
        <AlertTriangle
          className="h-4 w-4 mt-0.5 shrink-0"
          strokeWidth={2}
          style={{ color: "hsl(var(--tint-rose-fg))" }}
        />
        <div className="min-w-0 space-y-1">
          <p
            className="text-[12.5px] font-medium"
            style={{ color: "hsl(var(--tint-rose-fg))" }}
          >
            Replay aborted under {policyName}
          </p>
          <p className="text-[12px] text-foreground/80 leading-relaxed">
            The policy under test could not evaluate this case. The original
            decision is unaffected; this run is informational only.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
          Error
        </div>
        <pre
          className="rounded-lg ring-1 ring-inset ring-border/40 bg-card/30 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-foreground/85 overflow-x-auto whitespace-pre-wrap"
        >
          {run.error ??
            "UnknownError: replay engine returned no diagnostic payload."}
        </pre>
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
          Original decision (unchanged)
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={outcomeTone[run.originalOutcome].tint} size="md" dot>
            {outcomeTone[run.originalOutcome].label}
          </Pill>
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            conf {run.originalConfidence}
          </span>
        </div>
      </div>
    </div>
  );
}
