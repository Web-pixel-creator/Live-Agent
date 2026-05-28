import type { PolicySnapshot } from "@/data/simulationRuns";

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

export function PolicyBlurb({ policy }: { policy: PolicySnapshot | null | undefined }) {
  if (!policy) return null;
  const history = policy.runtimeGovernance?.history ?? [];

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
      {policy.runtimeGovernance?.templateId && (
        <p className="text-[11px] text-muted-foreground/75 font-mono">
          template={policy.runtimeGovernance.templateId}
          {policy.runtimeGovernance.version !== null
            ? ` · version=${policy.runtimeGovernance.version}`
            : ""}
        </p>
      )}
      {history.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
            Recent governance activity
          </div>
          {history.map((item) => (
            <p
              key={`${item.createdAt}:${item.version ?? "none"}`}
              className="text-[11px] text-muted-foreground/80 font-mono"
            >
              {formatTime(item.createdAt)} · {item.outcome ?? "observed"}
              {item.version !== null ? ` · v${item.version}` : ""}
              {item.actorRole ? ` · ${item.actorRole}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
