import { useCallback, useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Activity,
  Globe2,
  Radar,
  Eye,
} from "lucide-react";
import { findBundle } from "@/data/presentationBundles";
import type { BundleEvidence } from "@/data/presentationBundles";
import { EvidenceArtifact } from "@/components/evidence/EvidenceArtifact";

// /evidence/:id — split-view picture trail.
// Active artifact is synced to ?a=<index> so deep-links work.
const EvidenceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const bundle = id ? findBundle(id) : undefined;
  const [searchParams, setSearchParams] = useSearchParams();

  const artifactCount = bundle?.evidence?.length ?? 0;

  const rawA = parseInt(searchParams.get("a") ?? "0", 10);
  const activeIdx =
    Number.isFinite(rawA) && rawA >= 0 && rawA < artifactCount ? rawA : 0;

  const setActiveIdx = useCallback(
    (updater: number | ((prev: number) => number)) => {
      const next =
        typeof updater === "function" ? updater(activeIdx) : updater;
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === 0) {
            p.delete("a");
          } else {
            p.set("a", String(next));
          }
          return p;
        },
        { replace: true },
      );
    },
    [activeIdx, setSearchParams],
  );

  useEffect(() => {
    const prev = document.title;
    document.title = bundle
      ? `Evidence · ${bundle.titleLead} ${bundle.titleItalic}`
      : "Evidence not found · Action Desk";
    return () => {
      document.title = prev;
    };
  }, [bundle]);

  const artifacts = useMemo<BundleEvidence[]>(
    () => bundle?.evidence ?? [],
    [bundle],
  );

  // Keyboard ←/→
  useEffect(() => {
    if (artifacts.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t?.isContentEditable
      )
        return;
      e.preventDefault();
      setActiveIdx((i) =>
        e.key === "ArrowLeft"
          ? (i - 1 + artifacts.length) % artifacts.length
          : (i + 1) % artifacts.length,
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [artifacts.length]);

  if (!bundle) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="container-narrow py-32 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            404 · evidence not found
          </div>
          <h1 className="mt-4 font-serif text-3xl">
            No bundle matched this id.
          </h1>
          <Link
            to="/evidence"
            className="mt-8 inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to evidence index
          </Link>
        </div>
      </main>
    );
  }

  const active = artifacts[activeIdx];
  const tone = bundle.outcomeTone;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top rail */}
      <div className="border-b border-border/30">
        <div className="container-narrow h-12 flex items-center justify-between">
          <Link
            to="/evidence"
            className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            All evidence
          </Link>
          <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/50">
            <Eye className="h-3 w-3" strokeWidth={1.5} />
            Picture trail
          </div>
        </div>
      </div>

      <section className="container-narrow pt-14 pb-20">
        {/* Hero */}
        <div className="flex items-start justify-between gap-8 flex-wrap">
          <div className="min-w-0 max-w-3xl space-y-4">
            {/* Breadcrumb */}
            <nav
              aria-label="Breadcrumb"
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/60 flex items-center gap-1.5 flex-wrap"
            >
              <Link
                to="/evidence"
                className="hover:text-foreground transition-colors"
              >
                Evidence
              </Link>
              <span aria-hidden className="text-muted-foreground/30">
                /
              </span>
              <span>{bundle.id}</span>
              {active && (
                <>
                  <span aria-hidden className="text-muted-foreground/30">
                    /
                  </span>
                  <span
                    className="normal-case tracking-normal text-foreground/80 truncate max-w-[30ch]"
                    title={active.title}
                  >
                    {active.title}
                  </span>
                </>
              )}
            </nav>

            <h1 className="font-serif text-3xl md:text-[2.5rem] leading-[1.12] tracking-tight">
              {bundle.titleLead}{" "}
              <span
                className="italic"
                style={{ color: `hsl(var(--tint-${tone}-fg))` }}
              >
                {bundle.titleItalic}
              </span>
            </h1>

            {/* Kicker meta */}
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/50">
              {bundle.kicker}
            </div>

            {/* Outcome row — pill + confidence mini-bar + count, in tiers */}
            <div className="flex items-center gap-4 flex-wrap pt-1">
              <span
                className="inline-flex items-center h-[24px] px-2.5 rounded-[5px] ring-1 ring-inset font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{
                  backgroundColor: `hsl(var(--tint-${tone}) / 0.12)`,
                  color: `hsl(var(--tint-${tone}-fg))`,
                  ["--tw-ring-color" as any]: `hsl(var(--tint-${tone}) / 0.28)`,
                }}
              >
                {bundle.outcomeLabel}
              </span>
              {/* Confidence mini-bar */}
              <div className="flex items-center gap-2.5">
                <div
                  className="relative h-[5px] w-[120px] rounded-full overflow-hidden"
                  style={{ backgroundColor: `hsl(var(--tint-${tone}) / 0.14)` }}
                  aria-hidden
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                    style={{
                      width: `${bundle.confidence}%`,
                      backgroundColor: `hsl(var(--tint-${tone}-fg))`,
                      boxShadow: `0 0 8px hsl(var(--tint-${tone}-fg) / 0.5)`,
                    }}
                  />
                </div>
                <span
                  className="font-mono text-[12px] tabular-nums font-medium"
                  style={{ color: `hsl(var(--tint-${tone}-fg))` }}
                >
                  {bundle.confidence}%
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/45">
                {artifacts.length} artifacts
              </span>
            </div>
          </div>

          <Link
            to={`/bundle/${bundle.id}`}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg ring-1 ring-inset ring-border/40 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/80 hover:text-foreground hover:ring-border/70 hover:bg-card/40 transition-all"
          >
            Open full bundle
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Split-view */}
        <div className="mt-14 grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Thumbnail rail */}
          <ol className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible -mx-1 px-1 lg:mx-0 lg:px-0 snap-x snap-mandatory">
            {artifacts.map((a, i) => {
              const isActive = i === activeIdx;
              return (
                <li
                  key={`${a.title}-${i}`}
                  className="snap-start shrink-0 w-[230px] lg:w-auto animate-fade-up opacity-0"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    animationFillMode: "forwards",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    aria-pressed={isActive}
                    className="group relative w-full text-left rounded-lg ring-1 ring-inset transition-all duration-200 p-3.5 pl-6 flex items-start gap-3.5 overflow-hidden"
                    style={{
                      backgroundColor: isActive
                        ? `hsl(var(--tint-${tone}) / 0.07)`
                        : "hsl(var(--card) / 0.18)",
                      ["--tw-ring-color" as any]: isActive
                        ? `hsl(var(--tint-${tone}-fg) / 0.28)`
                        : "hsl(var(--border) / 0.35)",
                      opacity: isActive ? 1 : 0.72,
                    }}
                  >
                    {/* Tone mini-rail — quiet glow, no lift, no shadow */}
                    <span
                      className="absolute left-0 inset-y-0 w-[2px] rounded-l-lg transition-all"
                      style={{
                        backgroundColor: `hsl(var(--tint-${tone}-fg))`,
                        opacity: isActive ? 0.9 : 0,
                        transform: isActive ? "scaleY(1)" : "scaleY(0.6)",
                      }}
                    />
                    <KindIcon kind={a.kind} isActive={isActive} tone={tone} />
                    <div className="min-w-0">
                      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50">
                        {a.kind}
                      </div>
                      <div
                        className="mt-1.5 text-[13px] leading-tight truncate transition-colors"
                        style={{
                          color: isActive
                            ? "hsl(var(--foreground))"
                            : "hsl(var(--foreground) / 0.65)",
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {a.title}
                      </div>
                      {a.tag && (
                        <div className="mt-1.5 font-mono text-[9px] text-muted-foreground/40 truncate">
                          {a.tag}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Preview pane */}
          <div
            className="min-w-0 animate-fade-up opacity-0"
            style={{
              animationDelay: `${artifacts.length * 60 + 80}ms`,
              animationFillMode: "forwards",
            }}
          >
            {active ? (
              <article className="space-y-7">
                <EvidenceArtifact evidence={active} outcomeTone={tone} />

                {/* Caption block — tone-rail on the left gives the title weight */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                  <div
                    className="relative pl-5 space-y-2.5 min-w-0"
                    style={{
                      borderLeft: `2px solid hsl(var(--tint-${tone}-fg) / 0.5)`,
                    }}
                  >
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/55">
                      {active.kind}
                      {active.country && (
                        <span className="text-muted-foreground/30">
                          {" "}
                          · {active.country}
                        </span>
                      )}
                    </div>
                    <h2 className="font-serif text-[1.65rem] leading-[1.2] tracking-tight">
                      {active.title}
                    </h2>
                    <p className="text-[13.5px] leading-relaxed text-muted-foreground/75 max-w-[58ch]">
                      {active.contribution}
                    </p>
                  </div>

                  {/* Nav controls — Next is tone-tinted as the primary action */}
                  <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground/60 tabular-nums shrink-0 self-start md:self-auto">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIdx((i) => Math.max(0, i - 1))
                      }
                      disabled={activeIdx === 0}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg ring-1 ring-inset ring-border/40 hover:text-foreground hover:ring-border/70 hover:bg-card/50 transition-all disabled:opacity-20 disabled:pointer-events-none"
                      aria-label="Previous artifact"
                      title="Previous (←)"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 min-w-[4ch] text-center text-foreground/80">
                      <span className="text-foreground font-medium">{activeIdx + 1}</span>
                      <span className="text-muted-foreground/30"> / </span>
                      {artifacts.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIdx((i) =>
                          Math.min(artifacts.length - 1, i + 1),
                        )
                      }
                      disabled={activeIdx === artifacts.length - 1}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg ring-1 ring-inset transition-all disabled:opacity-20 disabled:pointer-events-none"
                      style={{
                        backgroundColor:
                          activeIdx === artifacts.length - 1
                            ? "transparent"
                            : `hsl(var(--tint-${tone}) / 0.10)`,
                        color:
                          activeIdx === artifacts.length - 1
                            ? "hsl(var(--muted-foreground))"
                            : `hsl(var(--tint-${tone}-fg))`,
                        ["--tw-ring-color" as any]:
                          activeIdx === artifacts.length - 1
                            ? "hsl(var(--border) / 0.4)"
                            : `hsl(var(--tint-${tone}-fg) / 0.35)`,
                      }}
                      aria-label="Next artifact"
                      title="Next (→)"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <kbd className="hidden md:inline-flex ml-2 items-center gap-1 px-1.5 h-5 rounded text-muted-foreground/40 text-[9px] uppercase tracking-widest ring-1 ring-inset ring-border/30">
                      ←/→
                    </kbd>
                  </div>
                </div>
              </article>
            ) : (
              <div className="rounded-lg border border-dashed border-border/40 px-5 py-14 text-center text-[13px] text-muted-foreground/60">
                No artifacts captured for this bundle yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

function KindIcon({
  kind,
  isActive,
  tone,
}: {
  kind: BundleEvidence["kind"];
  isActive?: boolean;
  tone?: string;
}) {
  const Icon =
    kind === "Document"
      ? FileText
      : kind === "Node telemetry"
        ? Activity
        : kind === "External check"
          ? Globe2
          : Radar;
  return (
    <div
      className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center transition-colors"
      style={{
        backgroundColor: isActive
          ? `hsl(var(--tint-${tone}-fg) / 0.12)`
          : "hsl(var(--muted) / 0.3)",
      }}
    >
      <Icon
        className="h-3.5 w-3.5 transition-colors"
        style={{
          color: isActive
            ? `hsl(var(--tint-${tone}-fg))`
            : "hsl(var(--muted-foreground) / 0.5)",
        }}
        strokeWidth={1.75}
        aria-hidden
      />
    </div>
  );
}

export default EvidenceDetail;
