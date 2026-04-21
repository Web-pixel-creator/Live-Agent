// Compact one-line activity timeline for the selected node. Pure
// presentation — derives events from the node via deriveNodeActivity and
// renders icon · label · relative time per row. Lives in the rail under
// "Last incident", before the action footer.

import { useMemo } from "react";
import {
  Activity,
  Power,
  Wrench,
  CircleCheck,
  Download,
  type LucideIcon,
} from "lucide-react";
import type { EdgeNode } from "@/data/nodes";
import {
  deriveNodeActivity,
  formatActivityAgo,
  type NodeActivityKind,
} from "./nodeActivity";

// Icon + tint per event kind. Tints follow the project's colour
// semantics: crimson = infra failure, amber = time/degradation warning,
// mint = healthy/resolved, slate = maintenance/inactive, violet = ops.
const KIND_META: Record<
  NodeActivityKind,
  { icon: LucideIcon; tint: "crimson" | "amber" | "mint" | "slate" | "violet" }
> = {
  heartbeat_lost: { icon: Activity, tint: "crimson" },
  heartbeat_slipped: { icon: Activity, tint: "amber" },
  restart: { icon: Power, tint: "violet" },
  maintenance_start: { icon: Wrench, tint: "slate" },
  maintenance_end: { icon: Wrench, tint: "slate" },
  firmware_update: { icon: Download, tint: "violet" },
  recovered: { icon: CircleCheck, tint: "mint" },
};

interface NodeActivityTimelineProps {
  node: EdgeNode;
}

export function NodeActivityTimeline({ node }: NodeActivityTimelineProps) {
  const events = useMemo(() => deriveNodeActivity(node), [node]);

  if (events.length === 0) return null;

  return (
    <div className="px-6 py-5 border-b border-border/40">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 font-medium mb-3">
        Activity
      </div>
      <ul className="space-y-2">
        {events.map((ev, i) => {
          const meta = KIND_META[ev.kind];
          const Icon = meta.icon;
          return (
            <li
              key={`${ev.kind}-${i}`}
              className="flex items-center gap-2.5 text-[11px] leading-tight"
            >
              <Icon
                className="h-3 w-3 shrink-0"
                strokeWidth={1.75}
                style={{ color: `hsl(var(--tint-${meta.tint}-fg))` }}
              />
              <span className="flex-1 min-w-0 text-foreground/85 truncate">
                {ev.label}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums shrink-0">
                {formatActivityAgo(ev.agoSec)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
