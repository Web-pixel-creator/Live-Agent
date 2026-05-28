import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { PresentationBundle } from "@/data/presentationBundles";

// Thin footer nav rendered just above the signature on /bundle/:id.
// Surfaces the next bundle in the active index so a reviewer can traverse
// either curated demo bundles or runtime-backed case bundles without
// returning to /evidence.
export function BundleFooterNav({
  bundle,
  nextBundle,
}: {
  bundle: PresentationBundle;
  nextBundle?: PresentationBundle | null;
}) {
  if (!nextBundle || nextBundle.id === bundle.id) {
    return null;
  }

  return (
    <section className="border-t border-primary/15">
      <div className="container-narrow py-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left — ambient label, orients the reader */}
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/90">
            Continue the demo set
          </div>

          {/* Right — the actual pointer */}
          <Link
            to={`/bundle/${nextBundle.id}`}
            className="group flex items-baseline gap-4 md:gap-5"
          >
            <div className="min-w-0 text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/90">
                Next case
              </div>
              <div className="mt-1 font-serif text-[17px] md:text-[19px] leading-tight text-foreground/90 group-hover:text-foreground transition-colors">
                {nextBundle.titleLead}{" "}
                <span
                  className="italic"
                  style={{ color: `hsl(var(--tint-${nextBundle.outcomeTone}-fg))` }}
                >
                  {nextBundle.titleItalic}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10.5px] text-muted-foreground/90 tabular-nums">
                {nextBundle.id} · {nextBundle.caseRef} · {nextBundle.outcomeLabel}
              </div>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-muted-foreground/90 group-hover:text-foreground transition-colors animate-icon-drift"
              strokeWidth={1.75}
              data-diff="motion"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
