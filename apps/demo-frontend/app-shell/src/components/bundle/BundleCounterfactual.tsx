import type { PresentationBundle } from "@/data/presentationBundles";
import { SectionLabel } from "./BundleTimeline";

// Counterfactual — "what would have happened without Action Desk". Pull-quote
// in serif italic sets the tone, then a flat two-column table: with / without.
// Direction tint is applied ONLY to the withDesk value, never to the row bg.
export function BundleCounterfactual({ bundle }: { bundle: PresentationBundle }) {
  const { pullQuote, rows } = bundle.counterfactual;
  return (
    <section id="bundle-counterfactual" className="border-b border-primary/15 scroll-mt-20">
      <div className="container-narrow py-24 md:py-28">
        <SectionLabel index="04" label="The counterfactual" hint="Action Desk vs. baseline" />

        <p className="mt-8 max-w-2xl font-serif text-[20px] md:text-[22px] leading-[1.45] text-foreground/85">
          {bundle.counterfactualLead}
        </p>

        {/* Pull-quote */}
        <blockquote className="mt-12 max-w-3xl">
          <p className="font-serif italic text-2xl md:text-[30px] leading-[1.22] text-foreground/90 tracking-tight">
            &ldquo;{pullQuote}&rdquo;
          </p>
        </blockquote>

        {/* Table */}
        <div
          className="mt-14 rounded-[12px] bg-background/40 ring-1 ring-inset ring-primary/15 backdrop-blur-sm overflow-hidden"
          data-diff="radius"
        >
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-6 px-6 py-3 border-b border-primary/15 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/90">
            <span>Metric</span>
            <span className="text-right min-w-[120px]">With Action Desk</span>
            <span className="text-right min-w-[120px]">Manual baseline</span>
          </div>

          {rows.map((r, i) => {
            const accent =
              r.direction === "better"
                ? "hsl(var(--tint-mint-fg))"
                : r.direction === "worse"
                  ? "hsl(var(--tint-rose-fg))"
                  : "hsl(var(--foreground))";
            return (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto] gap-6 px-6 py-4 border-b border-primary/15 last:border-b-0 items-baseline"
              >
                <span className="text-[13px] text-foreground/90">{r.label}</span>
                <span
                  className="text-right font-mono text-[13px] tabular-nums min-w-[120px]"
                  style={{ color: accent }}
                >
                  {r.withDesk}
                </span>
                <span className="text-right font-mono text-[13px] tabular-nums text-muted-foreground/90 min-w-[120px]">
                  {r.withoutDesk}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
