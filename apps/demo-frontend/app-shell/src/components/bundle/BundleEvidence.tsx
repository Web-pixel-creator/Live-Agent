import type { PresentationBundle } from "@/data/presentationBundles";
import { CountryChip } from "@/components/workspace/CountryChip";
import { SectionLabel } from "./BundleTimeline";
import { FileText, Radio, ShieldCheck, Activity } from "lucide-react";

const KIND_ICON = {
  Document: FileText,
  Signal: Radio,
  "External check": ShieldCheck,
  "Node telemetry": Activity,
} as const;

// Tone map — aligned with signal semantics, NOT just visual variety.
// - Document   → slate (neutral archival record)
// - Signal     → violet (AI-generated detection, brand tone)
// - External   → slate (third-party check, neutral-trusted, not "success")
// - Telemetry  → mint  (healthy infra state — amber would misread as warning)
const KIND_TONE: Record<string, string> = {
  Document: "slate",
  Signal: "violet",
  "External check": "slate",
  "Node telemetry": "mint",
};

// Evidence list — flat tiles, one per source. Each tile reads: kind-glyph,
// title, country/tag meta row, one-line contribution. Same visual weight
// across kinds so no single source dominates unless its tint says so.
export function BundleEvidence({ bundle }: { bundle: PresentationBundle }) {
  return (
    <section id="bundle-evidence" className="border-b border-primary/15 scroll-mt-20">
      <div className="container-narrow py-24 md:py-28">
        <SectionLabel
          index="03"
          label="The evidence"
          hint={`${bundle.evidence.length} sources`}
        />

        <p className="mt-8 max-w-2xl font-serif text-[20px] md:text-[22px] leading-[1.45] text-foreground/85">
          {bundle.evidenceLead}
        </p>

        <div className="mt-14 grid gap-4 md:gap-5 md:grid-cols-2">
          {bundle.evidence.map((e, i) => {
            const Icon = KIND_ICON[e.kind];
            const tone = KIND_TONE[e.kind];
            return (
              <div
                key={i}
                className="group relative flex gap-4 rounded-[12px] bg-background/40 ring-1 ring-inset ring-primary/15 backdrop-blur-sm p-5 pl-6 overflow-hidden transition-all duration-300 hover:bg-background/60 hover:ring-primary/25"
                data-diff={i === 0 ? "surface" : undefined}
              >
                {/* Dot grid — same capture-surface texture as ArtifactFrame */}
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.22] pointer-events-none transition-opacity duration-300 group-hover:opacity-[0.32]"
                  style={{
                    backgroundImage:
                      "radial-gradient(hsl(var(--muted-foreground) / 0.18) 1px, transparent 1px)",
                    backgroundSize: "14px 14px",
                  }}
                />
                {/* Vignette — soft edge darkening */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, transparent 60%, hsl(var(--background) / 0.5) 100%)",
                  }}
                />
                {/* Tone-rail on the left — gradient fades top→bottom for a
                    softer signature than a flat 2px stripe. */}
                <span
                  aria-hidden
                  className="absolute left-0 inset-y-3 w-[2px] rounded-r-full transition-opacity duration-300 group-hover:opacity-80"
                  style={{
                    background: `linear-gradient(to bottom, hsl(var(--tint-${tone}-fg) / 0.55), hsl(var(--tint-${tone}-fg) / 0.15))`,
                    opacity: 0.6,
                  }}
                />
                <span
                  className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] ring-1 ring-inset transition-colors duration-300"
                  style={{
                    backgroundColor: `hsl(var(--tint-${tone}) / 0.12)`,
                    ["--tw-ring-color" as any]: `hsl(var(--tint-${tone}) / 0.28)`,
                  }}
                  data-diff={i === 0 ? "radius" : undefined}
                >
                  <Icon
                    className="h-4 w-4 animate-icon-breathe"
                    strokeWidth={1.75}
                    style={{ color: `hsl(var(--tint-${tone}-fg))` }}
                    data-diff={i === 1 ? "motion" : undefined}
                  />
                </span>
                <div className="relative min-w-0 flex-1">
                  {/* Eyebrow — kind label sits ABOVE the title now, so the
                      title is the visual anchor of the tile. */}
                  <div
                    className="font-mono text-[9.5px] uppercase tracking-[0.2em] mb-1.5"
                    style={{ color: `hsl(var(--tint-${tone}-fg) / 0.85)` }}
                  >
                    {e.kind}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-foreground/95 leading-tight tracking-tight">
                      {e.title}
                    </span>
                    {e.country && <CountryChip code={e.country} />}
                    {e.tag && (
                      <span className="font-mono text-[10px] text-muted-foreground/95">
                        {e.tag}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 text-[12.5px] leading-[1.55] text-foreground/80">
                    {e.contribution}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
