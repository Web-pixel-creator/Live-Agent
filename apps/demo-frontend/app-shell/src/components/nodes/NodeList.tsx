// Linear-style grouped list of edge nodes. Mirrors the LiveDesk pattern:
// sticky tinted group headers, dense rows, hover actions, j/k navigation.
//
// Selection is single-row (drives the detail rail), not bulk — there is no
// realistic operator workflow that mutates many devices at once from this
// surface, and the rail needs the screen real-estate.

import { useEffect, useMemo, useRef } from "react";
import { ChevronDown } from "lucide-react";
import {
  type EdgeNode,
  type NodeStatus,
  STATUS_ORDER,
  STATUS_META,
  KIND_LABEL,
  formatHeartbeatAgo,
  heartbeatTone,
} from "@/data/nodes";
import { NodeStatusDot } from "./NodeStatusDot";
import { OwnerAvatar } from "@/components/workspace/OwnerAvatar";
import { countryFlag } from "@/components/workspace/CountryChip";

// 8-col grid: id · label · kind · location · owner · heartbeat · queue · uptime.
// Tuned at 1440-1920px; below that the workspace already gets cramped, the
// detail rail collapses first (handled by the page).
const COLS =
  "grid grid-cols-[110px_minmax(0,1.4fr)_120px_minmax(0,1fr)_110px_140px_72px_64px] gap-x-6 items-center";

interface NodeListProps {
  nodes: EdgeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Row-level action triggered from a keyboard shortcut on the focused
   *  row. The page owns the side-effect (toast) so the list stays a pure
   *  presentation + navigation surface. */
  onAction?: (id: string, action: "restart" | "maintenance") => void;
  collapsed: Record<NodeStatus, boolean>;
  onToggleCollapsed: (status: NodeStatus) => void;
  /** Counts to render in the group header (counts of *unfiltered* slice). */
  groupCounts: Record<NodeStatus, number>;
  /** Id of a node currently being "flashed" by the ambient blip system —
   *  brief amber ring + soft pulse to convey transient slipping. Pure
   *  presentation, no data mutation. */
  flashingId?: string | null;
}

export function NodeList({
  nodes,
  selectedId,
  onSelect,
  onAction,
  collapsed,
  onToggleCollapsed,
  groupCounts,
  flashingId,
}: NodeListProps) {
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  // Group + sort within the filtered slice. Within a group we keep the
  // store order so the operator gets a stable list — sorting by
  // heartbeatAgoSec is tempting but causes things to jump around as the
  // mock tick advances, which feels noisy.
  const grouped = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      status,
      meta: STATUS_META[status],
      items: nodes.filter((n) => n.status === status),
    }));
  }, [nodes]);

  const visibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const g of grouped) {
      if (collapsed[g.status]) continue;
      for (const n of g.items) ids.push(n.id);
    }
    return ids;
  }, [grouped, collapsed]);

  // Keyboard navigation — j/k step through the visible list, Enter is a
  // no-op because every visible row is *already* selected on focus to keep
  // the rail in sync. r/m fire row-level actions on the focused row,
  // mirroring the rail CTAs (request restart, toggle maintenance flag).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      // Row-level actions need a focused row — without one r/m would
      // emit a toast "from nowhere" which feels broken.
      if (e.key === "r" || e.key === "m") {
        if (!selectedId || !onAction) return;
        e.preventDefault();
        onAction(selectedId, e.key === "r" ? "restart" : "maintenance");
        return;
      }

      if (e.key !== "j" && e.key !== "k" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (visibleIds.length === 0) return;
      e.preventDefault();
      const idx = selectedId ? visibleIds.indexOf(selectedId) : -1;
      const dir = e.key === "j" || e.key === "ArrowDown" ? 1 : -1;
      const next = idx < 0 ? 0 : Math.max(0, Math.min(visibleIds.length - 1, idx + dir));
      onSelect(visibleIds[next]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleIds, selectedId, onSelect, onAction]);

  // Scroll selected row into view as keyboard nav advances.
  useEffect(() => {
    if (!selectedId) return;
    const el = rowRefs.current.get(selectedId);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {grouped.map((g, gi) => {
        // Hide a group entirely when it has no items in the filtered slice
        // AND no items in the unfiltered slice — keeps the page quiet when
        // a partner has no devices in a given state at all.
        if (g.items.length === 0 && groupCounts[g.status] === 0) return null;

        const muted = g.status === "healthy" || g.status === "maintenance";

        return (
          <section
            key={g.status}
            className={`${gi === 0 ? "pt-6" : "pt-10"} ${
              muted ? "opacity-85 hover:opacity-100 transition-opacity" : ""
            }`}
          >
            {/* Sticky group header — soft tint band, no shadow, no harsh
                brightness ramp. Keeps the row whispering so the table beneath
                it stays the focus. Tint stays in [0.04, 0.10] range. */}
            <div className="sticky top-0 z-20 px-8 pb-2 bg-background/95 backdrop-blur-sm">
              <button
                onClick={() => onToggleCollapsed(g.status)}
                className="group/hd w-full flex items-center gap-3 h-9 pl-3 pr-3.5 rounded-md text-left transition-smooth ring-1 ring-inset"
                style={{
                  backgroundColor: `hsl(var(--tint-${g.meta.tint}) / ${muted ? 0.04 : 0.07})`,
                  // @ts-expect-error css var
                  "--tw-ring-color": `hsl(var(--tint-${g.meta.tint}) / ${muted ? 0.10 : 0.14})`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `hsl(var(--tint-${g.meta.tint}) / ${muted ? 0.07 : 0.10})`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = `hsl(var(--tint-${g.meta.tint}) / ${muted ? 0.04 : 0.07})`;
                }}
              >
                <ChevronDown
                  className={`h-3 w-3 text-muted-foreground/70 transition-smooth shrink-0 ${
                    collapsed[g.status] ? "-rotate-90" : ""
                  }`}
                  strokeWidth={1.75}
                />
                <NodeStatusDot status={g.status} silent={collapsed[g.status]} />
                <span
                  className="text-[12px] font-semibold tracking-tight"
                  style={{ color: `hsl(var(--tint-${g.meta.tint}-fg))` }}
                >
                  {g.meta.label}
                </span>
                <span
                  className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-[5px] font-mono text-[10px] tabular-nums ring-1 ring-inset"
                  style={{
                    backgroundColor: `hsl(var(--tint-${g.meta.tint}) / 0.06)`,
                    color: `hsl(var(--tint-${g.meta.tint}-fg) / 0.85)`,
                    // @ts-expect-error css var
                    "--tw-ring-color": `hsl(var(--tint-${g.meta.tint}) / 0.16)`,
                  }}
                >
                  {g.items.length.toString().padStart(2, "0")}
                </span>
              </button>
            </div>

            {/* Per-group column header */}
            {!collapsed[g.status] && g.items.length > 0 && (
              <div className={`${COLS} px-8 pt-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-medium`}>
                <span>Node ID</span>
                <span>Label</span>
                <span>Kind</span>
                <span>Location</span>
                <span>Owner</span>
                <span>Heartbeat</span>
                <span className="text-right">Queue</span>
                <span className="text-right">Uptime</span>
              </div>
            )}

            {/* Rows */}
            {!collapsed[g.status] &&
              g.items.map((n) => {
                const isSelected = selectedId === n.id;
                const isFlashing = flashingId === n.id;
                const tone = heartbeatTone(n.heartbeatAgoSec);
                // Heartbeat colour derives from freshness, not status — a
                // "healthy" row that hasn't checked in for 4 minutes should
                // still flag itself amber here so the operator notices
                // before the device tips into degraded.
                const hbColor =
                  tone === "stale"
                    ? "hsl(var(--tint-rose-fg))"
                    : tone === "slipping"
                      ? "hsl(var(--tint-amber-fg))"
                      : "hsl(var(--muted-foreground))";
                const flag = countryFlag(n.country);

                return (
                  <button
                    key={n.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(n.id, el);
                      else rowRefs.current.delete(n.id);
                    }}
                    onClick={() => onSelect(n.id)}
                    className={`${COLS} relative w-full px-8 py-4 border-b border-border/20 text-left transition-smooth focus:outline-none ${
                      isFlashing
                        ? "bg-[hsl(var(--tint-amber)/0.10)] animate-pulse-soft"
                        : isSelected
                          ? "bg-secondary/45"
                          : "hover:bg-secondary/25"
                    }`}
                  >
                    {/* Selection rail — 2px violet bar on the left edge.
                        Mirrors the sidebar active pattern so selection reads
                        the same across surfaces. Sits on top of the status
                        accent (which is rendered at lower opacity below). */}
                    {isSelected && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-primary"
                      />
                    )}
                    {/* Status accent — 2px tinted rule on left edge for
                        offline/degraded only, very low opacity so it reads
                        as ambient context, not as a divider. */}
                    {!isSelected &&
                      (n.status === "offline" || n.status === "degraded") && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full opacity-50"
                          style={{
                            backgroundColor: `hsl(var(--tint-${g.meta.tint}-fg))`,
                          }}
                        />
                      )}

                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums truncate">
                      {n.id}
                    </span>
                    <span className="text-[13px] truncate">{n.label}</span>
                    <span className="text-[11px] text-muted-foreground/85 truncate">
                      {KIND_LABEL[n.kind]}
                    </span>
                    <span className="text-[11px] text-muted-foreground/85 truncate inline-flex items-center gap-1.5">
                      {flag && <span className="text-[12px] leading-none">{flag}</span>}
                      <span className="truncate">{n.city}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <OwnerAvatar name={n.owner} size={18} />
                      <span className="text-[11px] text-muted-foreground/85 truncate">
                        {n.owner}
                      </span>
                    </span>
                    <span
                      className="font-mono text-[11px] tabular-nums truncate"
                      style={{ color: hbColor }}
                    >
                      {formatHeartbeatAgo(n.heartbeatAgoSec)}
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums">
                      {n.queueDepth > 0 ? (
                        <span style={{ color: n.queueDepth >= 20 ? "hsl(var(--tint-rose-fg))" : n.queueDepth >= 10 ? "hsl(var(--tint-amber-fg))" : "hsl(var(--foreground))" }}>
                          {n.queueDepth}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground/85">
                      {(n.uptime7d * 100).toFixed(1)}%
                    </span>
                  </button>
                );
              })}

            {!collapsed[g.status] && g.items.length === 0 && (
              <div className="px-8 py-3 text-[11px] text-muted-foreground/70 italic border-b border-border/40">
                No nodes match the current filter.
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
