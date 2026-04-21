import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Camera,
  Check,
  Clock,
  Eye,
  Link2,
} from "lucide-react";
import { BUNDLE_INDEX } from "@/data/presentationBundles";
import { toast } from "@/hooks/use-toast";

type Filter = "all" | "mint" | "rose" | "amber";
type Sort = "newest" | "longest" | "confidence";

const FILTERS: {
  id: Filter;
  label: string;
  tone?: "mint" | "rose" | "amber";
}[] = [
  { id: "all", label: "All" },
  { id: "mint", label: "Approved", tone: "mint" },
  { id: "rose", label: "Declined", tone: "rose" },
  { id: "amber", label: "Escalated", tone: "amber" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "longest", label: "Longest" },
  { id: "confidence", label: "Confidence" },
];

const VALID_FILTERS: Filter[] = ["all", "mint", "rose", "amber"];
const VALID_SORTS: Sort[] = ["newest", "longest", "confidence"];

function durationToSeconds(d: string): number {
  let total = 0;
  const h = d.match(/(\d+)\s*h/);
  const m = d.match(/(\d+)\s*m/);
  const s = d.match(/(\d+)\s*s/);
  if (h) total += parseInt(h[1], 10) * 3600;
  if (m) total += parseInt(m[1], 10) * 60;
  if (s) total += parseInt(s[1], 10);
  return total;
}

const Evidence = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("outcome");
  const filter: Filter = (VALID_FILTERS as string[]).includes(raw ?? "")
    ? (raw as Filter)
    : "all";

  const setFilter = (next: Filter) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next === "all") {
          sp.delete("outcome");
        } else {
          sp.set("outcome", next);
        }
        return sp;
      },
      { replace: true },
    );
  };

  const rawSort = searchParams.get("sort");
  const sort: Sort = (VALID_SORTS as string[]).includes(rawSort ?? "")
    ? (rawSort as Sort)
    : "newest";

  const setSort = (next: Sort) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next === "newest") {
          sp.delete("sort");
        } else {
          sp.set("sort", next);
        }
        return sp;
      },
      { replace: true },
    );
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyBundleLink = async (
    e: React.MouseEvent<HTMLButtonElement>,
    bundleId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/bundle/${bundleId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopiedId(bundleId);
    toast({
      title: "Link copied",
      description: `${bundleId} URL is on your clipboard.`,
    });
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === bundleId ? null : prev));
    }, 1800);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: BUNDLE_INDEX.length };
    BUNDLE_INDEX.forEach((b) => {
      c[b.outcomeTone] = (c[b.outcomeTone] ?? 0) + 1;
    });
    return c;
  }, []);

  const visible = useMemo(() => {
    const filtered =
      filter === "all"
        ? BUNDLE_INDEX
        : BUNDLE_INDEX.filter((b) => b.outcomeTone === filter);
    const sorted = filtered.slice();
    if (sort === "newest") {
      sorted.sort(
        (a, b) =>
          new Date(b.generatedAt).getTime() -
          new Date(a.generatedAt).getTime(),
      );
    } else if (sort === "longest") {
      sorted.sort(
        (a, b) =>
          durationToSeconds(b.duration) - durationToSeconds(a.duration),
      );
    } else if (sort === "confidence") {
      sorted.sort((a, b) => b.confidence - a.confidence);
    }
    return sorted;
  }, [filter, sort]);

  const didMount = useRef(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      didMount.current = true;
    }, 600);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Visual Evidence · Action Desk";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top rail */}
      <div className="border-b border-border/30">
        <div className="container-narrow h-12 flex items-center justify-between">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Action Desk
          </Link>
          <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/50">
            <Eye className="h-3 w-3" strokeWidth={1.5} />
            Visual evidence
          </div>
        </div>
      </div>

      <section className="container-narrow pt-20 pb-24">
        {/* Hero — generous whitespace, reduced noise */}
        <div className="max-w-3xl space-y-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/45">
            Judge artifacts · preview
          </div>
          <h1 className="font-serif text-4xl md:text-5xl leading-[1.08] tracking-tight">
            Every decision, with its own{" "}
            <span className="italic text-gradient-primary">picture trail</span>.
          </h1>
          <p className="text-[14.5px] leading-[1.7] text-foreground/55 max-w-[54ch]">
            Visual Evidence collects OCR frames, node captures, and rendered
            drafts for each case — so a judge sees exactly what the AI was
            looking at the moment it decided.
          </p>
        </div>

        {/* Index section */}
        <div className="mt-20">
          {/* Section header */}
          <div className="flex items-baseline justify-between mb-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50">
              The demo set ·{" "}
              <span className="text-foreground/60">{visible.length}</span>
              {filter !== "all" && (
                <span className="text-muted-foreground/30">
                  {" "}
                  / {BUNDLE_INDEX.length}
                </span>
              )}{" "}
              cases
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/30">
              read in any order
            </div>
          </div>

          {/* Filter + Sort row */}
          <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-6 mb-8">
            <div
              role="tablist"
              aria-label="Filter bundles by outcome"
              className="flex flex-wrap items-center gap-2"
            >
              {FILTERS.map((f) => {
                const isActive = filter === f.id;
                const chipTone = f.tone ?? "violet";
                const count = counts[f.id] ?? 0;
                const disabled = f.id !== "all" && count === 0;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={isActive}
                    disabled={disabled}
                    onClick={() => setFilter(f.id)}
                    className="inline-flex items-center gap-2 h-7 px-3 rounded-full ring-1 ring-inset font-mono text-[10.5px] uppercase tracking-[0.16em] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={
                      isActive
                        ? {
                            backgroundColor: `hsl(var(--tint-${chipTone}) / 0.12)`,
                            color: `hsl(var(--tint-${chipTone}-fg))`,
                            ["--tw-ring-color" as any]: `hsl(var(--tint-${chipTone}) / 0.35)`,
                          }
                        : {
                            backgroundColor: "transparent",
                            color: "hsl(var(--muted-foreground) / 0.7)",
                            ["--tw-ring-color" as any]:
                              "hsl(var(--border) / 0.4)",
                          }
                    }
                  >
                    <span>{f.label}</span>
                    <span className="font-mono tabular-nums text-[9px] opacity-50">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sort control */}
            <div className="inline-flex items-center gap-2.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/35">
                Sort
              </span>
              <div
                role="radiogroup"
                aria-label="Sort bundles"
                className="inline-flex items-center rounded-full ring-1 ring-inset ring-border/35 p-0.5"
              >
                {SORTS.map((s) => {
                  const isActive = sort === s.id;
                  return (
                    <button
                      key={s.id}
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setSort(s.id)}
                      className="h-6 px-2.5 rounded-full font-mono text-[10px] uppercase tracking-[0.16em] transition-all"
                      style={
                        isActive
                          ? {
                              backgroundColor: "hsl(var(--muted) / 0.5)",
                              color: "hsl(var(--foreground) / 0.9)",
                            }
                          : {
                              backgroundColor: "transparent",
                              color: "hsl(var(--muted-foreground) / 0.5)",
                            }
                      }
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cards */}
          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/30 px-6 py-14 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50">
                No bundles match this filter
              </p>
            </div>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2">
              {visible.map((b, i) => {
                const isCopied = copiedId === b.id;
                const animate = !didMount.current;
                const delay = Math.min(i, 6) * 60;
                return (
                  <li
                    key={b.id}
                    className={animate ? "animate-fade-up" : undefined}
                    style={
                      animate ? { animationDelay: `${delay}ms` } : undefined
                    }
                  >
                    <article className="group relative overflow-hidden rounded-xl bg-card/20 ring-1 ring-inset ring-border/25 hover:ring-border/50 hover:bg-card/35 transition-all">
                      {/* Tone rail */}
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[3px] z-10"
                        style={{
                          backgroundColor: `hsl(var(--tint-${b.outcomeTone}-fg) / 0.7)`,
                        }}
                      />

                      {/* Card body — link target */}
                      <Link
                        to={`/evidence/${b.id}`}
                        className="block pl-7 pr-6 pt-6 pb-5"
                        aria-label={`Open picture trail for ${b.titleLead} ${b.titleItalic}`}
                      >
                        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/45 leading-tight">
                          {b.kicker}
                        </div>

                        <h2 className="mt-4 font-serif text-[22px] md:text-[24px] leading-[1.2] tracking-tight text-foreground/90">
                          {b.titleLead}{" "}
                          <span
                            className="italic"
                            style={{
                              color: `hsl(var(--tint-${b.outcomeTone}-fg))`,
                            }}
                          >
                            {b.titleItalic}
                          </span>
                        </h2>

                        <div className="mt-5 flex items-center gap-2.5 flex-wrap">
                          <span
                            className="inline-flex items-center h-[22px] px-2.5 rounded-[5px] ring-1 ring-inset font-mono text-[10px] uppercase tracking-[0.14em]"
                            style={{
                              backgroundColor: `hsl(var(--tint-${b.outcomeTone}) / 0.10)`,
                              color: `hsl(var(--tint-${b.outcomeTone}-fg))`,
                              ["--tw-ring-color" as any]: `hsl(var(--tint-${b.outcomeTone}) / 0.22)`,
                            }}
                          >
                            {b.outcomeLabel}
                          </span>
                          <span
                            className="font-mono text-[10.5px] tabular-nums"
                            style={{
                              color: `hsl(var(--tint-${b.outcomeTone}-fg) / 0.8)`,
                            }}
                          >
                            {b.confidence}%
                          </span>
                        </div>

                        <p className="mt-4 font-serif text-[14.5px] leading-snug text-muted-foreground/65 line-clamp-2">
                          {b.verdict}
                        </p>

                        {/* Operator meta */}
                        <div className="mt-5 flex items-center gap-2 font-mono text-[9.5px] text-muted-foreground/35 tabular-nums">
                          <span className="truncate">{b.operator}</span>
                          <span className="text-muted-foreground/15">·</span>
                          <span className="truncate">{b.policyHash}</span>
                          <span className="text-muted-foreground/15">·</span>
                          <span className="shrink-0" title={b.generatedAt}>
                            {b.generatedAt.slice(0, 10)}
                          </span>
                        </div>
                      </Link>

                      {/* Footer */}
                      <div className="pl-7 pr-4 pb-4 pt-3.5 border-t border-border/20 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground/50 tabular-nums min-w-0">
                          <span className="truncate">{b.id}</span>
                          <span className="text-muted-foreground/15">·</span>
                          <span className="truncate">{b.caseRef}</span>
                          <span className="text-muted-foreground/15">·</span>
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <Clock
                              className="h-2.5 w-2.5 opacity-60"
                              strokeWidth={1.75}
                            />
                            {b.duration}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleCopyBundleLink(e, b.id)}
                            aria-label={`Copy link to bundle ${b.id}`}
                            className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all"
                          >
                            {isCopied ? (
                              <>
                                <Check
                                  className="h-3 w-3 text-[hsl(var(--tint-mint-fg))]"
                                  strokeWidth={2}
                                />
                                <span className="text-[hsl(var(--tint-mint-fg))]">
                                  Copied
                                </span>
                              </>
                            ) : (
                              <>
                                <Link2
                                  className="h-3 w-3"
                                  strokeWidth={1.75}
                                />
                                <span>Copy link</span>
                              </>
                            )}
                          </button>
                          <Link
                            to={`/bundle/${b.id}`}
                            aria-label={`Open full bundle ${b.id}`}
                            className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all"
                          >
                            <span>Open bundle</span>
                            <ArrowUpRight
                              className="h-3 w-3"
                              strokeWidth={1.75}
                            />
                          </Link>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Coming soon */}
        <div className="mt-20 flex items-start gap-4 rounded-xl border border-dashed border-border/25 px-6 py-5 text-[13px] text-muted-foreground/50">
          <Camera
            className="h-4 w-4 shrink-0 mt-0.5 opacity-50"
            strokeWidth={1.75}
          />
          <p className="leading-relaxed">
            Visual frames, OCR overlays, and per-node capture reels will land
            here. The structure above is the scaffold — one card per bundle,
            expanding into a timeline of visual artifacts.
          </p>
        </div>
      </section>
    </main>
  );
};

export default Evidence;
