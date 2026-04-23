import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { BundleHero } from "@/components/bundle/BundleHero";
import { BundleTimeline } from "@/components/bundle/BundleTimeline";
import { BundleDecision } from "@/components/bundle/BundleDecision";
import { BundleEvidence } from "@/components/bundle/BundleEvidence";
import { BundleCounterfactual } from "@/components/bundle/BundleCounterfactual";
import { BundleSignature } from "@/components/bundle/BundleSignature";
import { BundleFooterNav } from "@/components/bundle/BundleFooterNav";
import { BundleTOC } from "@/components/bundle/BundleTOC";
import { BundleDiffOverlay } from "@/components/bundle/BundleDiffOverlay";
import { ArrowUpRight, Link2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { usePresentationBundle } from "@/hooks/usePresentationBundles";
import {
  buildRuntimeArtifactViewerPath,
  RUNTIME_ARTIFACT_VIEW_PRESETS,
} from "@/lib/runtime-artifact-viewer";

// Public read-only narrative of a single case. No workspace chrome (no
// sidebar, no topbar, no command palette) — a judge lands here from a bare
// link and reads top-to-bottom. Falls back to the featured bundle when no id.
const Bundle = () => {
  const { id } = useParams<{ id: string }>();
  const {
    bundle,
    defaultBundleId,
    nextBundle,
  } = usePresentationBundle(id ?? null);
  const resolvedId = id ?? defaultBundleId;
  const [copied, setCopied] = useState(false);
  const artifactViewerPath = buildRuntimeArtifactViewerPath(
    RUNTIME_ARTIFACT_VIEW_PRESETS.report,
    { caseRef: resolvedId },
  );

  const handleCopyLink = async () => {
    const url = new URL(`/bundle/${resolvedId}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for older browsers / non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // give up — toast still confirms intent
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast({
      title: "Link copied",
      description: "Bundle URL is on your clipboard — share it with anyone.",
    });
    window.setTimeout(() => setCopied(false), 1800);
  };

  // SEO: set title + description per bundle.
  useEffect(() => {
    if (!bundle) return;
    const prevTitle = document.title;
    const fullTitle = `${bundle.titleLead} ${bundle.titleItalic}`;
    document.title = `${fullTitle} · Action Desk bundle ${bundle.id}`;
    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") ?? "";
    if (desc) desc.setAttribute("content", bundle.verdict);
    return () => {
      document.title = prevTitle;
      if (desc) desc.setAttribute("content", prevDesc);
    };
  }, [bundle]);

  if (!bundle) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="container-narrow py-32">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            404 · bundle not found
          </div>
          <h1 className="mt-4 font-serif text-4xl leading-tight">
            No such bundle:{" "}
            <span className="italic text-muted-foreground/90">{resolvedId}</span>
          </h1>
          <p className="mt-4 text-[14px] text-muted-foreground max-w-lg">
            Bundles are generated on demand from live Action Desk cases. If this
            link was shared with you, ask the sender to regenerate it.
          </p>
          <Link
            to="/app"
            className="mt-8 inline-flex items-center gap-1.5 text-[13px] text-foreground/80 hover:text-foreground transition-colors"
          >
            Back to Action Desk
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Thin top rail — not a topbar, just a breadcrumb + back link. */}
      <div className="border-b border-primary/15" data-diff="accent">
        <div className="container-narrow h-11 flex items-center justify-between">
          <Link
            to="/app"
            className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Action Desk
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to={artifactViewerPath}
              className="group inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/90 hover:text-foreground transition-colors"
            >
              <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} />
              <span>Inspect report</span>
            </Link>
            <button
              type="button"
              onClick={handleCopyLink}
              aria-label="Copy bundle link"
              className="group inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/90 hover:text-foreground transition-colors"
            >
              {copied ? (
                <>
                  <Check
                    className="h-3 w-3 text-[hsl(var(--tint-mint-fg))]"
                    strokeWidth={2}
                  />
                  <span className="text-[hsl(var(--tint-mint-fg))]">Copied</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3 w-3 animate-icon-breathe" strokeWidth={1.75} data-diff="motion" />
                  <span>Copy link</span>
                </>
              )}
            </button>
            <span className="hidden sm:inline-block h-3 w-px bg-border/60" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/90">
              Presentation bundle · {bundle.id}
            </span>
          </div>
        </div>
      </div>

      <BundleHero bundle={bundle} />

      {/* TOC floats in the left gutter on lg+; on smaller screens it's
          hidden and the page reads top-down. Pointer-events-none on the
          wrapper so it never intercepts clicks on the centered content. */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden lg:block w-[max(1.5rem,calc((100%-64rem)/2))]">
          <div className="pointer-events-auto sticky top-24 pl-6 pr-4 pt-4">
            <BundleTOC outcomeTone={bundle.outcomeTone} />
          </div>
        </div>

        {/* Staggered reveal — each section enters 80ms after the previous,
            mirroring the curated cadence on /evidence. Wrapper divs carry
            the animation so each underlying section component stays
            untouched. `both` fill-mode in animate-fade-up holds opacity:0
            during the delay so nothing flashes before its turn. */}
        <div className="animate-fade-up" style={{ animationDelay: "0ms" }}>
          <BundleTimeline bundle={bundle} />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <BundleDecision bundle={bundle} />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
          <BundleEvidence bundle={bundle} />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "240ms" }}>
          <BundleCounterfactual bundle={bundle} />
        </div>
      <BundleFooterNav bundle={bundle} nextBundle={nextBundle} />
      </div>

      <BundleSignature bundle={bundle} />
      <BundleDiffOverlay />
    </main>
  );
};

export default Bundle;
