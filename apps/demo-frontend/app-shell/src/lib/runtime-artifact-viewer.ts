export type RuntimeArtifactIndexEntry = {
  category: string;
  label: string;
  description: string;
  relativePath: string;
  size: number;
  updatedAt: string;
  url: string;
};

export type RuntimeArtifactDocument = {
  entry: RuntimeArtifactIndexEntry;
  payload: unknown;
  raw: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toArtifactIndexEntry(value: unknown): RuntimeArtifactIndexEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const relativePath = typeof value.relativePath === "string" ? value.relativePath.trim() : "";
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const size = typeof value.size === "number" && Number.isFinite(value.size) ? value.size : null;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt.trim() : "";
  if (!category || !label || !relativePath || !url || size === null || !updatedAt) {
    return null;
  }
  return {
    category,
    label,
    description,
    relativePath,
    size,
    updatedAt,
    url,
  };
}

export async function fetchRuntimeArtifactIndex(
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeArtifactIndexEntry[]> {
  const response = await fetchImpl("/debug-artifacts/index.json", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`runtime_artifact_index_${response.status}`);
  }
  const payload = (await response.json()) as { items?: unknown };
  if (!Array.isArray(payload.items)) {
    return [];
  }
  return payload.items
    .map((item) => toArtifactIndexEntry(item))
    .filter((item): item is RuntimeArtifactIndexEntry => item !== null);
}

export async function fetchRuntimeArtifactDocument(
  entry: RuntimeArtifactIndexEntry,
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeArtifactDocument> {
  const response = await fetchImpl(entry.url, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`runtime_artifact_document_${response.status}`);
  }
  const raw = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }
  return {
    entry,
    payload,
    raw,
  };
}

export function summarizeRuntimeArtifact(payload: unknown): {
  shape: string;
  count: string;
  topLevelKeys: string[];
} {
  if (Array.isArray(payload)) {
    return {
      shape: "array",
      count: `${payload.length} items`,
      topLevelKeys:
        payload.length > 0 && isRecord(payload[0]) ? Object.keys(payload[0]).slice(0, 6) : [],
    };
  }
  if (isRecord(payload)) {
    const keys = Object.keys(payload);
    return {
      shape: "object",
      count: `${keys.length} keys`,
      topLevelKeys: keys.slice(0, 8),
    };
  }
  return {
    shape: typeof payload,
    count: "scalar",
    topLevelKeys: [],
  };
}
