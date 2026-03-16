import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  getCredentialMetadataSnapshot,
  listCredentialMetadata,
  resolveCredentialValue,
  type ResolvedCredentialValue,
} from "./credential-store.js";

export type AuthProfileTargetCategory = "skills_runtime" | "device_nodes" | "live_gateway";

export type AuthProfileTarget = {
  profileId: string;
  namespace: string;
  label: string;
  category: AuthProfileTargetCategory;
  directValueEnvKey: string | null;
  credentialNameEnvKey: string | null;
  profileEnvKey: string | null;
};

export type AuthProfileRecord = {
  profileId: string;
  namespace: string;
  label: string | null;
  activeCredentialName: string | null;
  credentialNames: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type AuthProfileUpsertInput = {
  profileId: string;
  namespace: string;
  label?: string | null;
  activeCredentialName?: string | null;
  credentialNames?: string[];
  metadata?: Record<string, unknown>;
};

export type AuthProfileResolvedValue = ResolvedCredentialValue & {
  profileId: string | null;
  selectionSource: "direct_env" | "explicit_credential" | "auth_profile" | "missing";
  activeCredentialName: string | null;
  target: AuthProfileTarget | null;
};

export type AuthProfileRotationMetadata = {
  rotationCount: number;
  lastRotatedAt: string | null;
  previousCredentialName: string | null;
  currentCredentialName: string | null;
  lastCredentialUpdatedAt: string | null;
};

export type AuthProfileSnapshot = {
  profileId: string;
  namespace: string;
  label: string;
  category: AuthProfileTargetCategory | "custom";
  target: AuthProfileTarget | null;
  directValueConfigured: boolean;
  explicitCredentialName: string | null;
  configuredProfileId: string | null;
  storedProfile: AuthProfileRecord | null;
  activeCredentialName: string | null;
  credentialNames: string[];
  availableCredentials: Array<{
    name: string;
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
  }>;
  rotation: AuthProfileRotationMetadata | null;
  effectiveResolution: AuthProfileResolvedValue;
  warnings: string[];
};

type StoredAuthProfileFile = {
  schemaVersion: 1;
  updatedAt: string;
  profiles: AuthProfileRecord[];
};

type AuthProfileStoreReadResult = {
  file: StoredAuthProfileFile;
  warning: string | null;
};

type AuthProfileTargetBinding = {
  target: AuthProfileTarget;
  directValue: string | null;
  credentialName: string | null;
  configuredProfileId: string | null;
};

export type LiveGatewayAuthProfileSecretKind = "api_key" | "auth_header";

export type LiveGatewayAuthProfileConfig = {
  name: string;
  displayName: string;
  apiKey: string | null;
  apiKeyCredential: string | null;
  apiKeyProfileId: string | null;
  authHeader: string | null;
  authHeaderCredential: string | null;
  authHeaderProfileId: string | null;
};

export const KNOWN_AUTH_PROFILE_TARGETS: readonly AuthProfileTarget[] = Object.freeze([
  {
    profileId: "skills-managed-index",
    namespace: "skills.managed_index.auth_token",
    label: "Skills Managed Index",
    category: "skills_runtime",
    directValueEnvKey: "SKILLS_MANAGED_INDEX_AUTH_TOKEN",
    credentialNameEnvKey: "SKILLS_MANAGED_INDEX_AUTH_CREDENTIAL",
    profileEnvKey: "SKILLS_MANAGED_INDEX_AUTH_PROFILE",
  },
  {
    profileId: "ui-navigator-device-index",
    namespace: "ui_navigator.device_node_index.auth_token",
    label: "UI Navigator Device Index",
    category: "device_nodes",
    directValueEnvKey: "UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_TOKEN",
    credentialNameEnvKey: "UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_CREDENTIAL",
    profileEnvKey: "UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_PROFILE",
  },
]);

export function buildLiveGatewayAuthProfileNamespace(params: {
  name: string;
  kind: LiveGatewayAuthProfileSecretKind;
}): string {
  const normalizedName = sanitizeProfileName(params.name, "profile");
  return `live.gateway.auth_profiles.${normalizedName}.${params.kind}`;
}

export function parseLiveGatewayAuthProfileConfigs(
  env: NodeJS.ProcessEnv = process.env,
): LiveGatewayAuthProfileConfig[] {
  const raw = toNonEmptyString(env.LIVE_API_AUTH_PROFILES_JSON);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const configs: LiveGatewayAuthProfileConfig[] = [];
    for (let index = 0; index < parsed.length; index += 1) {
      const item = parsed[index];
      if (!isRecord(item)) {
        continue;
      }
      const fallbackName = `json-${index + 1}`;
      const rawName = toNonEmptyString(item.name) ?? fallbackName;
      const normalizedName = sanitizeProfileName(rawName, fallbackName);
      configs.push({
        name: normalizedName,
        displayName: rawName,
        apiKey: toNonEmptyString(item.apiKey),
        apiKeyCredential: toNonEmptyString(item.apiKeyCredential),
        apiKeyProfileId: sanitizeProfileId(item.apiKeyProfileId),
        authHeader: toNonEmptyString(item.authHeader),
        authHeaderCredential: toNonEmptyString(item.authHeaderCredential),
        authHeaderProfileId: sanitizeProfileId(item.authHeaderProfileId),
      });
    }
    return configs;
  } catch {
    return [];
  }
}

function listConfiguredAuthProfileBindings(env: NodeJS.ProcessEnv): AuthProfileTargetBinding[] {
  const bindings: AuthProfileTargetBinding[] = KNOWN_AUTH_PROFILE_TARGETS.map((target) => ({
    target,
    directValue: target.directValueEnvKey ? toNonEmptyString(env[target.directValueEnvKey]) : null,
    credentialName: target.credentialNameEnvKey ? toNonEmptyString(env[target.credentialNameEnvKey]) : null,
    configuredProfileId: target.profileEnvKey ? sanitizeProfileId(env[target.profileEnvKey]) : target.profileId,
  }));

  for (const profile of parseLiveGatewayAuthProfileConfigs(env)) {
    if (profile.apiKey || profile.apiKeyCredential || profile.apiKeyProfileId) {
      const target = buildLiveGatewayAuthTarget({
        name: profile.name,
        displayName: profile.displayName,
        kind: "api_key",
        configuredProfileId: profile.apiKeyProfileId,
      });
      bindings.push({
        target,
        directValue: profile.apiKey,
        credentialName: profile.apiKeyCredential,
        configuredProfileId: profile.apiKeyProfileId ?? target.profileId,
      });
    }
    if (profile.authHeader || profile.authHeaderCredential || profile.authHeaderProfileId) {
      const target = buildLiveGatewayAuthTarget({
        name: profile.name,
        displayName: profile.displayName,
        kind: "auth_header",
        configuredProfileId: profile.authHeaderProfileId,
      });
      bindings.push({
        target,
        directValue: profile.authHeader,
        credentialName: profile.authHeaderCredential,
        configuredProfileId: profile.authHeaderProfileId ?? target.profileId,
      });
    }
  }

  return bindings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeProfileId(value: unknown): string | null {
  const normalized = toNonEmptyString(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized && normalized.length > 0 ? normalized.slice(0, 96) : null;
}

function sanitizeNamespace(value: unknown): string | null {
  const normalized = toNonEmptyString(value)?.toLowerCase();
  return normalized && normalized.length > 0 ? normalized.slice(0, 160) : null;
}

function sanitizeProfileName(value: unknown, fallback: string): string {
  return (
    toNonEmptyString(value)
      ?.toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 96) || fallback
  );
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = toNonEmptyString(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) {
    return {};
  }
  const redactedKeyPattern = /(secret|token|password|private[-_]?key|api[-_]?key|credential[-_]?value|bearer)/i;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (redactedKeyPattern.test(key)) {
      continue;
    }
    try {
      sanitized[key] = JSON.parse(JSON.stringify(value)) as unknown;
    } catch {
      continue;
    }
  }
  return sanitized;
}

function normalizeRotationMetadata(value: unknown): AuthProfileRotationMetadata | null {
  if (!isRecord(value)) {
    return null;
  }
  const rotationCountRaw =
    typeof value.rotationCount === "number" ? value.rotationCount : Number(value.rotationCount);
  const rotationCount =
    Number.isFinite(rotationCountRaw) && rotationCountRaw > 0 ? Math.floor(rotationCountRaw) : 0;
  return {
    rotationCount,
    lastRotatedAt: toNonEmptyString(value.lastRotatedAt),
    previousCredentialName: toNonEmptyString(value.previousCredentialName),
    currentCredentialName: toNonEmptyString(value.currentCredentialName),
    lastCredentialUpdatedAt: toNonEmptyString(value.lastCredentialUpdatedAt),
  };
}

function buildEmptyAuthProfileFile(): StoredAuthProfileFile {
  return {
    schemaVersion: 1,
    updatedAt: new Date(0).toISOString(),
    profiles: [],
  };
}

function buildLiveGatewayAuthTarget(params: {
  name: string;
  displayName: string;
  kind: LiveGatewayAuthProfileSecretKind;
  configuredProfileId?: string | null;
}): AuthProfileTarget {
  const normalizedName = sanitizeProfileName(params.name, "profile");
  const suffix = params.kind === "api_key" ? "api-key" : "auth-header";
  const profileId =
    sanitizeProfileId(params.configuredProfileId) ?? `live-gateway-${normalizedName}-${suffix}`;
  return {
    profileId,
    namespace: buildLiveGatewayAuthProfileNamespace({
      name: normalizedName,
      kind: params.kind,
    }),
    label: `Live Gateway ${params.displayName} ${params.kind === "api_key" ? "API Key" : "Auth Header"}`,
    category: "live_gateway",
    directValueEnvKey: null,
    credentialNameEnvKey: null,
    profileEnvKey: null,
  };
}

function getAuthProfileStorePath(env: NodeJS.ProcessEnv, cwd: string): string {
  return resolve(cwd, toNonEmptyString(env.AUTH_PROFILE_STORE_FILE) ?? ".credentials/auth-profiles.json");
}

function parseAuthProfileFile(raw: string): StoredAuthProfileFile {
  const parsed = JSON.parse(raw) as unknown;
  const profiles = isRecord(parsed) && Array.isArray(parsed.profiles) ? parsed.profiles : [];
  return {
    schemaVersion: 1,
    updatedAt: toNonEmptyString(isRecord(parsed) ? parsed.updatedAt : null) ?? new Date(0).toISOString(),
    profiles: profiles
      .map((item): AuthProfileRecord | null => {
        if (!isRecord(item)) {
          return null;
        }
        const profileId = sanitizeProfileId(item.profileId);
        const namespace = sanitizeNamespace(item.namespace);
        if (!profileId || !namespace) {
          return null;
        }
        const credentialNames = sanitizeStringArray(item.credentialNames);
        const activeCredentialName = toNonEmptyString(item.activeCredentialName);
        return {
          profileId,
          namespace,
          label: toNonEmptyString(item.label),
          activeCredentialName,
          credentialNames:
            activeCredentialName && !credentialNames.includes(activeCredentialName)
              ? [activeCredentialName, ...credentialNames]
              : credentialNames,
          createdAt: toNonEmptyString(item.createdAt) ?? new Date(0).toISOString(),
          updatedAt: toNonEmptyString(item.updatedAt) ?? new Date(0).toISOString(),
          metadata: sanitizeMetadata(isRecord(item.metadata) ? item.metadata : undefined),
        };
      })
      .filter((item): item is AuthProfileRecord => item !== null),
  };
}

function readAuthProfileFile(storePath: string): StoredAuthProfileFile {
  if (!existsSync(storePath)) {
    return buildEmptyAuthProfileFile();
  }
  return parseAuthProfileFile(readFileSync(storePath, "utf8"));
}

function tryReadAuthProfileFile(storePath: string): AuthProfileStoreReadResult {
  if (!existsSync(storePath)) {
    return {
      file: buildEmptyAuthProfileFile(),
      warning: null,
    };
  }
  try {
    return {
      file: readAuthProfileFile(storePath),
      warning: null,
    };
  } catch (error) {
    return {
      file: buildEmptyAuthProfileFile(),
      warning: `Auth profile store file at ${storePath} could not be parsed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function readAuthProfileFileStrict(storePath: string): StoredAuthProfileFile {
  const result = tryReadAuthProfileFile(storePath);
  if (result.warning) {
    throw new Error(result.warning);
  }
  return result.file;
}

function writeAuthProfileFile(storePath: string, file: StoredAuthProfileFile): void {
  mkdirSync(dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${randomUUID()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(file, null, 2), "utf8");
  renameSync(tempPath, storePath);
}

function findKnownTarget(params: {
  profileId?: string | null;
  namespace?: string | null;
  env?: NodeJS.ProcessEnv;
}): AuthProfileTarget | null {
  const profileId = sanitizeProfileId(params.profileId);
  const namespace = sanitizeNamespace(params.namespace);
  const configuredTargets = listConfiguredAuthProfileBindings(params.env ?? process.env).map((item) => item.target);
  return (
    configuredTargets.find((target) => {
      if (profileId && target.profileId === profileId) {
        return true;
      }
      if (namespace && target.namespace === namespace) {
        return true;
      }
      return false;
    }) ?? null
  );
}

function resolveTargetProfileId(params: {
  namespace: string;
  profileId?: string | null;
  env?: NodeJS.ProcessEnv;
}): string {
  return (
    sanitizeProfileId(params.profileId) ??
    findKnownTarget({ ...params, env: params.env })?.profileId ??
    params.namespace.replace(/\./g, "-")
  );
}

function resolveTargetLabel(params: {
  namespace: string;
  profileId?: string | null;
  label?: string | null;
  env?: NodeJS.ProcessEnv;
}): string | null {
  return toNonEmptyString(params.label) ?? findKnownTarget({ ...params, env: params.env })?.label ?? null;
}

function sortCredentialNamesByAvailability(
  names: string[],
  availableCredentials: Array<{ name: string; updatedAt: string }>,
): string[] {
  const order = new Map<string, number>();
  availableCredentials
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .forEach((item, index) => {
      order.set(item.name, index);
    });
  return names
    .slice()
    .sort((left, right) => {
      const leftIndex = order.get(left);
      const rightIndex = order.get(right);
      if (leftIndex !== undefined || rightIndex !== undefined) {
        return (leftIndex ?? Number.MAX_SAFE_INTEGER) - (rightIndex ?? Number.MAX_SAFE_INTEGER);
      }
      return left.localeCompare(right);
    });
}

export function listAuthProfiles(options?: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): AuthProfileRecord[] {
  const env = options?.env ?? process.env;
  const cwd = options?.cwd ?? process.cwd();
  return tryReadAuthProfileFile(getAuthProfileStorePath(env, cwd)).file.profiles;
}

export function getAuthProfileRecord(
  params: {
    profileId?: string | null;
    namespace?: string | null;
  },
  options?: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  },
): AuthProfileRecord | null {
  const profileId = sanitizeProfileId(params.profileId);
  const namespace = sanitizeNamespace(params.namespace);
  if (!profileId && !namespace) {
    return null;
  }
  const records = listAuthProfiles(options);
  return (
    records.find((item) => {
      if (profileId && item.profileId === profileId) {
        return true;
      }
      if (namespace && item.namespace === namespace) {
        return true;
      }
      return false;
    }) ?? null
  );
}

export function upsertAuthProfile(
  input: AuthProfileUpsertInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    nowIso?: string;
  },
): {
  path: string;
  profile: AuthProfileRecord;
} {
  const env = options?.env ?? process.env;
  const cwd = options?.cwd ?? process.cwd();
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const storePath = getAuthProfileStorePath(env, cwd);
  const file = readAuthProfileFileStrict(storePath);
  const profileId = resolveTargetProfileId({
    namespace: input.namespace,
    profileId: input.profileId,
    env,
  });
  const namespace = sanitizeNamespace(input.namespace);
  if (!namespace) {
    throw new Error("namespace is required for auth profile upsert.");
  }
  const existing = file.profiles.find((item) => item.profileId === profileId || item.namespace === namespace) ?? null;
  const activeCredentialName = toNonEmptyString(input.activeCredentialName) ?? existing?.activeCredentialName ?? null;
  const availableCredentials = listCredentialMetadata({ env, cwd }).filter((item) => item.namespace === namespace);
  const credentialNames = sortCredentialNamesByAvailability(
    Array.from(
      new Set(
        [
          activeCredentialName,
          ...sanitizeStringArray(input.credentialNames),
          ...(existing?.credentialNames ?? []),
          ...availableCredentials.map((item) => item.name),
        ].filter((item): item is string => typeof item === "string" && item.trim().length > 0),
      ),
    ),
    availableCredentials,
  );
  const profile: AuthProfileRecord = {
    profileId,
    namespace,
    label: resolveTargetLabel({
      namespace,
      profileId,
      label: input.label,
      env,
    }),
    activeCredentialName,
    credentialNames,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    metadata: sanitizeMetadata(input.metadata ?? existing?.metadata),
  };
  const profiles = file.profiles.filter((item) => item.profileId !== profileId && item.namespace !== namespace);
  profiles.push(profile);
  profiles.sort((left, right) => left.profileId.localeCompare(right.profileId));
  writeAuthProfileFile(storePath, {
    schemaVersion: 1,
    updatedAt: nowIso,
    profiles,
  });
  return {
    path: storePath,
    profile,
  };
}

export function rotateAuthProfile(
  params: {
    profileId?: string | null;
    namespace?: string | null;
    nextCredentialName?: string | null;
  },
  options?: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    nowIso?: string;
  },
): {
  path: string;
  profile: AuthProfileRecord;
  availableCredentialNames: string[];
  selectedCredentialName: string;
} {
  const env = options?.env ?? process.env;
  const cwd = options?.cwd ?? process.cwd();
  const profileId = sanitizeProfileId(params.profileId);
  const namespace =
    sanitizeNamespace(params.namespace) ?? findKnownTarget({ profileId, env })?.namespace ?? null;
  if (!profileId && !namespace) {
    throw new Error("profileId or namespace is required for auth profile rotation.");
  }
  const existing = getAuthProfileRecord({ profileId, namespace }, { env, cwd });
  const target = findKnownTarget({
    profileId: profileId ?? existing?.profileId ?? null,
    namespace: namespace ?? existing?.namespace ?? null,
    env,
  });
  const effectiveNamespace = namespace ?? existing?.namespace ?? target?.namespace ?? null;
  if (!effectiveNamespace) {
    throw new Error("Auth profile rotation could not resolve namespace.");
  }
  const availableCredentials = listCredentialMetadata({ env, cwd })
    .filter((item) => item.namespace === effectiveNamespace)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const availableCredentialNames = Array.from(
    new Set(
      [
        ...availableCredentials.map((item) => item.name),
        ...(existing?.credentialNames ?? []),
      ].filter((item): item is string => typeof item === "string" && item.trim().length > 0),
    ),
  );
  if (availableCredentialNames.length === 0) {
    throw new Error(`No credential-store entries are available for namespace '${effectiveNamespace}'.`);
  }
  const nextCredentialName = toNonEmptyString(params.nextCredentialName);
  if (nextCredentialName && !availableCredentialNames.includes(nextCredentialName)) {
    throw new Error(
      `Credential '${nextCredentialName}' is not available for namespace '${effectiveNamespace}'.`,
    );
  }
  const currentIndex = existing?.activeCredentialName
    ? availableCredentialNames.indexOf(existing.activeCredentialName)
    : -1;
  const selectedCredentialName =
    nextCredentialName ??
    availableCredentialNames[(currentIndex + 1 + availableCredentialNames.length) % availableCredentialNames.length] ??
    availableCredentialNames[0];
  const selectedCredential =
    availableCredentials.find((item) => item.name === selectedCredentialName) ?? null;
  const previousRotation = normalizeRotationMetadata(existing?.metadata?.rotation);
  const mergedMetadata = {
    ...(existing?.metadata ?? {}),
    rotation: {
      rotationCount: (previousRotation?.rotationCount ?? 0) + 1,
      lastRotatedAt: options?.nowIso ?? new Date().toISOString(),
      previousCredentialName: existing?.activeCredentialName ?? null,
      currentCredentialName: selectedCredentialName,
      lastCredentialUpdatedAt: selectedCredential?.updatedAt ?? null,
    },
  };
  const updated = upsertAuthProfile(
    {
      profileId: profileId ?? existing?.profileId ?? target?.profileId ?? effectiveNamespace.replace(/\./g, "-"),
      namespace: effectiveNamespace,
      label: existing?.label ?? target?.label ?? null,
      activeCredentialName: selectedCredentialName,
      credentialNames: availableCredentialNames,
      metadata: mergedMetadata,
    },
    options,
  );
  return {
    path: updated.path,
    profile: updated.profile,
    availableCredentialNames,
    selectedCredentialName,
  };
}

export function resolveCredentialValueWithProfile(options: {
  namespace: string;
  profileId?: string | null;
  directValue?: string | null;
  credentialName?: string | null;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): AuthProfileResolvedValue {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const namespace = sanitizeNamespace(options.namespace);
  if (!namespace) {
    return {
      value: null,
      source: "missing",
      credentialName: null,
      metadata: null,
      warnings: ["namespace is required for credential resolution."],
      profileId: null,
      selectionSource: "missing",
      activeCredentialName: null,
      target: null,
    };
  }

  const target = findKnownTarget({
    profileId: options.profileId,
    namespace,
    env,
  });
  const directValue = toNonEmptyString(options.directValue);
  if (directValue) {
    const resolved = resolveCredentialValue({
      namespace,
      directValue,
      credentialName: options.credentialName,
      env,
      cwd,
    });
    return {
      ...resolved,
      profileId: sanitizeProfileId(options.profileId) ?? target?.profileId ?? null,
      selectionSource: "direct_env",
      activeCredentialName: null,
      target,
    };
  }

  const explicitCredentialName = toNonEmptyString(options.credentialName);
  if (explicitCredentialName) {
    const resolved = resolveCredentialValue({
      namespace,
      credentialName: explicitCredentialName,
      env,
      cwd,
    });
    return {
      ...resolved,
      profileId: sanitizeProfileId(options.profileId) ?? target?.profileId ?? null,
      selectionSource: resolved.source === "credential_store" ? "explicit_credential" : "missing",
      activeCredentialName: explicitCredentialName,
      target,
    };
  }

  const authProfileStoreWarning = tryReadAuthProfileFile(getAuthProfileStorePath(env, cwd)).warning;
  const record = getAuthProfileRecord(
    {
      profileId: options.profileId,
      namespace,
    },
    { env, cwd },
  );
  const activeCredentialName = record?.activeCredentialName ?? null;
  if (activeCredentialName) {
    const resolved = resolveCredentialValue({
      namespace,
      credentialName: activeCredentialName,
      env,
      cwd,
    });
    return {
      ...resolved,
      profileId: record?.profileId ?? sanitizeProfileId(options.profileId) ?? target?.profileId ?? null,
      selectionSource: resolved.source === "credential_store" ? "auth_profile" : "missing",
      activeCredentialName,
      target,
    };
  }

  return {
    value: null,
    source: "missing",
    credentialName: null,
    metadata: null,
    warnings: [
      ...(authProfileStoreWarning ? [authProfileStoreWarning] : []),
      ...(record ? [`Auth profile '${record.profileId}' does not have an active credential.`] : []),
    ],
    profileId: record?.profileId ?? sanitizeProfileId(options.profileId) ?? target?.profileId ?? null,
    selectionSource: "missing",
    activeCredentialName: null,
    target,
  };
}

export function listAuthProfileSnapshots(options?: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): AuthProfileSnapshot[] {
  const env = options?.env ?? process.env;
  const cwd = options?.cwd ?? process.cwd();
  const storeRead = tryReadAuthProfileFile(getAuthProfileStorePath(env, cwd));
  const storedProfiles = storeRead.file.profiles;
  const credentialSnapshot = getCredentialMetadataSnapshot({ env, cwd });
  const credentials = credentialSnapshot.entries;
  const bindings = listConfiguredAuthProfileBindings(env);
  const candidateKeys = new Map<string, { profileId: string; namespace: string }>();

  for (const binding of bindings) {
    candidateKeys.set(binding.target.profileId, {
      profileId: binding.target.profileId,
      namespace: binding.target.namespace,
    });
  }
  for (const profile of storedProfiles) {
    candidateKeys.set(profile.profileId, {
      profileId: profile.profileId,
      namespace: profile.namespace,
    });
  }

  return Array.from(candidateKeys.values())
    .map(({ profileId, namespace }) => {
      const binding =
        bindings.find((item) => item.target.profileId === profileId || item.target.namespace === namespace) ?? null;
      const target = binding?.target ?? findKnownTarget({ profileId, namespace, env });
      const storedProfile = storedProfiles.find((item) => item.profileId === profileId || item.namespace === namespace) ?? null;
      const directValueConfigured = Boolean(binding?.directValue);
      const explicitCredentialName = binding?.credentialName ?? null;
      const configuredProfileId = binding?.configuredProfileId ?? profileId;
      const effectiveResolution = resolveCredentialValueWithProfile({
        namespace,
        profileId: configuredProfileId ?? profileId,
        directValue: binding?.directValue ?? null,
        credentialName: explicitCredentialName,
        env,
        cwd,
      });
      const availableCredentials = credentials
        .filter((item) => item.namespace === namespace)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((item) => ({
          name: item.name,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          metadata: item.metadata,
        }));
      const credentialNames = Array.from(
        new Set(
          [
            ...availableCredentials.map((item) => item.name),
            ...(storedProfile?.credentialNames ?? []),
          ].filter((item): item is string => typeof item === "string" && item.trim().length > 0),
        ),
      );
      const warnings = [...effectiveResolution.warnings];
      if (storeRead.warning) {
        warnings.push(storeRead.warning);
      }
      for (const warning of credentialSnapshot.warnings) {
        warnings.push(warning);
      }
      if (directValueConfigured) {
        warnings.push("Direct env credential is set and overrides auth-profile rotation until removed.");
      } else if (!explicitCredentialName && !storedProfile?.activeCredentialName && availableCredentials.length > 0) {
        warnings.push("Credential-store entries exist, but no explicit credential or auth-profile binding is active.");
      }
      const category: AuthProfileSnapshot["category"] = target?.category ?? "custom";
      const rotation = normalizeRotationMetadata(storedProfile?.metadata?.rotation);
      return {
        profileId,
        namespace,
        label: storedProfile?.label ?? target?.label ?? profileId,
        category,
        target,
        directValueConfigured,
        explicitCredentialName,
        configuredProfileId: configuredProfileId ?? null,
        storedProfile,
        activeCredentialName: effectiveResolution.activeCredentialName,
        credentialNames,
        availableCredentials,
        rotation,
        effectiveResolution,
        warnings: Array.from(new Set(warnings)),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}
