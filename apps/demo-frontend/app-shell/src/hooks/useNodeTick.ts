// useNodeTick — single source of "now" for the /app/nodes surface.
//
// Every 5 seconds we bump a counter; downstream components derive their
// own freshness numbers (heartbeat-ago, sparkline tail, "synced Xs ago"
// footer) from it. We deliberately do NOT mutate the underlying
// edgeNodes store — keeping it immutable means selection state, group
// ordering and search results stay stable; only the rendered surface
// breathes.
//
// Tick semantics:
// - tickSec: seconds elapsed since the page was mounted. Drives every
//   "live" number on the page.
// - syncedAgoSec: tickSec % 5 (always < 5). Drives the footer label so
//   it reads "synced 2s ago" right before the next tick fires.
//
// Heartbeat & sparkline behaviour for each node status:
// - healthy:     heartbeat-ago resets to a small jittered value every
//                tick (the device is "actively checking in"). Sparkline
//                tail shifts every ~12s of wall-clock = 1 simulated
//                hour, so the chart visibly breathes.
// - degraded:    heartbeat-ago grows monotonically — the operator sees
//                the slip get worse. Sparkline shifts the same way.
// - offline:     frozen. The headline "unreachable 2h 16m" should not
//                grow forever in a demo (it would tip into days within
//                an hour and ruin the read).
// - maintenance: frozen for the same reason.

import { useEffect, useState } from "react";
import type { EdgeNode } from "@/data/nodes";

const TICK_MS = 5_000;
// One simulated "hour" of sparkline shift per N seconds of wall-clock.
// 12s feels alive without being chaotic; over a minute the chart moves
// 5 columns which is enough to register as "this is live".
const HOUR_SHIFT_SEC = 12;

export function useNodeTick(intervalMs: number = TICK_MS): number {
  const [tickSec, setTickSec] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setTickSec(Math.floor((Date.now() - start) / 1000));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return tickSec;
}

/** Seconds since the last 5-second tick — for "synced Xs ago" footer. */
export function syncedAgoSec(tickSec: number): number {
  return tickSec % 5;
}

// Deterministic per-node jitter so the freshly-checked-in number for
// healthy nodes doesn't all read "0s ago" at the same wall-clock
// instant — that would look mechanical. Hash the node id into a small
// offset (0..9 seconds).
function jitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 10;
}

/**
 * Project a node into its "live" view at the given tick. Pure function,
 * does not mutate. Returns a shallow clone with `heartbeatAgoSec` and
 * `heartbeatHistory` adjusted; everything else is the same reference.
 */
export function liveNodeView(node: EdgeNode, tickSec: number): EdgeNode {
  // Frozen states — nothing to update.
  if (node.status === "offline" || node.status === "maintenance") {
    return node;
  }

  // Heartbeat-ago.
  let heartbeatAgoSec: number;
  if (node.status === "healthy") {
    // Healthy devices reset to a small value (the jittered baseline)
    // every tick — they ARE checking in. Walk through the 5s window so
    // the number visibly counts up between ticks.
    const baseline = jitter(node.id);
    heartbeatAgoSec = baseline + (tickSec % 5);
  } else {
    // Degraded — slip gets worse. Anchor at the stored value.
    heartbeatAgoSec = node.heartbeatAgoSec + tickSec;
  }

  // Sparkline shift — drop oldest, append a new tail point. The new
  // point hovers near the trend's recent average so the chart doesn't
  // wildly jump frame to frame.
  const shifts = Math.floor(tickSec / HOUR_SHIFT_SEC);
  let heartbeatHistory = node.heartbeatHistory;
  if (shifts > 0 && node.heartbeatHistory.length > 0) {
    const N = node.heartbeatHistory.length;
    const tailAvg =
      node.heartbeatHistory.slice(-3).reduce((a, b) => a + b, 0) /
      Math.min(3, N);
    const next: number[] = [];
    // Use deterministic jitter per shift so animation is smooth, not
    // jumpy on re-renders within the same tick.
    for (let i = 0; i < shifts; i++) {
      const seed = (jitter(node.id) + i) % 10;
      const wobble = (seed - 5) / 100; // ±0.05
      const v = Math.max(0, Math.min(1, tailAvg + wobble));
      next.push(v);
    }
    heartbeatHistory = [...node.heartbeatHistory.slice(shifts), ...next];
    // Guard length — should always equal original length.
    if (heartbeatHistory.length > N) {
      heartbeatHistory = heartbeatHistory.slice(-N);
    }
  }

  return { ...node, heartbeatAgoSec, heartbeatHistory };
}
