import { useState, useMemo, useEffect, useRef } from "react";
import { Eye, EyeOff, Check, RotateCcw, Download, Upload, Eraser } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

/**
 * BundleDiffOverlay — DESIGN_2 diff inspector for /bundle.
 *
 * Visualises which DESIGN_2 channels were applied to the page so a reviewer
 * can isolate one or many in parallel. The control is multi-select: each
 * chip toggles its own channel, with "All" / "None" shortcuts at the top.
 *
 * Channels live as `data-diff="<key>"` markers on representative elements,
 * and a single CSS rule (scoped to `html[data-bundle-diff-keys]`) paints
 * dashed outlines + a tiny corner label per channel. Multi-select works by
 * encoding the active set into a space-separated attribute and matching
 * each key with `~="key"` selectors.
 *
 *   surface — gradient-border glass shells (was: bg-card/30 + rounded-lg)
 *   radius  — rounded-[12px]/[6px] scale (was: rounded-lg / rounded-md)
 *   accent  — border-primary/15 hairlines (was: border-border/40-60)
 *   text    — opacity ≥/90 for AA (was: /60–/80, sub-AA contrast)
 *   motion  — animate-icon-breathe / drift / hairline-sweep (was: none)
 */

const LEGEND = [
  {
    key: "surface",
    label: "Glass surfaces",
    swatch: "hsl(var(--tint-violet-fg))",
    desc: "rounded-[12px] bg-background/40 ring-primary/15",
    was: "rounded-lg bg-card/30 ring-border/40",
  },
  {
    key: "radius",
    label: "Radius scale",
    swatch: "hsl(var(--tint-mint-fg))",
    desc: "rounded-[12px] / rounded-[6px]",
    was: "rounded-lg / rounded-md",
  },
  {
    key: "accent",
    label: "Hairline accent",
    swatch: "hsl(var(--tint-amber-fg))",
    desc: "border-primary/15",
    was: "border-border/40–60",
  },
  {
    key: "text",
    label: "AA contrast",
    swatch: "hsl(var(--tint-rose-fg))",
    desc: "text-foreground/≥90 (≥4.5:1)",
    was: "text-muted-foreground/60–80",
  },
  {
    key: "motion",
    label: "Animated icons",
    swatch: "hsl(var(--primary))",
    desc: "icon-breathe · drift · hairline-sweep",
    was: "static",
  },
] as const;

type Key = (typeof LEGEND)[number]["key"];
const ALL_KEYS: Key[] = LEGEND.map((l) => l.key);

export function BundleDiffOverlay() {
  const [open, setOpen] = useState(false);
  // Each key is an independent toggle. Empty set = no highlights.
  const [active, setActive] = useState<Set<Key>>(() => new Set(ALL_KEYS));
  // Two-step "Clear element filter" inside the import dialog: first click
  // shows how many tags will be removed and asks for confirmation; second
  // click actually clears them. Reset whenever the dialog opens/closes.
  const [clearConfirm, setClearConfirm] = useState<{ count: number } | null>(null);

  // Sync the active set onto <html> as a space-separated attribute. Empty
  // → remove the attribute entirely so no rules match.
  const writeAttr = (set: Set<Key>) => {
    const html = document.documentElement;
    if (set.size === 0) html.removeAttribute("data-bundle-diff-keys");
    else html.setAttribute("data-bundle-diff-keys", Array.from(set).join(" "));
  };

  // Clear any per-element import filter (data-diff-imported tags + the
  // <html> filter flag). Called whenever the user changes channels
  // manually, resets, or imports without filtering — so stale tags from
  // a prior filtered import never linger. The optional snapshot return
  // captures the exact nodes that were tagged so an Undo can restore them.
  const clearImportFilter = (capture = false) => {
    const hadFilter =
      document.documentElement.getAttribute("data-bundle-diff-filter") ===
      "imported";
    document.documentElement.removeAttribute("data-bundle-diff-filter");
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-diff-imported]"),
    );
    nodes.forEach((el) => el.removeAttribute("data-diff-imported"));
    return capture ? { nodes, hadFilter } : null;
  };

  // Restore a previously-cleared snapshot. Re-tags the same DOM nodes
  // and re-enables the scoped html flag if it was on.
  const restoreImportFilter = (snapshot: {
    nodes: HTMLElement[];
    hadFilter: boolean;
  }) => {
    let restored = 0;
    snapshot.nodes.forEach((el) => {
      // The node may have been removed from the DOM since clearing —
      // skip those silently rather than throwing.
      if (el.isConnected) {
        el.setAttribute("data-diff-imported", "");
        restored += 1;
      }
    });
    if (snapshot.hadFilter) {
      document.documentElement.setAttribute(
        "data-bundle-diff-filter",
        "imported",
      );
    }
    return restored;
  };

  const toggle = (k: Key) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      writeAttr(next);
      clearImportFilter();
      return next;
    });
  };

  const setAll = () => {
    const next = new Set<Key>(ALL_KEYS);
    setActive(next);
    writeAttr(next);
    clearImportFilter();
  };
  const setNone = () => {
    const next = new Set<Key>();
    setActive(next);
    writeAttr(next);
    clearImportFilter();
  };

  // Restore the default state — every channel on. Distinct from `setAll` in
  // intent: this is a one-tap "go back to how it shipped", not a toggle.
  const resetDefaults = () => {
    const next = new Set<Key>(ALL_KEYS);
    setActive(next);
    writeAttr(next);
    clearImportFilter();
  };

  // Export the current diff state — active channels + each highlighted
  // element's id/position/preview — as a JSON file. The `scope` controls
  // which elements are serialised:
  //   "viewport" → only elements currently intersecting the viewport
  //   "all"      → every tagged element on the page across active channels
  // In both cases each element carries an `inViewport` flag so the
  // consumer can re-filter without re-running the export.
  const handleExport = (scope: "viewport" | "all" = "all") => {
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const isInViewport = (r: DOMRect) =>
      r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;

    const collectFor = (k: Key) => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-diff="${k}"]`),
      );
      return nodes
        .map((el, i) => {
          const rect = el.getBoundingClientRect();
          const inViewport = isInViewport(rect);
          return {
            index: i,
            channel: k,
            id: el.id || null,
            tag: el.tagName.toLowerCase(),
            classes: el.className?.toString().slice(0, 160) || null,
            text:
              (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80) ||
              null,
            inViewport,
            position: {
              x: Math.round(rect.left + window.scrollX),
              y: Math.round(rect.top + window.scrollY),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            },
          };
        })
        .filter((entry) => (scope === "viewport" ? entry.inViewport : true));
    };
    const elements = ALL_KEYS.flatMap((k) =>
      active.has(k) ? collectFor(k) : [],
    );
    const payload = {
      exportedAt: new Date().toISOString(),
      url: window.location.href,
      bundleId: window.location.pathname.split("/").filter(Boolean).pop() || null,
      scope,
      viewport: { w: vw, h: vh, scrollX: window.scrollX, scrollY: window.scrollY },
      activeChannels: Array.from(active),
      allChannels: ALL_KEYS,
      counts: channelCounts,
      visibleTotal,
      elements,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `bundle-diff-${payload.bundleId ?? "snapshot"}-${scope}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: scope === "viewport" ? "Viewport diff exported" : "Full diff exported",
      description: `${elements.length} element${elements.length === 1 ? "" : "s"} across ${active.size} channel${active.size === 1 ? "" : "s"} saved as JSON.`,
    });
  };

  // Hidden file input — triggered by the Import button. Two-step flow:
  // parse the file → stash a preview in `pendingImport` → show the
  // confirmation dialog with channels + element counts → on confirm,
  // commit to state and the <html> attribute.
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  type ImportedElement = {
    channel: Key;
    index: number; // position within its channel's querySelectorAll order
    inViewport: boolean;
    id: string | null;
    tag: string | null;
    text: string | null;
    position: { x: number; y: number; w: number; h: number } | null;
  };
  type ImportMode = "all" | "visible" | "off-screen";
  type PendingImport = {
    fileName: string;
    channels: Key[];
    skippedChannels: string[];
    elementsByChannel: Record<Key, number>;
    visibleByChannel: Record<Key, number>;
    offscreenByChannel: Record<Key, number>;
    totalElements: number;
    elementsInFile: number;
    elements: ImportedElement[];
    exportedAt: string | null;
    sourceUrl: string | null;
    scope: string | null;
    importMode: ImportMode;
  };
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        activeChannels?: unknown;
        elements?: unknown;
        exportedAt?: unknown;
        url?: unknown;
        scope?: unknown;
      };
      if (!parsed || !Array.isArray(parsed.activeChannels)) {
        throw new Error("Missing activeChannels[] in JSON");
      }
      const rawChannels = parsed.activeChannels as unknown[];
      const valid = rawChannels.filter(
        (k): k is Key => typeof k === "string" && (ALL_KEYS as string[]).includes(k),
      );
      const skipped = rawChannels.filter(
        (k): k is string =>
          typeof k === "string" && !(ALL_KEYS as string[]).includes(k),
      );

      const elementsByChannel = Object.fromEntries(
        ALL_KEYS.map((k) => [k, 0]),
      ) as Record<Key, number>;
      const visibleByChannel = Object.fromEntries(
        ALL_KEYS.map((k) => [k, 0]),
      ) as Record<Key, number>;
      const offscreenByChannel = Object.fromEntries(
        ALL_KEYS.map((k) => [k, 0]),
      ) as Record<Key, number>;
      const elements: ImportedElement[] = [];
      let elementsInFile = 0;
      if (Array.isArray(parsed.elements)) {
        elementsInFile = parsed.elements.length;
        for (const el of parsed.elements as Array<{
          channel?: unknown;
          index?: unknown;
          inViewport?: unknown;
          id?: unknown;
          tag?: unknown;
          text?: unknown;
          position?: unknown;
        }>) {
          if (
            el &&
            typeof el.channel === "string" &&
            (ALL_KEYS as string[]).includes(el.channel) &&
            typeof el.index === "number"
          ) {
            const ch = el.channel as Key;
            const inViewport = el.inViewport === true;
            elementsByChannel[ch] += 1;
            if (inViewport) visibleByChannel[ch] += 1;
            else offscreenByChannel[ch] += 1;
            const pos = el.position as
              | { x?: unknown; y?: unknown; w?: unknown; h?: unknown }
              | null
              | undefined;
            const position =
              pos &&
              typeof pos.x === "number" &&
              typeof pos.y === "number" &&
              typeof pos.w === "number" &&
              typeof pos.h === "number"
                ? { x: pos.x, y: pos.y, w: pos.w, h: pos.h }
                : null;
            elements.push({
              channel: ch,
              index: el.index,
              inViewport,
              id: typeof el.id === "string" && el.id.length > 0 ? el.id : null,
              tag: typeof el.tag === "string" ? el.tag : null,
              text: typeof el.text === "string" && el.text.length > 0 ? el.text : null,
              position,
            });
          }
        }
      }
      const totalElements = valid.reduce(
        (sum, k) => sum + elementsByChannel[k],
        0,
      );

      // Default the import mode to mirror how the snapshot was exported,
      // when that hint is present. Otherwise fall back to "all".
      const fileScope =
        typeof parsed.scope === "string" ? parsed.scope : null;
      const initialMode: ImportMode =
        fileScope === "viewport" ? "visible" : "all";

      setPendingImport({
        fileName: file.name,
        channels: valid,
        skippedChannels: skipped,
        elementsByChannel,
        visibleByChannel,
        offscreenByChannel,
        totalElements,
        elementsInFile,
        elements,
        exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
        sourceUrl: typeof parsed.url === "string" ? parsed.url : null,
        scope: fileScope,
        importMode: initialMode,
      });
    } catch (err) {
      toast({
        title: "Import failed",
        description:
          err instanceof Error
            ? err.message
            : "Could not parse the selected file as a diff snapshot.",
        variant: "destructive",
      });
    }
  };

  const setImportMode = (mode: ImportMode) => {
    setPendingImport((prev) => (prev ? { ...prev, importMode: mode } : prev));
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    // Always start from a clean filter slate.
    clearImportFilter();

    const next = new Set<Key>(pendingImport.channels);
    setActive(next);
    writeAttr(next);

    // If mode != "all", we tag matching DOM nodes so the scoped CSS rule
    // can restrict outlines to just those elements. Matching is by
    // (channel, index) — same ordering used during export.
    let taggedCount = 0;
    if (pendingImport.importMode !== "all") {
      const wantVisible = pendingImport.importMode === "visible";
      // Group desired indices per channel for an O(1) lookup.
      const wanted = new Map<Key, Set<number>>();
      for (const el of pendingImport.elements) {
        if (!next.has(el.channel)) continue;
        if (wantVisible ? !el.inViewport : el.inViewport) continue;
        if (!wanted.has(el.channel)) wanted.set(el.channel, new Set());
        wanted.get(el.channel)!.add(el.index);
      }
      for (const [ch, indices] of wanted) {
        const nodes = document.querySelectorAll<HTMLElement>(
          `[data-diff="${ch}"]`,
        );
        nodes.forEach((node, i) => {
          if (indices.has(i)) {
            node.setAttribute("data-diff-imported", "");
            taggedCount += 1;
          }
        });
      }
      // Activate the scoped CSS rule.
      document.documentElement.setAttribute("data-bundle-diff-filter", "imported");
    }

    if (!open) setOpen(true);
    const modeLabel =
      pendingImport.importMode === "all"
        ? "all matched elements"
        : pendingImport.importMode === "visible"
          ? `${taggedCount} visible element${taggedCount === 1 ? "" : "s"}`
          : `${taggedCount} off-screen element${taggedCount === 1 ? "" : "s"}`;
    toast({
      title: "Diff imported",
      description:
        pendingImport.channels.length === 0
          ? "Snapshot loaded — no channels were active."
          : `Restored ${pendingImport.channels.length} channel${pendingImport.channels.length === 1 ? "" : "s"} · ${modeLabel}.`,
    });
    setPendingImport(null);
    setClearConfirm(null);
  };

  const cancelImport = () => {
    setPendingImport(null);
    setClearConfirm(null);
  };

  const handleOpenToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Re-enable the current set (or default to all on first open).
      const set = active.size === 0 ? new Set<Key>(ALL_KEYS) : active;
      setActive(set);
      writeAttr(set);
    } else {
      // Closing the panel clears highlights but preserves the saved set.
      document.documentElement.removeAttribute("data-bundle-diff-keys");
    }
  };

  const activeCount = active.size;

  // Per-channel DOM counts — how many tagged elements exist for each
  // channel right now. Recomputed when the panel opens or the active set
  // changes, and re-checked on resize / route mutations via a tiny
  // MutationObserver so the numbers stay honest as the page hydrates.
  const [channelCounts, setChannelCounts] = useState<Record<Key, number>>(
    () => Object.fromEntries(ALL_KEYS.map((k) => [k, 0])) as Record<Key, number>,
  );

  useEffect(() => {
    if (!open) return;
    const recount = () => {
      const next = {} as Record<Key, number>;
      for (const k of ALL_KEYS) {
        next[k] = document.querySelectorAll(`[data-diff="${k}"]`).length;
      }
      setChannelCounts(next);
    };
    recount();
    // Watch for late-mounted sections (staggered fade-up reveals) so the
    // counts settle once the bundle is fully painted.
    const obs = new MutationObserver(recount);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-diff"],
    });
    return () => obs.disconnect();
  }, [open]);

  // Total visible highlights = sum of counts for currently-active channels.
  const visibleTotal = useMemo(
    () =>
      ALL_KEYS.reduce(
        (sum, k) => sum + (active.has(k) ? channelCounts[k] : 0),
        0,
      ),
    [active, channelCounts],
  );

  // Memo the per-channel CSS so we don't rebuild it every render.
  const channelCss = useMemo(() => buildChannelCss(), []);

  return (
    <>
      {/* Pinned to the viewport. The panel renders ABOVE the button so a
          tall list never spills off-screen, and is constrained to the
          viewport height with internal scroll. Both the toggle pill and
          the panel stay visible regardless of page scroll. */}
      <div className="fixed bottom-4 right-[140px] z-[9998] font-mono text-[10px] uppercase tracking-[0.18em] flex flex-col items-end gap-2">
        {open && (
          <div
            className="w-[340px] max-h-[calc(100vh-5rem)] flex flex-col rounded-[10px] border border-primary/15 bg-background/95 backdrop-blur-md ring-1 ring-inset ring-primary/10 shadow-[0_8px_28px_-12px_hsl(252_90%_30%/0.45)] overflow-hidden"
            role="group"
            aria-label="Diff filter channels"
          >
            {/* Sticky header — title + All/None/Reset shortcuts. Stays
                visible while the legend list scrolls underneath. */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2.5 border-b border-primary/15 bg-background/95 backdrop-blur-md">
              <span className="text-foreground/95">DESIGN_2 deltas</span>
              <div className="flex items-center gap-1 normal-case tracking-normal">
                <button
                  onClick={setAll}
                  className={`rounded-[4px] px-1.5 py-0.5 text-[10px] transition-colors ${
                    activeCount === ALL_KEYS.length
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground/95 hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  All
                </button>
                <span aria-hidden className="text-border/60 text-[10px]">·</span>
                <button
                  onClick={setNone}
                  className={`rounded-[4px] px-1.5 py-0.5 text-[10px] transition-colors ${
                    activeCount === 0
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground/95 hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  None
                </button>
                <span aria-hidden className="text-border/60 text-[10px]">·</span>
                <button
                  onClick={resetDefaults}
                  title="Reset to defaults (all channels on)"
                  className="group inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] text-muted-foreground/95 hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <RotateCcw
                    className="h-2.5 w-2.5 transition-transform group-hover:-rotate-180 duration-500"
                    strokeWidth={2}
                  />
                  Reset
                </button>
              </div>
            </div>

            {/* Scrollable legend body — owns the overflow so the chrome
                (header + footer) stays pinned to the panel edges. */}
            <ul className="flex flex-col gap-1 normal-case tracking-normal overflow-y-auto px-3 py-2.5 min-h-0">
              {LEGEND.map((row) => {
                const isOn = active.has(row.key);
                return (
                  <li key={row.key}>
                    <button
                      onClick={() => toggle(row.key)}
                      aria-pressed={isOn}
                      className={`group w-full text-left rounded-[6px] px-2 py-1.5 ring-1 ring-inset transition-colors ${
                        isOn
                          ? "bg-primary/[0.06] ring-primary/20"
                          : "ring-transparent hover:bg-secondary/40 hover:ring-border/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Checkbox-style toggle indicator */}
                        <span
                          aria-hidden
                          className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] ring-1 ring-inset transition-colors`}
                          style={{
                            backgroundColor: isOn
                              ? row.swatch
                              : "transparent",
                            ["--tw-ring-color" as never]: isOn
                              ? row.swatch
                              : "hsl(var(--border) / 0.6)",
                          }}
                        >
                          {isOn && (
                            <Check
                              className="h-2.5 w-2.5 text-background"
                              strokeWidth={3}
                            />
                          )}
                        </span>
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: row.swatch }}
                        />
                        <span className="text-[11.5px] text-foreground/95">
                          {row.label}
                        </span>
                        {/* Per-channel highlighted-element count. Dimmed
                            when the channel is off so it's clear those
                            elements aren't currently visible. */}
                        <span
                          className={`ml-auto inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-[4px] px-1.5 font-mono tabular-nums text-[10px] ring-1 ring-inset transition-colors ${
                            isOn
                              ? "text-foreground/95"
                              : "text-muted-foreground/70"
                          }`}
                          style={{
                            backgroundColor: isOn
                              ? `${row.swatch.replace("))", ") / 0.12)")}`
                              : "transparent",
                            ["--tw-ring-color" as never]: isOn
                              ? `${row.swatch.replace("))", ") / 0.3)")}`
                              : "hsl(var(--border) / 0.4)",
                          }}
                          title={`${channelCounts[row.key]} tagged element${channelCounts[row.key] === 1 ? "" : "s"} on this page`}
                        >
                          {channelCounts[row.key]}
                        </span>
                      </div>
                      <div className="ml-[26px] mt-0.5 text-[10px] text-foreground/85 font-mono">
                        now: {row.desc}
                      </div>
                      <div className="ml-[26px] text-[10px] text-muted-foreground/95 font-mono line-through decoration-muted-foreground/40">
                        was: {row.was}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Sticky footer — counts always visible at the bottom of the
                panel, plus an Export action that snapshots the current
                state as JSON. */}
            <div className="px-3 py-2.5 border-t border-primary/15 bg-background/95 backdrop-blur-md text-[10px] normal-case tracking-normal flex items-center justify-between gap-2">
              <span className="text-muted-foreground/95">
                <span
                  className="font-mono tabular-nums text-foreground font-semibold"
                  aria-live="polite"
                >
                  {visibleTotal}
                </span>{" "}
                visible · <span className="font-mono tabular-nums">{activeCount}/{ALL_KEYS.length}</span> ch.
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                />
                <button
                  onClick={handleImportClick}
                  title="Import a previously exported diff JSON"
                  className="group inline-flex items-center gap-1.5 rounded-[5px] border border-primary/20 bg-background/60 px-2 py-1 text-[10px] text-foreground/95 hover:bg-primary/10 hover:border-primary/40 transition-colors"
                >
                  <Upload
                    className="h-2.5 w-2.5 transition-transform group-hover:-translate-y-[1px] duration-200"
                    strokeWidth={2}
                  />
                  Import
                </button>
                {/* Segmented export — choose scope before downloading.
                    "Visible" = only elements intersecting the viewport now,
                    "All" = every tagged element across active channels. */}
                <div
                  className="inline-flex items-stretch rounded-[5px] border border-primary/20 bg-primary/[0.06] overflow-hidden"
                  role="group"
                  aria-label="Export scope"
                >
                  <button
                    onClick={() => handleExport("viewport")}
                    disabled={activeCount === 0}
                    title="Export only elements currently visible in the viewport"
                    className="group inline-flex items-center gap-1 px-2 py-1 text-[10px] text-foreground/95 hover:bg-primary/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Download
                      className="h-2.5 w-2.5 transition-transform group-hover:translate-y-[1px] duration-200"
                      strokeWidth={2}
                    />
                    Visible
                  </button>
                  <span aria-hidden className="w-px bg-primary/20" />
                  <button
                    onClick={() => handleExport("all")}
                    disabled={activeCount === 0}
                    title="Export every tagged element across active channels (incl. off-screen)"
                    className="inline-flex items-center px-2 py-1 text-[10px] text-foreground/95 hover:bg-primary/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    All
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toggle pill — rendered AFTER the panel so it anchors to the
            bottom of the fixed column. Panel grows upward from here. */}
        <button
          onClick={handleOpenToggle}
          className={`inline-flex items-center gap-2 rounded-[6px] border px-3 py-1.5 backdrop-blur transition-colors ${
            open
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-primary/20 bg-background/80 text-muted-foreground/95 hover:text-foreground"
          }`}
          title="Toggle bundle DESIGN_2 diff overlay"
        >
          {open ? (
            <EyeOff className="h-3 w-3" strokeWidth={2} />
          ) : (
            <Eye className="h-3 w-3 animate-icon-breathe" strokeWidth={2} />
          )}
          show diff
          {open && (
            <span
              className="ml-1 inline-flex h-4 min-w-[18px] items-center justify-center rounded-[3px] bg-primary/25 px-1 tabular-nums text-[9.5px] tracking-normal font-semibold"
              title={`${visibleTotal} highlighted element${visibleTotal === 1 ? "" : "s"} across ${activeCount} channel${activeCount === 1 ? "" : "s"}`}
              aria-live="polite"
            >
              {visibleTotal}
            </span>
          )}
        </button>
      </div>

      {pendingImport && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="diff-import-preview-title"
        >
          <button
            type="button"
            aria-label="Cancel import"
            onClick={cancelImport}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-[12px] border border-primary/15 bg-background/95 backdrop-blur-md ring-1 ring-inset ring-primary/10 shadow-[0_24px_60px_-20px_hsl(252_90%_30%/0.55)] overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/95">
                Confirm import
              </div>
              <h2
                id="diff-import-preview-title"
                className="mt-1 font-serif text-[20px] leading-tight text-foreground/95"
              >
                Apply <span className="italic">{pendingImport.fileName}</span>?
              </h2>
              <p className="mt-2 text-[12px] text-muted-foreground/95 leading-relaxed">
                The current channel selection will be replaced with the snapshot
                below. Highlighting on the page will update immediately.
              </p>
            </div>

            <div className="px-5 pb-3 space-y-3">
              <div className="rounded-[8px] border border-primary/15 bg-background/40">
                <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/95">
                    Channels to activate
                  </span>
                  <span className="font-mono tabular-nums text-[10.5px] text-foreground/95">
                    {pendingImport.channels.length}/{ALL_KEYS.length}
                  </span>
                </div>
                <ul className="px-3 py-2 space-y-1.5">
                  {LEGEND.map((row) => {
                    const willActivate = pendingImport.channels.includes(row.key);
                    const count = pendingImport.elementsByChannel[row.key];
                    return (
                      <li
                        key={row.key}
                        className="flex items-center gap-2 text-[12px]"
                      >
                        <span
                          aria-hidden
                          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] ring-1 ring-inset"
                          style={{
                            backgroundColor: willActivate ? row.swatch : "transparent",
                            ["--tw-ring-color" as never]: willActivate
                              ? row.swatch
                              : "hsl(var(--border) / 0.6)",
                          }}
                        >
                          {willActivate && (
                            <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />
                          )}
                        </span>
                        <span
                          className={
                            willActivate
                              ? "text-foreground/95"
                              : "text-muted-foreground/70 line-through decoration-muted-foreground/40"
                          }
                        >
                          {row.label}
                        </span>
                        <span className="ml-auto font-mono tabular-nums text-[10.5px] text-muted-foreground/95">
                          {count} el.
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {(() => {
                const totalsByMode: Record<ImportMode, number> = {
                  all: pendingImport.channels.reduce((s, k) => s + pendingImport.elementsByChannel[k], 0),
                  visible: pendingImport.channels.reduce((s, k) => s + pendingImport.visibleByChannel[k], 0),
                  "off-screen": pendingImport.channels.reduce((s, k) => s + pendingImport.offscreenByChannel[k], 0),
                };
                const modes: Array<{ key: ImportMode; label: string; hint: string }> = [
                  { key: "all", label: "All", hint: "Every element in the snapshot" },
                  { key: "visible", label: "Visible only", hint: "Only inViewport: true" },
                  { key: "off-screen", label: "Off-screen", hint: "Only inViewport: false" },
                ];
                return (
                  <div className="rounded-[8px] border border-primary/15 bg-background/40">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/95">
                        Restore mode
                      </span>
                      <span className="font-mono tabular-nums text-[10.5px] text-foreground/95">
                        {totalsByMode[pendingImport.importMode]} highlight
                        {totalsByMode[pendingImport.importMode] === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="px-2 py-2 grid grid-cols-3 gap-1.5">
                      {modes.map((m) => {
                        const isOn = pendingImport.importMode === m.key;
                        return (
                          <button
                            key={m.key}
                            onClick={() => setImportMode(m.key)}
                            title={m.hint}
                            aria-pressed={isOn}
                            className={`flex flex-col items-start gap-0.5 rounded-[6px] px-2 py-1.5 text-left ring-1 ring-inset transition-colors ${
                              isOn
                                ? "bg-primary/[0.10] ring-primary/30"
                                : "ring-transparent hover:bg-secondary/40 hover:ring-border/40"
                            }`}
                          >
                            <span className={`text-[11.5px] ${isOn ? "text-foreground/95" : "text-muted-foreground/95"}`}>
                              {m.label}
                            </span>
                            <span className="font-mono tabular-nums text-[10px] text-muted-foreground/90">
                              {totalsByMode[m.key]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Per-element preview — every node that will receive an
                  outline once the snapshot is applied, filtered by both
                  the active channels and the selected restore mode.
                  Scrolls internally so very long lists stay tidy. */}
              {(() => {
                const swatchByKey = Object.fromEntries(
                  LEGEND.map((l) => [l.key, l.swatch]),
                ) as Record<Key, string>;
                const labelByKey = Object.fromEntries(
                  LEGEND.map((l) => [l.key, l.label]),
                ) as Record<Key, string>;
                const previewItems = pendingImport.elements.filter((el) => {
                  if (!pendingImport.channels.includes(el.channel)) return false;
                  if (pendingImport.importMode === "visible" && !el.inViewport)
                    return false;
                  if (pendingImport.importMode === "off-screen" && el.inViewport)
                    return false;
                  return true;
                });
                const MAX_SHOWN = 40;
                const shown = previewItems.slice(0, MAX_SHOWN);
                const hidden = previewItems.length - shown.length;
                return (
                  <div className="rounded-[8px] border border-primary/15 bg-background/40">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/95">
                        Elements to highlight
                      </span>
                      <span className="font-mono tabular-nums text-[10.5px] text-foreground/95">
                        {previewItems.length}
                      </span>
                    </div>
                    {previewItems.length === 0 ? (
                      <div className="px-3 py-3 text-[11px] text-muted-foreground/95">
                        Nothing matches the current channels and restore mode.
                      </div>
                    ) : (
                      <ul className="max-h-[180px] overflow-y-auto divide-y divide-primary/[0.08]">
                        {shown.map((el, i) => {
                          const swatch = swatchByKey[el.channel];
                          const label = labelByKey[el.channel];
                          const summary =
                            el.text ||
                            (el.id ? `#${el.id}` : null) ||
                            (el.tag ? `<${el.tag}>` : "(unnamed element)");
                          return (
                            <li
                              key={`${el.channel}-${el.index}-${i}`}
                              className="flex items-center gap-2 px-3 py-1.5"
                            >
                              <span
                                aria-hidden
                                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: swatch }}
                              />
                              <span
                                className="font-mono text-[9.5px] uppercase tracking-[0.14em] shrink-0 w-[58px]"
                                style={{ color: swatch }}
                                title={label}
                              >
                                {el.channel}
                              </span>
                              <span className="text-[11px] text-foreground/90 truncate flex-1" title={summary}>
                                {summary}
                              </span>
                              <span className="font-mono tabular-nums text-[9.5px] text-muted-foreground/80 shrink-0">
                                {el.tag ?? "—"}
                              </span>
                              <span
                                className={`font-mono text-[9.5px] uppercase tracking-[0.14em] shrink-0 w-[34px] text-right ${
                                  el.inViewport
                                    ? "text-[hsl(var(--tint-mint-fg))]"
                                    : "text-muted-foreground/70"
                                }`}
                                title={el.inViewport ? "In viewport at export time" : "Off-screen at export time"}
                              >
                                {el.inViewport ? "vis" : "off"}
                              </span>
                            </li>
                          );
                        })}
                        {hidden > 0 && (
                          <li className="px-3 py-1.5 text-[10.5px] text-muted-foreground/95 font-mono">
                            + {hidden} more · scroll within this list to see all when expanded
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })()}

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <dt className="font-mono uppercase tracking-[0.16em] text-[9.5px] text-muted-foreground/95">
                  Highlights
                </dt>
                <dd className="font-mono tabular-nums text-foreground/95 text-right">
                  {pendingImport.totalElements}
                </dd>
                <dt className="font-mono uppercase tracking-[0.16em] text-[9.5px] text-muted-foreground/95">
                  In file
                </dt>
                <dd className="font-mono tabular-nums text-muted-foreground/95 text-right">
                  {pendingImport.elementsInFile}
                </dd>
                {pendingImport.scope && (
                  <>
                    <dt className="font-mono uppercase tracking-[0.16em] text-[9.5px] text-muted-foreground/95">
                      Scope
                    </dt>
                    <dd className="font-mono text-muted-foreground/95 text-right">
                      {pendingImport.scope}
                    </dd>
                  </>
                )}
                {pendingImport.exportedAt && (
                  <>
                    <dt className="font-mono uppercase tracking-[0.16em] text-[9.5px] text-muted-foreground/95">
                      Exported
                    </dt>
                    <dd className="font-mono text-muted-foreground/95 text-right truncate">
                      {pendingImport.exportedAt.replace("T", " ").slice(0, 19)}
                    </dd>
                  </>
                )}
              </dl>

              {pendingImport.skippedChannels.length > 0 && (
                <div className="rounded-[6px] border border-[hsl(var(--tint-amber-fg)/0.3)] bg-[hsl(var(--tint-amber-fg)/0.06)] px-3 py-2 text-[11px] text-foreground/85">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[hsl(var(--tint-amber-fg))]">
                    Skipped
                  </span>{" "}
                  {pendingImport.skippedChannels.length} unknown channel
                  {pendingImport.skippedChannels.length === 1 ? "" : "s"}:{" "}
                  <span className="font-mono">
                    {pendingImport.skippedChannels.join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-primary/15 bg-background/60 flex items-center justify-between gap-2">
              {/* Two-step clear: first click counts the live tags and
                  surfaces a confirm/cancel pair; second click commits.
                  Stays harmless when there's nothing to remove. */}
              {clearConfirm === null ? (
                <button
                  onClick={() => {
                    const count = document.querySelectorAll("[data-diff-imported]").length;
                    if (count === 0) {
                      toast({
                        title: "Nothing to clear",
                        description: "No imported element tags are currently active.",
                      });
                      return;
                    }
                    setClearConfirm({ count });
                  }}
                  title="Remove data-diff-imported tags and scoped highlighting"
                  className="group inline-flex items-center gap-1.5 rounded-[5px] border border-border/40 bg-background/60 px-2.5 py-1.5 text-[11px] text-muted-foreground/95 hover:text-foreground hover:bg-secondary/50 hover:border-border/60 transition-colors"
                >
                  <Eraser
                    className="h-3 w-3 transition-transform group-hover:rotate-[-8deg] duration-200"
                    strokeWidth={2}
                  />
                  Clear element filter
                </button>
              ) : (
                <div
                  className="inline-flex items-center gap-1.5 rounded-[5px] border border-[hsl(var(--tint-amber-fg)/0.35)] bg-[hsl(var(--tint-amber-fg)/0.08)] pl-2.5 pr-1 py-1 text-[11px] text-foreground/95"
                  role="alertdialog"
                  aria-label="Confirm clear element filter"
                >
                  <Eraser
                    className="h-3 w-3 text-[hsl(var(--tint-amber-fg))]"
                    strokeWidth={2}
                  />
                  <span>
                    Remove{" "}
                    <span className="font-mono tabular-nums font-semibold">
                      {clearConfirm.count}
                    </span>{" "}
                    tag{clearConfirm.count === 1 ? "" : "s"}?
                  </span>
                  <button
                    onClick={() => {
                      const snapshot = clearImportFilter(true);
                      setClearConfirm(null);
                      const removed = snapshot?.nodes.length ?? 0;
                      // Undo is valid for UNDO_WINDOW_MS after the toast
                      // appears. After that the snapshot is forgotten and
                      // any click on the (already-dismissed) Undo button
                      // surfaces a clear "expired" message instead of
                      // silently re-tagging stale nodes.
                      const UNDO_WINDOW_MS = 10_000;
                      const expiresAt = Date.now() + UNDO_WINDOW_MS;
                      let snapshotRef: typeof snapshot | null = snapshot;
                      // Drop the captured nodes from memory once expired
                      // so the closure doesn't pin them indefinitely.
                      const expiryTimer = window.setTimeout(() => {
                        snapshotRef = null;
                      }, UNDO_WINDOW_MS);
                      toast({
                        title: "Element filter cleared",
                        description: `Removed ${removed} scoped tag${removed === 1 ? "" : "s"} — Undo available for ${UNDO_WINDOW_MS / 1000}s.`,
                        // Auto-dismiss the toast itself at the same
                        // moment the action expires so the UI stays honest.
                        duration: UNDO_WINDOW_MS,
                        action:
                          snapshot && removed > 0 ? (
                            <ToastAction
                              altText="Undo clear element filter"
                              onClick={() => {
                                if (Date.now() > expiresAt || !snapshotRef) {
                                  toast({
                                    title: "Undo expired",
                                    description: `The ${UNDO_WINDOW_MS / 1000}-second undo window has passed. Re-import the snapshot to restore the filter.`,
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                window.clearTimeout(expiryTimer);
                                const restored = restoreImportFilter(snapshotRef);
                                snapshotRef = null;
                                toast({
                                  title:
                                    restored === removed
                                      ? "Element filter restored"
                                      : "Element filter partially restored",
                                  description:
                                    restored === removed
                                      ? `Re-applied ${restored} scoped tag${restored === 1 ? "" : "s"}.`
                                      : `Re-applied ${restored} of ${removed} tags — ${removed - restored} element${removed - restored === 1 ? "" : "s"} no longer in the DOM.`,
                                });
                              }}
                            >
                              Undo
                            </ToastAction>
                          ) : undefined,
                      });
                    }}
                    className="ml-1 inline-flex items-center gap-1 rounded-[4px] border border-[hsl(var(--tint-amber-fg)/0.45)] bg-[hsl(var(--tint-amber-fg)/0.18)] px-2 py-0.5 text-[11px] text-foreground hover:bg-[hsl(var(--tint-amber-fg)/0.28)] transition-colors"
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                    Confirm
                  </button>
                  <button
                    onClick={() => setClearConfirm(null)}
                    className="rounded-[4px] px-2 py-0.5 text-[11px] text-muted-foreground/95 hover:text-foreground hover:bg-background/60 transition-colors"
                  >
                    Keep
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelImport}
                  className="rounded-[5px] px-3 py-1.5 text-[12px] text-muted-foreground/95 hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmImport}
                  className="inline-flex items-center gap-1.5 rounded-[5px] border border-primary/30 bg-primary/15 px-3 py-1.5 text-[12px] text-primary hover:bg-primary/25 transition-colors"
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                  Apply snapshot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{channelCss}</style>
    </>
  );
}

// Builds the CSS for outlines + corner labels per channel. Kept as a
// function so each key contributes its own selector pair without a giant
// hand-typed wall.
function buildChannelCss() {
  const base = `
    html[data-bundle-diff-keys] [data-diff] { position: relative; }
    html[data-bundle-diff-keys] [data-diff]::after {
      content: attr(data-diff);
      position: absolute;
      top: -10px;
      left: 8px;
      z-index: 50;
      padding: 1px 6px;
      border-radius: 4px;
      font-family: ui-monospace, monospace;
      font-size: 9px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: hsl(var(--background));
      pointer-events: none;
      opacity: 0;
      transition: opacity 160ms ease;
    }
    [data-diff="surface"] { --diff-color: hsl(var(--tint-violet-fg)); }
    [data-diff="radius"]  { --diff-color: hsl(var(--tint-mint-fg)); }
    [data-diff="accent"]  { --diff-color: hsl(var(--tint-amber-fg)); }
    [data-diff="text"]    { --diff-color: hsl(var(--tint-rose-fg)); }
    [data-diff="motion"]  { --diff-color: hsl(var(--primary)); }
  `;
  const perKey = ["surface", "radius", "accent", "text", "motion"]
    .map(
      (k) => `
        html[data-bundle-diff-keys~="${k}"]:not([data-bundle-diff-filter="imported"]) [data-diff="${k}"],
        html[data-bundle-diff-keys~="${k}"][data-bundle-diff-filter="imported"] [data-diff="${k}"][data-diff-imported] {
          outline: 2px dashed var(--diff-color, hsl(var(--primary)));
          outline-offset: 4px;
          border-radius: 4px;
        }
        html[data-bundle-diff-keys~="${k}"]:not([data-bundle-diff-filter="imported"]) [data-diff="${k}"]::after,
        html[data-bundle-diff-keys~="${k}"][data-bundle-diff-filter="imported"] [data-diff="${k}"][data-diff-imported]::after {
          opacity: 1;
          background: var(--diff-color, hsl(var(--primary)));
        }
      `,
    )
    .join("\n");
  return base + perKey;
}
