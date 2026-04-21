type FrontendRuntimeConfig = {
  apiBaseUrl: string | null;
  wsUrl: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toConfiguredUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

let runtimeConfigPromise: Promise<FrontendRuntimeConfig> | null = null;

async function loadRuntimeConfig(fetchImpl: typeof fetch): Promise<FrontendRuntimeConfig> {
  try {
    const response = await fetchImpl("/config.json", {
      cache: "no-store",
    });
    if (!response.ok) {
      return { apiBaseUrl: null, wsUrl: null };
    }
    const payload = (await response.json()) as { runtime?: unknown };
    const runtime = isRecord(payload.runtime) ? payload.runtime : null;
    return {
      apiBaseUrl: toConfiguredUrl(runtime?.apiBaseUrl),
      wsUrl: toConfiguredUrl(runtime?.wsUrl),
    };
  } catch {
    return { apiBaseUrl: null, wsUrl: null };
  }
}

export async function getFrontendRuntimeConfig(
  fetchImpl: typeof fetch = fetch,
): Promise<FrontendRuntimeConfig> {
  if (fetchImpl !== fetch) {
    return loadRuntimeConfig(fetchImpl);
  }
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = loadRuntimeConfig(fetchImpl);
  }
  return runtimeConfigPromise;
}

export async function resolveRuntimeApiUrl(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (/^https?:\/\//i.test(input)) {
    return input;
  }
  const config = await getFrontendRuntimeConfig(fetchImpl);
  if (!config.apiBaseUrl) {
    return input;
  }
  return new URL(input, `${config.apiBaseUrl}/`).toString();
}

export async function fetchRuntimeApi(
  input: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const url = await resolveRuntimeApiUrl(input, fetchImpl);
  return fetchImpl(url, init);
}
