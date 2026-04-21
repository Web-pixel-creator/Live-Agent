import { forwardRef } from "react";
import type { PresentationBundle } from "@/data/presentationBundles";

// Signature footer — the bundle's "sealed audit" moment. Mono-heavy: bundle id,
// policy hash, generated-at, verify hint. No CTAs, no gradients. This is the
// part a judge copy-pastes into their notes.
export function BundleSignature({ bundle }: { bundle: PresentationBundle }) {
  const generated = new Date(bundle.generatedAt);
  const formatted = generated.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <section>
      <div className="container-narrow py-16">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/95">
              <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse-glow" />
              Sealed audit artifact
            </div>
            <div className="mt-2 font-serif text-2xl md:text-3xl leading-tight text-foreground/90">
              This bundle is immutable.{" "}
              <span className="italic text-foreground/70">
                Anyone with the id can verify it.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground/95 md:text-right">
            <SigRow label="Bundle" value={bundle.id} highlight />
            <SigRow label="Policy" value={bundle.policyHash} />
            <SigRow label="Case" value={bundle.caseRef} />
            <SigRow label="Generated" value={formatted} />
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-primary/15 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/95">
          <span>Action Desk · Presentation bundle</span>
          <span>v1 · read-only · no PII</span>
        </div>
      </div>
    </section>
  );
}

interface SigRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

// Wrapped in forwardRef so React Router / HMR don't trip the
// "function component cannot be given refs" warning when re-mounted.
const SigRow = forwardRef<HTMLDivElement, SigRowProps>(function SigRow(
  { label, value, highlight },
  ref,
) {
  return (
    <div ref={ref} className="flex items-center gap-3 md:justify-end">
      <span className="uppercase tracking-[0.18em] text-muted-foreground/90 text-[10px]">
        {label}
      </span>
      <span
        className={highlight ? "text-[hsl(var(--tint-violet-fg))]" : "text-foreground/85"}
      >
        {value}
      </span>
    </div>
  );
});
