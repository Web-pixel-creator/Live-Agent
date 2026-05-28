// Edge node mock store — physical capture endpoints deployed at partner
// locations (visa centres, embassies, partner offices, mobile capture vans).
// The Action Desk operator uses /app/nodes to answer one question first:
// "can I trust the data flowing in from this device right now?"
//
// We model 20 nodes covering the full state matrix so the page exercises
// every branch of the UI: offline (rose), degraded heartbeat / queue
// (amber), maintenance windows (slate), and a healthy long tail (mint).

export type NodeStatus = "healthy" | "degraded" | "offline" | "maintenance";

export type NodeKind = "kiosk" | "scanner" | "mobile_capture" | "partner_terminal";

export interface NodeIncident {
  // ISO timestamp.
  at: string;
  // Short human label, surfaced in detail rail.
  label: string;
}

export interface EdgeNode {
  id: string;
  label: string;
  kind: NodeKind;
  city: string;
  country: string; // ISO-2, lines up with CountryChip flag map.
  tz: string;      // IANA timezone — used by detail rail "local time".
  owner: string;   // Operator/partner responsible for the device.
  status: NodeStatus;
  // Seconds since last heartbeat. Drives the freshness pill — fresh if <60,
  // amber if <600, rose if >=600. For offline/maintenance we still show the
  // last value so the operator knows when contact was lost.
  heartbeatAgoSec: number;
  uptime7d: number;        // 0..1
  queueDepth: number;      // pending uploads stuck on device
  errorRate24h: number;    // 0..1
  throughput24h: number;   // documents processed in last 24h
  firmware: string;        // agent version
  lastIncident?: NodeIncident;
  // 24 hourly heartbeat-success ratios (0..1, oldest → newest). Drives the
  // sparkline in the detail rail. Length is exactly 24 by convention.
  heartbeatHistory: number[];
}

// Deterministic helper for fake hourly traces — gives the sparklines varied
// but believable shapes without committing arrays of magic numbers per row.
function trace(seed: number, baseline: number, dipAt?: number): number[] {
  const out: number[] = [];
  for (let h = 0; h < 24; h++) {
    // Pseudo-random but stable wobble around the baseline.
    const wobble = ((Math.sin(seed * 7.3 + h * 0.91) + Math.cos(seed * 3.1 + h * 1.7)) * 0.04);
    let v = baseline + wobble;
    if (dipAt !== undefined && Math.abs(h - dipAt) < 3) {
      v -= 0.35 * (1 - Math.abs(h - dipAt) / 3);
    }
    out.push(Math.max(0, Math.min(1, Number(v.toFixed(3)))));
  }
  return out;
}

// Identity of the operator currently signed into the workspace. Mirrors the
// constant in LiveDesk so the "Mine" filter shares one source of truth.
export const CURRENT_OPERATOR = "A. Petrova";

export const edgeNodes: EdgeNode[] = [
  // ── Offline (top of the operator's worry list) ─────────────────────────
  {
    id: "NODE-LON-04",
    label: "London VAC · Counter 4",
    kind: "kiosk",
    city: "London",
    country: "UK",
    tz: "Europe/London",
    owner: "M. Adeyemi",
    status: "offline",
    heartbeatAgoSec: 8160, // ~2h 16m
    uptime7d: 0.812,
    queueDepth: 14,
    errorRate24h: 0.041,
    throughput24h: 92,
    firmware: "agent 4.2.1",
    lastIncident: { at: "2026-04-20T07:42:00Z", label: "Heartbeat lost mid-session" },
    heartbeatHistory: trace(11, 0.96, 22),
  },
  {
    id: "NODE-MUM-02",
    label: "Mumbai BLS · Window 2",
    kind: "scanner",
    city: "Mumbai",
    country: "IN",
    tz: "Asia/Kolkata",
    owner: "R. Iyer",
    status: "offline",
    heartbeatAgoSec: 17400, // ~4h 50m
    uptime7d: 0.74,
    queueDepth: 6,
    errorRate24h: 0.018,
    throughput24h: 41,
    firmware: "agent 3.9.0",
    lastIncident: { at: "2026-04-20T05:10:00Z", label: "Power cycle, no reconnect" },
    heartbeatHistory: trace(22, 0.93, 19),
  },

  // ── Degraded ──────────────────────────────────────────────────────────
  {
    id: "NODE-BER-01",
    label: "Berlin Konsulat · Reception",
    kind: "kiosk",
    city: "Berlin",
    country: "DE",
    tz: "Europe/Berlin",
    owner: CURRENT_OPERATOR,
    status: "degraded",
    heartbeatAgoSec: 220, // 3m 40s — slipping
    uptime7d: 0.967,
    queueDepth: 23,
    errorRate24h: 0.062,
    throughput24h: 188,
    firmware: "agent 4.2.1",
    lastIncident: { at: "2026-04-19T16:08:00Z", label: "OCR timeout spike" },
    heartbeatHistory: trace(33, 0.88, 14),
  },
  {
    id: "NODE-TOR-07",
    label: "Toronto VAC · Bay 7",
    kind: "scanner",
    city: "Toronto",
    country: "CA",
    tz: "America/Toronto",
    owner: "J. Khoury",
    status: "degraded",
    heartbeatAgoSec: 95, // borderline
    uptime7d: 0.954,
    queueDepth: 11,
    errorRate24h: 0.048,
    throughput24h: 142,
    firmware: "agent 4.1.7",
    heartbeatHistory: trace(44, 0.9, 18),
  },
  {
    id: "NODE-PAR-03",
    label: "Paris Consulat · Salle 3",
    kind: "kiosk",
    city: "Paris",
    country: "FR",
    tz: "Europe/Paris",
    owner: "L. Moreau",
    status: "degraded",
    heartbeatAgoSec: 412,
    uptime7d: 0.929,
    queueDepth: 31,
    errorRate24h: 0.071,
    throughput24h: 118,
    firmware: "agent 4.2.0",
    lastIncident: { at: "2026-04-20T04:22:00Z", label: "Upload backlog growing" },
    heartbeatHistory: trace(55, 0.85, 16),
  },
  {
    id: "NODE-MAD-05",
    label: "Madrid VAC · Mobile Van A",
    kind: "mobile_capture",
    city: "Madrid",
    country: "ES",
    tz: "Europe/Madrid",
    owner: CURRENT_OPERATOR,
    status: "degraded",
    heartbeatAgoSec: 178,
    uptime7d: 0.942,
    queueDepth: 8,
    errorRate24h: 0.039,
    throughput24h: 67,
    firmware: "agent 4.0.3",
    heartbeatHistory: trace(66, 0.91, 11),
  },

  // ── Maintenance ───────────────────────────────────────────────────────
  {
    id: "NODE-AMS-02",
    label: "Amsterdam Partner · Terminal B",
    kind: "partner_terminal",
    city: "Amsterdam",
    country: "NL",
    tz: "Europe/Amsterdam",
    owner: "Auto",
    status: "maintenance",
    heartbeatAgoSec: 1800,
    uptime7d: 0.991,
    queueDepth: 0,
    errorRate24h: 0.004,
    throughput24h: 0,
    firmware: "agent 4.3.0-rc",
    lastIncident: { at: "2026-04-20T06:00:00Z", label: "Scheduled firmware roll" },
    heartbeatHistory: trace(77, 0.97),
  },
  {
    id: "NODE-LIS-01",
    label: "Lisbon VAC · Counter 1",
    kind: "kiosk",
    city: "Lisbon",
    country: "PT",
    tz: "Europe/Lisbon",
    owner: "Auto",
    status: "maintenance",
    heartbeatAgoSec: 3600,
    uptime7d: 0.988,
    queueDepth: 2,
    errorRate24h: 0.006,
    throughput24h: 0,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(88, 0.96),
  },

  // ── Healthy long tail ─────────────────────────────────────────────────
  {
    id: "NODE-NYC-01",
    label: "New York VAC · Counter 1",
    kind: "kiosk",
    city: "New York",
    country: "US",
    tz: "America/New_York",
    owner: "S. Patel",
    status: "healthy",
    heartbeatAgoSec: 8,
    uptime7d: 0.998,
    queueDepth: 1,
    errorRate24h: 0.003,
    throughput24h: 412,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(99, 0.98),
  },
  {
    id: "NODE-TOK-02",
    label: "Tokyo Partner · Window 2",
    kind: "partner_terminal",
    city: "Tokyo",
    country: "JP",
    tz: "Asia/Tokyo",
    owner: "K. Sato",
    status: "healthy",
    heartbeatAgoSec: 21,
    uptime7d: 0.996,
    queueDepth: 0,
    errorRate24h: 0.002,
    throughput24h: 287,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(101, 0.99),
  },
  {
    id: "NODE-ROM-01",
    label: "Rome Consolato · Sala 1",
    kind: "kiosk",
    city: "Rome",
    country: "IT",
    tz: "Europe/Rome",
    owner: CURRENT_OPERATOR,
    status: "healthy",
    heartbeatAgoSec: 14,
    uptime7d: 0.994,
    queueDepth: 0,
    errorRate24h: 0.005,
    throughput24h: 198,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(112, 0.97),
  },
  {
    id: "NODE-SHA-04",
    label: "Shanghai VAC · Bay 4",
    kind: "scanner",
    city: "Shanghai",
    country: "CN",
    tz: "Asia/Shanghai",
    owner: "Y. Chen",
    status: "healthy",
    heartbeatAgoSec: 31,
    uptime7d: 0.992,
    queueDepth: 2,
    errorRate24h: 0.007,
    throughput24h: 356,
    firmware: "agent 4.2.0",
    heartbeatHistory: trace(123, 0.97),
  },
  {
    id: "NODE-LON-09",
    label: "London VAC · Counter 9",
    kind: "kiosk",
    city: "London",
    country: "UK",
    tz: "Europe/London",
    owner: "M. Adeyemi",
    status: "healthy",
    heartbeatAgoSec: 12,
    uptime7d: 0.997,
    queueDepth: 0,
    errorRate24h: 0.002,
    throughput24h: 244,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(134, 0.98),
  },
  {
    id: "NODE-BER-02",
    label: "Berlin Konsulat · Hall B",
    kind: "scanner",
    city: "Berlin",
    country: "DE",
    tz: "Europe/Berlin",
    owner: CURRENT_OPERATOR,
    status: "healthy",
    heartbeatAgoSec: 7,
    uptime7d: 0.999,
    queueDepth: 0,
    errorRate24h: 0.001,
    throughput24h: 305,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(145, 0.99),
  },
  {
    id: "NODE-PAR-08",
    label: "Paris Consulat · Mobile Van",
    kind: "mobile_capture",
    city: "Paris",
    country: "FR",
    tz: "Europe/Paris",
    owner: "L. Moreau",
    status: "healthy",
    heartbeatAgoSec: 26,
    uptime7d: 0.989,
    queueDepth: 1,
    errorRate24h: 0.008,
    throughput24h: 121,
    firmware: "agent 4.2.0",
    heartbeatHistory: trace(156, 0.96),
  },
  {
    id: "NODE-TOR-12",
    label: "Toronto VAC · Bay 12",
    kind: "scanner",
    city: "Toronto",
    country: "CA",
    tz: "America/Toronto",
    owner: "J. Khoury",
    status: "healthy",
    heartbeatAgoSec: 19,
    uptime7d: 0.995,
    queueDepth: 0,
    errorRate24h: 0.004,
    throughput24h: 211,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(167, 0.98),
  },
  {
    id: "NODE-NYC-06",
    label: "New York VAC · Counter 6",
    kind: "kiosk",
    city: "New York",
    country: "US",
    tz: "America/New_York",
    owner: "S. Patel",
    status: "healthy",
    heartbeatAgoSec: 11,
    uptime7d: 0.996,
    queueDepth: 0,
    errorRate24h: 0.003,
    throughput24h: 388,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(178, 0.98),
  },
  {
    id: "NODE-MUM-09",
    label: "Mumbai BLS · Window 9",
    kind: "scanner",
    city: "Mumbai",
    country: "IN",
    tz: "Asia/Kolkata",
    owner: "R. Iyer",
    status: "healthy",
    heartbeatAgoSec: 17,
    uptime7d: 0.991,
    queueDepth: 1,
    errorRate24h: 0.006,
    throughput24h: 263,
    firmware: "agent 4.2.0",
    heartbeatHistory: trace(189, 0.97),
  },
  {
    id: "NODE-AMS-05",
    label: "Amsterdam Partner · Terminal A",
    kind: "partner_terminal",
    city: "Amsterdam",
    country: "NL",
    tz: "Europe/Amsterdam",
    owner: "Auto",
    status: "healthy",
    heartbeatAgoSec: 9,
    uptime7d: 0.998,
    queueDepth: 0,
    errorRate24h: 0.002,
    throughput24h: 332,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(200, 0.99),
  },
  {
    id: "NODE-LIS-04",
    label: "Lisbon VAC · Counter 4",
    kind: "kiosk",
    city: "Lisbon",
    country: "PT",
    tz: "Europe/Lisbon",
    owner: "Auto",
    status: "healthy",
    heartbeatAgoSec: 22,
    uptime7d: 0.993,
    queueDepth: 0,
    errorRate24h: 0.005,
    throughput24h: 176,
    firmware: "agent 4.2.1",
    heartbeatHistory: trace(211, 0.97),
  },
];

// ── Derived helpers ──────────────────────────────────────────────────────

export interface NodeCounts {
  total: number;
  offline: number;
  degraded: number;
  maintenance: number;
  healthy: number;
  /** Things the operator probably wants to look at: offline + degraded. */
  needsAttention: number;
}

export function nodeCounts(nodes: EdgeNode[] = edgeNodes): NodeCounts {
  const c = {
    total: nodes.length,
    offline: 0,
    degraded: 0,
    maintenance: 0,
    healthy: 0,
    needsAttention: 0,
  };
  for (const n of nodes) {
    c[n.status] += 1;
    if (n.status === "offline" || n.status === "degraded") c.needsAttention += 1;
  }
  return c;
}

// Status order used everywhere — surface broken stuff first.
export const STATUS_ORDER: NodeStatus[] = ["offline", "degraded", "maintenance", "healthy"];

export const STATUS_META: Record<
  NodeStatus,
  { label: string; tint: "crimson" | "rose" | "amber" | "slate" | "mint"; pulse: boolean }
> = {
  // Offline uses crimson — strictly reserved for infra failure so it
  // visually outranks SLA-burning rose elsewhere in the workspace.
  offline:     { label: "Offline",     tint: "crimson", pulse: true  },
  degraded:    { label: "Degraded",    tint: "amber",   pulse: false },
  maintenance: { label: "Maintenance", tint: "slate",   pulse: false },
  healthy:     { label: "Healthy",     tint: "mint",    pulse: false },
};

export const KIND_LABEL: Record<NodeKind, string> = {
  kiosk:             "Kiosk",
  scanner:           "Scanner",
  mobile_capture:    "Mobile capture",
  partner_terminal:  "Partner terminal",
};

// Format "12s ago" / "3m 40s" / "2h 14m" — tight, mono-friendly.
export function formatHeartbeatAgo(sec: number): string {
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${String(s).padStart(2, "0")}s ago` : `${m}m ago`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m > 0 ? `${h}h ${String(m).padStart(2, "0")}m ago` : `${h}h ago`;
}

// Heartbeat freshness lens — shapes the row pill colour even for "healthy"
// devices that have started to slip but haven't tipped into degraded yet.
export type HeartbeatTone = "fresh" | "slipping" | "stale";
export function heartbeatTone(sec: number): HeartbeatTone {
  if (sec < 60) return "fresh";
  if (sec < 600) return "slipping";
  return "stale";
}

// Local time at the node's location — surfaced in detail rail so operators
// don't request a remote restart at 3am local.
export function nodeLocalTime(tz: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(now);
  } catch {
    return "—";
  }
}
