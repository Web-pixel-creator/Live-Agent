import type { PresentationBundle } from "@/data/presentationBundles";
import { ScrollText } from "lucide-react";

// Editorial hero for the bundle page. Gradient is reserved for the title
// italic span only (brand-mark style, not a surface) — everything else is
// flat per workspace rules. Sets the demo tone: serif display, generous air,
// tight mono meta strip under the title.
export function BundleHero({ bundle }: { bundle: PresentationBundle }) {
  return (
    <section className="relative overflow-hidden border-b border-primary/15">
      {/* Subtle radial glow behind the title — decorative, not a surface. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 0%, hsl(252 90% 76% / 0.14) 0%, transparent 70%)",
        }}
      />
      {/* Faint grid wash — same `grid-bg` utility used on landing hero,
          masked to the top so the lavender beam dominates. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[520px] grid-bg pointer-events-none opacity-40"
      />
      <div className="container-narrow relative pt-32 pb-28">
        {/* Kicker — DESIGN_2 lozenge with breathing icon chip + live dot. */}
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full ring-1 ring-inset ring-primary/25 bg-primary/[0.06] px-3 py-1 backdrop-blur-sm"
            data-diff="accent"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] bg-primary/15 ring-1 ring-inset ring-primary/30">
              <ScrollText
                className="h-2.5 w-2.5 text-primary animate-icon-breathe"
                strokeWidth={2}
                data-diff="motion"
              />
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-foreground/95">
              {bundle.kicker}
            </span>
            <span
              aria-hidden
              className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse-glow"
            />
          </span>
        </div>

        {/* Display title — two-part: lead (default serif) + italic accent.
            Trailing punctuation stays in the lead so the gradient wraps only
            the emphasis noun phrase. */}
        <h1 className="mt-6 font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[68px] leading-[1.02] tracking-tight max-w-4xl text-foreground">
          {bundle.titleLead}{" "}
          <span
            className="italic text-gradient-primary"
            style={{ paddingRight: "0.18em" }}
          >
            {bundle.titleItalic}
          </span>
          <span aria-hidden>.</span>
        </h1>

        {/* Verdict — workspace-tone subtitle */}
        <p
          className="mt-6 max-w-2xl text-[15px] md:text-[17px] leading-[1.7] text-foreground/85"
          data-diff="text"
        >
          {bundle.verdict}
        </p>

        {/* Meta strip — wrapped in a glass shell with a hairline-sweep top
            edge, so the metadata reads as a sealed audit row, not loose
            chips floating in space. */}
        <div
          className="mt-10 relative rounded-[12px] bg-background/40 ring-1 ring-inset ring-primary/15 backdrop-blur-sm overflow-hidden"
          data-diff="surface"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px animate-hairline-sweep"
          />
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 font-mono text-[11px] text-muted-foreground/95">
            <MetaItem label="Case" value={bundle.caseRef} />
            <MetaItem label="Operator" value={bundle.operator} />
            <MetaItem label="Duration" value={bundle.duration} />
            <MetaItem
              label="Outcome"
              value={bundle.outcomeLabel}
              accent={`hsl(var(--tint-${bundle.outcomeTone}-fg))`}
              dot={`hsl(var(--tint-${bundle.outcomeTone}-fg))`}
            />
            <MetaItem
              label="Confidence"
              value={`${bundle.confidence}%`}
              accent={`hsl(var(--tint-${bundle.outcomeTone}-fg))`}
            />
            <MetaItem label="Policy" value={bundle.policyHash} />
          </div>
        </div>
      </div>
    </section>
  );
}

function MetaItem({
  label,
  value,
  accent,
  dot,
}: {
  label: string;
  value: string;
  accent?: string;
  dot?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {dot && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full animate-pulse-glow"
          style={{ backgroundColor: dot }}
        />
      )}
      <span className="uppercase tracking-[0.18em] text-muted-foreground/90 text-[10px]">
        {label}
      </span>
      <span
        className="text-foreground/95"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </span>
  );
}
