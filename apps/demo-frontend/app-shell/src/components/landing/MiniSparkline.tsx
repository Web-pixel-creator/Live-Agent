/**
 * MiniSparkline — tiny SVG chart used inside the hero dashboard preview.
 * Pure SVG, no deps; lavender stroke + soft area fill on brand.
 */
interface MiniSparklineProps {
  points: number[];
  height?: number;
  className?: string;
}

export const MiniSparkline = ({ points, height = 64, className }: MiniSparklineProps) => {
  const w = 100;
  const h = height;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height: `${h}px`, display: "block" }}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(252 90% 76%)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(252 90% 76%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path
        d={path}
        fill="none"
        stroke="hsl(252 90% 76%)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
