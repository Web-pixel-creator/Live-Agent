import type { BundleEvidence } from "@/data/presentationBundles";
import { ArtifactFrame } from "./ArtifactFrame";

// API-style key/value rows mimicking a JSON response from a registry.
export function ExternalCheckMockup({
  evidence,
  accent,
}: {
  evidence: BundleEvidence;
  accent: string;
}) {
  const rows = [
    ["endpoint", evidence.tag ?? "ext·api"],
    ["status", "200 OK"],
    ["latency", "184ms"],
    ["match", evidence.country ?? "—"],
    ["fresh", "14m ago"],
  ];
  return (
    <ArtifactFrame label="External check · response" tag={evidence.tag}>
      <svg viewBox="0 0 320 220" className="w-full h-full" aria-hidden>
        <rect
          x="20"
          y="20"
          width="280"
          height="180"
          rx="3"
          fill="hsl(var(--card))"
          stroke="hsl(var(--border))"
        />
        <line
          x1="20"
          x2="300"
          y1="44"
          y2="44"
          stroke="hsl(var(--border) / 0.6)"
        />
        <text
          x="32"
          y="36"
          fontFamily="ui-monospace, monospace"
          fontSize="9"
          fill="hsl(var(--muted-foreground))"
        >
          GET /v1/check
        </text>
        <circle cx="288" cy="33" r="3" fill={accent} />
        {rows.map(([k, v], i) => {
          const y = 66 + i * 26;
          return (
            <g key={k}>
              <text
                x="32"
                y={y}
                fontFamily="ui-monospace, monospace"
                fontSize="10"
                fill="hsl(var(--muted-foreground))"
              >
                {k}
              </text>
              <text
                x="288"
                y={y}
                textAnchor="end"
                fontFamily="ui-monospace, monospace"
                fontSize="10"
                fill={i === 1 ? accent : "hsl(var(--foreground) / 0.85)"}
              >
                {v}
              </text>
              <line
                x1="32"
                x2="288"
                y1={y + 6}
                y2={y + 6}
                stroke="hsl(var(--border) / 0.4)"
              />
            </g>
          );
        })}
      </svg>
    </ArtifactFrame>
  );
}
