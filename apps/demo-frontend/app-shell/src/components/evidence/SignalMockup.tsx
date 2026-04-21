import type { BundleEvidence } from "@/data/presentationBundles";
import { ArtifactFrame } from "./ArtifactFrame";

// Confidence-style horizontal bar + threshold line, evoking the moment a
// detector fired or a confidence score crossed (or didn't cross) a line.
export function SignalMockup({
  evidence,
  accent,
}: {
  evidence: BundleEvidence;
  accent: string;
}) {
  // Pull the *current* percentage from the contribution string. Signals often
  // mention multiple values (e.g. "94% baseline → 61% · below 75% threshold"):
  // we want the live composite (61), not the baseline and not the threshold.
  // Strategy: ignore any % immediately tied to "threshold"/"auto-route", then
  // take the last remaining match (which is the most recent state).
  const cleaned = evidence.contribution.replace(
    /(\d{1,3})\s*%\s*(auto[-\s]?route|threshold)/gi,
    "",
  );
  const matches = [...cleaned.matchAll(/(\d{1,3})\s*%/g)];
  const pct = matches.length
    ? parseInt(matches[matches.length - 1][1], 10)
    : Math.min(94, 60 + (evidence.tag?.length ?? 8) * 2);
  const barX = 30;
  const barW = 260;
  const fillW = (barW * pct) / 100;
  const thresholdX = barX + barW * 0.75;

  return (
    <ArtifactFrame label="Signal · detector trace" tag={evidence.tag}>
      <svg viewBox="0 0 320 220" className="w-full h-full" aria-hidden>
        {/* Header */}
        <text
          x="30"
          y="44"
          fontFamily="ui-monospace, monospace"
          fontSize="9"
          fill="hsl(var(--muted-foreground))"
        >
          COMPOSITE CONFIDENCE
        </text>
        <text
          x="290"
          y="44"
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
          fontSize="14"
          fill={accent}
        >
          {pct}%
        </text>

        {/* Bar background */}
        <rect
          x={barX}
          y="70"
          width={barW}
          height="14"
          rx="2"
          fill="hsl(var(--muted) / 0.5)"
        />
        {/* Bar fill */}
        <rect
          x={barX}
          y="70"
          width={fillW}
          height="14"
          rx="2"
          fill={accent}
          fillOpacity="0.7"
        />
        {/* Threshold marker (auto-route line at 75%) */}
        <line
          x1={thresholdX}
          x2={thresholdX}
          y1="60"
          y2="100"
          stroke="hsl(var(--muted-foreground) / 0.6)"
          strokeDasharray="2 3"
        />
        <text
          x={thresholdX + 4}
          y="60"
          fontFamily="ui-monospace, monospace"
          fontSize="8"
          fill="hsl(var(--muted-foreground))"
        >
          75% threshold
        </text>

        {/* Detail rows */}
        {[
          ["detector", evidence.tag ?? "sig·detector"],
          ["fired_at", "t+0.4s"],
          ["margin", `${Math.abs(pct - 75)}pp`],
        ].map(([k, v], i) => {
          const y = 130 + i * 22;
          return (
            <g key={k}>
              <text
                x="30"
                y={y}
                fontFamily="ui-monospace, monospace"
                fontSize="10"
                fill="hsl(var(--muted-foreground))"
              >
                {k}
              </text>
              <text
                x="290"
                y={y}
                textAnchor="end"
                fontFamily="ui-monospace, monospace"
                fontSize="10"
                fill="hsl(var(--foreground) / 0.85)"
              >
                {v}
              </text>
            </g>
          );
        })}
      </svg>
    </ArtifactFrame>
  );
}
