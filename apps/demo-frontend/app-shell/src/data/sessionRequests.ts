// Operator-issued document requests, persisted to localStorage so the inbox
// survives a page refresh. React components subscribe via the hooks below
// (`useCaseRequests`, `useAllRequestCounts`) so re-renders happen the moment
// a request is recorded — and a `storage` event listener keeps multiple tabs
// in sync.
//
// Shape: caseRef → ordered list of RequestRecord. Order matters because we
// splice synthetic events into the case timeline.

import { useSyncExternalStore } from "react";
import type { CaseDocument, CaseEvent, WorkspaceCase } from "./workspace";

export interface RequestRecord {
  doc: string;
  at: string; // ISO timestamp of original request
  resentAt?: string; // ISO timestamp of last resend (if any)
  received?: boolean; // operator manually marked as received
  receivedAt?: string;
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------
// Versioned key so we can evolve the schema without crashing older snapshots.
const STORAGE_KEY = "actiondesk:requests:v1";

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const hydrate = (): Map<string, RequestRecord[]> => {
  if (!isBrowser) return new Map();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, RequestRecord[]>;
    if (!parsed || typeof parsed !== "object") return new Map();
    const map = new Map<string, RequestRecord[]>();
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v) && v.length > 0) map.set(k, v);
    }
    return map;
  } catch {
    return new Map();
  }
};

// Keyed by case ref. Hydrated synchronously from localStorage on module load
// so the first render already reflects persisted state.
const requests: Map<string, RequestRecord[]> = hydrate();

const persist = () => {
  if (!isBrowser) return;
  try {
    if (requests.size === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const obj: Record<string, RequestRecord[]> = {};
    for (const [k, v] of requests) obj[k] = v;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Quota exceeded / disabled storage — stay in-memory only.
  }
};

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// ---------------------------------------------------------------------------
// Cross-tab sync
// ---------------------------------------------------------------------------
// Primary path: BroadcastChannel — works in any same-origin browsing context,
// including sandboxed iframes that share an origin. Fallback: native `storage`
// event for browsers that don't expose BroadcastChannel.
//
// ⚠️ Preview-environment caveat: lovable's preview opens each browser tab in
// an isolated sandbox, which means *both* mechanisms are blocked between
// tabs in the preview. In production (a real deployment served from a single
// origin) cross-tab sync works as designed. For true cross-device sync —
// outside any same-origin constraints — promote this store to a real backend
// table with realtime subscriptions.
const CHANNEL_NAME = "actiondesk:requests";
const channel: BroadcastChannel | null =
  isBrowser && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

// Tag every outgoing message with a per-tab id so we can ignore echoes of
// our own writes (BroadcastChannel does not deliver to the sending context,
// but we keep the guard for safety across HMR reloads).
const TAB_ID = isBrowser ? `${Date.now()}-${Math.random().toString(36).slice(2)}` : "ssr";

interface SyncMessage {
  tabId: string;
  data: Record<string, RequestRecord[]>;
}

const serializeRequests = (): Record<string, RequestRecord[]> => {
  const obj: Record<string, RequestRecord[]> = {};
  for (const [k, v] of requests) obj[k] = v;
  return obj;
};

const applyRemote = (data: Record<string, RequestRecord[]>) => {
  requests.clear();
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v) && v.length > 0) requests.set(k, v);
  }
  // Mirror to localStorage for refresh-survival in this tab too. We don't
  // re-broadcast — the originating tab already did.
  try {
    if (isBrowser) {
      if (requests.size === 0) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // ignore quota / disabled storage
  }
  listeners.forEach((fn) => fn());
};

if (channel) {
  channel.addEventListener("message", (e: MessageEvent<SyncMessage>) => {
    const msg = e.data;
    if (!msg || msg.tabId === TAB_ID) return;
    applyRemote(msg.data);
  });
}

const broadcast = () => {
  if (!channel) return;
  try {
    channel.postMessage({ tabId: TAB_ID, data: serializeRequests() } satisfies SyncMessage);
  } catch {
    // channel closed — drop silently
  }
};

const emit = () => {
  persist();
  broadcast();
  listeners.forEach((fn) => fn());
};

// Fallback: native `storage` event. Only fires across tabs in browsers that
// share localStorage between contexts — useful when BroadcastChannel is
// unavailable. No-op when our key didn't change.
if (isBrowser) {
  window.addEventListener("storage", (e) => {
    if (e.storageArea !== window.localStorage) return;
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    const next = hydrate();
    requests.clear();
    for (const [k, v] of next) requests.set(k, v);
    listeners.forEach((fn) => fn());
  });
}

// Stable snapshot per (case, docs[]) input — we cache by the records array
// reference so useSyncExternalStore's getSnapshot is referentially stable
// between unrelated re-renders.
const snapshotCache = new WeakMap<RequestRecord[], RequestRecord[]>();
const EMPTY: RequestRecord[] = [];

const getSnapshot = (caseRef: string): RequestRecord[] => {
  const recs = requests.get(caseRef);
  if (!recs || recs.length === 0) return EMPTY;
  let cached = snapshotCache.get(recs);
  if (!cached) {
    cached = recs.slice();
    snapshotCache.set(recs, cached);
  }
  return cached;
};

/**
 * Record an operator request. Idempotent: requesting the same doc twice is a no-op.
 * Returns an `undo` thunk that removes the just-added record (or null if no-op),
 * so callers can wire a 5s "Undo" toast without juggling state themselves.
 */
export const recordDocRequest = (caseRef: string, doc: string): (() => void) | null => {
  const existing = requests.get(caseRef) ?? [];
  if (existing.some((r) => r.doc === doc)) return null;
  const next = [...existing, { doc, at: new Date().toISOString() }];
  requests.set(caseRef, next);
  emit();
  return () => {
    const cur = requests.get(caseRef);
    if (!cur) return;
    const filtered = cur.filter((r) => r.doc !== doc);
    if (filtered.length === 0) requests.delete(caseRef);
    else requests.set(caseRef, filtered);
    emit();
  };
};

/**
 * Resend an existing request — bumps the resentAt timestamp. No-op if not found.
 * Returns an undo thunk restoring the previous resentAt value (or undefined).
 */
export const resendDocRequest = (caseRef: string, doc: string): (() => void) | null => {
  const existing = requests.get(caseRef);
  if (!existing) return null;
  const idx = existing.findIndex((r) => r.doc === doc);
  if (idx === -1) return null;
  const prevResentAt = existing[idx].resentAt;
  const next = existing.slice();
  next[idx] = { ...next[idx], resentAt: new Date().toISOString() };
  requests.set(caseRef, next);
  emit();
  return () => {
    const cur = requests.get(caseRef);
    if (!cur) return;
    const j = cur.findIndex((r) => r.doc === doc);
    if (j === -1) return;
    const restored = cur.slice();
    const { resentAt: _drop, ...rest } = restored[j];
    restored[j] = prevResentAt ? { ...rest, resentAt: prevResentAt } : rest;
    requests.set(caseRef, restored);
    emit();
  };
};

/**
 * Mark a previously-requested doc as received — flips review → ok in the derived view.
 * Returns an undo thunk that clears the received flag.
 */
export const markDocReceived = (caseRef: string, doc: string): (() => void) | null => {
  const existing = requests.get(caseRef);
  if (!existing) return null;
  const idx = existing.findIndex((r) => r.doc === doc);
  if (idx === -1) return null;
  const prev = existing[idx];
  if (prev.received) return null;
  const next = existing.slice();
  next[idx] = { ...next[idx], received: true, receivedAt: new Date().toISOString() };
  requests.set(caseRef, next);
  emit();
  return () => {
    const cur = requests.get(caseRef);
    if (!cur) return;
    const j = cur.findIndex((r) => r.doc === doc);
    if (j === -1) return;
    const restored = cur.slice();
    const { received: _r, receivedAt: _ra, ...rest } = restored[j];
    restored[j] = rest;
    requests.set(caseRef, restored);
    emit();
  };
};

/**
 * Shift every request timestamp back by N hours. Demo helper so operators can
 * see the "Awaiting reply · 24h+" bucket populate without editing localStorage
 * by hand. Both `at` and `resentAt` move so the staleness clock advances even
 * for already-resent requests. Returns undo (restoring prior snapshot) or null
 * when there's nothing to shift.
 */
export const backdateAllRequests = (hours: number): (() => void) | null => {
  if (requests.size === 0) return null;
  const snapshot = new Map<string, RequestRecord[]>();
  for (const [k, v] of requests) snapshot.set(k, v.map((r) => ({ ...r })));
  const deltaMs = hours * 60 * 60 * 1000;
  const shift = (iso: string) => new Date(new Date(iso).getTime() - deltaMs).toISOString();
  for (const [k, v] of requests) {
    requests.set(
      k,
      v.map((r) => ({
        ...r,
        at: shift(r.at),
        ...(r.resentAt ? { resentAt: shift(r.resentAt) } : {}),
      })),
    );
  }
  emit();
  return () => {
    requests.clear();
    for (const [k, v] of snapshot) requests.set(k, v);
    emit();
  };
};

/**
 * Seed a curated set of demo requests across multiple cases with staggered
 * staleness — gives a presentation-ready snapshot of the inbox in one click:
 * fresh request, half-day-old, day-old, and a clearly stale 3-day-old. We
 * skip cases that already have a record for that exact doc so re-running the
 * command is idempotent and never duplicates an active row.
 *
 * Returns an undo thunk restoring the prior snapshot, plus the count seeded
 * so the caller can render a precise toast. Returns null when nothing was
 * seeded (every target already had a record).
 */
export interface SeedDemoResult {
  undo: () => void;
  seeded: number;
}

interface SeedSpec {
  caseRef: string;
  doc: string;
  /** Hours ago — used to backdate `at` so each row sits in a different bucket. */
  hoursAgo: number;
}

const DEMO_SEED: SeedSpec[] = [
  // Hard-coded for deterministic demos. Doc names match `missing` entries in
  // workspaceCases so the request flips them into review state cleanly.
  { caseRef: "VS-2841", doc: "Passport scan",          hoursAgo: 0.25 }, // ~15m → "now"
  { caseRef: "VS-2836", doc: "Country-of-origin docs", hoursAgo: 8 },    // half-day
  { caseRef: "VS-2838", doc: "Passport scan",          hoursAgo: 30 },   // 1d+
  { caseRef: "VS-2839", doc: "Reference letter · EN",  hoursAgo: 72 },   // 3d — clearly stale
];

export const seedDemoRequests = (): SeedDemoResult | null => {
  // Snapshot prior state for the undo thunk before any mutations.
  const snapshot = new Map<string, RequestRecord[]>();
  for (const [k, v] of requests) snapshot.set(k, v.map((r) => ({ ...r })));

  const now = Date.now();
  let seeded = 0;
  for (const spec of DEMO_SEED) {
    const existing = requests.get(spec.caseRef) ?? [];
    if (existing.some((r) => r.doc === spec.doc)) continue;
    const at = new Date(now - spec.hoursAgo * 60 * 60 * 1000).toISOString();
    requests.set(spec.caseRef, [...existing, { doc: spec.doc, at }]);
    seeded += 1;
  }
  if (seeded === 0) return null;
  emit();
  return {
    seeded,
    undo: () => {
      requests.clear();
      for (const [k, v] of snapshot) requests.set(k, v);
      emit();
    },
  };
};

/**
 * Wipe every recorded request across all cases. Returns an undo thunk that
 * restores the prior snapshot — handy for demo resets via the command palette.
 * Returns null when there's nothing to clear.
 */
export const clearAllRequests = (): (() => void) | null => {
  if (requests.size === 0) return null;
  const snapshot = new Map<string, RequestRecord[]>();
  for (const [k, v] of requests) snapshot.set(k, v.slice());
  requests.clear();
  emit();
  return () => {
    requests.clear();
    for (const [k, v] of snapshot) requests.set(k, v);
    emit();
  };
};

/**
 * One-shot presenter reset: wipes the inbox, then re-seeds the curated demo
 * mix — all under a single snapshot so a single Cmd+Z restores whatever the
 * operator had before. Always succeeds (returns the seeded count plus an undo
 * thunk) regardless of prior state, so it's the canonical "snap back to a
 * known good demo" command.
 */
export const resetDemoState = (): SeedDemoResult => {
  // Snapshot whatever was there before — could be empty, partially seeded,
  // backdated, mid-conversation… all variations restore via this single thunk.
  const snapshot = new Map<string, RequestRecord[]>();
  for (const [k, v] of requests) snapshot.set(k, v.map((r) => ({ ...r })));

  // Wipe in-place (skip emit — we'll batch one emit at the end so subscribers
  // see the new seeded state directly, no flash of empty inbox).
  requests.clear();

  const now = Date.now();
  let seeded = 0;
  for (const spec of DEMO_SEED) {
    const at = new Date(now - spec.hoursAgo * 60 * 60 * 1000).toISOString();
    const existing = requests.get(spec.caseRef) ?? [];
    requests.set(spec.caseRef, [...existing, { doc: spec.doc, at }]);
    seeded += 1;
  }
  emit();

  return {
    seeded,
    undo: () => {
      requests.clear();
      for (const [k, v] of snapshot) requests.set(k, v);
      emit();
    },
  };
};

/** Subscribe to request changes for a single case. */
export const useCaseRequests = (caseRef: string): RequestRecord[] => {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(caseRef),
    () => EMPTY,
  );
};

// ---------------------------------------------------------------------------
// Aggregate hook: caseRef → number of *outstanding* requests in this session.
// "Outstanding" = sent but not yet marked received. This drives the Live Desk
// chip so an operator can spot at a glance which cases they've nudged.
//
// We rebuild a fresh Map each emit and compare against the previous snapshot
// by cheap structural equality (same size + same entries). When equal we
// return the prior reference so useSyncExternalStore stays stable.
// ---------------------------------------------------------------------------
let countsSnapshot: ReadonlyMap<string, number> = new Map();
const EMPTY_COUNTS: ReadonlyMap<string, number> = new Map();

const computeCounts = (): ReadonlyMap<string, number> => {
  const next = new Map<string, number>();
  for (const [ref, recs] of requests) {
    const outstanding = recs.reduce((n, r) => (r.received ? n : n + 1), 0);
    if (outstanding > 0) next.set(ref, outstanding);
  }
  // Stability check — same size + same entries → reuse previous reference.
  if (next.size === countsSnapshot.size) {
    let same = true;
    for (const [k, v] of next) {
      if (countsSnapshot.get(k) !== v) {
        same = false;
        break;
      }
    }
    if (same) return countsSnapshot;
  }
  countsSnapshot = next;
  return countsSnapshot;
};

/** Subscribe to outstanding-request counts across all cases. */
export const useAllRequestCounts = (): ReadonlyMap<string, number> => {
  return useSyncExternalStore(
    subscribe,
    computeCounts,
    () => EMPTY_COUNTS,
  );
};

// ---------------------------------------------------------------------------
// Aggregate hook: caseRef → ISO timestamp of the *earliest outstanding* request.
// "Earliest outstanding" is the most useful staleness signal — if a case has
// 3 requests sent at different times, the oldest one is what tells you how
// long the operator has been waiting. Drives the "Awaiting reply >24h" vs
// "Sent recently" buckets in the My-requests view.
//
// Same stability strategy as computeCounts: rebuild fresh each emit, return
// the prior reference when entries are structurally equal.
// ---------------------------------------------------------------------------
let stalenessSnapshot: ReadonlyMap<string, string> = new Map();
const EMPTY_STALENESS: ReadonlyMap<string, string> = new Map();

const computeStaleness = (): ReadonlyMap<string, string> => {
  const next = new Map<string, string>();
  for (const [ref, recs] of requests) {
    let earliest: string | null = null;
    for (const r of recs) {
      if (r.received) continue;
      // Use resentAt when present — a resend resets the "waiting clock" from
      // the client's perspective (they were nudged again, fresh stopwatch).
      const t = r.resentAt ?? r.at;
      if (!earliest || t < earliest) earliest = t;
    }
    if (earliest) next.set(ref, earliest);
  }
  if (next.size === stalenessSnapshot.size) {
    let same = true;
    for (const [k, v] of next) {
      if (stalenessSnapshot.get(k) !== v) {
        same = false;
        break;
      }
    }
    if (same) return stalenessSnapshot;
  }
  stalenessSnapshot = next;
  return stalenessSnapshot;
};

/** Subscribe to earliest-outstanding-request timestamps across all cases. */
export const useAllRequestStaleness = (): ReadonlyMap<string, string> => {
  return useSyncExternalStore(
    subscribe,
    computeStaleness,
    () => EMPTY_STALENESS,
  );
};

/**
 * Return a derived case with operator requests applied:
 *  - Documents flipped from `missing` → `review` for any requested doc.
 *  - Documents flipped to `ok` if operator marked them received.
 *  - Synthetic Operator events appended for each request / resend / receipt.
 * The original `WorkspaceCase` is never mutated.
 */
export const applyRequestOverrides = (
  base: WorkspaceCase,
  reqs: RequestRecord[],
): WorkspaceCase => {
  if (reqs.length === 0) return base;

  const byDoc = new Map(reqs.map((r) => [r.doc, r] as const));

  const documents: CaseDocument[] = base.documents.map((d) => {
    const r = byDoc.get(d.name);
    if (!r) return d;
    if (r.received) return { ...d, state: "ok" as const };
    if (d.state === "missing") return { ...d, state: "review" as const };
    return d;
  });

  const newEvents: CaseEvent[] = [];
  for (const r of reqs) {
    newEvents.push({ at: r.at, actor: "Operator" as const, title: `Operator requested ${r.doc}` });
    if (r.resentAt) {
      newEvents.push({ at: r.resentAt, actor: "Operator" as const, title: `Operator resent request · ${r.doc}` });
    }
    if (r.receivedAt) {
      newEvents.push({ at: r.receivedAt, actor: "Operator" as const, title: `Operator marked received · ${r.doc}` });
    }
  }

  return {
    ...base,
    documents,
    events: [...base.events, ...newEvents],
  };
};
