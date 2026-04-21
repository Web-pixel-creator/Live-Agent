// Pure derivation of an "activity timeline" for a node from existing
// state — no separate event store, no mock arrays per node. The rail
// shows the last 5-8 things that happened so the operator can read the
// device's recent history at a glance without leaving the page.
//
// Sources we synthesise events from:
//   1. lastIncident         → "heartbeat lost" / status-specific event
//   2. heartbeatHistory dips → "heartbeat slipped" markers (hours where
//      success ratio dropped below 0.6)
//   3. status                → derived ops events (maintenance start,
//      restart) inferred from current state
//   4. firmware              → "agent updated" event ~3-7 days ago
//
// Output is sorted newest-first and capped at 8 entries.

import type { EdgeNode, NodeStatus } from "@/data/nodes";

export type NodeActivityKind =
  | "heartbeat_lost"
  | "heartbeat_slipped"
  | "restart"
  | "maintenance_start"
  | "maintenance_end"
  | "firmware_update"
  | "recovered";

export interface NodeActivityEvent {
  kind: NodeActivityKind;
  /** Seconds-ago for the event. Drives the relative time label. We use
   *  numbers (not ISO strings) because the rail re-renders on the live
   *  tick and we want stable, deterministic ordering without parsing. */
  agoSec: number;
  /** One-line description rendered next to the icon. */
  label: string;
}

// --- helpers ---------------------------------------------------------

function isoToAgoSec(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

// Deterministic-but-varied "ago" for derived events that don't have a
// real timestamp. Keeps the timeline from looking templated across nodes
// without needing to fabricate ISO strings in the data file.
function jitterAgo(seed: string, baseHours: number, spreadHours: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const frac = (h % 1000) / 1000;
  return Math.floor((baseHours + frac * spreadHours) * 3600);
}

// --- main derivation -------------------------------------------------

export function deriveNodeActivity(node: EdgeNode): NodeActivityEvent[] {
  const events: NodeActivityEvent[] = [];

  // 1. Last incident — the anchor event, almost always present for
  //    broken nodes. Label is taken straight from the incident record.
  if (node.lastIncident) {
    events.push({
      kind: incidentKind(node.status),
      agoSec: isoToAgoSec(node.lastIncident.at),
      label: node.lastIncident.label,
    });
  }

  // 2. Heartbeat dips — scan the 24h history for hours where the success
  //    ratio dropped below 0.6 and emit a marker. These read as
  //    "transient blips" leading up to the current state.
  //    history[0] = 24h ago, history[23] = ~now.
  node.heartbeatHistory.forEach((ratio, idx) => {
    if (ratio < 0.6) {
      const hoursAgo = 24 - idx;
      events.push({
        kind: "heartbeat_slipped",
        agoSec: hoursAgo * 3600,
        label: `Heartbeat slipped to ${Math.round(ratio * 100)}%`,
      });
    }
  });

  // 3. Status-derived ops events — we infer one or two believable
  //    actions that would have happened given the current state.
  if (node.status === "maintenance") {
    events.push({
      kind: "maintenance_start",
      agoSec: jitterAgo(node.id + "maint", 2, 4), // 2-6h ago
      label: "Scheduled maintenance window started",
    });
  }
  if (node.status === "healthy" && node.uptime7d > 0.99) {
    // A very clean healthy node gets a "recovered" entry — implies a
    // past blip that's now resolved, makes the history feel earned.
    events.push({
      kind: "recovered",
      agoSec: jitterAgo(node.id + "rec", 18, 30), // ~18-48h ago
      label: "Recovered to nominal heartbeat",
    });
  }
  if (node.status === "degraded" && node.queueDepth > 15) {
    // High queue + degraded → operator likely tried a restart recently.
    events.push({
      kind: "restart",
      agoSec: jitterAgo(node.id + "rst", 1, 3), // 1-4h ago
      label: "Restart requested by operator",
    });
  }

  // 4. Firmware update — every node gets one, dated 3-7 days back so it
  //    sits at the bottom of the timeline as the "earliest known event".
  events.push({
    kind: "firmware_update",
    agoSec: jitterAgo(node.id + "fw", 72, 96), // 3-7d ago
    label: `Agent updated to ${node.firmware.replace(/^agent /, "")}`,
  });

  // Sort newest-first and cap. 8 fits comfortably in the rail without
  // forcing the action footer below the fold on a 14" laptop.
  events.sort((a, b) => a.agoSec - b.agoSec);
  return events.slice(0, 8);
}

// Map current status → which kind of incident sits at the top of the
// timeline. Keeps the icon/colour vocabulary aligned with the status
// pill in the banner above.
function incidentKind(status: NodeStatus): NodeActivityKind {
  switch (status) {
    case "offline":
      return "heartbeat_lost";
    case "degraded":
      return "heartbeat_slipped";
    case "maintenance":
      return "maintenance_start";
    default:
      return "recovered";
  }
}

// Compact relative-time formatter. Rail uses tabular nums so the column
// stays aligned even with mixed units.
export function formatActivityAgo(sec: number): string {
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
