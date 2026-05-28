import type { PresentationBundle } from "@/data/presentationBundles";
import { ConfidenceBar } from "@/components/workspace/runDetail/ConfidenceBar";
import { SectionLabel } from "./BundleTimeline";

// The decision block — central gravity of the bundle. Two columns on desktop:
// left is the editorial "why", right is the workspace-style decision card
// with confidence bar, policy blurb, and the "what changed" list.
export function BundleDecision({ bundle }: { bundle: PresentationBundle }) {
  const { decision, outcomeTone, confidence, outcomeLabel } = bundle;

  return (
    <section id="bundle-decision" className="border-b border-primary/15 scroll-mt-20">
      <div className="container-narrow py-24 md:py-28">
        <SectionLabel index="02" label="The decision" hint={outcomeLabel} />

        <p className="mt-8 max-w-2xl font-serif text-[20px] md:text-[22px] leading-[1.45] text-foreground/85">
          {bundle.decisionLead}
        </p>

        <div className="mt-14 grid gap-12 md:gap-14 md:grid-cols-[1.1fr_1fr]">
          {/* Left — editorial narrative */}
          <div>
            <p className="font-serif text-2xl md:text-[30px] leading-[1.2] text-foreground/95 tracking-tight">
              {decision.question}
            </p>
            <p className="mt-7 text-[14.5px] leading-[1.7] text-foreground/80 max-w-[52ch]">
              {decision.summary}
            </p>
          </div>

          {/* Right — workspace-tone decision card */}
          <div
            className="relative rounded-[12px] bg-background/40 ring-1 ring-inset ring-primary/15 backdrop-blur-sm overflow-hidden"
            data-diff="surface"
          >
            {/* Hairline sweep across the top edge — same signature as the
                hero meta strip, ties the two surfaces together. */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px animate-hairline-sweep pointer-events-none"
            />

            {/* Confidence strip */}
            <div className="px-6 py-5 border-b border-primary/15" data-diff="accent">
              <div className="flex items-baseline justify-between mb-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/95">
                  Confidence
                </span>
                <span
                  className="font-mono text-[14px] tabular-nums font-medium"
                  style={{ color: `hsl(var(--tint-${outcomeTone}-fg))` }}
                >
                  {confidence}%
                </span>
              </div>
              <ConfidenceBar value={confidence} tone={outcomeTone} />
            </div>

            {/* Policy */}
            <div className="px-6 py-5 border-b border-primary/15 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/95">
                  Policy
                </span>
                <span className="font-mono text-[10.5px] text-[hsl(var(--tint-violet-fg))] bg-[hsl(var(--tint-violet)/0.1)] ring-1 ring-inset ring-[hsl(var(--tint-violet)/0.25)] rounded-[4px] px-1.5 py-0.5">
                  {decision.policyName}
                </span>
              </div>
              <p className="text-[12.5px] leading-[1.6] text-foreground/85">
                {decision.policyDescription}
              </p>
            </div>

            {/* What changed */}
            <div className="px-6 py-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/95 mb-3.5">
                What changed
              </div>
              <ul className="flex flex-col gap-2.5">
                {decision.changes.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-[12.5px] leading-snug text-foreground/85"
                  >
                    <span
                      className="mt-0.5 inline-flex h-[18px] shrink-0 items-center justify-center rounded-[3px] px-1.5 ring-1 ring-inset font-mono text-[9.5px] uppercase tracking-[0.12em]"
                      style={{
                        backgroundColor:
                          c.kind === "changed"
                            ? "hsl(var(--tint-amber) / 0.14)"
                            : c.kind === "added"
                              ? "hsl(var(--tint-mint) / 0.14)"
                              : "hsl(var(--tint-rose) / 0.14)",
                        color:
                          c.kind === "changed"
                            ? "hsl(var(--tint-amber-fg))"
                            : c.kind === "added"
                              ? "hsl(var(--tint-mint-fg))"
                              : "hsl(var(--tint-rose-fg))",
                        ["--tw-ring-color" as any]:
                          c.kind === "changed"
                            ? "hsl(var(--tint-amber) / 0.3)"
                            : c.kind === "added"
                              ? "hsl(var(--tint-mint) / 0.3)"
                              : "hsl(var(--tint-rose) / 0.3)",
                      }}
                    >
                      {c.kind}
                    </span>
                    <span className="min-w-0">
                      <span className="text-foreground/95 font-medium">{c.label}</span>
                      {c.detail && (
                        <span className="ml-1.5 text-muted-foreground/95">
                          · {c.detail}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
