import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  Check,
  Pencil,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleAlert,
  ArrowLeft,
  PackageOpen,
  Send,
  ExternalLink,
  Copy,
  BellOff,
  ArrowRight,
  Camera,
  Hash,
  FileText,
  Globe,
  Timer,
  Mail,
  Phone,
  Star,
  Server,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  parseSlaMinutes,
  type CaseEventActor,
} from "@/data/workspace";
import {
  applyRequestOverrides,
  recordDocRequest,
  useCaseRequests,
} from "@/data/sessionRequests";
import { OwnerAvatar } from "./OwnerAvatar";
import { CountryChip, countryFlag, countryTimeHint } from "./CountryChip";
import { STATUS_META } from "@/data/nodes";
import { RequestDocSheet } from "./RequestDocSheet";
import { StageIcon } from "./StageIcon";
import { AwaitingClientSheet } from "./AwaitingClientSheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useVipCases } from "@/hooks/useVipCases";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";
import {
  buildCaseBundlePath,
  buildCaseEvidencePath,
  buildCaseRuntimeSupportPath,
  buildCaseVaultPath,
} from "@/lib/case-artifact-links";
import {
  buildRuntimeSessionReplaySummary,
  fetchRuntimeSessionReplay,
  type RuntimeSessionReplaySummary,
} from "@/lib/runtime-session-replay";

// Format an ISO timestamp into a compact "Jun 24 · 14:00" label for the timeline.
const formatEventTime = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${date} · ${time}`;
};

// Each actor gets a distinct tint so the operator can scan who did what.
const actorTint: Record<CaseEventActor, string> = {
  AI:       "hsl(var(--tint-violet-fg))",
  Client:   "hsl(var(--tint-amber-fg))",
  Operator: "hsl(var(--tint-rose-fg))",
  System:   "hsl(var(--tint-slate-fg))",
};

const docIcon = (s: string) => {
  if (s === "ok") return <CircleCheck className="h-3 w-3 text-success" strokeWidth={1.75} />;
  if (s === "missing") return <CircleDashed className="h-3 w-3 text-destructive" strokeWidth={1.75} />;
  return <CircleAlert className="h-3 w-3 text-primary" strokeWidth={1.75} />;
};

// Compact "now / Nh / Nd" age label — matches the Live Desk badge so operators
// see consistent staleness vocabulary across surfaces.
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

// Once a request has been waiting longer than this it shifts to the rose tint
// to signal "stale — chase the client". Mirrors the Live Desk threshold.
const REQUESTED_STALE_MS = 24 * 60 * 60 * 1000;

function formatStatusLabel(value: string | null | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.replace(/[_-]+/g, " ").trim();
}

function toneForReplay(summary: RuntimeSessionReplaySummary | null): "mint" | "rose" | "violet" | "slate" {
  if (!summary) {
    return "slate";
  }
  if (summary.resumeReady === false || summary.approvalGateStatus === "pending") {
    return "rose";
  }
  if (summary.replayState === "verified" || summary.resumeReady === true) {
    return "mint";
  }
  return "violet";
}

interface ConsoleStageProps {
  caseRef?: string;
}

export const ConsoleStage = ({ caseRef = "VS-2841" }: ConsoleStageProps) => {
  const { deviceNodes, getCaseByRef, getCaseWikiByRef } = useWorkspaceRuntime();
  // Tab selection — defaults are picked by the smart-default effect below
  // based on whether the case has missing docs. Initial values here are just
  // placeholders before the case is resolved.
  const [showHistory, setShowHistory] = useState(false);
  const [showWiki, setShowWiki] = useState(true);
  // "Why this tab?" subtle hint shown next to the tab-row when smart-default
  // auto-opened Documents because there are missing docs. Auto-dismisses on
  // first manual tab switch or after a few seconds — see effect below.
  const [autoOpenedHint, setAutoOpenedHint] = useState(false);
  // Pause the auto-dismiss timeout while the operator is hovering the hint
  // so they have all the time they need to scan the missing-doc names.
  const [hintHovered, setHintHovered] = useState(false);
  const [requestDoc, setRequestDoc] = useState<string | null>(null);
  const [awaitingDoc, setAwaitingDoc] = useState<string | null>(null);
  // Bulk request: which missing docs the operator has ticked, plus the
  // committed list passed into the sheet when "Request all" is clicked.
  const [selectedMissing, setSelectedMissing] = useState<Set<string>>(() => new Set());
  const [bulkDocs, setBulkDocs] = useState<string[] | null>(null);
  // Transient ring around a doc row after the operator clicked its name in
  // the smart-default hint. Cleared after a short flash.
  const [highlightedDoc, setHighlightedDoc] = useState<string | null>(null);
  // After Approve & send: card flips to a brief success-state, header dims,
  // then we redirect. Local-only — no fake business resolution.
  const [isApproving, setIsApproving] = useState(false);
  // Transient success state on the contact-tooltip copy actions: which
  // identifier was just copied. Reverts after 600ms so the icon swap
  // (Mail/Phone/Hash → Check) reads as a confirmation, not a mode change.
  const [copiedKey, setCopiedKey] = useState<"email" | "phone" | "ref" | null>(null);
  const copyResetRef = useRef<number | null>(null);
  const flashCopied = (key: "email" | "phone" | "ref") => {
    setCopiedKey(key);
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopiedKey(null), 600);
  };
  useEffect(() => () => {
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
  }, []);

  // VIP marker — persisted per case-ref via localStorage. The toggle lives
  // in the client tooltip; the badge surfaces on the initials tile so the
  // status is visible even when the tooltip is closed.
  const { isVip, toggleVip } = useVipCases();

  // Stable DOM-id for a doc row — derived from name so the hint can
  // scrollIntoView and the row can react to the highlight state.
  const docRowId = (name: string) =>
    `doc-row-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

  // Click handler for hint chips: switch to Documents tab, scroll to the
  // row, and flash a ring. Uses requestAnimationFrame so the tab content
  // mounts before we try to scroll.
  const focusDocRow = (name: string) => {
    setShowWiki(true);
    setShowHistory(false);
    setAutoOpenedHint(false);
    setHighlightedDoc(name);
    requestAnimationFrame(() => {
      const el = document.getElementById(docRowId(name));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => setHighlightedDoc((cur) => (cur === name ? null : cur)), 1800);
  };
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep-link target — when a caller (e.g. the "N requested" badge on the
  // Live Desk row) wants the operator to land directly on the Documents
  // section, they pass `?focus=documents`. We force the wiki open and
  // scroll the section into view on mount / param change.
  const focusTarget = searchParams.get("focus");
  const docsAnchorRef = useRef<HTMLButtonElement>(null);

  // Approve & send: flip the approval card to a success-state, dim the header
  // chrome (so signals like SLA/awaiting don't read as still-actionable), then
  // redirect back to the Live Desk. The 800ms window lets the operator see
  // their action confirmed locally before the route swap.
  const handleApprove = () => {
    if (!c) return;
    setIsApproving(true);
    toast.success(`Handoff sent · ${c.ref} · ${c.client}`);
    setTimeout(() => navigate("/app"), 800);
  };

  // Resolve case from the workspace dataset, then layer on any operator
  // requests issued during this session (missing→review + timeline events).
  const baseCase = getCaseByRef(caseRef);
  const sessionReqs = useCaseRequests(caseRef);
  const c = baseCase ? applyRequestOverrides(baseCase, sessionReqs) : undefined;
  const wiki = getCaseWikiByRef(c?.caseId ?? c?.sessionId ?? null);
  const sessionId = c?.sessionId ?? wiki?.sessionId ?? null;
  const replayQuery = useQuery({
    queryKey: ["app-shell", "console-stage-session-replay", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchRuntimeSessionReplay(sessionId ?? ""),
    staleTime: 30_000,
    retry: 1,
  });
  const replaySummary = buildRuntimeSessionReplaySummary(replayQuery.data);
  const runtimeSupportPath = buildCaseRuntimeSupportPath(c);
  const remediationDraft = wiki?.operatorPreviewPack?.remediation?.draft ?? null;
  const exportReady =
    wiki?.operatorPreviewPack?.compliance?.enforcement?.exportReady ??
    wiki?.compliance?.enforcement?.exportReady;
  const exportStatusLabel =
    exportReady === false
      ? "Export blocked"
      : exportReady === true
        ? "Export ready"
        : "Export waiting";
  const exportTone: "mint" | "rose" | "violet" | "slate" =
    exportReady === false ? "rose" : exportReady === true ? "mint" : "slate";
  const proofSigned = wiki?.evidenceSignature?.status === "signed";
  const proofPublished = proofSigned || Boolean(replaySummary?.latestProofSummary);
  const proofStatusLabel = proofSigned
    ? "Proof signed"
    : proofPublished
      ? "Proof published"
      : "Proof pending";
  const proofTone: "mint" | "rose" | "violet" | "slate" = proofSigned
    ? "mint"
    : proofPublished
      ? "violet"
      : "slate";
  const replayStatusLabel = replayQuery.isLoading
    ? "Replay loading"
    : formatStatusLabel(replaySummary?.replayState, "Replay waiting");
  const replayTone = replayQuery.isLoading ? "slate" : toneForReplay(replaySummary);
  const gatePending = replaySummary?.approvalGateStatus === "pending";
  const replayNeedsAttention =
    Boolean(sessionId) &&
    !replayQuery.isLoading &&
    (!replaySummary ||
      (replaySummary.replayState !== "verified" &&
        replaySummary.resumeReady !== true));
  const runtimeSupportItems: Array<{
    label: string;
    tone: "mint" | "rose" | "violet" | "slate";
    dot?: boolean;
  }> = [];
  if (exportReady !== true) {
    runtimeSupportItems.push({ label: exportStatusLabel, tone: exportTone, dot: true });
  }
  if (!proofPublished) {
    runtimeSupportItems.push({ label: proofStatusLabel, tone: proofTone, dot: true });
  }
  if (replayNeedsAttention) {
    runtimeSupportItems.push({ label: replayStatusLabel, tone: replayTone, dot: true });
  }
  if (gatePending) {
    runtimeSupportItems.push({ label: "Gate pending", tone: "rose" });
  }
  const showRuntimeSupportStrip = runtimeSupportItems.length > 0;
  const runtimeSupportCta = exportReady !== true
    ? remediationDraft
      ? {
          label: "Inspect compliance blocker",
          to: buildCaseRuntimeSupportPath(c, "case-wiki"),
        }
      : {
          label: exportReady === false ? "Inspect export block" : "Inspect export posture",
          to: buildCaseRuntimeSupportPath(c, "session-ops"),
        }
    : !proofPublished
      ? signatureStatus === "unsigned"
        ? {
            label: "Inspect unsigned proof",
            to: buildCaseRuntimeSupportPath(c, "case-wiki"),
          }
        : {
            label: "Inspect missing proof",
            to: buildCaseRuntimeSupportPath(c, "connections"),
          }
      : gatePending
        ? {
            label: "Inspect replay gate",
            to: buildCaseRuntimeSupportPath(c, "connections"),
          }
        : replayNeedsAttention
          ? {
              label: "Inspect replay",
              to: buildCaseRuntimeSupportPath(c, "connections"),
            }
          : {
              label: "Runtime support",
              to: runtimeSupportPath,
            };

  // List of doc names currently in `missing` state — drives the bulk bar.
  // Computed unconditionally so hook order stays stable across renders.
  const missingDocs = useMemo(
    () => c?.documents.filter((d) => d.state === "missing").map((d) => d.name) ?? [],
    [c?.documents],
  );
  const missingSet = useMemo(() => new Set(missingDocs), [missingDocs]);

  // Map doc-name → ISO timestamp of the latest request (resentAt wins over
  // the original `at` so a nudge resets the staleness clock). Drives the
  // violet left-border + "requested · 3d ago" hint on each requested-doc
  // row, so an operator who deep-links from the Live Desk badge sees at a
  // glance which lines are waiting on a client reply.
  const requestedAt = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of sessionReqs) {
      if (r.received) continue;
      map.set(r.doc, r.resentAt ?? r.at);
    }
    return map;
  }, [sessionReqs]);
  // Re-evaluated each render so the relative-age label stays fresh between
  // navigations; fine because the parent only re-renders on data changes.
  const NOW_MS = Date.now();

  // Reconcile selection whenever the missing set shrinks — once a doc flips
  // out of missing (request sent, marked received), drop it from the tick set
  // so the count stays accurate.
  useEffect(() => {
    setSelectedMissing((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const name of prev) {
        if (missingSet.has(name)) next.add(name);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [missingSet]);

  // Honour `?focus=documents` deep-link: ensure the wiki is expanded and
  // smoothly scroll the Documents header into view. Re-runs when the case or
  // focus target changes so navigating between cases keeps working.
  useEffect(() => {
    if (focusTarget !== "documents") return;
    setShowWiki(true);
    setShowHistory(false);
    // Defer to next frame so the section is mounted before we scroll.
    const id = requestAnimationFrame(() => {
      docsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [focusTarget, caseRef]);

  // Smart default tab — when the operator switches between cases without an
  // explicit ?focus deep-link, show the tab that matters most: Documents if
  // there are missing docs to action, otherwise Case history (read-only
  // overview). Skipped when ?focus=documents is set so the deep-link wins.
  // Track which caseRef we've already applied the smart-default for, so we
  // run the logic exactly once per case once it's actually resolved (instead
  // of running on the first render when `c` is still undefined and
  // missingDocs is empty, which would always force history + no-hint).
  const smartDefaultAppliedFor = useRef<string | null>(null);
  useEffect(() => {
    if (focusTarget === "documents") return;
    if (!c) return;
    if (smartDefaultAppliedFor.current === caseRef) return;
    smartDefaultAppliedFor.current = caseRef;
    if (missingDocs.length > 0) {
      setShowWiki(true);
      setShowHistory(false);
      // Surface the "why this tab?" hint only when smart-default opened
      // Documents on operator's behalf — i.e. they didn't pick it themselves.
      setAutoOpenedHint(true);
    } else {
      setShowWiki(false);
      setShowHistory(true);
      setAutoOpenedHint(false);
    }
  }, [caseRef, focusTarget, c, missingDocs.length]);

  // Auto-dismiss the smart-default hint after 12s so it doesn't linger.
  // Manual tab switches dismiss it instantly via the click handlers below.
  // Hovering the hint pauses the timer — the effect re-runs on hover state
  // change, so leaving the hint restarts a fresh 12s window.
  useEffect(() => {
    if (!autoOpenedHint || hintHovered) return;
    const id = window.setTimeout(() => setAutoOpenedHint(false), 12000);
    return () => window.clearTimeout(id);
  }, [autoOpenedHint, hintHovered]);

  // ⌘1 / ⌘2 — quick-switch between Case history and Documents tabs.
  // Skipped when focus is in an editable field (input/textarea/contentEditable)
  // or when a sheet/dialog has the focus, so we don't hijack typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      const inEditable =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);

      // ⌘↵ — Approve & send the pending approval. Skipped while typing in
      // the draft (operator may want a literal newline) or when no approval
      // is pending / already submitting.
      if (e.key === "Enter") {
        if (inEditable) return;
        if (!c?.approval || isApproving) return;
        // Don't fire when a sheet/dialog is open over the console.
        if (document.querySelector('[role="dialog"][data-state="open"]')) return;
        e.preventDefault();
        handleApprove();
        return;
      }

      if (e.key !== "1" && e.key !== "2") return;
      if (inEditable) return;
      e.preventDefault();
      setAutoOpenedHint(false);
      if (e.key === "1") {
        setShowHistory(true);
        setShowWiki(false);
      } else {
        setShowWiki(true);
        setShowHistory(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.ref, c?.approval, isApproving]);

  // Empty state — operator landed on a ref we don't know.
  if (!c) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-8 py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-secondary/40 ring-1 ring-inset ring-border flex items-center justify-center mb-5">
          <PackageOpen className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <h2 className="font-serif text-2xl tracking-tight">Case not found</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          We couldn't find a case matching{" "}
          <span className="font-mono text-foreground/80">{caseRef}</span>. It may
          have been resolved, archived, or the link is stale.
        </p>
        <Button
          asChild
          variant="ghost"
          className="mt-6 h-9 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <Link to="/app">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
            Back to Live Desk
          </Link>
        </Button>
      </div>
    );
  }

  const toggleMissing = (name: string) =>
    setSelectedMissing((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const selectAllMissing = () => setSelectedMissing(new Set(missingDocs));
  const clearMissingSelection = () => setSelectedMissing(new Set());

  const openBulkRequest = () => {
    // Snapshot the current selection so the sheet's draft is stable while
    // open, even if the underlying missingDocs changes mid-flow.
    const docs = missingDocs.filter((d) => selectedMissing.has(d));
    if (docs.length === 0) return;
    setBulkDocs(docs);
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {/* ─── Hero header ───────────────────────────────────────────────────
          Mirrors the RunDetailDrawer / Plan-Lead-Detail rhythm: eyebrow row
          on top, large serif client name as the headline, then a 4-col
          metadata grid below. A 3px SLA-urgency bar on the left edge carries
          the at-a-glance signal Live Desk uses ('this case is burning?'),
          continuing the colour-identity pattern from Simulation Lab cards. */}
      {(() => {
        const slaMins = parseSlaMinutes(c.sla);
        // Urgency hash:
        //   resolved → mint, slaWarn or <1h → rose, <4h → amber, else violet.
        // Keeps the same colour vocabulary the Live Desk uses for its SLA dot.
        const slaHashColor = (() => {
          if (c.status === "resolved") return "hsl(var(--tint-mint-fg))";
          if (c.slaWarn || (slaMins !== null && slaMins < 60))
            return "hsl(var(--tint-rose-fg))";
          if (slaMins !== null && slaMins < 240)
            return "hsl(var(--tint-amber-fg))";
          return "hsl(var(--tint-violet-fg))";
        })();

        const handleCopyRef = () => {
          navigator.clipboard?.writeText(c.ref);
          toast.success(`Copied ${c.ref}`);
        };
        const handleOpenLiveDesk = () => {
          navigate(`/app?focus=${encodeURIComponent(c.ref)}`);
        };
        const handleOpenBundle = () => {
          navigate(buildCaseBundlePath(c));
        };
        const handleOpenEvidence = () => {
          navigate(buildCaseEvidencePath(c));
        };
        const handleOpenCaseVault = () => {
          navigate(buildCaseVaultPath(c));
        };
        const handleSnooze = () => {
          toast(`Snoozed ${c.ref}`, {
            description: "Will resurface in 4h. Not yet wired to a real timer.",
          });
        };

        // Quick action button — 32px circle, hairline border. Same shape as
        // the RunDetailDrawer cluster so the workspace's action vocabulary
        // stays consistent across surfaces.
        const QuickAction = ({
          icon: Icon,
          label,
          onClick,
        }: {
          icon: typeof Copy;
          label: string;
          onClick: () => void;
        }) => (
          <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-secondary/30 transition-smooth focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        );

        // SLA tier label — short word that pairs with the urgency colour so
        // the right-edge SLA block reads as an at-a-glance verdict, not just
        // a countdown.
        const slaTier = (() => {
          if (c.status === "resolved") return "RESOLVED";
          if (c.slaWarn || (slaMins !== null && slaMins < 60)) return "BURNING";
          if (slaMins !== null && slaMins < 240) return "WARM";
          return "ON TRACK";
        })();

        // Initial(s) for the client tile — first letter of each word, max 2.
        const clientInitials = c.client
          .split(/\s+/)
          .map((w) => w[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();

        // Real contact info from the case payload — surfaced via the
        // initials-tile tooltip in the hero header.
        const clientEmail = c.email;
        const clientPhone = c.phone;
        const clientTime = countryTimeHint(c.country);

        return (
          <header
            id="action-queue"
            className={`relative scroll-mt-24 px-8 pt-7 pb-7 border-b border-border overflow-hidden transition-opacity duration-500 ${isApproving ? "opacity-40 pointer-events-none" : "opacity-100"}`}
          >
            {/* SLA urgency hash bar — 3px, full-height, on the left edge. */}
            <span
              aria-hidden
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ backgroundColor: slaHashColor }}
            />

            {/* VIP priority accent — 1px amber rule sitting just inside the
                SLA hash bar. Mirrors the Live Desk row marker so VIP status
                reads identically across surfaces without competing with the
                SLA urgency colour for the very first pixel. */}
            {isVip(c.ref) && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-[3px] top-0 bottom-0 w-px"
                style={{ backgroundColor: "hsl(var(--tint-amber-fg))" }}
              />
            )}

            {/* Removed ambient SLA glow — keeping the hero quiet, signals
                live in the SLA chip on the right. */}

            {/* Eyebrow row — section label + stage chip with icon + ambient
                "N awaiting" signal pulled up from the section below. */}
            <div className="relative flex items-center gap-2 mb-5">
              <span className="text-[10px] uppercase tracking-[0.22em] text-primary font-medium">
                Operator Console · Case
              </span>
              <span aria-hidden className="text-border">/</span>
              <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-secondary/40 border border-border/40 text-[10.5px] uppercase tracking-[0.16em] text-foreground/85">
                <StageIcon stage={c.stage} />
                {c.stage}
              </span>
              {missingDocs.length > 0 && (
                <span
                  className="ml-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-mono"
                  style={{ color: "hsl(var(--tint-rose-fg))" }}
                >
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full animate-pulse-dot"
                    style={{ backgroundColor: "hsl(var(--tint-rose-fg))" }}
                  />
                  {missingDocs.length} awaiting client
                </span>
              )}
            </div>

            {/* Main row — client identity on the left, SLA hero on the right. */}
            <div className="relative flex items-start gap-6">
              {/* Client block: large initials tile + serif name + meta-pills. */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-4">
                  {/* Initials tile — violet-tinted, hairline border, mono.
                      Hover surfaces the contact card (name + email + phone),
                      so the tile doubles as a quick-glance identity sheet. */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="relative shrink-0 inline-flex items-center justify-center h-12 w-12 rounded-xl font-mono text-[15px] tracking-tight ring-1 ring-inset ring-border/50 transition-smooth hover:ring-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                        style={{
                          backgroundColor: "hsl(var(--tint-violet) / 0.10)",
                          color: "hsl(var(--tint-violet-fg))",
                        }}
                        aria-label={`Contact details for ${c.client}${isVip(c.ref) ? " · VIP" : ""}`}
                      >
                        {clientInitials}
                        {isVip(c.ref) && (
                          <span
                            aria-hidden="true"
                            title="VIP client"
                            className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 w-4 rounded-full ring-2 ring-background"
                            style={{
                              backgroundColor: "hsl(var(--tint-amber-fg))",
                              color: "hsl(var(--background))",
                            }}
                          >
                            <Star className="h-2.5 w-2.5 fill-current" strokeWidth={1.5} />
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" sideOffset={8} className="w-64 p-0">
                      <div className="px-3 pt-3 pb-2 border-b border-border/40">
                        <div className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-muted-foreground mb-1">
                          Client
                        </div>
                        <div className="font-serif text-[15px] leading-tight text-foreground">
                          {c.client}
                        </div>
                      </div>
                      <ul className="p-1.5 space-y-px">
                        <li>
                          <a
                            href={`mailto:${clientEmail}`}
                            className="group/contact flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition-smooth text-left"
                          >
                            <Mail className="h-3 w-3 shrink-0 text-muted-foreground/70" strokeWidth={1.75} />
                            <span className="flex-1 truncate text-[11.5px] text-foreground/90">
                              {clientEmail}
                            </span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0 text-muted-foreground/30 group-hover/contact:text-muted-foreground/70 transition-smooth" strokeWidth={2} />
                          </a>
                        </li>
                        <li>
                          <a
                            href={`tel:${clientPhone.replace(/\s+/g, "")}`}
                            className="group/contact flex items-start gap-2.5 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition-smooth text-left"
                          >
                            <Phone className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" strokeWidth={1.75} />
                            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                              <span className="flex items-center gap-1.5 min-w-0 font-mono text-[11.5px] tabular-nums text-foreground/90">
                                {countryFlag(c.country) && (
                                  <span
                                    aria-hidden="true"
                                    title={c.country.toUpperCase()}
                                    className="text-[12px] leading-none shrink-0"
                                  >
                                    {countryFlag(c.country)}
                                  </span>
                                )}
                                <span className="truncate">{clientPhone}</span>
                              </span>
                              {clientTime && (
                                <span className="flex items-center gap-1 text-[10px] leading-none text-muted-foreground/70">
                                  <span>{clientTime.city}</span>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="font-mono tabular-nums">{clientTime.time}</span>
                                  {clientTime.isOffHours && (
                                    <span
                                      aria-label="Outside local working hours"
                                      title="Outside local working hours (08:00–21:00)"
                                      className="ml-1 inline-block h-1 w-1 rounded-full bg-[hsl(var(--tint-amber-fg))]"
                                    />
                                  )}
                                </span>
                              )}
                            </span>
                            <ExternalLink className="h-2.5 w-2.5 mt-0.5 shrink-0 text-muted-foreground/30 group-hover/contact:text-muted-foreground/70 transition-smooth" strokeWidth={2} />
                          </a>
                        </li>
                      </ul>
                      {/* Compact action row — icon-only copy actions for the
                          three identifiers, plus the Live Desk jump. Sits
                          under a hairline divider so it reads as meta-actions
                          rather than another contact line. */}
                      <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-t border-border/40">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(clientEmail).then(
                                () => {
                                  flashCopied("email");
                                  toast.success("Email copied", { description: clientEmail });
                                },
                                () => toast.error("Couldn't copy email"),
                              );
                            }}
                            aria-label={`Copy email · ${clientEmail}`}
                            title={`Copy email · ${clientEmail}`}
                            className={`flex h-6 w-6 items-center justify-center rounded hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-smooth ${copiedKey === "email" ? "text-[hsl(var(--tint-mint-fg))]" : "text-muted-foreground/60 hover:text-foreground"}`}
                          >
                            {copiedKey === "email" ? (
                              <Check className="h-3 w-3 animate-in zoom-in-50 fade-in duration-200" strokeWidth={2.25} />
                            ) : (
                              <Mail className="h-3 w-3" strokeWidth={1.75} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(clientPhone).then(
                                () => {
                                  flashCopied("phone");
                                  toast.success("Phone copied", { description: clientPhone });
                                },
                                () => toast.error("Couldn't copy phone"),
                              );
                            }}
                            aria-label={`Copy phone · ${clientPhone}`}
                            title={`Copy phone · ${clientPhone}`}
                            className={`flex h-6 w-6 items-center justify-center rounded hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-smooth ${copiedKey === "phone" ? "text-[hsl(var(--tint-mint-fg))]" : "text-muted-foreground/60 hover:text-foreground"}`}
                          >
                            {copiedKey === "phone" ? (
                              <Check className="h-3 w-3 animate-in zoom-in-50 fade-in duration-200" strokeWidth={2.25} />
                            ) : (
                              <Phone className="h-3 w-3" strokeWidth={1.75} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(c.ref).then(
                                () => {
                                  flashCopied("ref");
                                  toast.success("Case ref copied", { description: c.ref });
                                },
                                () => toast.error("Couldn't copy case ref"),
                              );
                            }}
                            aria-label={`Copy case reference · ${c.ref}`}
                            title={`Copy case reference · ${c.ref}`}
                            className={`flex h-6 w-6 items-center justify-center rounded hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-smooth ${copiedKey === "ref" ? "text-[hsl(var(--tint-mint-fg))]" : "text-muted-foreground/60 hover:text-foreground"}`}
                          >
                            {copiedKey === "ref" ? (
                              <Check className="h-3 w-3 animate-in zoom-in-50 fade-in duration-200" strokeWidth={2.25} />
                            ) : (
                              <Hash className="h-3 w-3" strokeWidth={1.75} />
                            )}
                          </button>
                          {/* VIP toggle — separated by a faint divider so it
                              reads as a state action rather than another copy. */}
                          <span aria-hidden="true" className="mx-1 h-3 w-px bg-border/60" />
                          <button
                            type="button"
                            onClick={() => {
                              const nowVip = toggleVip(c.ref);
                              if (nowVip) {
                                toast.success(`Marked ${c.ref} as VIP`, {
                                  description: c.client,
                                });
                              } else {
                                toast(`VIP removed · ${c.ref}`, {
                                  description: c.client,
                                });
                              }
                            }}
                            aria-pressed={isVip(c.ref)}
                            aria-label={isVip(c.ref) ? "Unmark as VIP" : "Mark as VIP"}
                            title={isVip(c.ref) ? "Unmark as VIP" : "Mark as VIP"}
                            className={`flex h-6 w-6 items-center justify-center rounded hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-smooth ${
                              isVip(c.ref)
                                ? "text-[hsl(var(--tint-amber-fg))]"
                                : "text-muted-foreground/60 hover:text-foreground"
                            }`}
                          >
                            <Star
                              className={`h-3 w-3 ${isVip(c.ref) ? "fill-current" : ""}`}
                              strokeWidth={1.75}
                            />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenLiveDesk}
                          className="group/jump flex items-center gap-1.5 h-6 px-2 rounded text-[10.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-smooth"
                        >
                          <span>Live Desk</span>
                          <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover/jump:translate-x-0.5" strokeWidth={2} />
                        </button>
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <div className="min-w-0 flex-1">
                    <h1 className="font-serif text-[28px] tracking-tight leading-[1.15] text-foreground">
                      {c.client}
                    </h1>
                    <div className="mt-1 text-[12.5px] text-muted-foreground leading-snug">
                      Assigned to{" "}
                      <span className="inline-flex items-center gap-1.5 align-middle ml-0.5">
                        <OwnerAvatar name={c.owner} mine={c.owner === "A. Petrova"} />
                        <span className="text-foreground/85">{c.owner}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compact meta-pills row — split into two visual tiers.
                    Identity (Visa, Country) reads first: violet-tinted, no
                    border, slightly heavier text — these are *what the case is
                    about*. Utility (Ref, Captured-by) sits visually quieter
                    behind: hairline border, muted label — these are *how to
                    work with it*. The eye lands on identity, the hand reaches
                    for utility. */}
                <div className="mt-5 flex flex-wrap items-center gap-1.5">
                  {/* ── Identity tier ─────────────────────────────────────── */}
                  <span
                    className="inline-flex items-center gap-2 h-7 pl-2 pr-2.5 rounded-md ring-1 ring-inset"
                    style={{
                      backgroundColor: "hsl(var(--tint-violet) / 0.12)",
                      // @ts-expect-error css var
                      "--tw-ring-color": "hsl(var(--tint-violet) / 0.22)",
                    }}
                  >
                    <FileText className="h-3 w-3" strokeWidth={1.75} style={{ color: "hsl(var(--tint-violet-fg))" }} />
                    <span className="text-[11.5px] font-medium" style={{ color: "hsl(var(--tint-violet-fg))" }}>
                      {c.visa}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-2 h-7 pl-2 pr-2.5 rounded-md bg-secondary/40 ring-1 ring-inset ring-border/40">
                    <Globe className="h-3 w-3 text-foreground/60" strokeWidth={1.75} />
                    <CountryChip code={c.country} />
                  </span>

                  {/* Hairline separator between identity and utility tiers. */}
                  <span aria-hidden className="mx-1 h-3.5 w-px bg-border/60" />

                  {/* ── Utility tier ──────────────────────────────────────── */}
                  <button
                    type="button"
                    onClick={handleCopyRef}
                    title="Copy case reference"
                    className="group/meta inline-flex items-center gap-2 h-7 pl-2 pr-2.5 rounded-md border border-border/40 hover:border-border/70 hover:bg-secondary/30 transition-smooth"
                  >
                    <Hash className="h-3 w-3 text-muted-foreground/60" strokeWidth={1.75} />
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
                      Ref
                    </span>
                    <span className="font-mono text-[11.5px] text-foreground/85 tabular-nums">
                      {c.ref}
                    </span>
                    <Copy className="h-2.5 w-2.5 text-muted-foreground/30 group-hover/meta:text-muted-foreground/70 transition-smooth" strokeWidth={2} />
                  </button>

                  {/* Captured-by pill — bridges the case to the device that
                      produced its scans. When that device is currently
                      offline we tint the whole pill crimson so the operator
                      sees, while reviewing, that incoming docs from this
                      source can't be trusted as fresh — it changes the
                      decision (chase the client to re-upload via web flow,
                      or wait for the node to come back). Click jumps to
                      /app/nodes with the node pre-selected. */}
                  {(() => {
                    if (!c.sourceNodeId) return null;
                    const node = deviceNodes.find((n) => n.id === c.sourceNodeId);
                    if (!node) return null;
                    const isOffline = node.status === "offline";
                    const meta = STATUS_META[node.status];
                    const dotColor = `hsl(var(--tint-${meta.tint}-fg))`;
                    return (
                      <button
                        type="button"
                        onClick={() => navigate(`/app/nodes?node=${encodeURIComponent(node.id)}`)}
                        title={
                          isOffline
                            ? `${node.id} is offline — ${node.label}, ${node.city}. Captures from this device may be stale.`
                            : `${node.id} · ${node.label}, ${node.city} · ${meta.label.toLowerCase()}`
                        }
                        className={`group/cap inline-flex items-center gap-2 h-7 pl-2 pr-2.5 rounded-md border transition-smooth ${
                          isOffline
                            ? "border-[hsl(var(--tint-crimson)/0.45)] bg-[hsl(var(--tint-crimson)/0.10)] hover:bg-[hsl(var(--tint-crimson)/0.16)]"
                            : "border-border/40 hover:border-border/70 hover:bg-secondary/30"
                        }`}
                      >
                        {/* Status dot — pulses on offline so the pill reads
                            as a live alert, not a static label. */}
                        <span className="relative inline-flex h-2 w-2 shrink-0">
                          {meta.pulse && (
                            <span
                              className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                              style={{ backgroundColor: dotColor }}
                            />
                          )}
                          <span
                            className="relative inline-flex h-2 w-2 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                        </span>
                        <Server
                          className={`h-3 w-3 ${isOffline ? "text-[hsl(var(--tint-crimson-fg))]" : "text-muted-foreground/70"}`}
                          strokeWidth={1.75}
                        />
                        <span
                          className={`text-[10px] uppercase tracking-[0.16em] ${
                            isOffline ? "text-[hsl(var(--tint-crimson-fg))]" : "text-muted-foreground/70"
                          }`}
                        >
                          Captured by
                        </span>
                        <span
                          className={`font-mono text-[11.5px] tabular-nums ${
                            isOffline ? "text-[hsl(var(--tint-crimson-fg))]" : "text-foreground"
                          }`}
                        >
                          {node.id}
                        </span>
                        <ArrowRight
                          className={`h-2.5 w-2.5 transition-transform group-hover/cap:translate-x-0.5 ${
                            isOffline ? "text-[hsl(var(--tint-crimson-fg))]/70" : "text-muted-foreground/40 group-hover/cap:text-muted-foreground/80"
                          }`}
                          strokeWidth={2}
                        />
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* SLA hero block + quick actions — right column. The big
                  countdown is the most operationally important number on
                  this screen, so it gets typographic weight and colour
                  authority instead of being buried in a metadata grid. */}
              <div className="shrink-0 flex flex-col items-end gap-3">
                <div className="flex items-center gap-1.5">
                  <QuickAction
                    icon={ExternalLink}
                    label="Open in Live Desk"
                    onClick={handleOpenLiveDesk}
                  />
                  <QuickAction
                    icon={FileText}
                    label="Open presentation bundle"
                    onClick={handleOpenBundle}
                  />
                  <QuickAction
                    icon={Camera}
                    label="Open visual evidence"
                    onClick={handleOpenEvidence}
                  />
                  <QuickAction
                    icon={Server}
                    label="Open Case Vault"
                    onClick={handleOpenCaseVault}
                  />
                  <QuickAction
                    icon={Copy}
                    label="Copy case reference"
                    onClick={handleCopyRef}
                  />
                  <QuickAction
                    icon={BellOff}
                    label="Snooze case for 4h"
                    onClick={handleSnooze}
                  />
                </div>

                {(() => {
                  // Absolute deadline tooltip: now + remaining SLA minutes.
                  // Falls back to "—" when SLA isn't parseable (resolved cases
                  // or odd labels). Day label switches between "today",
                  // "tomorrow", or a short date so the tooltip stays compact.
                  let deadlineLabel = "—";
                  if (slaMins !== null) {
                    const due = new Date(NOW_MS + slaMins * 60_000);
                    const now = new Date(NOW_MS);
                    const sameDay = due.toDateString() === now.toDateString();
                    const tomorrow = new Date(now);
                    tomorrow.setDate(now.getDate() + 1);
                    const isTomorrow =
                      due.toDateString() === tomorrow.toDateString();
                    const time = due.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    });
                    const dayWord = sameDay
                      ? "today"
                      : isTomorrow
                        ? "tomorrow"
                        : due.toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          });
                    deadlineLabel = `${time} ${dayWord}`;
                  }

                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="relative flex items-center gap-3.5 pl-4 pr-5 py-3 rounded-lg ring-1 ring-inset cursor-default"
                          style={{
                            backgroundColor: `${slaHashColor.replace(")", " / 0.08)")}`,
                            // @ts-expect-error css var
                            "--tw-ring-color": `${slaHashColor.replace(")", " / 0.24)")}`,
                          }}
                        >
                          <Timer
                            className="h-4 w-4 shrink-0"
                            strokeWidth={1.75}
                            style={{ color: slaHashColor }}
                          />
                          <div className="flex flex-col">
                            <span className="text-[9px] uppercase tracking-[0.2em] font-mono leading-none text-muted-foreground/70">
                              SLA · {slaTier}
                            </span>
                            <span
                              className="font-mono font-medium text-[28px] tabular-nums leading-none mt-1.5"
                              style={{ color: slaHashColor }}
                            >
                              {c.sla}
                            </span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={8} className="max-w-xs">
                        <div className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-muted-foreground mb-1">
                          Deadline
                        </div>
                        <div className="font-mono text-[12px] tabular-nums text-foreground">
                          Due {deadlineLabel}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground/80 mt-1">
                          {c.sla} remaining
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })()}
              </div>
            </div>
          </header>
        );
      })()}

      {/* HERO — approval (data-driven). Empty state when nothing is pending. */}
      <div className="px-8 py-12 max-w-3xl mx-auto">
        {c.approval ? (
          isApproving ? (
            /* ── Success-state ──────────────────────────────────────────
                Local action confirmation — operator just clicked Approve &
                send and we want a calm closure signal before the redirect.
                Honest about what's confirmed: the handoff was submitted,
                not that the case is "Resolved" (that's a backend truth we
                don't own here). Mint accent + check icon + timestamp. */
            <div className="animate-fade-up">
              <div className="text-[10px] uppercase tracking-[0.22em] mb-6" style={{ color: "hsl(var(--tint-mint-fg))" }}>
                Action confirmed
              </div>

              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="shrink-0 inline-flex items-center justify-center h-12 w-12 rounded-full"
                  style={{
                    background: "hsl(var(--tint-mint-bg))",
                    color: "hsl(var(--tint-mint-fg))",
                  }}
                >
                  <Check className="h-6 w-6" strokeWidth={2.25} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h1 className="font-serif text-3xl md:text-4xl leading-[1.15] tracking-tight">
                    Handoff sent.
                  </h1>
                  <div className="mt-2 text-[13px] text-muted-foreground">
                    Reminder dispatched to{" "}
                    <span className="text-foreground/85">{c.client}</span>
                    {" · "}
                    <span className="font-mono text-[12px]">{c.ref}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full animate-pulse-dot"
                  style={{ backgroundColor: "hsl(var(--tint-mint-fg))" }}
                />
                Returning to Live Desk…
              </div>
            </div>
          ) : (
          <>
            <div className="text-[10px] uppercase tracking-[0.22em] text-primary mb-6">
              {c.approval.eyebrow}
            </div>

            <h1 className="font-serif text-3xl md:text-4xl leading-[1.15] tracking-tight">
              {c.approval.headline.prefix}
              <span className="italic text-gradient-primary">
                {c.approval.headline.emphasis}
              </span>
              {c.approval.headline.suffix}
            </h1>

            {/* Draft + signals — decontained block. No border-frame; instead
                a soft secondary tint + hairline rules top/bottom. The block
                bleeds full-width by negating the parent's px-8 with -mx-8,
                which gives the operator's eye a clear "this is the artifact
                you'd send" zone without boxing it in. */}
            <div className="mt-9 -mx-8 px-8 py-6 bg-secondary/15 border-y border-border/60">
              <div className="font-mono text-[12px] text-foreground/85 leading-relaxed whitespace-pre-line">
                {c.approval.draft}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {c.approval.signals.map((s) => (
                  <Pill key={s.label} tone={s.tone} size="sm">
                    {s.label}
                  </Pill>
                ))}
              </div>
            </div>

            {/* Action row — primary CTA larger (h-11) and richer primary fill,
                Edit / Reject stay as ghosts so the visual weight reads
                Approve → secondary actions → keyboard hint. */}
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                className="h-11 px-6 text-[13px] bg-primary/90 text-primary-foreground hover:bg-primary"
              >
                <Check className="mr-2 h-4 w-4" strokeWidth={2.25} />
                Approve & send
              </Button>
              <Button variant="ghost" disabled={isApproving} className="h-11 px-4 text-[13px] text-muted-foreground hover:text-foreground">
                <Pencil className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                Edit
              </Button>
              <Button
                variant="ghost"
                disabled={isApproving}
                className="h-11 px-4 text-[13px] hover:bg-[hsl(var(--tint-rose)/0.08)]"
                style={{ color: "hsl(var(--tint-rose-fg) / 0.85)" }}
              >
                Reject
              </Button>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary/50 text-foreground/80 text-[10.5px] tracking-tight font-mono">⌘↵</kbd>
                to approve
              </span>
            </div>

            {showRuntimeSupportStrip ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
                <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Runtime support
                </span>
                {runtimeSupportItems.map((item) => (
                  <Pill key={`${item.label}:${item.tone}`} tone={item.tone} size="sm" dot={item.dot}>
                    {item.label}
                  </Pill>
                ))}
                <Button asChild variant="ghost" className="ml-auto h-8 px-3 text-[11.5px]">
                  <Link to={runtimeSupportCta.to}>
                    <Server className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                    {runtimeSupportCta.label}
                  </Link>
                </Button>
              </div>
            ) : null}
          </>
          )
        ) : (
          /* ── Empty approval state ─────────────────────────────────────
              Decontained: no border, soft secondary wash matches the
              section anchor below, centered typography in the same
              voice as the regular approval headline. */
          <div className="px-6 py-12 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-5">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full ring-1 ring-inset ring-border"
              />
              No pending approval
            </div>
            <h2 className="font-serif text-[34px] leading-[1.15] tracking-tight max-w-2xl">
              {c.client} · nothing for you to decide
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
              This case is currently <span className="text-foreground/80">{c.stage.toLowerCase()}</span>
              {" "}({c.status.replace("_", " ")}). The timeline below shows everything
              that's happened so far.
            </p>
          </div>
        )}

        {/* ── Section: secondary surfaces ─────────────────────────────────
            Case History + Documents share one tab-row header so they read
            as a single zone (not two orphan eyebrow buttons floating in
            space). The whole zone gets a left rail + soft wash so it
            anchors visually to the same vertical the hero/approval blocks
            live on. */}
        <section
          id="live-activity"
          className={`relative mt-12 -mx-8 scroll-mt-24 px-8 py-6 bg-secondary/[0.06] border-y border-border/50 transition-opacity duration-500 ${isApproving ? "opacity-40 pointer-events-none" : "opacity-100"}`}
        >
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0 w-[3px] bg-border/70"
          />

          <div className="group/tabs flex items-center border-b border-border/40 -mx-1 px-1 pb-2.5 mb-4">
            {/* Tabs — quiet, no permanent kbd chips. Hover the tab-row to
                reveal the shortcut hint on the right; this keeps the resting
                state calm and uncluttered. */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => {
                  setShowHistory(true);
                  setShowWiki(false);
                  setAutoOpenedHint(false);
                }}
                className={`relative inline-flex items-baseline gap-2 px-3 h-7 text-[10.5px] uppercase tracking-[0.18em] transition-smooth ${
                  showHistory
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Case history</span>
                <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
                  {c.events.length}
                </span>
                {showHistory && (
                  <span
                    aria-hidden
                    className="absolute left-3 right-3 -bottom-[10px] h-[1.5px] bg-primary/80"
                  />
                )}
              </button>
              <span aria-hidden className="h-3 w-px bg-border/50" />
              <button
                ref={docsAnchorRef}
                onClick={() => {
                  setShowWiki(true);
                  setShowHistory(false);
                  setAutoOpenedHint(false);
                }}
                className={`relative inline-flex items-baseline gap-2 px-3 h-7 text-[10.5px] uppercase tracking-[0.18em] transition-smooth scroll-mt-24 ${
                  showWiki
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Documents</span>
                <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
                  {c.documents.filter((d) => d.state === "ok").length}/{c.documents.length}
                </span>
                {showWiki && (
                  <span
                    aria-hidden
                    className="absolute left-3 right-3 -bottom-[10px] h-[1.5px] bg-primary/80"
                  />
                )}
              </button>
            </div>

            {/* Right cluster — only the awaiting summary lives here now.
                Compact rose chip with count; click/hover opens a clean
                popover list. The shortcut hint sits to its left and only
                fades in when the operator hovers the tab-row, so the
                resting view stays whisper-quiet. */}
            <div className="ml-auto flex items-center gap-3">
              <span
                aria-hidden
                className="hidden sm:inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.16em] font-mono text-muted-foreground/40 opacity-0 group-hover/tabs:opacity-100 transition-opacity"
              >
                <kbd className="inline-flex items-center justify-center px-1 h-[14px] min-w-[20px] rounded text-[9px] tracking-tight border border-border/50">⌘1</kbd>
                <span>/</span>
                <kbd className="inline-flex items-center justify-center px-1 h-[14px] min-w-[20px] rounded text-[9px] tracking-tight border border-border/50">⌘2</kbd>
                <span className="text-muted-foreground/50">switch</span>
              </span>

              {missingDocs.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onMouseEnter={() => setHintHovered(true)}
                      onMouseLeave={() => setHintHovered(false)}
                      onFocus={() => setHintHovered(true)}
                      onBlur={() => setHintHovered(false)}
                      className={`group/awaiting inline-flex items-center gap-2 h-6 pl-2 pr-1.5 rounded-full text-[10px] uppercase tracking-[0.14em] font-mono transition-smooth hover:bg-secondary/50 ${
                        autoOpenedHint ? "animate-fade-up" : ""
                      }`}
                      style={{ color: "hsl(var(--tint-rose-fg))" }}
                      aria-label={`${missingDocs.length} documents awaiting client`}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: "hsl(var(--tint-rose-fg))" }}
                      />
                      <span>awaiting</span>
                      <span className="text-foreground/70 tabular-nums">{missingDocs.length}</span>
                      <ChevronDown
                        aria-hidden
                        className="h-3 w-3 shrink-0 text-muted-foreground/50 group-hover/awaiting:text-foreground/70 transition-smooth"
                        strokeWidth={1.75}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    sideOffset={8}
                    className="w-64 p-2"
                    onMouseEnter={() => setHintHovered(true)}
                    onMouseLeave={() => setHintHovered(false)}
                  >
                    <div className="px-2 pt-1 pb-2 flex items-center justify-between">
                      <span className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-muted-foreground">
                        Awaiting client
                      </span>
                      <span className="text-[9.5px] font-mono text-muted-foreground/60 tabular-nums">
                        {missingDocs.length}
                      </span>
                    </div>
                    <ul className="space-y-px">
                      {missingDocs.map((name) => (
                        <li key={name}>
                          <button
                            onClick={() => focusDocRow(name)}
                            className="group/item w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/60 text-foreground/85 hover:text-foreground transition-smooth text-left text-[12px]"
                          >
                            <span
                              aria-hidden
                              className="inline-block h-1 w-1 rounded-full shrink-0"
                              style={{ backgroundColor: "hsl(var(--tint-rose-fg))" }}
                            />
                            <span className="flex-1 truncate">{name}</span>
                            <ChevronRight
                              aria-hidden
                              className="h-3 w-3 shrink-0 text-muted-foreground/30 group-hover/item:text-foreground/70 group-hover/item:translate-x-0.5 transition-all"
                              strokeWidth={1.75}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-1 px-2 pt-2 pb-1 border-t border-border/40 text-[9.5px] uppercase tracking-[0.16em] font-mono text-muted-foreground/60">
                      Click a name to jump to the row
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {showHistory && (
            <ol className="space-y-2.5 border-l border-border/60 ml-1 pl-4">
              {[...c.events]
                .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
                .map((e, i) => (
                  <li key={i} className="flex items-baseline gap-3 text-xs">
                    <span className="font-mono text-[10px] text-muted-foreground w-[88px] shrink-0 tabular-nums">
                      {formatEventTime(e.at)}
                    </span>
                    <span
                      className="font-mono text-[10px] uppercase tracking-wide w-[60px] shrink-0"
                      style={{ color: actorTint[e.actor] }}
                    >
                      {e.actor}
                    </span>
                    <span className="text-foreground/90">{e.title}</span>
                  </li>
                ))}
            </ol>
          )}

        {showWiki && (
          <>
            {/* Bulk-request bar — hairline strip directly under the tabs.
                No container, no ring: inline checkbox on the left, count
                in the middle, "Request all" as a tinted text-link on the
                right. Matches the decontained rhythm of the surrounding
                section. */}
            {missingDocs.length > 0 && (
              <div className="mt-1 mb-3 flex items-center gap-3 h-7 border-b border-border/30">
                <button
                  onClick={
                    selectedMissing.size === missingDocs.length
                      ? clearMissingSelection
                      : selectAllMissing
                  }
                  className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-smooth"
                >
                  <span
                    className={`h-3.5 w-3.5 rounded-[3px] ring-1 ring-inset transition-smooth flex items-center justify-center ${
                      selectedMissing.size === missingDocs.length
                        ? "bg-primary ring-primary"
                        : selectedMissing.size > 0
                          ? "bg-primary/70 ring-primary/70"
                          : "bg-transparent ring-border/70"
                    }`}
                  >
                    {selectedMissing.size === missingDocs.length && (
                      <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                    )}
                    {selectedMissing.size > 0 && selectedMissing.size < missingDocs.length && (
                      <span className="h-[2px] w-2 rounded-full bg-primary-foreground" />
                    )}
                  </span>
                  {selectedMissing.size === missingDocs.length
                    ? "Deselect all"
                    : `Select all missing · ${missingDocs.length}`}
                </button>

                <span className="ml-auto flex items-center gap-3">
                  {selectedMissing.size > 0 && (
                    <button
                      onClick={clearMissingSelection}
                      className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground transition-smooth"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={openBulkRequest}
                    disabled={selectedMissing.size === 0}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium transition-smooth disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:brightness-125"
                    style={{ color: "hsl(var(--tint-rose-fg))" }}
                  >
                    <Send className="h-3 w-3" strokeWidth={2} />
                    {selectedMissing.size > 1
                      ? `Request all (${selectedMissing.size})`
                      : selectedMissing.size === 1
                        ? "Request (1)"
                        : `Request all (${missingDocs.length})`}
                  </button>
                </span>
              </div>
            )}

            <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {c.documents.map((d) => {
                // missing → opens request sheet (single) OR ticks for bulk
                // review  → opens awaiting sheet (status + resend / mark received)
                // ok / other → passive
                const isMissing = d.state === "missing";
                const isReview = d.state === "review";
                const isInteractive = isMissing || isReview;
                const isTicked = isMissing && selectedMissing.has(d.name);
                // A doc is "session-requested" only while we have a live record
                // and the operator hasn't ticked it received — that's exactly
                // what the deep-link from the Live Desk wants highlighted.
                const reqAt = requestedAt.get(d.name);
                const isSessionRequested = isReview && Boolean(reqAt);
                const requestedAge = shortAge(reqAt, NOW_MS);
                const isStaleRequest =
                  isSessionRequested && reqAt
                    ? NOW_MS - new Date(reqAt).getTime() >= REQUESTED_STALE_MS
                    : false;
                const reqTone = isStaleRequest ? "rose" : "violet";
                const cta = isMissing ? "Request" : isReview ? "Awaiting" : null;

                // Row layout — explicit CSS grid so every cell sits on a
                // shared vertical: status icon, name, action label all line
                // up across rows regardless of state. The checkbox column
                // (14px) is reserved on every row — for non-missing docs we
                // render an empty spacer there so the rest of the row stays
                // anchored to the same x-coordinate as missing rows.
                const gridTemplate = "14px 12px minmax(0, 1fr) 92px";

                const content = (
                  <div
                    className="grid items-center gap-2 w-full"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {isMissing ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMissing(d.name);
                        }}
                        title={isTicked ? "Untick" : "Add to bulk request"}
                        className={`h-3.5 w-3.5 rounded-[3px] ring-1 ring-inset transition-smooth flex items-center justify-center ${
                          isTicked
                            ? "bg-primary ring-primary opacity-100"
                            : selectedMissing.size > 0
                              ? "bg-transparent ring-border/70 opacity-100 hover:ring-foreground/40"
                              : "bg-transparent ring-border/70 opacity-0 group-hover:opacity-100 hover:ring-foreground/40"
                        }`}
                      >
                        {isTicked && (
                          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                        )}
                      </button>
                    ) : (
                      <span aria-hidden />
                    )}
                    <span className="inline-flex items-center justify-center">
                      {docIcon(d.state)}
                    </span>
                    <span className="min-w-0 flex items-baseline gap-1.5">
                      <span
                        className={`truncate ${
                          isInteractive ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {d.name}
                      </span>
                      {isSessionRequested && requestedAge && (
                        <span
                          className="font-mono text-[10px] uppercase tracking-wide shrink-0"
                          style={{ color: `hsl(var(--tint-${reqTone}-fg))` }}
                          title={`Requested ${requestedAge} ago${isStaleRequest ? " · awaiting >24h" : ""}`}
                        >
                          · {requestedAge}
                        </span>
                      )}
                    </span>
                    {cta ? (
                      /* Action chip — always visible soft pill so the row
                          reads as actionable at a glance, not just on hover.
                          Tone matches state: rose=request (needs outbound
                          action), violet=awaiting (in-flight). On row-hover
                          the chip brightens + arrow nudges right. */
                      <span
                        className="justify-self-end inline-flex items-center gap-1 h-[22px] pl-2 pr-1.5 rounded-full text-[10px] font-medium uppercase tracking-[0.12em] transition-smooth whitespace-nowrap font-mono ring-1 ring-inset"
                        style={{
                          color: `hsl(var(--tint-${isMissing ? "rose" : "violet"}-fg))`,
                          backgroundColor: `hsl(var(--tint-${isMissing ? "rose" : "violet"}) / 0.08)`,
                          // @ts-expect-error css var
                          "--tw-ring-color": `hsl(var(--tint-${isMissing ? "rose" : "violet"}) / 0.20)`,
                        }}
                      >
                        {cta}
                        <ArrowRight
                          className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5"
                          strokeWidth={2.25}
                        />
                      </span>
                    ) : (
                      <span aria-hidden />
                    )}
                  </div>
                );
                // Session-requested rows get a tinted left-border + faint
                // background wash so the operator immediately sees which lines
                // are waiting on a client reply when they deep-link in.
                const requestedClasses = isSessionRequested
                  ? isStaleRequest
                    ? "border-l-2 border-[hsl(var(--tint-rose-fg))] bg-[hsl(var(--tint-rose)/0.08)] pl-2"
                    : "border-l-2 border-[hsl(var(--tint-violet-fg))] bg-[hsl(var(--tint-violet)/0.06)] pl-2"
                  : "";
                const isHighlighted = highlightedDoc === d.name;
                const highlightRing = isHighlighted
                  ? "ring-2 ring-[hsl(var(--tint-rose-fg))] ring-offset-2 ring-offset-background rounded transition-all duration-300"
                  : "";
                return (
                  <li key={d.name} id={docRowId(d.name)} className={`scroll-mt-32 ${highlightRing}`}>
                    {isInteractive ? (
                      <button
                        onClick={() =>
                          isMissing
                            ? setRequestDoc(d.name)
                            : setAwaitingDoc(d.name)
                        }
                        className={`group w-full text-xs py-1.5 -mx-2 px-2 rounded transition-smooth text-left ${
                          isTicked
                            ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                            : `hover:bg-secondary/40 ${requestedClasses}`
                        }`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className={`text-xs py-1.5 ${requestedClasses}`}>
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        </section>
      </div>

      <RequestDocSheet
        open={requestDoc !== null}
        onOpenChange={(open) => !open && setRequestDoc(null)}
        caseRef={c}
        docName={requestDoc}
        onSent={recordDocRequest}
      />

      {/* Bulk variant — same sheet component, fed a list. After send, clear
          the selection so the operator returns to a clean state. */}
      <RequestDocSheet
        open={bulkDocs !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBulkDocs(null);
            clearMissingSelection();
          }
        }}
        caseRef={c}
        docNames={bulkDocs}
        onSent={recordDocRequest}
      />

      <AwaitingClientSheet
        open={awaitingDoc !== null}
        onOpenChange={(open) => !open && setAwaitingDoc(null)}
        caseRef={c}
        request={
          awaitingDoc
            ? sessionReqs.find((r) => r.doc === awaitingDoc) ?? null
            : null
        }
      />
    </div>
  );
};
