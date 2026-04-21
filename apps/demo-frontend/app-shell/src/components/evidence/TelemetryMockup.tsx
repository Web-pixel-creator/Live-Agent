import type { BundleEvidence } from "@/data/presentationBundles";
import { ArtifactFrame } from "./ArtifactFrame";

// A small heartbeat-style sparkline + a couple of stat rows. Conveys
// "live capture" at the moment the case touched the node.
export function TelemetryMockup({
  evidence,
  accent,
}: {
  evidence: BundleEvidence;
  accent: string;
}) {
  // Deterministic pseudo-random sparkline derived from the tag so different
  // telemetry artifacts don't all look identical, but each stays stable
  // across renders (no jitter on re-mount).
  const seed = (evidence.tag ?? evidence.title)
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const points: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * 280 + 20;
    const noise = Math.sin((i + seed) * 0.6) * 18 + Math.cos(i * 0.3 + seed) * 10;
    const y = 130 + noise;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return (
    <ArtifactFrame label="Node capture · telemetry" tag={evidence.tag}>
      <svg viewBox="0 0 320 220" className="w-full h-full" aria-hidden>
        {/* Grid */}
        {[40, 80, 120, 160, 200].map((y) => (
          <line
            key={y}
            x1="20"
            x2="300"
            y1={y}
            y2={y}
            stroke="hsl(var(--border) / 0.4)"
          />
        ))}
        {/* Baseline */}
        <line
          x1="20"
          x2="300"
          y1="130"
          y2="130"
          stroke="hsl(var(--muted-foreground) / 0.3)"
          strokeDasharray="2 3"
        />
        {/* Sparkline */}
        <polyline
          fill="none"
          stroke={accent}
          strokeOpacity="0.85"
          strokeWidth="1.5"
          points={points.join(" ")}
        />
        {/* Pulse dot at the end */}
        {(() => {
          const last = points[points.length - 1].split(",");
          return (
            <circle
              cx={last[0]}
              cy={last[1]}
              r="3"
              fill={accent}
              fillOpacity="0.9"
            />
          );
        })()}
        {/* Legend */}
        <text
          x="20"
          y="30"
          fontFamily="ui-monospace, monospace"
          fontSize="9"
          fill="hsl(var(--muted-foreground))"
        >
          HEARTBEAT · 1s
        </text>
        <text
          x="300"
          y="30"
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
          fontSize="9"
          fill={accent}
          fillOpacity="0.85"
        >
          OK
        </text>
      </svg>
    </ArtifactFrame>
  );
}
