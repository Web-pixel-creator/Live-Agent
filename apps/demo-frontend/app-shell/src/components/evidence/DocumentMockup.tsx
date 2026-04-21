import type { BundleEvidence } from "@/data/presentationBundles";
import { ArtifactFrame } from "./ArtifactFrame";

// A page silhouette with redacted text lines and ONE highlighted field
// (the OCR target the AI cared about). The accent ring marks the field
// that actually fed the decision.
export function DocumentMockup({
  evidence,
  accent,
}: {
  evidence: BundleEvidence;
  accent: string;
}) {
  return (
    <ArtifactFrame label="OCR · document capture" tag={evidence.tag}>
      <svg viewBox="0 0 320 220" className="w-full h-full" aria-hidden>
        {/* Page */}
        <rect
          x="40"
          y="14"
          width="240"
          height="192"
          rx="3"
          fill="hsl(var(--card))"
          stroke="hsl(var(--border))"
        />
        {/* Header band */}
        <rect x="56" y="30" width="120" height="6" rx="1" fill="hsl(var(--muted-foreground) / 0.45)" />
        <rect x="56" y="44" width="80" height="4" rx="1" fill="hsl(var(--muted-foreground) / 0.25)" />
        {/* Body lines (redacted) */}
        {[68, 82, 96, 110, 138, 152, 166, 180].map((y, i) => (
          <rect
            key={y}
            x="56"
            y={y}
            width={i % 3 === 0 ? 200 : i % 3 === 1 ? 170 : 140}
            height="4"
            rx="1"
            fill="hsl(var(--muted-foreground) / 0.18)"
          />
        ))}
        {/* OCR target — outer glow halo (static), then breathing ring + fill.
            Halo gives depth even when the pulse is at its quiet phase. */}
        <g>
          <rect
            x="48"
            y="116"
            width="224"
            height="22"
            rx="4"
            fill="none"
            stroke={accent}
            strokeOpacity="0.18"
            strokeWidth="3"
          />
          <g className="animate-ocr-pulse" style={{ transformOrigin: "160px 127px" }}>
            <rect
              x="52"
              y="120"
              width="216"
              height="14"
              rx="2"
              fill={accent}
              fillOpacity="0.16"
              stroke={accent}
              strokeOpacity="0.7"
              strokeWidth="1"
            />
          </g>
          <rect x="56" y="125" width="170" height="4" rx="1" fill={accent} fillOpacity="0.9" />
        </g>
        {/* Corner crop marks */}
        {[
          [40, 14],
          [280, 14],
          [40, 206],
          [280, 206],
        ].map(([cx, cy], i) => (
          <g key={i} stroke={accent} strokeOpacity="0.35">
            <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} />
            <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} />
          </g>
        ))}
      </svg>
    </ArtifactFrame>
  );
}
