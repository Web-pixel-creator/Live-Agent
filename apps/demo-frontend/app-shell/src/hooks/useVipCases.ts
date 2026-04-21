// VIP marker store — persists a Set<caseRef> in localStorage so the
// operator's "this client matters" tag survives reloads. Hooks subscribe
// via a tiny pub/sub so toggling in one place (e.g. the client tooltip)
// updates every other consumer (initials tile, sidebar badges) instantly.

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "actiondesk:vip-cases";

const listeners = new Set<() => void>();
let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    cache = new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist(next: Set<string>) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Storage full / disabled — ignore, in-memory cache still works.
  }
  listeners.forEach((fn) => fn());
}

export function useVipCases() {
  const [snapshot, setSnapshot] = useState<Set<string>>(() => new Set(load()));

  useEffect(() => {
    const sync = () => setSnapshot(new Set(load()));
    listeners.add(sync);
    // Cross-tab sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        cache = null;
        sync();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isVip = useCallback((ref: string) => snapshot.has(ref), [snapshot]);

  const toggleVip = useCallback((ref: string) => {
    const current = load();
    const next = new Set(current);
    if (next.has(ref)) next.delete(ref);
    else next.add(ref);
    persist(next);
    return next.has(ref);
  }, []);

  return { isVip, toggleVip, vipSet: snapshot };
}
