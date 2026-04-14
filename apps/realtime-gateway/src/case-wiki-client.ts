import type { OrchestratorRequest } from "@mla/contracts";
import type { GatewayConfig } from "./config.js";

export const gatewayCaseWikiCacheTtlMs = 15_000;

type FetchLike = typeof fetch;

type CaseWikiCacheEntry = {
  expiresAtMs: number;
  value: Record<string, unknown> | null;
  pending?: Promise<Record<string, unknown> | null>;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getRequestInput(request: OrchestratorRequest): Record<string, unknown> | null {
  const payload = toRecord(request.payload);
  return payload ? toRecord(payload.input) : null;
}

function getExistingCaseWikiSnapshot(request: OrchestratorRequest): Record<string, unknown> | null {
  const input = getRequestInput(request);
  return input ? toRecord(input.caseWiki) : null;
}

function getRequestTenantId(request: OrchestratorRequest): string | null {
  const input = getRequestInput(request);
  const metadata = toRecord(request.metadata);
  const metadataTenant = metadata ? toRecord(metadata.tenant) : null;
  return (
    toNonEmptyString(input?.tenantId) ??
    toNonEmptyString(metadata?.tenantId) ??
    toNonEmptyString(metadataTenant?.tenantId)
  );
}

function buildCaseWikiCacheKey(sessionId: string, tenantId: string | null): string {
  return `${tenantId ?? "public"}::${sessionId}`;
}

export function requestHasCaseWikiSnapshot(request: OrchestratorRequest): boolean {
  const existing = getExistingCaseWikiSnapshot(request);
  if (!existing) {
    return false;
  }
  const requestSessionId = toNonEmptyString(request.sessionId);
  const caseWikiSessionId = toNonEmptyString(existing.sessionId);
  if (!requestSessionId || !caseWikiSessionId) {
    return true;
  }
  return requestSessionId === caseWikiSessionId;
}

export function attachCaseWikiSnapshotToRequest(
  request: OrchestratorRequest,
  caseWiki: Record<string, unknown>,
): OrchestratorRequest {
  const payload = toRecord(request.payload);
  const input = getRequestInput(request);
  if (!payload || !input) {
    return request;
  }
  return {
    ...request,
    payload: {
      ...payload,
      input: {
        ...input,
        caseWiki,
      },
    },
  } as OrchestratorRequest;
}

export async function fetchRuntimeCaseWikiSnapshot(
  config: Pick<GatewayConfig, "apiBackendBaseUrl">,
  params: {
    sessionId: string;
    tenantId?: string | null;
    fetchImpl?: FetchLike;
  },
): Promise<Record<string, unknown> | null> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const url = new URL("/v1/runtime/case-wiki", config.apiBackendBaseUrl);
  url.searchParams.set("sessionId", params.sessionId);
  const headers: Record<string, string> = {
    "X-Operator-Role": "viewer",
  };
  const tenantId = toNonEmptyString(params.tenantId);
  if (tenantId) {
    headers["X-Tenant-Id"] = tenantId;
  }

  const response = await fetchImpl(url, {
    method: "GET",
    headers,
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`runtime case wiki request failed: ${response.status}`);
  }

  const parsed = (await response.json()) as { data?: unknown };
  const caseWiki = toRecord(parsed.data);
  return caseWiki ?? null;
}

export function createCaseWikiRequestAttacher(
  config: Pick<GatewayConfig, "apiBackendBaseUrl">,
  options?: {
    cacheTtlMs?: number;
    fetchImpl?: FetchLike;
    now?: () => number;
  },
): (request: OrchestratorRequest) => Promise<OrchestratorRequest> {
  const cacheTtlMs = options?.cacheTtlMs ?? gatewayCaseWikiCacheTtlMs;
  const fetchImpl = options?.fetchImpl;
  const now = options?.now ?? Date.now;
  const cache = new Map<string, CaseWikiCacheEntry>();

  async function getCachedCaseWikiSnapshot(
    sessionId: string,
    tenantId: string | null,
  ): Promise<Record<string, unknown> | null> {
    const cacheKey = buildCaseWikiCacheKey(sessionId, tenantId);
    const cached = cache.get(cacheKey);
    const nowMs = now();

    if (cached?.pending) {
      return cached.pending;
    }
    if (cached && cached.expiresAtMs > nowMs) {
      return cached.value;
    }

    const pending = fetchRuntimeCaseWikiSnapshot(config, {
      sessionId,
      tenantId,
      fetchImpl,
    })
      .then((value) => {
        cache.set(cacheKey, {
          value,
          expiresAtMs: now() + cacheTtlMs,
        });
        return value;
      })
      .catch((error) => {
        cache.delete(cacheKey);
        throw error;
      });

    cache.set(cacheKey, {
      value: null,
      expiresAtMs: 0,
      pending,
    });
    return pending;
  }

  return async (request: OrchestratorRequest): Promise<OrchestratorRequest> => {
    if (request.type !== "orchestrator.request" || requestHasCaseWikiSnapshot(request)) {
      return request;
    }
    const sessionId = toNonEmptyString(request.sessionId);
    if (!sessionId) {
      return request;
    }

    try {
      const caseWiki = await getCachedCaseWikiSnapshot(sessionId, getRequestTenantId(request));
      return caseWiki ? attachCaseWikiSnapshotToRequest(request, caseWiki) : request;
    } catch {
      return request;
    }
  };
}
