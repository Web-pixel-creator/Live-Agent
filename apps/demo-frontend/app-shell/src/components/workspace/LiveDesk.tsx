import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  Plus,
  Search,
  ChevronDown,
  Check,
  UserRoundCog,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Camera,
  Download,
  FileText,
  X,
  Inbox,
  User,
  Star,
  Flame,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CURRENT_OPERATOR, STATUS_META, type EdgeNode } from "@/data/nodes";
import { Server } from "lucide-react";
import {
  type CaseStatus,
  type WorkspaceCase,
  slaBurnPercent,
  parseSlaMinutes,
  stuckLabel,
} from "@/data/workspace";
import { useAllRequestCounts, useAllRequestStaleness } from "@/data/sessionRequests";
import { OwnerAvatar } from "./OwnerAvatar";
import { CountryChip } from "./CountryChip";
import { StageIcon } from "./StageIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useVipCases } from "@/hooks/useVipCases";
import { useToast } from "@/hooks/use-toast";
import { NewCaseSheet } from "./NewCaseSheet";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";
import {
  buildCaseBundlePath,
  buildCaseEvidencePath,
  buildCaseVaultPath,
} from "@/lib/case-artifact-links";

type Status = CaseStatus;

// Identity of the operator currently signed into the workspace. Mirrors the
// name shown in AppSidebar's footer ("A. Petrova"). Centralised here so the
// "Mine only" filter — and any future "assigned to me" affordances — share a
// single source of truth. When real auth lands this becomes a hook reading
// from session/profile.
const statusGroups: {
  key: Status;
  label: string;
  dotClass: string;
  tint: "rose" | "violet" | "amber" | "mint";
  /** Whether this group should be visually emphasised vs. quieted down. */
  emphasis: "loud" | "normal" | "muted";
  /** Whether this group is collapsed by default. */
  defaultCollapsed: boolean;
}[] = [
  { key: "needs_action", label: "Needs action", dotClass: "bg-destructive", tint: "rose", emphasis: "loud", defaultCollapsed: false },
  { key: "in_flight", label: "In flight", dotClass: "bg-primary", tint: "violet", emphasis: "normal", defaultCollapsed: false },
  { key: "awaiting_client", label: "Awaiting client", dotClass: "bg-warning", tint: "amber", emphasis: "muted", defaultCollapsed: false },
  { key: "resolved", label: "Resolved", dotClass: "bg-success", tint: "mint", emphasis: "muted", defaultCollapsed: true },
];

const visaTone: Record<string, "violet" | "rose" | "amber" | "mint" | "slate"> = {
  "EU Blue Card": "violet",
  "Skilled Worker": "violet",
  "O-1A": "rose",
  "Highly Skilled Pro": "amber",
  "D7 Passive Income": "mint",
  Humanitarian: "rose",
};

// Single source of truth for column layout — header & rows share this exactly.
// Leading 20px column is for the bulk-select checkbox.
const COLS =
  "grid grid-cols-[20px_88px_minmax(0,1.4fr)_minmax(0,1fr)_72px_88px_60px] items-center gap-6";

// Sort helper — most-burning SLA first, infinite/none cases last.
function sortByBurn(items: WorkspaceCase[]) {
  return [...items].sort((a, b) => {
    const ma = parseSlaMinutes(a.sla);
    const mb = parseSlaMinutes(b.sla);
    if (ma === null && mb === null) return 0;
    if (ma === null) return 1;
    if (mb === null) return -1;
    return ma - mb;
  });
}

// Tiny shortcut hint chip used in the bottom hints bar.
const ShortcutHint = ({
  keys,
  label,
  dim = false,
}: {
  keys: string[];
  label: string;
  dim?: boolean;
}) => (
  <span className={`inline-flex items-center gap-1.5 ${dim ? "opacity-40" : ""}`}>
    <span className="inline-flex items-center gap-0.5">
      {keys.map((k) => (
        <kbd
          key={k}
          className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-secondary/60 ring-1 ring-inset ring-border/60 font-mono text-[9px] text-foreground/80"
        >
          {k}
        </kbd>
      ))}
    </span>
    <span className="text-muted-foreground/70">{label}</span>
  </span>
);

// Compact relative-age label for the "N requested · 3d" hint inline with the
// requested-badge. Mirrors operator shorthand: <1h → "now", <24h → "Nh",
// otherwise "Nd". Returns null when the input is missing.
const shortAge = (iso: string | undefined, now: number): string | null => {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return "now";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export const LiveDesk = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cases, deviceNodes, addDraftCase } = useWorkspaceRuntime();
  const requestCounts = useAllRequestCounts();
  const requestStaleness = useAllRequestStaleness();
  const { isVip, toggleVip } = useVipCases();
  const [query, setQuery] = useState("");
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  // Marker for the most recently created case — drives a brief fresh-glow on
  // its row so the operator can spot the new entry in the dense list.
  // Cleared shortly after to keep the animation a one-shot affair.
  const [freshRef, setFreshRef] = useState<string | null>(null);

  // Node filter — driven entirely by ?node=ID URL param so deep-links from
  // /app/nodes "Open related cases" land in a pre-filtered desk. We
  // intentionally don't persist this to localStorage (unlike onlyMine /
  // mineOnly / vipOnly) — it's a contextual lens, not a long-running
  // preference; surviving reloads is enough.
  const [searchParams, setSearchParams] = useSearchParams();
  const nodeFilterId = searchParams.get("node");
  const nodeFilterMeta = useMemo(
    () => (nodeFilterId ? deviceNodes.find((n) => n.id === nodeFilterId) ?? null : null),
    [deviceNodes, nodeFilterId],
  );
  // Aggregate infra-impact filter — driven by ?infra=degraded coming from the
  // Topbar pill. Narrows to cases whose sourceNode is currently non-healthy.
  // Independent of nodeFilterId (which targets one specific device); the two
  // never compose meaningfully so we let nodeFilterId win when both are set.
  const infraFilter = searchParams.get("infra"); // "degraded" | null
  // SLA-burning lens — driven by ?burning=1 from the Topbar alert band.
  // Narrows the desk to non-resolved cases under the 1h SLA threshold so
  // the operator lands directly on what's about to breach.
  const burningFilter = searchParams.get("burning") === "1";
  const nonHealthyNodeIds = useMemo(
    () => new Set(deviceNodes.filter((n) => n.status !== "healthy").map((n) => n.id)),
    [deviceNodes],
  );
  const clearNodeFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("node");
      next.delete("infra");
      next.delete("burning");
      return next;
    });
  };
  // "My requests" inbox mode — when on, hides every case with zero outstanding
  // doc requests in this session. Pairs with the violet "N requested" badge in
  // the row so operators have a one-click view of what's still pending a
  // client reply. We treat it as a hard filter (not a sort) so the count in
  // the header reflects only what's actually shown.
  //
  // Persisted to localStorage so the filter survives page refresh — operators
  // who curate their desk to "only my outstanding requests" expect that view
  // to stick across reloads, not silently reset to the full board. Lazy
  // initializer keeps the read off the render-hot path; SSR-safe via the
  // `typeof window` guard.
  const STORAGE_KEY = "liveDesk:onlyMine";
  const [onlyMine, setOnlyMine] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private mode / disabled storage — degrade gracefully to in-memory only.
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (onlyMine) window.localStorage.setItem(STORAGE_KEY, "1");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Quota / disabled storage — best-effort, no user-facing failure.
    }
  }, [onlyMine]);

  // "Mine only" — narrows the desk to cases owned by CURRENT_OPERATOR.
  // Composes additively with "My requests": both filters AND together so an
  // operator can ask "show me only the cases I own AND that have outstanding
  // requests" — the natural inbox query for a single-operator daily flow.
  // Persisted in its own localStorage key so the two pills stay independent.
  const MINE_STORAGE_KEY = "liveDesk:mineOnly";
  const [mineOnly, setMineOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(MINE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (mineOnly) window.localStorage.setItem(MINE_STORAGE_KEY, "1");
      else window.localStorage.removeItem(MINE_STORAGE_KEY);
    } catch {
      /* best-effort */
    }
  }, [mineOnly]);

  // "VIP only" — third independent lens, narrows the desk to cases the
  // operator has flagged via the client-tooltip Star toggle. Persisted under
  // its own key so it composes with mineOnly + onlyMine without bleed.
  const VIP_STORAGE_KEY = "liveDesk:vipOnly";
  const [vipOnly, setVipOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(VIP_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (vipOnly) window.localStorage.setItem(VIP_STORAGE_KEY, "1");
      else window.localStorage.removeItem(VIP_STORAGE_KEY);
    } catch {
      /* best-effort */
    }
  }, [vipOnly]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    statusGroups.reduce(
      (acc, g) => ({ ...acc, [g.key]: g.defaultCollapsed }),
      {} as Record<string, boolean>,
    ),
  );
  const [focusedRef, setFocusedRef] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lastSelectedRef, setLastSelectedRef] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Total outstanding-request count drives both the toggle badge and the
  // disabled state — there's nothing to filter to if no requests are live.
  const totalOutstanding = useMemo(() => {
    let sum = 0;
    requestCounts.forEach((n) => (sum += n));
    return sum;
  }, [requestCounts]);

  // How many cases the current operator owns — drives the count badge on
  // the "Mine only" pill and the disabled state when the operator owns none.
  const mineTotal = useMemo(
    () => cases.filter((c) => c.owner === CURRENT_OPERATOR).length,
    [cases],
  );

  // Total VIP-flagged cases across the board — drives the "VIP only" pill
  // count badge and its disabled state.
  const vipTotal = useMemo(
    () => cases.filter((c) => isVip(c.ref)).length,
    [cases, isVip],
  );

  const filtered = useMemo(
    () =>
      cases.filter((c) => {
        if (nodeFilterId && c.sourceNodeId !== nodeFilterId) return false;
        if (infraFilter === "degraded") {
          if (c.status === "resolved") return false;
          if (!nonHealthyNodeIds.has(c.sourceNodeId)) return false;
        }
        if (burningFilter) {
          if (c.status === "resolved") return false;
          const m = parseSlaMinutes(c.sla);
          if (m === null || m >= 60) return false;
        }
        if (onlyMine && (requestCounts.get(c.ref) ?? 0) === 0) return false;
        if (mineOnly && c.owner !== CURRENT_OPERATOR) return false;
        if (vipOnly && !isVip(c.ref)) return false;
        if (!query.trim()) return true;
        return `${c.ref} ${c.client} ${c.visa} ${c.stage} ${c.owner}`
          .toLowerCase()
          .includes(query.toLowerCase());
      }),
    [burningFilter, cases, infraFilter, isVip, mineOnly, nodeFilterId, nonHealthyNodeIds, onlyMine, query, requestCounts, vipOnly]
  );

  // Staleness threshold for the My-requests view secondary grouping. 24h is
  // the default "I should poke this again" horizon for an immigration-doc
  // request — anything older counts as awaiting a reply too long.
  const STALE_MS = 24 * 60 * 60 * 1000;
  const NOW_MS = Date.now();

  // Stable VIP-first reorder — lifts every VIP-flagged case to the top of
  // its bucket while preserving the relative order of both halves. Stable
  // partition (not a comparator) so we never mangle the upstream sort
  // (burn-down for "Needs action", oldest-first for staleness buckets, etc.).
  const liftVip = (items: typeof cases) => {
    if (vipTotal === 0) return items;
    const vips: typeof cases = [];
    const rest: typeof cases = [];
    for (const c of items) (isVip(c.ref) ? vips : rest).push(c);
    return vips.length === 0 ? items : [...vips, ...rest];
  };

  const grouped = useMemo(() => {
    // My-requests mode: replace status grouping with a staleness split so the
    // operator sees the rotting requests above the fresh ones at a glance.
    // We synthesise two pseudo-groups that mirror the shape statusGroups
    // produces (key/label/dotClass/tint/emphasis/items) so the existing render
    // pipeline works unchanged.
    if (onlyMine) {
      const stale: typeof cases = [];
      const recent: typeof cases = [];
      for (const c of filtered) {
        const at = requestStaleness.get(c.ref);
        const ageMs = at ? NOW_MS - new Date(at).getTime() : 0;
        if (ageMs >= STALE_MS) stale.push(c);
        else recent.push(c);
      }
      // Both buckets sorted oldest-first so the most-rotten case sits at the
      // top of "Awaiting reply >24h" and the oldest of the fresh ones leads
      // "Sent recently" — natural triage order.
      const byAge = (a: typeof cases[number], b: typeof cases[number]) => {
        const ta = requestStaleness.get(a.ref) ?? "";
        const tb = requestStaleness.get(b.ref) ?? "";
        return ta.localeCompare(tb);
      };
      stale.sort(byAge);
      recent.sort(byAge);
      return [
        {
          key: "stale" as const,
          label: "Awaiting reply · 24h+",
          dotClass: "bg-destructive",
          tint: "rose" as const,
          emphasis: "loud" as const,
          defaultCollapsed: false,
          items: liftVip(stale),
        },
        {
          key: "recent" as const,
          label: "Sent recently",
          dotClass: "bg-primary",
          tint: "violet" as const,
          emphasis: "normal" as const,
          defaultCollapsed: false,
          items: liftVip(recent),
        },
      ];
    }
    return statusGroups.map((g) => {
      const items = filtered.filter((c) => c.status === g.key);
      // Needs action sorted by burn — most urgent first. Other groups keep order.
      const sorted = g.key === "needs_action" ? sortByBurn(items) : items;
      // VIP cases float to the top of their bucket, beating burn-down /
      // default order — operator's "this client matters" flag wins over
      // algorithmic priority. Exception: Resolved — these need no action,
      // so lifting VIP there creates a false priority signal in a section
      // that's collapsed by default anyway.
      return { ...g, items: g.key === "resolved" ? sorted : liftVip(sorted) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, onlyMine, requestStaleness, NOW_MS, isVip, vipTotal]);

  // Flat list of currently visible rows (respects collapsed groups) — drives j/k navigation.
  const visibleRows = useMemo(() => {
    const rows: { ref: string; status: Status | "stale" | "recent" }[] = [];
    grouped.forEach((g) => {
      if (collapsed[g.key]) return;
      g.items.forEach((c) => rows.push({ ref: c.ref, status: g.key }));
    });
    return rows;
  }, [grouped, collapsed]);

  // Inline row actions — quiet, only visible on hover.
  const handleApprove = (e: React.MouseEvent | null, ref: string) => {
    e?.stopPropagation();
    toast({ title: "Approval sent", description: ref });
  };
  const handleReassign = (e: React.MouseEvent | null, ref: string) => {
    e?.stopPropagation();
    toast({ title: "Reassign", description: `${ref} · pick owner in Console` });
    navigate(`/app/console?ref=${encodeURIComponent(ref)}`);
  };
  const handleOpen = (e: React.MouseEvent | null, ref: string) => {
    e?.stopPropagation();
    navigate(`/app/console?ref=${encodeURIComponent(ref)}`);
  };
  const handleOpenBundle = (
    e: React.MouseEvent | null,
    value: WorkspaceCase,
  ) => {
    e?.stopPropagation();
    navigate(buildCaseBundlePath(value));
  };
  const handleOpenEvidence = (
    e: React.MouseEvent | null,
    value: WorkspaceCase,
  ) => {
    e?.stopPropagation();
    navigate(buildCaseEvidencePath(value));
  };
  const handleOpenCaseVault = (
    e: React.MouseEvent | null,
    value: WorkspaceCase,
  ) => {
    e?.stopPropagation();
    navigate(buildCaseVaultPath(value));
  };
  // VIP toggle from row context menu — mirrors the client-tooltip Star, but
  // accessible without hover-targeting a 12px icon. Toast confirms the
  // direction (flag / unflag) so the operator gets feedback when right-
  // clicking deep in a long list.
  const handleToggleVip = (ref: string, client: string) => {
    const nowVip = toggleVip(ref);
    toast({
      title: nowVip ? "Flagged as VIP" : "VIP flag removed",
      description: `${client} · ${ref}`,
    });
  };

  // Selection helpers ------------------------------------------------------
  const toggleSelected = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
    setLastSelectedRef(ref);
  };

  const selectRange = (toRef: string) => {
    const toIdx = visibleRows.findIndex((r) => r.ref === toRef);
    if (toIdx < 0) return;
    const fromIdx = lastSelectedRef
      ? visibleRows.findIndex((r) => r.ref === lastSelectedRef)
      : -1;
    const start = fromIdx < 0 ? toIdx : Math.min(fromIdx, toIdx);
    const end = fromIdx < 0 ? toIdx : Math.max(fromIdx, toIdx);
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) next.add(visibleRows[i].ref);
      return next;
    });
    setLastSelectedRef(toRef);
  };

  const clearSelection = () => {
    setSelected(new Set());
    setLastSelectedRef(null);
  };

  const toggleGroupSelection = (groupRefs: string[]) => {
    const allSelected = groupRefs.every((r) => selected.has(r));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) groupRefs.forEach((r) => next.delete(r));
      else groupRefs.forEach((r) => next.add(r));
      return next;
    });
  };

  // Bulk actions — fired from floating action bar.
  const bulkReassign = () => {
    toast({ title: "Bulk reassign", description: `${selected.size} cases · pick owner` });
    clearSelection();
  };
  const bulkSnooze = () => {
    toast({ title: "Snoozed", description: `${selected.size} cases · 24h` });
    clearSelection();
  };
  const bulkResolve = () => {
    toast({ title: "Marked resolved", description: `${selected.size} cases` });
    clearSelection();
  };
  const bulkExport = () => {
    toast({ title: "Export started", description: `${selected.size} cases · CSV` });
  };
  // Bulk VIP cleanup — only meaningful when at least one selected case is
  // currently flagged. Lifts every flag in the selection in a single pass
  // (rather than asking the operator to right-click each row), which is the
  // entire point of having selection in the first place.
  const bulkUnflagVip = () => {
    const refs = [...selected].filter((r) => isVip(r));
    refs.forEach((r) => toggleVip(r));
    toast({
      title: "VIP flags removed",
      description: `${refs.length} case${refs.length === 1 ? "" : "s"} unflagged`,
    });
    clearSelection();
  };

  // Keyboard navigation — j/k, Enter, a, e, /, Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Esc — blur typing context, then clear selection, then focus.
      if (e.key === "Escape") {
        if (isTyping) {
          (target as HTMLElement).blur();
          e.preventDefault();
        } else if (selected.size > 0) {
          clearSelection();
          e.preventDefault();
        } else if (focusedRef) {
          setFocusedRef(null);
          e.preventDefault();
        }
        return;
      }

      // "/" — focus filter input.
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      // "i" — toggle "My requests" inbox filter. Mirrors the header pill so
      // operators can flip the view without leaving the keyboard. Honours the
      // same gate as the pill: no-op when nothing is outstanding (avoids a
      // confusing "filter on, zero results, can't tell why" state).
      if (e.key === "i" && !isTyping) {
        if (totalOutstanding === 0) return;
        e.preventDefault();
        setOnlyMine((v) => !v);
        return;
      }

      // "m" — toggle "Mine only" filter (cases owned by current operator).
      // Same disabled gate as the pill: skip when the operator owns nothing.
      if (e.key === "m" && !isTyping) {
        if (mineTotal === 0) return;
        e.preventDefault();
        setMineOnly((v) => !v);
        return;
      }

      // "v" — toggle "VIP only" filter. Disabled when nothing is flagged so
      // the operator never lands on an empty board with no obvious cause.
      if (e.key === "v" && !isTyping) {
        if (vipTotal === 0) return;
        e.preventDefault();
        setVipOnly((v) => !v);
        return;
      }

      if (isTyping) return;
      if (visibleRows.length === 0) return;

      const currentIdx = focusedRef
        ? visibleRows.findIndex((r) => r.ref === focusedRef)
        : -1;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIdx < 0 ? 0 : Math.min(visibleRows.length - 1, currentIdx + 1);
        setFocusedRef(visibleRows[next].ref);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIdx < 0 ? 0 : Math.max(0, currentIdx - 1);
        setFocusedRef(visibleRows[prev].ref);
        return;
      }

      if (currentIdx < 0) return;
      const row = visibleRows[currentIdx];

      if (e.key === "Enter") {
        e.preventDefault();
        handleOpen(null, row.ref);
        return;
      }
      if (e.key === "a" && row.status === "needs_action") {
        e.preventDefault();
        handleApprove(null, row.ref);
        return;
      }
      if (e.key === "e") {
        e.preventDefault();
        handleReassign(null, row.ref);
        return;
      }
      // x — toggle selection on focused row. Shift+X — range select.
      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        if (e.shiftKey) selectRange(row.ref);
        else toggleSelected(row.ref);
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, focusedRef, selected, lastSelectedRef, totalOutstanding, mineTotal, vipTotal]);

  // Scroll focused row into view.
  useEffect(() => {
    if (!focusedRef) return;
    const el = rowRefs.current.get(focusedRef);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedRef]);

  return (
    <div className="relative flex flex-col h-full">
      {/* Header — generous breathing room, no boxed metric. The active-count
          is inline with the title only when no filter is engaged; once
          the operator narrows the desk the active-filter ribbon below
          carries the count, so we drop it here to avoid duplicating
          information at competing weights. */}
      <div className="flex items-center justify-between gap-4 px-8 pt-6 pb-5">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-serif text-[26px] tracking-tight leading-none">Live Desk</h1>
          <span className="font-mono text-[10.5px] text-muted-foreground/70 tabular-nums">
            {filtered.length} active
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* "Mine only" — narrows desk to cases owned by CURRENT_OPERATOR.
              Sits to the LEFT of "My requests" so the pair reads naturally
              as a sentence: "mine only, my requests". Uses the rose tint
              to differentiate from the violet "My requests" pill — at a
              glance an operator can tell which lens is active without
              reading the label. Disabled (visible) when the operator owns
              zero cases, same affordance pattern as My requests. */}
          <button
            onClick={() => mineTotal > 0 && setMineOnly((v) => !v)}
            disabled={mineTotal === 0}
            title={
              mineTotal === 0
                ? "You own no cases right now"
                : mineOnly
                  ? `Showing only cases owned by ${CURRENT_OPERATOR} · click to clear`
                  : `Show only cases owned by ${CURRENT_OPERATOR}`
            }
            aria-pressed={mineOnly}
            className={`hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium ring-1 ring-inset transition-smooth ${
              mineOnly
                ? ""
                : mineTotal === 0
                  ? "text-muted-foreground/50 ring-border/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground ring-border/70 hover:ring-border bg-secondary/30"
            }`}
            style={
              mineOnly
                ? {
                    backgroundColor: "hsl(var(--tint-rose) / 0.16)",
                    // @ts-expect-error css var
                    "--tw-ring-color": "hsl(var(--tint-rose) / 0.38)",
                    color: "hsl(var(--tint-rose-fg))",
                  }
                : undefined
            }
          >
            <User className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Mine only</span>
            {mineTotal > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-[4px] font-mono text-[10px] tabular-nums"
                style={{
                  backgroundColor: mineOnly
                    ? "hsl(var(--tint-rose) / 0.28)"
                    : "hsl(var(--secondary) / 0.8)",
                  color: mineOnly
                    ? "hsl(var(--tint-rose-fg))"
                    : "hsl(var(--muted-foreground))",
                }}
              >
                {mineTotal}
              </span>
            )}
          </button>
          {/* "VIP only" — third lens, narrows to operator-flagged clients.
              Amber tint matches the Star indicator the operator already
              learned in the client tooltip + Live Desk row markers. Same
              disabled-when-zero affordance pattern as the other two pills. */}
          <button
            onClick={() => vipTotal > 0 && setVipOnly((v) => !v)}
            disabled={vipTotal === 0}
            title={
              vipTotal === 0
                ? "No VIP cases flagged yet"
                : vipOnly
                  ? "Showing only VIP cases · click to clear"
                  : "Show only VIP-flagged cases"
            }
            aria-pressed={vipOnly}
            className={`hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium ring-1 ring-inset transition-smooth ${
              vipOnly
                ? ""
                : vipTotal === 0
                  ? "bg-secondary/30 text-muted-foreground/40 ring-border/40 cursor-not-allowed"
                  : "bg-secondary/40 text-muted-foreground ring-border/60 hover:text-foreground hover:bg-secondary/60"
            }`}
            style={
              vipOnly
                ? {
                    backgroundColor: "hsl(var(--tint-amber) / 0.16)",
                    color: "hsl(var(--tint-amber-fg))",
                    // @ts-expect-error css var
                    "--tw-ring-color": "hsl(var(--tint-amber) / 0.32)",
                  }
                : undefined
            }
          >
            <Star
              className={`h-3.5 w-3.5 ${vipOnly ? "fill-current" : ""}`}
              strokeWidth={1.75}
            />
            <span>VIP only</span>
            {vipTotal > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-[4px] font-mono text-[10px] tabular-nums"
                style={{
                  backgroundColor: vipOnly
                    ? "hsl(var(--tint-amber) / 0.28)"
                    : "hsl(var(--secondary) / 0.8)",
                  color: vipOnly
                    ? "hsl(var(--tint-amber-fg))"
                    : "hsl(var(--muted-foreground))",
                }}
              >
                {vipTotal}
              </span>
            )}
          </button>
          {/* "My requests" inbox toggle — narrows the desk to cases with at
              least one outstanding doc request this session. Disabled (but
              still visible) when nothing is outstanding so operators learn
              the affordance exists even on a clean board. */}
          <button
            onClick={() => totalOutstanding > 0 && setOnlyMine((v) => !v)}
            disabled={totalOutstanding === 0}
            title={
              totalOutstanding === 0
                ? "No outstanding requests"
                : onlyMine
                  ? "Showing only cases with outstanding requests · click to clear"
                  : "Show only cases with outstanding requests"
            }
            aria-pressed={onlyMine}
            className={`hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium ring-1 ring-inset transition-smooth ${
              onlyMine
                ? "text-primary"
                : totalOutstanding === 0
                  ? "text-muted-foreground/50 ring-border/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground ring-border/70 hover:ring-border bg-secondary/30"
            }`}
            style={
              onlyMine
                ? {
                    backgroundColor: "hsl(var(--tint-violet) / 0.16)",
                    // @ts-expect-error css var
                    "--tw-ring-color": "hsl(var(--tint-violet) / 0.38)",
                    color: "hsl(var(--tint-violet-fg))",
                  }
                : undefined
            }
          >
            <Inbox className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>My requests</span>
            {totalOutstanding > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-[4px] font-mono text-[10px] tabular-nums"
                style={{
                  backgroundColor: onlyMine
                    ? "hsl(var(--tint-violet) / 0.28)"
                    : "hsl(var(--secondary) / 0.8)",
                  color: onlyMine
                    ? "hsl(var(--tint-violet-fg))"
                    : "hsl(var(--muted-foreground))",
                }}
              >
                {totalOutstanding}
              </span>
            )}
          </button>
          <div className="hidden md:flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-secondary/30 w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter cases…  ( / )"
              className="bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none flex-1 min-w-0"
            />
            <kbd className="hidden lg:inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-background/60 ring-1 ring-inset ring-border/60 font-mono text-[9px] text-muted-foreground/80">
              /
            </kbd>
          </div>
          <Button
            size="sm"
            onClick={() => setNewCaseOpen(true)}
            className="h-8 text-xs bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            New case
          </Button>
        </div>
      </div>

      <NewCaseSheet
        open={newCaseOpen}
        onOpenChange={setNewCaseOpen}
        existingCases={cases}
        onCreated={(draft) => {
          addDraftCase(draft);
          setFreshRef(draft.ref);
          const ref = draft.ref;
          // 2s matches the fresh-glow keyframe; clear the marker so re-renders
          // don't loop the animation.
          window.setTimeout(() => {
            setFreshRef((curr) => (curr === draft.ref ? null : curr));
          }, 2000);
          // Force-expand the section the new case lands in — otherwise the
          // fresh-glow plays inside a collapsed group and the operator sees
          // nothing. New cases are created in `in_flight`; in My-requests
          // mode they fall into `recent` (zero outstanding requests yet).
          setCollapsed((prev) => ({ ...prev, in_flight: false, recent: false }));
          // Auto-focus the new row so j/k navigation lands on it and the
          // operator's eye is drawn to the top of in-flight.
          setFocusedRef(draft.ref);
          toast({
            title: "Case created",
            description: `${ref} added to Live Desk · top of in-flight.`,
          });
        }}
      />

      {/* Grouped list */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Active-filter ribbon — appears whenever "My requests" or "Mine
            only" is active (or both). Makes the narrowed view obvious
            (otherwise an empty desk reads as "nothing to do" rather than
            "filter is hiding things") and gives a one-click escape hatch
            back to the full board. When both filters are on we stack the
            two labels as inline chips so it's unambiguous which lenses are
            composed; the surrounding ribbon picks the violet tint to keep
            the visual language consistent across single- and multi-filter
            states. */}
        {(onlyMine || mineOnly || vipOnly || nodeFilterMeta || infraFilter === "degraded" || burningFilter) && (
          <div
            className="mx-8 mt-4 flex items-center gap-2.5 h-8 pl-2.5 pr-1.5 rounded-md ring-1 ring-inset"
            style={{
              backgroundColor: burningFilter ? "hsl(var(--tint-rose) / 0.08)" : "hsl(var(--tint-violet) / 0.08)",
              // @ts-expect-error css var
              "--tw-ring-color": burningFilter ? "hsl(var(--tint-rose) / 0.24)" : "hsl(var(--tint-violet) / 0.22)",
            }}
          >
            <div className="flex items-center gap-1.5">
              {burningFilter && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-rose) / 0.18)",
                    color: "hsl(var(--tint-rose-fg))",
                  }}
                  title="Cases under 1h SLA"
                >
                  <Flame className="h-3 w-3" strokeWidth={2} />
                  SLA burning
                </span>
              )}
              {nodeFilterMeta && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium font-mono tabular-nums"
                  style={{
                    backgroundColor:
                      nodeFilterMeta.status === "offline"
                        ? "hsl(var(--tint-crimson) / 0.18)"
                        : "hsl(var(--tint-violet) / 0.18)",
                    color:
                      nodeFilterMeta.status === "offline"
                        ? "hsl(var(--tint-crimson-fg))"
                        : "hsl(var(--tint-violet-fg))",
                  }}
                  title={`${nodeFilterMeta.label} · ${nodeFilterMeta.city}`}
                >
                  <Server className="h-3 w-3" strokeWidth={2} />
                  {nodeFilterMeta.id}
                </span>
              )}
              {infraFilter === "degraded" && !nodeFilterMeta && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-amber) / 0.18)",
                    color: "hsl(var(--tint-amber-fg))",
                  }}
                  title="Cases captured by non-healthy nodes"
                >
                  <Server className="h-3 w-3" strokeWidth={2} />
                  Degraded infra
                </span>
              )}
              {mineOnly && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-rose) / 0.18)",
                    color: "hsl(var(--tint-rose-fg))",
                  }}
                >
                  <User className="h-3 w-3" strokeWidth={2} />
                  Mine only
                </span>
              )}
              {vipOnly && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-amber) / 0.18)",
                    color: "hsl(var(--tint-amber-fg))",
                  }}
                >
                  <Star className="h-3 w-3 fill-current" strokeWidth={2} />
                  VIP only
                </span>
              )}
              {onlyMine && (
                <span
                  className="inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: "hsl(var(--tint-violet) / 0.18)",
                    color: "hsl(var(--tint-violet-fg))",
                  }}
                >
                  <Inbox className="h-3 w-3" strokeWidth={2} />
                  My requests
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {filtered.length === 0
                ? "no cases match"
                : `${filtered.length} case${filtered.length === 1 ? "" : "s"} match`}
            </span>
            <button
              onClick={() => {
                setOnlyMine(false);
                setMineOnly(false);
                setVipOnly(false);
                clearNodeFilter();
              }}
              className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-smooth"
            >
              <X className="h-3 w-3" strokeWidth={1.75} />
              Clear
            </button>
          </div>
        )}
        {grouped.map((g, gi) => {
          const muted = g.emphasis === "muted";
          return (
            <section
              key={g.key}
              className={`${gi === 0 ? "pt-5" : "pt-9"} ${muted ? "opacity-70 hover:opacity-100 transition-opacity" : ""}`}
            >
              {/* Status header — sticky tinted band */}
              <div className="sticky top-0 z-20 px-8 pb-1.5 bg-background/95 backdrop-blur-sm">
                <button
                  onClick={() =>
                    setCollapsed((s) => ({ ...s, [g.key]: !s[g.key] }))
                  }
                  className="group/hd relative w-full flex items-center gap-3 h-9 pl-3 pr-3.5 rounded-md text-left transition-smooth ring-1 ring-inset hover:brightness-150 shadow-[0_8px_16px_-10px_rgba(0,0,0,0.6)] overflow-hidden"
                  style={{
                    backgroundColor: `hsl(var(--tint-${g.tint}) / ${muted ? 0.06 : 0.1})`,
                    // @ts-expect-error css var
                    "--tw-ring-color": `hsl(var(--tint-${g.tint}) / ${muted ? 0.12 : 0.18})`,
                  }}
                >
                  {/* Active accent-bar — only for the expanded (in-focus)
                      group. Saturated tint rule on the left edge mirrors the
                      AppSidebar active-row pattern and the /evidence section
                      anchors, so "where am I working right now?" reads in a
                      single glance across the workspace. */}
                  {!collapsed[g.key] && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                      style={{ backgroundColor: `hsl(var(--tint-${g.tint}-fg) / ${muted ? 0.55 : 0.85})` }}
                    />
                  )}
                  <ChevronDown
                    className={`h-3 w-3 text-muted-foreground/80 transition-smooth shrink-0 ${
                      collapsed[g.key] ? "-rotate-90" : ""
                    }`}
                    strokeWidth={1.75}
                  />
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ring-2 ring-background/60 ${g.dotClass} ${
                      g.key === "needs_action" ? "animate-pulse-soft" : ""
                    }`}
                  />
                  <span
                    className="text-[12px] font-semibold tracking-tight"
                    style={{ color: `hsl(var(--tint-${g.tint}-fg))` }}
                  >
                    {g.label}
                  </span>
                  {g.key === "needs_action" && g.items.length > 0 && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 ml-1">
                      sorted by burn
                    </span>
                  )}
                  {(g.key === "stale" || g.key === "recent") && g.items.length > 0 && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 ml-1">
                      oldest first
                    </span>
                  )}
                  {(() => {
                    const vipInGroup = g.items.reduce((n, c) => n + (isVip(c.ref) ? 1 : 0), 0);
                    return (
                      <span className="ml-auto inline-flex items-center gap-1.5">
                        {vipInGroup > 0 && (
                          <span
                            className="inline-flex items-center gap-1 h-[18px] pl-1 pr-1.5 rounded-[5px] font-mono text-[10px] tabular-nums ring-1 ring-inset"
                            style={{
                              backgroundColor: "hsl(var(--tint-amber) / 0.14)",
                              color: "hsl(var(--tint-amber-fg))",
                              // @ts-expect-error css var
                              "--tw-ring-color": "hsl(var(--tint-amber) / 0.28)",
                            }}
                            title={`${vipInGroup} VIP case${vipInGroup === 1 ? "" : "s"} in this group`}
                          >
                            <Star className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
                            {vipInGroup}
                          </span>
                        )}
                        <span
                          className="inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-[5px] bg-background/40 font-mono text-[10px] tabular-nums ring-1 ring-inset"
                          style={{
                            color: `hsl(var(--tint-${g.tint}-fg) / 0.85)`,
                            // @ts-expect-error css var
                            "--tw-ring-color": `hsl(var(--tint-${g.tint}) / 0.20)`,
                          }}
                        >
                          {g.items.length.toString().padStart(2, "0")}
                        </span>
                      </span>
                    );
                  })()}
                </button>
              </div>

              {/* Per-group column header */}
              {!collapsed[g.key] && g.items.length > 0 && (() => {
                const groupRefs = g.items.map((c) => c.ref);
                const selectedInGroup = groupRefs.filter((r) => selected.has(r)).length;
                const allSelected = selectedInGroup === groupRefs.length;
                const someSelected = selectedInGroup > 0 && !allSelected;
                return (
                  <div
                    className={`${COLS} px-8 pt-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-medium`}
                  >
                    <button
                      onClick={() => toggleGroupSelection(groupRefs)}
                      title={allSelected ? "Deselect all in group" : "Select all in group"}
                      className={`h-3.5 w-3.5 rounded-[3px] ring-1 ring-inset transition-smooth flex items-center justify-center ${
                        allSelected || someSelected
                          ? "bg-primary/80 ring-primary/80"
                          : "bg-transparent ring-border/70 hover:ring-foreground/40"
                      }`}
                    >
                      {allSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
                      {someSelected && <span className="h-[2px] w-2 rounded-full bg-primary-foreground" />}
                    </button>
                    <span>Ref</span>
                    <span>Client</span>
                    <span>Stage</span>
                    <span>Owner</span>
                    <span className="text-right">SLA</span>
                    <span className="text-right">Updated</span>
                  </div>
                );
              })()}

              {!collapsed[g.key] &&
                g.items.map((c) => {
                  const isFocused = focusedRef === c.ref;
                  const isSelected = selected.has(c.ref);
                  const isFresh = freshRef === c.ref;
                  const hasSelection = selected.size > 0;
                  return (
                  <ContextMenu key={c.ref}>
                    <ContextMenuTrigger asChild>
                  <div
                    ref={(el) => {
                      if (el) rowRefs.current.set(c.ref, el);
                      else rowRefs.current.delete(c.ref);
                    }}
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      setFocusedRef(c.ref);
                      // When a selection is active, row click toggles selection instead of navigating.
                      // Shift+click extends the range from the last selected row.
                      if (hasSelection || e.shiftKey) {
                        if (e.shiftKey) selectRange(c.ref);
                        else toggleSelected(c.ref);
                        return;
                      }
                      navigate(`/app/console?ref=${encodeURIComponent(c.ref)}`);
                    }}
                    className={`${COLS} relative px-8 py-4 border-b border-border/30 transition-smooth cursor-pointer group focus:outline-none ${
                      isSelected
                        ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                        : isFocused
                          ? "bg-secondary/40 ring-1 ring-inset ring-primary/40"
                          : "hover:bg-secondary/30"
                    } ${isFresh ? "animate-fresh-glow" : ""}`}
                  >
                    {/* VIP priority accent — 1px amber rule on the left edge.
                        Reads as a status marker without interfering with the
                        row's selection/focus rings or background tints. */}
                    {isVip(c.ref) && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-0 bottom-0 w-px"
                        style={{ backgroundColor: "hsl(var(--tint-amber-fg))" }}
                      />
                    )}
                    {/* Bulk-select checkbox — visible on hover, when selected, or when any selection is active */}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (e.shiftKey) selectRange(c.ref);
                        else toggleSelected(c.ref);
                      }}
                      title={isSelected ? "Deselect (x)" : "Select (x · shift+x for range)"}
                      className={`h-3.5 w-3.5 rounded-[3px] ring-1 ring-inset transition-smooth flex items-center justify-center ${
                        isSelected
                          ? "bg-primary ring-primary opacity-100"
                          : hasSelection
                            ? "bg-transparent ring-border/70 opacity-100 hover:ring-foreground/40"
                            : "bg-transparent ring-border/70 opacity-0 group-hover:opacity-100 hover:ring-foreground/40"
                      }`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
                    </button>

                    {/* Ref */}
                    <span className="font-mono text-[11px] text-muted-foreground group-hover:text-foreground tabular-nums">
                      {c.ref}
                    </span>

                    {/* Client + visa pill + flag */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${g.dotClass} ${
                          g.key === "needs_action" ? "animate-pulse-soft" : ""
                        }`}
                      />
                      <span className="text-sm truncate">{c.client}</span>
                      {isVip(c.ref) && (
                        <span
                          aria-label="VIP client"
                          title="VIP client"
                          className="shrink-0 inline-flex"
                        >
                          <Star
                            className="h-3 w-3 fill-current"
                            style={{ color: "hsl(var(--tint-amber-fg))" }}
                            strokeWidth={1.5}
                          />
                        </span>
                      )}
                      <Pill tone={visaTone[c.visa] || "slate"} size="sm">
                        {c.visa}
                      </Pill>
                      <CountryChip code={c.country} />
                      {/* Node health indicator — surfaces *only* when the
                          capturing device isn't healthy. Healthy is the
                          default and silent: a dot on every row would just
                          be noise and hide the actually-degraded ones. The
                          colour follows project semantics (crimson = infra
                          failure, amber = degradation, slate = maintenance);
                          click jumps to /app/nodes?node=ID. Tooltip carries
                          the full context (ID + label + status) so the
                          operator can decide priority without leaving the
                          desk. */}
                      {(() => {
                        if (!c.sourceNodeId) return null;
                        const node: EdgeNode | undefined = deviceNodes.find(
                          (n) => n.id === c.sourceNodeId,
                        );
                        if (!node || node.status === "healthy") return null;
                        const meta = STATUS_META[node.status];
                        const dotColor = `hsl(var(--tint-${meta.tint}-fg))`;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Captured by ${node.id}, ${meta.label.toLowerCase()}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/app/nodes?node=${encodeURIComponent(node.id)}`,
                                  );
                                }}
                                className="shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full transition-smooth hover:bg-secondary/40"
                              >
                                <span className="relative inline-flex h-1.5 w-1.5">
                                  {meta.pulse && (
                                    <span
                                      className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                                      style={{ backgroundColor: dotColor }}
                                    />
                                  )}
                                  <span
                                    className="relative inline-flex h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: dotColor }}
                                  />
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[11px] py-1.5 px-2.5">
                              <div className="flex items-center gap-1.5">
                                <Server
                                  className="h-3 w-3"
                                  strokeWidth={1.75}
                                  style={{ color: dotColor }}
                                />
                                <span className="font-mono tabular-nums">{node.id}</span>
                                <span className="text-muted-foreground/70">·</span>
                                <span style={{ color: dotColor }}>
                                  {meta.label.toLowerCase()}
                                </span>
                              </div>
                              <div className="text-muted-foreground/80 mt-0.5">
                                {node.label} · {node.city}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </div>

                    {/* Stage with quiet glyph + optional stuck badge */}
                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground truncate min-w-0">
                      <StageIcon stage={c.stage} />
                      <span className="truncate">{c.stage}</span>
                      {(() => {
                        const reqCount = requestCounts.get(c.ref) ?? 0;
                        if (reqCount === 0) return null;
                        const age = shortAge(requestStaleness.get(c.ref), NOW_MS);
                        const isStale = (() => {
                          const at = requestStaleness.get(c.ref);
                          return at ? NOW_MS - new Date(at).getTime() >= STALE_MS : false;
                        })();
                        // Once a request crosses the 24h staleness mark we shift the
                        // badge to a rose tint so the row reads as "rotting" without
                        // the operator needing to flip into My-requests mode.
                        const tint = isStale ? "rose" : "violet";
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Clickable shortcut → jumps straight to the
                                  Operator Console with the Documents section
                                  scrolled into view. Stops propagation so the
                                  outer row click (which also opens the case,
                                  but to the approval hero) doesn't fire. */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/app/console?ref=${encodeURIComponent(c.ref)}&focus=documents`,
                                  );
                                }}
                                className="inline-flex items-center gap-1 h-4 px-1.5 rounded-sm font-mono text-[9px] uppercase tracking-wide shrink-0 transition-smooth hover:brightness-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 ring-1 ring-inset"
                                style={{
                                  color: `hsl(var(--tint-${tint}-fg))`,
                                  backgroundColor: `hsl(var(--tint-${tint}) / 0.10)`,
                                  ['--tw-ring-color' as any]: `hsl(var(--tint-${tint}) / 0.22)`,
                                }}
                                aria-label={`Open ${c.ref} documents · ${reqCount} requested${age ? ` · ${age} ago` : ""}`}
                              >
                                <span className="h-1 w-1 rounded-full bg-current opacity-70" />
                                {reqCount} requested
                                {age && (
                                  <>
                                    <span className="opacity-40">·</span>
                                    <span className="normal-case tracking-normal opacity-80">{age}</span>
                                  </>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-mono text-[10px]">
                              Open documents · {reqCount} requested
                              {age ? ` · oldest ${age} ago` : ""}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                      {(() => {
                        const stuck = stuckLabel(c.stageEnteredAt);
                        if (!stuck) return null;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center gap-1 h-4 px-1.5 rounded-sm font-mono text-[9px] uppercase tracking-wide shrink-0 ring-1 ring-inset ring-[hsl(var(--tint-amber)/0.22)]"
                                style={{
                                  color: "hsl(var(--tint-amber-fg))",
                                  backgroundColor: "hsl(var(--tint-amber) / 0.10)",
                                }}
                              >
                                stuck {stuck}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-mono text-[10px]">
                              In stage since {new Date(c.stageEnteredAt).toUTCString().slice(5, 22)}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </span>

                    {/* Owner — avatar + name. Hidden on row hover to make room for actions. */}
                    <span className="flex items-center gap-2 min-w-0 transition-opacity group-hover:opacity-0">
                      <OwnerAvatar name={c.owner} mine={c.owner === CURRENT_OPERATOR} />
                      <span className="text-[11px] text-muted-foreground truncate">
                        {c.owner}
                      </span>
                    </span>

                    {/* SLA — time + thin burn-down bar */}
                    <span className="flex flex-col items-end gap-1 min-w-0">
                      <span
                        className={`font-mono text-[11px] tabular-nums leading-none ${
                          c.slaWarn ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {c.sla}
                      </span>
                      {(() => {
                        const pct = slaBurnPercent(c.sla);
                        if (pct === null) return null;
                        return (
                          <span className="block w-12 h-[2px] rounded-full bg-secondary/60 overflow-hidden">
                            <span
                              className="block h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: c.slaWarn
                                  ? "hsl(var(--tint-rose-fg))"
                                  : "hsl(var(--muted-foreground) / 0.5)",
                              }}
                            />
                          </span>
                        );
                      })()}
                    </span>

                    {/* Updated — date in tooltip, stays terse in the row */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-right font-mono text-[10px] text-muted-foreground tabular-nums cursor-default">
                          {c.updated}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="font-mono text-[10px]">
                        Last updated · {c.updated}
                      </TooltipContent>
                    </Tooltip>

                    {/* Inline row-actions — appear on hover, sit over Owner column */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity pointer-events-none ${
                        selected.size > 0
                          ? "opacity-0"
                          : "opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto"
                      }`}
                      style={{
                        // Align with Owner column start: 32px (px-8) + sum of prior cols + gaps
                        // 32 + 88 + 24 + (1.4fr) + 24 + (1fr) + 24 — too dynamic; use right offset instead.
                        right: "calc(60px + 88px + 24px + 24px)",
                      }}
                    >
                      {g.key === "needs_action" && (
                        <button
                          onClick={(e) => handleApprove(e, c.ref)}
                          title="Approve (a)"
                          className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium ring-1 ring-inset transition-smooth hover:brightness-125"
                          style={{
                            backgroundColor: "hsl(var(--tint-mint) / 0.16)",
                            color: "hsl(var(--tint-mint-fg))",
                            // @ts-expect-error css var
                            "--tw-ring-color": "hsl(var(--tint-mint) / 0.22)",
                          }}
                        >
                          <Check className="h-3 w-3" strokeWidth={2.25} />
                          Approve
                        </button>
                      )}
                      <button
                        onClick={(e) => handleReassign(e, c.ref)}
                        title="Reassign owner"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <UserRoundCog className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={(e) => handleOpenBundle(e, c)}
                        title="Open presentation bundle"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <FileText className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={(e) => handleOpenEvidence(e, c)}
                        title="Open visual evidence"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <Camera className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={(e) => handleOpenCaseVault(e, c)}
                        title="Open Case Vault"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <Server className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={(e) => handleOpen(e, c.ref)}
                        title="Open in Console (↵)"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 ring-1 ring-inset ring-border/60 transition-smooth"
                      >
                        <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover/95 backdrop-blur-md border-border">
                      <ContextMenuItem
                        onSelect={() => handleOpen(null, c.ref)}
                        className="text-[12px] gap-2"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open in Console
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">↵</span>
                      </ContextMenuItem>
                      {g.key === "needs_action" && (
                        <ContextMenuItem
                          onSelect={() => handleApprove(null, c.ref)}
                          className="text-[12px] gap-2"
                          style={{ color: "hsl(var(--tint-mint-fg))" }}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2} />
                          Approve
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">a</span>
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem
                        onSelect={() => handleReassign(null, c.ref)}
                        className="text-[12px] gap-2"
                      >
                        <UserRoundCog className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Reassign owner
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">e</span>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => handleOpenBundle(null, c)}
                        className="text-[12px] gap-2"
                      >
                        <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open presentation bundle
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => handleOpenEvidence(null, c)}
                        className="text-[12px] gap-2"
                      >
                        <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open visual evidence
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => handleOpenCaseVault(null, c)}
                        className="text-[12px] gap-2"
                      >
                        <Server className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open Case Vault
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      {/* VIP toggle — labelled by current state so the action
                          reads as the verb, not the noun. Amber accent only on
                          the unflag direction (the destructive-ish path), so
                          it doesn't compete with the row's own VIP marker. */}
                      <ContextMenuItem
                        onSelect={() => handleToggleVip(c.ref, c.client)}
                        className="text-[12px] gap-2"
                        style={
                          isVip(c.ref)
                            ? { color: "hsl(var(--tint-amber-fg))" }
                            : undefined
                        }
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${isVip(c.ref) ? "fill-current" : ""}`}
                          strokeWidth={1.75}
                        />
                        {isVip(c.ref) ? "Remove VIP flag" : "Flag as VIP"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  );
                })}

              {!collapsed[g.key] && g.items.length === 0 && (
                <div className="px-8 py-3 text-[11px] text-muted-foreground/70 italic border-b border-border/40">
                  No cases.
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Floating bulk-action bar — appears when one or more cases are selected */}
      {selected.size > 0 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 animate-fade-up">
          <div className="flex items-center gap-1 h-11 pl-2 pr-2 rounded-xl bg-card/95 backdrop-blur-md ring-1 ring-inset ring-border shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)]">
            {/* Selection counter */}
            <div className="flex items-center gap-2 h-7 pl-2 pr-3 rounded-lg bg-primary/15 ring-1 ring-inset ring-primary/30">
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-primary text-primary-foreground font-mono text-[10px] tabular-nums font-semibold">
                {selected.size}
              </span>
              <span className="text-[11px] font-medium text-primary">
                selected
              </span>
            </div>
            <div className="h-5 w-px bg-border/80 mx-0.5" />
            <button
              onClick={bulkReassign}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] text-foreground/90 hover:bg-secondary/80 transition-smooth"
            >
              <UserRoundCog className="h-3.5 w-3.5" strokeWidth={1.75} />
              Reassign
            </button>
            <button
              onClick={bulkSnooze}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] text-foreground/90 hover:bg-secondary/80 transition-smooth"
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
              Snooze
            </button>
            <button
              onClick={bulkResolve}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] transition-smooth hover:brightness-125"
              style={{
                color: "hsl(var(--tint-mint-fg))",
                backgroundColor: "hsl(var(--tint-mint) / 0.14)",
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Mark resolved
            </button>
            <button
              onClick={bulkExport}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] text-foreground/90 hover:bg-secondary/80 transition-smooth"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              Export
            </button>
            {/* Bulk VIP unflag — only shown when the selection contains at
                least one flagged case, so the bar stays quiet for typical
                triage selections. Amber tint matches every other VIP cue. */}
            {(() => {
              const vipInSelection = [...selected].filter((r) => isVip(r)).length;
              if (vipInSelection === 0) return null;
              return (
                <button
                  onClick={bulkUnflagVip}
                  title={`Remove VIP flag from ${vipInSelection} case${vipInSelection === 1 ? "" : "s"}`}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] transition-smooth hover:brightness-125"
                  style={{
                    color: "hsl(var(--tint-amber-fg))",
                    backgroundColor: "hsl(var(--tint-amber) / 0.14)",
                  }}
                >
                  <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                  Unflag VIP
                  <span className="font-mono text-[10px] opacity-70">{vipInSelection}</span>
                </button>
              );
            })()}
            <div className="h-5 w-px bg-border/80 mx-0.5" />
            <button
              onClick={clearSelection}
              title="Clear selection (esc)"
              className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-smooth"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}

      {/* Footer — keyboard hints. Same dim-on-rest, brighten-on-hover
          treatment as /app/nodes so the rhythm reads as one product
          instead of three independently-styled surfaces. */}
      <div className="group/foot shrink-0 px-8 py-2 text-[10px] text-muted-foreground/80 border-t border-border/40 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4 flex-wrap opacity-45 group-hover/foot:opacity-100 transition-smooth">
          <ShortcutHint keys={["j", "k"]} label="navigate" />
          <ShortcutHint keys={["↵"]} label="open" />
          <ShortcutHint keys={["a"]} label="approve" dim={!focusedRef || visibleRows.find((r) => r.ref === focusedRef)?.status !== "needs_action"} />
          <ShortcutHint keys={["e"]} label="reassign" dim={!focusedRef} />
          <ShortcutHint keys={["x"]} label="select" dim={!focusedRef} />
          <ShortcutHint keys={["⇧", "x"]} label="range" dim={!focusedRef || !lastSelectedRef} />
          <ShortcutHint keys={["/"]} label="filter" />
          <ShortcutHint keys={["i"]} label="inbox" dim={totalOutstanding === 0} />
          <ShortcutHint keys={["m"]} label="mine" dim={mineTotal === 0} />
          <ShortcutHint keys={["esc"]} label={selected.size > 0 ? "clear selection" : "clear"} />
          <ShortcutHint keys={["?"]} label="all shortcuts" />
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="opacity-60 group-hover/foot:opacity-100 transition-smooth">{filtered.length} of {cases.length}</span>
          <span className="font-mono">synced 12s ago</span>
        </div>
      </div>
    </div>
  );
};
