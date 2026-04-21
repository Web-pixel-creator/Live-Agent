import { useEffect, useState } from "react";

/**
 * Tiny live sparkline for the hero workflow active-step indicator.
 * 28×10 SVG, six values, smoothed; new sample every ~700ms so the
 * line gently breathes without becoming visual noise. Pure visual
 * decoration — read as "this step is doing live work right now".
 */
export const HeroSparkline = () => {
  // Seeded baseline so the line has shape from first paint instead of
  // animating up from a flat zero (which reads as a glitch, not life).
  const [vals, setVals] = useState<number[]>(() => [4, 6, 3, 7, 5, 8]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVals((prev) => {
        // Random walk constrained to [2, 9] — keeps the line inside the
        // viewbox and avoids the occasional flat-line that breaks the
        // "live" illusion.
        const last = prev[prev.length - 1];
        const delta = Math.round((Math.random() - 0.5) * 6);
        const next = Math.min(9, Math.max(2, last + delta));
        return [...prev.slice(1), next];
      });
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  const W = 28;
  const H = 10;
  const step = W / (vals.length - 1);
  const points = vals
    .map((v, i) => `${(i * step).toFixed(2)},${(H - v).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="overflow-visible"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500 ease-out"
        style={{ filter: "drop-shadow(0 0 2px hsl(var(--primary) / 0.6))" }}
      />
      {/* Trailing dot — sits on the latest value, primary glow */}
      {(() => {
        const lastX = (vals.length - 1) * step;
        const lastY = H - vals[vals.length - 1];
        return (
          <circle
            cx={lastX}
            cy={lastY}
            r={1.2}
            fill="hsl(var(--primary))"
            className="transition-all duration-500 ease-out"
          />
        );
      })()}
    </svg>
  );
};
