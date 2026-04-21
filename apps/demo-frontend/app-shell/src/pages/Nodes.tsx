// /app/nodes — Edge node health monitor.
//
// Layout: standard workspace shell (sidebar + topbar) with a header strip
// (counts + filter pills + search) above a split between NodeList and
// NodeDetailRail. URL state ?node=<id> deep-links to a specific node so the
// rail survives reloads / shared links.

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/workspace/AppSidebar";
import { Topbar } from "@/components/workspace/Topbar";
import { CommandPalette } from "@/components/workspace/CommandPalette";
import { ShortcutsOverlay } from "@/components/workspace/ShortcutsOverlay";
import { NodeList } from "@/components/nodes/NodeList";
import { NodeDetailRail } from "@/components/nodes/NodeDetailRail";
import {
  edgeNodes,
  nodeCounts,
  CURRENT_OPERATOR,
  type EdgeNode,
  type NodeStatus,
} from "@/data/nodes";
import { useNodeTick, liveNodeView, syncedAgoSec } from "@/hooks/useNodeTick";
import { useToast } from "@/hooks/use-toast";
import { Search, X } from "lucide-react";
import {
  fetchRuntimeDeviceNodes,
  mapRuntimeDeviceNode,
} from "@/lib/runtime-device-nodes";

type FilterMode = "all" | "attention" | "maintenance" | "mine";

const FILTER_LABELS: Record<FilterMode, string> = {
  all: "All",
  attention: "Needs attention",
  maintenance: "Maintenance",
  mine: "Mine",
};

const Nodes = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const runtimeNodesQuery = useQuery({
    queryKey: ["device-nodes", "app-shell"],
    queryFn: fetchRuntimeDeviceNodes,
    staleTime: 30_000,
    retry: 1,
  });
  const sourceNodes = useMemo(() => {
    const runtimeNodes = Array.isArray(runtimeNodesQuery.data)
      ? runtimeNodesQuery.data.map(mapRuntimeDeviceNode)
      : [];
    return runtimeNodes.length > 0 ? runtimeNodes : edgeNodes;
  }, [runtimeNodesQuery.data]);

  // Row-level shortcuts. Co-located with the page rather than the list
  // because they emit toasts (cross-cutting concern owned by the page).
  // 'r' mirrors the rail "Request restart" CTA; 'm' mirrors "Maintenance"
  // toggle. Per product call, neither mutates node status — both are
  // server-side actions, the UI just acknowledges the request.
  const handleAction = useCallback(
    (id: string, action: "restart" | "maintenance") => {
      const node = sourceNodes.find((n) => n.id === id) ?? edgeNodes.find((n) => n.id === id);
      if (!node) return;
      if (action === "restart") {
        toast({
          title: "Restart requested",
          description: `${node.id} · queued for next heartbeat window`,
        });
      } else {
        toast({
          title: "Maintenance flag toggled",
          description: `${node.id} · routing paused`,
        });
      }
    },
    [sourceNodes, toast],
  );

  // Live tick — drives heartbeat-ago, sparkline shift, and footer
  // "synced Xs ago" label. Re-renders the whole page every 5s; cheap
  // because the node count is small and projection is pure.
  const tickSec = useNodeTick();
  const liveNodes = useMemo(
    () => sourceNodes.map((n) => liveNodeView(n, tickSec)),
    [sourceNodes, tickSec],
  );

  // Ambient "heartbeat slipping" blips — every 25-40s a random healthy
  // node briefly flashes amber with a toast. Pure visual atmosphere: no
  // mutation, no status change, no persistence. Scoped to /app/nodes
  // because that's the surface where it reads as monitoring noise rather
  // than as an actionable alert. The flash lives 3s, the cooldown is
  // jittered so the rhythm doesn't feel mechanical.
  const [flashingId, setFlashingId] = useState<string | null>(null);
  useEffect(() => {
    let flashTimer: ReturnType<typeof setTimeout> | null = null;
    let scheduleTimer: ReturnType<typeof setTimeout> | null = null;

    const fire = () => {
      const runtimeCandidates = sourceNodes.filter((n) => n.status === "healthy");
      const selection = runtimeCandidates.length > 0 ? runtimeCandidates : edgeNodes;
      if (selection.length === 0) {
        schedule();
        return;
      }
      const node = selection[Math.floor(Math.random() * selection.length)];
      setFlashingId(node.id);
      // Auto-expand the Healthy group so the flash isn't invisible — the
      // toast already drew the operator's attention there.
      setCollapsed((prev) => (prev.healthy ? { ...prev, healthy: false } : prev));
      toast({
        title: `${node.id} heartbeat slipping`,
        description: `${node.label} · ${node.city} · transient delay`,
      });
      flashTimer = setTimeout(() => setFlashingId(null), 3000);
      schedule();
    };

    const schedule = () => {
      // 25-40s jitter — slow enough to stay ambient, fast enough to feel
      // like the surface is alive between operator actions.
      const delay = 25_000 + Math.random() * 15_000;
      scheduleTimer = setTimeout(fire, delay);
    };

    schedule();
    return () => {
      if (flashTimer) clearTimeout(flashTimer);
      if (scheduleTimer) clearTimeout(scheduleTimer);
    };
  }, [sourceNodes, toast]);

  // Group collapse — Healthy collapses by default to keep the eye on
  // problems first. Operators can pop it open when they want the full view.
  const [collapsed, setCollapsed] = useState<Record<NodeStatus, boolean>>({
    offline: false,
    degraded: false,
    maintenance: true,
    healthy: true,
  });

  // Counts are derived from status which never changes per tick — safe
  // to compute once from the canonical store.
  const counts = useMemo(() => nodeCounts(sourceNodes), [sourceNodes]);

  // Selection lives in the URL so deep links work and the rail survives
  // reload. Default to first offline node when nothing is in the URL — the
  // operator's most likely target on landing.
  const selectedId = searchParams.get("node");
  useEffect(() => {
    if (selectedId) return;
    const firstOffline = sourceNodes.find((n) => n.status === "offline");
    const fallback = firstOffline?.id ?? sourceNodes[0]?.id;
    if (fallback) {
      setSearchParams({ node: fallback }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceNodes, setSearchParams]);

  const handleSelect = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("node", id);
      return next;
    });
    // Auto-expand the group containing the selected node so keyboard nav
    // doesn't accidentally drive selection into an invisible row.
    const sel = sourceNodes.find((n) => n.id === id);
    if (sel && collapsed[sel.status]) {
      setCollapsed((s) => ({ ...s, [sel.status]: false }));
    }
  };

  const filtered = useMemo(() => {
    return liveNodes.filter((n) => {
      if (filter === "attention" && n.status !== "offline" && n.status !== "degraded") return false;
      if (filter === "maintenance" && n.status !== "maintenance") return false;
      if (filter === "mine" && n.owner !== CURRENT_OPERATOR) return false;
      if (!query.trim()) return true;
      return `${n.id} ${n.label} ${n.city} ${n.owner} ${n.kind}`
        .toLowerCase()
        .includes(query.toLowerCase());
    });
  }, [query, filter, liveNodes]);

  // Group counts for the *unfiltered* list — drives "show empty group?"
  // logic in the list so a filter that hides all degraded items doesn't
  // also hide the heading "Degraded · 0" reminder.
  const groupCounts: Record<NodeStatus, number> = useMemo(() => ({
    offline: counts.offline,
    degraded: counts.degraded,
    maintenance: counts.maintenance,
    healthy: counts.healthy,
  }), [counts]);

  const selectedNode = useMemo(
    () => liveNodes.find((n) => n.id === selectedId) ?? null,
    [selectedId, liveNodes],
  );

  // "/" focuses search — same shortcut as Live Desk so muscle memory
  // carries across surfaces.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      e.preventDefault();
      const el = document.getElementById("nodes-search") as HTMLInputElement | null;
      el?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <div className="h-screen flex w-full bg-background text-foreground overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Topbar section="Device Nodes" />
          <main className="flex-1 min-h-0 flex">
            {/* Left column: header strip + list */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Header strip — counts + filters + search.
                  Refactor: counts collapsed into a single muted run
                  ("20 total · 2 offline · 4 degraded") instead of three
                  separately-styled tags; filter pills became text
                  buttons with a 1px under-rule for active state (less
                  chrome, more attention on the data); search lost its
                  right-side `/` kbd hint (the same cue lives in the
                  footer). Header height bumped 56px → 64px so the
                  whole row breathes — the surface is monitoring, not
                  packing chrome. */}
              <div className="shrink-0">
                <div className="flex items-center gap-5 px-8 h-16">
                  <div className="flex items-baseline gap-3 min-w-0 shrink-0">
                    <h1 className="font-serif text-[26px] tracking-tight leading-none whitespace-nowrap">
                      Edge nodes
                    </h1>
                    <span className="font-mono text-[10.5px] text-muted-foreground/70 tabular-nums whitespace-nowrap">
                      {counts.total} total
                      {counts.offline > 0 && (
                        <>
                          <span className="text-muted-foreground/30 mx-1">·</span>
                          <span style={{ color: "hsl(var(--tint-crimson-fg))" }}>
                            {counts.offline} off
                          </span>
                        </>
                      )}
                      {counts.degraded > 0 && (
                        <>
                          <span className="text-muted-foreground/30 mx-1">·</span>
                          <span style={{ color: "hsl(var(--tint-amber-fg))" }}>
                            {counts.degraded} deg
                          </span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Filter pills — flatter, text-led with subtle
                      under-rule when active. nowrap so labels never
                      stack on narrow viewports where the rail steals
                      width. */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(Object.keys(FILTER_LABELS) as FilterMode[]).map((f) => {
                      const active = filter === f;
                      const disabled =
                        (f === "attention" && counts.needsAttention === 0) ||
                        (f === "maintenance" && counts.maintenance === 0) ||
                        (f === "mine" && sourceNodes.filter((n) => n.owner === CURRENT_OPERATOR).length === 0);
                      return (
                        <button
                          key={f}
                          onClick={() => !disabled && setFilter(f)}
                          disabled={disabled}
                          className={`relative inline-flex items-center gap-1.5 h-8 px-2.5 text-[11.5px] whitespace-nowrap transition-smooth ${
                            active
                              ? "text-foreground"
                              : disabled
                                ? "text-muted-foreground/40 cursor-not-allowed"
                                : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span>{FILTER_LABELS[f]}</span>
                          {f === "attention" && counts.needsAttention > 0 && (
                            <span className="font-mono text-[10px] tabular-nums opacity-60">
                              {counts.needsAttention}
                            </span>
                          )}
                          {active && (
                            <span
                              aria-hidden
                              className="absolute left-2.5 right-2.5 -bottom-px h-px"
                              style={{ backgroundColor: "hsl(var(--primary))" }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Search — borderless until focus, no kbd cue.
                      Flex-shrinks down to 160px so it never elbows the
                      filter pills off the row. */}
                  <div className="ml-auto flex items-center gap-2 h-8 px-2.5 rounded-md bg-secondary/30 min-w-[160px] max-w-[260px] flex-1 ring-1 ring-inset ring-transparent focus-within:ring-primary/30 focus-within:bg-secondary/50 transition-smooth">
                    <Search className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.75} />
                    <input
                      id="nodes-search"
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find by id, label, city…"
                      className="flex-1 min-w-0 bg-transparent outline-none text-[12px] placeholder:text-muted-foreground/50"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        className="text-muted-foreground/60 hover:text-foreground transition-smooth"
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-px bg-border/40 mx-8" />
              </div>

              <NodeList
                nodes={filtered}
                selectedId={selectedId}
                onSelect={handleSelect}
                onAction={handleAction}
                collapsed={collapsed}
                onToggleCollapsed={(s) =>
                  setCollapsed((prev) => ({ ...prev, [s]: !prev[s] }))
                }
                groupCounts={groupCounts}
                flashingId={flashingId}
              />

              {/* Footer — keyboard hints. Dimmed by default to ~45%
                  opacity so they live as ambient cues, not foreground
                  chrome; lift to full when the operator hovers the
                  strip. The "synced" indicator stays brighter — it's
                  a liveness signal, not a hint. */}
              <div className="group/foot shrink-0 px-8 py-2 text-[10px] text-muted-foreground/80 border-t border-border/40 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4 opacity-45 group-hover/foot:opacity-100 transition-smooth">
                  <ShortcutHint keys={["j", "k"]} label="navigate" />
                  <ShortcutHint keys={["r"]} label="restart" />
                  <ShortcutHint keys={["m"]} label="maintenance" />
                  <ShortcutHint keys={["/"]} label="filter" />
                </div>
                <div className="flex items-center gap-4">
                  <span className="opacity-60 group-hover/foot:opacity-100 transition-smooth">
                    {filtered.length} of {counts.total}
                  </span>
                  <span className="font-mono inline-flex items-center gap-1.5">
                    <span className="relative inline-flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary/60 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary/80" />
                    </span>
                    synced {syncedAgoSec(tickSec)}s ago
                  </span>
                </div>
              </div>
            </div>

            {/* Right column: detail rail */}
            <NodeDetailRail node={selectedNode} />
          </main>
        </div>
        <CommandPalette />
        <ShortcutsOverlay />
      </div>
    </SidebarProvider>
  );
};

function ShortcutHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-secondary/60 ring-1 ring-inset ring-border/60 font-mono text-[10px] tabular-nums"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}

export default Nodes;
