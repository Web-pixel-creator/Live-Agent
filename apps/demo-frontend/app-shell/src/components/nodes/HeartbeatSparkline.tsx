// Heartbeat sparkline — pure SVG, no charting lib.
//
// 2026 refresh: smooth Catmull-Rom curve, vertical gradient fill that fades
// to transparent, soft glow under the line, and small "incident" dots with
// a halo so the eye lands on outages first. Tint follows node status.

import type { NodeStatus } from "@/data/nodes";
import { STATUS_META } from "@/data/nodes";
import { useId } from "react";

interface HeartbeatSparklineProps {
  data: number[]; // 0..1, length 24 by convention
  status: NodeStatus;
  width?: number;
  height?: number;
}

// Catmull-Rom → cubic Bezier for an organic line without chart-lib weight.
function smoothPath(pts: ReadonlyArray<readonly [number, number]>): string {
  if (pts.length < 2) return "";
  const d: string[] = [`M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`,
    );
  }
  return d.join(" ");
}

export function HeartbeatSparkline({
  data,
  status,
  width = 332,
  height = 72,
}: HeartbeatSparklineProps) {
  const uid = useId().replace(/[:]/g, "");
  if (data.length === 0) return null;

  const tint = STATUS_META[status].tint;
  const stroke = `hsl(var(--tint-${tint}-fg))`;

  const padX = 4;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - v) * innerH;
    return [x, y] as const;
  });

  const linePath = smoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath =
    `${linePath} L ${last[0].toFixed(2)} ${(padY + innerH).toFixed(2)} ` +
    `L ${first[0].toFixed(2)} ${(padY + innerH).toFixed(2)} Z`;

  const dips = points
    .map((p, i) => [p, i] as const)
    .filter(([, i]) => data[i] < 0.6);

  const gradId = `hb-grad-${uid}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Heartbeat success over the last 24 hours"
      className="block w-full h-auto"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={`hsl(var(--tint-${tint}-fg))`} stopOpacity="0.22" />
          <stop offset="70%" stopColor={`hsl(var(--tint-${tint}))`} stopOpacity="0.06" />
          <stop offset="100%" stopColor={`hsl(var(--tint-${tint}))`} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Faint baseline grid — 100% / 50% references */}
      <line
        x1={padX}
        x2={width - padX}
        y1={padY + 0.5}
        y2={padY + 0.5}
        stroke="hsl(var(--border))"
        strokeWidth={1}
        strokeDasharray="2 4"
        opacity={0.35}
      />

      <path d={areaPath} fill={`url(#${gradId})`} opacity={0.85} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />

      {/* Trailing dot on the latest reading — anchors the eye on "now" */}
      <circle
        cx={last[0]}
        cy={last[1]}
        r={2.2}
        fill={stroke}
      />

      {/* Incident markers — subtle, no halo */}
      {dips.map(([[x, y], i]) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={1.8}
          fill="hsl(var(--background))"
          stroke={stroke}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
