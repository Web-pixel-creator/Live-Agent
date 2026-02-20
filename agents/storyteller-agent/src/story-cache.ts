import { createHash } from "node:crypto";

export type StoryCacheScope = "plan" | "branch" | "asset";

type StoryCacheEntry<T> = {
  key: string;
  scope: StoryCacheScope;
  value: T;
  createdAt: string;
  updatedAt: string;
  expiresAtMs: number;
  hitCount: number;
  byteSize: number;
};

type StoryCacheStats = {
  hits: number;
  misses: number;
  writes: number;
  evictions: number;
  invalidations: number;
  lastInvalidationReason: string | null;
  lastInvalidationAt: string | null;
};

type StoryCacheConfig = {
  enabled: boolean;
  maxEntries: number;
  ttlMs: number;
};

export type StoryCacheSnapshot = {
  enabled: boolean;
  config: {
    maxEntries: number;
    ttlMs: number;
  };
  policy: {
    modelFingerprint: string | null;
    purgeToken: string | null;
  };
  totals: {
    entries: number;
    hits: number;
    misses: number;
    writes: number;
    evictions: number;
    invalidations: number;
    hitRatePct: number;
  };
  scopes: {
    plan: number;
    branch: number;
    asset: number;
  };
  memory: {
    approxBytes: number;
  };
  lastInvalidation: {
    reason: string | null;
    at: string | null;
  };
};

const cache = new Map<string, StoryCacheEntry<unknown>>();
const stats: StoryCacheStats = {
  hits: 0,
  misses: 0,
  writes: 0,
  evictions: 0,
  invalidations: 0,
  lastInvalidationReason: null,
  lastInvalidationAt: null,
};

let modelFingerprint: string | null = null;
let purgeToken: string | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function loadConfig(): StoryCacheConfig {
  return {
    enabled: process.env.STORYTELLER_CACHE_ENABLED !== "false",
    maxEntries: parsePositiveInt(process.env.STORYTELLER_CACHE_MAX_ENTRIES, 600),
    ttlMs: parsePositiveInt(process.env.STORYTELLER_CACHE_TTL_MS, 30 * 60 * 1000),
  };
}

const config = loadConfig();

function nowIso(): string {
  return new Date().toISOString();
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }
  if (typeof value === "object" && value !== null) {
    const source = value as Record<string, unknown>;
    const sortedKeys = Object.keys(source).sort();
    const normalized: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      normalized[key] = stableNormalize(source[key]);
    }
    return normalized;
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

function approxBytes(value: unknown): number {
  const serialized = stableStringify(value);
  return Buffer.byteLength(serialized, "utf8");
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function sweepExpired(): void {
  if (!config.enabled) {
    return;
  }
  const nowMs = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      cache.delete(key);
      stats.evictions += 1;
    }
  }
}

function clearCache(reason: string): void {
  cache.clear();
  stats.invalidations += 1;
  stats.lastInvalidationReason = reason;
  stats.lastInvalidationAt = nowIso();
}

function enforceCapacity(): void {
  while (cache.size > config.maxEntries) {
    const oldest = cache.keys().next();
    if (oldest.done) {
      break;
    }
    cache.delete(oldest.value);
    stats.evictions += 1;
  }
}

function normalizePolicyFingerprint(input: string): string {
  return input.trim();
}

export function buildStoryCacheKey(namespace: string, payload: unknown): string {
  const normalizedNamespace = namespace.trim().toLowerCase();
  const hash = createHash("sha256").update(stableStringify(payload)).digest("hex");
  return `${normalizedNamespace}:${hash}`;
}

export function ensureStoryCachePolicy(params: {
  modelFingerprint: string;
  purgeToken?: string | null;
}): void {
  if (!config.enabled) {
    return;
  }
  sweepExpired();

  const nextFingerprint = normalizePolicyFingerprint(params.modelFingerprint);
  if (modelFingerprint !== null && modelFingerprint !== nextFingerprint) {
    clearCache("model_fingerprint_changed");
  }
  modelFingerprint = nextFingerprint;

  const nextToken = toNullableString(params.purgeToken);
  if (nextToken !== purgeToken && nextToken !== null) {
    clearCache("manual_purge_token_changed");
  }
  purgeToken = nextToken;
}

export function getFromStoryCache<T>(scope: StoryCacheScope, key: string): T | null {
  if (!config.enabled) {
    return null;
  }
  sweepExpired();
  const entry = cache.get(key);
  if (!entry || entry.scope !== scope) {
    stats.misses += 1;
    return null;
  }
  const nowMs = Date.now();
  if (entry.expiresAtMs <= nowMs) {
    cache.delete(key);
    stats.evictions += 1;
    stats.misses += 1;
    return null;
  }

  entry.hitCount += 1;
  entry.updatedAt = nowIso();
  stats.hits += 1;

  cache.delete(key);
  cache.set(key, entry);
  return cloneValue(entry.value as T);
}

export function setInStoryCache<T>(scope: StoryCacheScope, key: string, value: T): void {
  if (!config.enabled) {
    return;
  }
  sweepExpired();
  const timestamp = nowIso();
  const entry: StoryCacheEntry<T> = {
    key,
    scope,
    value: cloneValue(value),
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAtMs: Date.now() + config.ttlMs,
    hitCount: 0,
    byteSize: approxBytes(value),
  };
  cache.set(key, entry);
  stats.writes += 1;
  enforceCapacity();
}

export function purgeStoryCache(reason = "manual_purge_api"): StoryCacheSnapshot {
  if (config.enabled) {
    clearCache(reason);
  }
  return getStoryCacheSnapshot();
}

export function getStoryCacheSnapshot(): StoryCacheSnapshot {
  if (config.enabled) {
    sweepExpired();
  }

  let planCount = 0;
  let branchCount = 0;
  let assetCount = 0;
  let totalBytes = 0;
  for (const entry of cache.values()) {
    totalBytes += entry.byteSize;
    if (entry.scope === "plan") {
      planCount += 1;
    } else if (entry.scope === "branch") {
      branchCount += 1;
    } else if (entry.scope === "asset") {
      assetCount += 1;
    }
  }

  const totalLookups = stats.hits + stats.misses;
  const hitRatePct = totalLookups > 0 ? Number(((stats.hits / totalLookups) * 100).toFixed(2)) : 0;

  return {
    enabled: config.enabled,
    config: {
      maxEntries: config.maxEntries,
      ttlMs: config.ttlMs,
    },
    policy: {
      modelFingerprint,
      purgeToken,
    },
    totals: {
      entries: cache.size,
      hits: stats.hits,
      misses: stats.misses,
      writes: stats.writes,
      evictions: stats.evictions,
      invalidations: stats.invalidations,
      hitRatePct,
    },
    scopes: {
      plan: planCount,
      branch: branchCount,
      asset: assetCount,
    },
    memory: {
      approxBytes: totalBytes,
    },
    lastInvalidation: {
      reason: stats.lastInvalidationReason,
      at: stats.lastInvalidationAt,
    },
  };
}
