import type { SimulationRun } from "@/data/simulationRuns";
import { findPolicy } from "@/data/simulationRuns";

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

// Short context block that helps the operator decide whether to promote.
// Skipped entirely when the policy can't be resolved (orphaned run).
export function PolicyBlurb({ policyId }: { policyId: SimulationRun["policyId"] }) {
  const policy = findPolicy(policyId);
  if (!policy) return null;

  return (
    <div className="px-8 py-6 border-t border-border/60 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">
          About this policy
        </span>
        <span className="font-mono text-[10px] text-[hsl(var(--tint-violet-fg))]/85">
          {policy.name}
        </span>
        {policy.isLive && (
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
        )}
      </div>
      <p className="text-[12.5px] leading-relaxed text-foreground/80">
        {policy.description}
      </p>
      <p className="text-[11px] text-muted-foreground/75 font-mono">
        {policy.author} · {formatTime(policy.authoredAt)}
      </p>
    </div>
  );
}
