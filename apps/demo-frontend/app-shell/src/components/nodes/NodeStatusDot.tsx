// Tinted status dot — same vocabulary as Live Desk group dots so operators
// don't have to re-learn colour meaning when they switch surfaces.

import type { NodeStatus } from "@/data/nodes";
import { STATUS_META } from "@/data/nodes";

interface NodeStatusDotProps {
  status: NodeStatus;
  size?: number;
  /** Force-disable the offline pulse (e.g. inside dense headers). */
  silent?: boolean;
}

export function NodeStatusDot({ status, size = 8, silent = false }: NodeStatusDotProps) {
  const meta = STATUS_META[status];
  const pulse = meta.pulse && !silent;
  return (
    <span
      aria-label={meta.label}
      className={`relative inline-flex shrink-0 ${pulse ? "" : ""}`}
      style={{ width: size, height: size }}
    >
      {pulse && (
        <span
          aria-hidden
          className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
          style={{ backgroundColor: `hsl(var(--tint-${meta.tint}-fg))` }}
        />
      )}
      <span
        className="relative inline-flex rounded-full ring-2 ring-background/60"
        style={{
          width: size,
          height: size,
          backgroundColor: `hsl(var(--tint-${meta.tint}-fg))`,
        }}
      />
    </span>
  );
}
