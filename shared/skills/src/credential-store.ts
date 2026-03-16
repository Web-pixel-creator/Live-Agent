import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type CredentialValueSource = "direct_env" | "credential_store" | "missing";

type CredentialCipherPayload = {
  algorithm: "aes-256-gcm";
  ivBase64: string;
  tagBase64: string;
  valueBase64: string;
};

type StoredCredentialRecord = {
  namespace: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  secret: CredentialCipherPayload;
};

type StoredCredentialFile = {
  schemaVersion: 1;
  updatedAt: string;
  credentials: StoredCredentialRecord[];
};

type CredentialStoreReadResult = {
  file: StoredCredentialFile;
  warning: string | null;
};

export type ResolvedCredentialValue = {
  value: string | null;
  source: CredentialValueSource;
  credentialName: string | null;
  metadata: Record<string, unknown> | null;
  warnings: string[];
};

export type CredentialMetadataRecord = {
  namespace: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type CredentialMetadataSnapshot = {
  path: string;
  entries: CredentialMetadataRecord[];
  warnings: string[];
};

export type CredentialStoreEntryInput = {
  namespace: string;
  name: string;
  secretValue: string;
  metadata?: Record<string, unknown>;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getStorePath(env: NodeJS.ProcessEnv, cwd: string): string {
  return resolve(cwd, toNonEmptyString(env.CREDENTIAL_STORE_FILE) ?? ".credentials/store.json");
}

function getMasterKey(env: NodeJS.ProcessEnv): string | null {
  return (
    toNonEmptyString(env.CREDENTIAL_STORE_MASTER_KEY) ??
    toNonEmptyString(env.MLA_CREDENTIAL_STORE_MASTER_KEY) ??
    null
  );
}

function deriveKey(masterKey: string): Buffer {
  return createHash("sha256").update(masterKey, "utf8").digest();
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

function encryptSecret(secretValue: string, masterKey: string): CredentialCipherPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(masterKey), iv);
  const encrypted = Buffer.concat([cipher.update(secretValue, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithm: "aes-256-gcm",
    ivBase64: iv.toString("base64"),
    tagBase64: tag.toString("base64"),
    valueBase64: encrypted.toString("base64"),
  };
}

function decryptSecret(secret: CredentialCipherPayload, masterKey: string): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(masterKey),
    Buffer.from(secret.ivBase64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.tagBase64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(secret.valueBase64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function parseStoreFile(raw: string): StoredCredentialFile {
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { credentials?: unknown }).credentials)
  ) {
    return {
      schemaVersion: 1,
      updatedAt: new Date(0).toISOString(),
      credentials: [],
    };
  }
  const file = parsed as StoredCredentialFile;
  return {
    schemaVersion: 1,
    updatedAt: toNonEmptyString(file.updatedAt) ?? new Date(0).toISOString(),
    credentials: file.credentials.filter(
      (item): item is StoredCredentialRecord =>
        typeof item === "object" &&
        item !== null &&
        typeof item.namespace === "string" &&
        typeof item.name === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.updatedAt === "string" &&
        typeof item.metadata === "object" &&
        item.metadata !== null &&
        typeof item.secret === "object" &&
        item.secret !== null &&
        item.secret.algorithm === "aes-256-gcm" &&
        typeof item.secret.ivBase64 === "string" &&
        typeof item.secret.tagBase64 === "string" &&
        typeof item.secret.valueBase64 === "string",
    ),
  };
}

function buildEmptyStoreFile(): StoredCredentialFile {
  return {
    schemaVersion: 1,
    updatedAt: new Date(0).toISOString(),
    credentials: [],
  };
}

function tryReadStoreFile(storePath: string): CredentialStoreReadResult {
  if (!existsSync(storePath)) {
    return {
      file: buildEmptyStoreFile(),
      warning: null,
    };
  }
  try {
    return {
      file: parseStoreFile(readFileSync(storePath, "utf8")),
      warning: null,
    };
  } catch (error) {
    return {
      file: buildEmptyStoreFile(),
      warning: `Credential store file at ${storePath} could not be parsed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function readStoreFileStrict(storePath: string): StoredCredentialFile {
  const result = tryReadStoreFile(storePath);
  if (result.warning) {
    throw new Error(result.warning);
  }
  return result.file;
}

function writeStoreFile(storePath: string, file: StoredCredentialFile): void {
  mkdirSync(dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${randomUUID()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(file, null, 2), "utf8");
  renameSync(tempPath, storePath);
}

export function upsertCredentialStoreEntry(
  input: CredentialStoreEntryInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    nowIso?: string;
  },
): {
  path: string;
  entryMetadata: Record<string, unknown>;
} {
  const env = options?.env ?? process.env;
  const cwd = options?.cwd ?? process.cwd();
  const masterKey = getMasterKey(env);
  if (!masterKey) {
    throw new Error("Credential store master key is not configured.");
  }

  const namespace = toNonEmptyString(input.namespace);
  const name = toNonEmptyString(input.name);
  const secretValue = toNonEmptyString(input.secretValue);
  if (!namespace || !name || !secretValue) {
    throw new Error("namespace, name, and secretValue are required for credential store upsert.");
  }

  const nowIso = options?.nowIso ?? new Date().toISOString();
  const storePath = getStorePath(env, cwd);
  const file = readStoreFileStrict(storePath);
  const existing = file.credentials.find((item) => item.namespace === namespace && item.name === name);
  const entryMetadata = sanitizeMetadata(input.metadata);
  const record: StoredCredentialRecord = {
    namespace,
    name,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    metadata: entryMetadata,
    secret: encryptSecret(secretValue, masterKey),
  };
  const nextCredentials = file.credentials.filter((item) => !(item.namespace === namespace && item.name === name));
  nextCredentials.push(record);
  nextCredentials.sort((left, right) => {
    if (left.namespace !== right.namespace) {
      return left.namespace.localeCompare(right.namespace);
    }
    return left.name.localeCompare(right.name);
  });

  writeStoreFile(storePath, {
    schemaVersion: 1,
    updatedAt: nowIso,
    credentials: nextCredentials,
  });

  return {
    path: storePath,
    entryMetadata,
  };
}

export function resolveCredentialValue(
  options: {
    namespace: string;
    directValue?: string | null;
    credentialName?: string | null;
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  },
): ResolvedCredentialValue {
  const env = options.env ?? process.env;
  const directValue = toNonEmptyString(options.directValue);
  if (directValue) {
    return {
      value: directValue,
      source: "direct_env",
      credentialName: null,
      metadata: null,
      warnings: [],
    };
  }

  const credentialName = toNonEmptyString(options.credentialName);
  if (!credentialName) {
    return {
      value: null,
      source: "missing",
      credentialName: null,
      metadata: null,
      warnings: [],
    };
  }

  const masterKey = getMasterKey(env);
  if (!masterKey) {
    return {
      value: null,
      source: "missing",
      credentialName,
      metadata: null,
      warnings: ["Credential store master key is not configured."],
    };
  }

  const cwd = options.cwd ?? process.cwd();
  const storePath = getStorePath(env, cwd);
  if (!existsSync(storePath)) {
    return {
      value: null,
      source: "missing",
      credentialName,
      metadata: null,
      warnings: [`Credential store file is missing: ${storePath}`],
    };
  }

  try {
    const storeRead = tryReadStoreFile(storePath);
    if (storeRead.warning) {
      return {
        value: null,
        source: "missing",
        credentialName,
        metadata: null,
        warnings: [storeRead.warning],
      };
    }
    const file = storeRead.file;
    const entry =
      file.credentials.find(
        (item) => item.namespace === options.namespace && item.name === credentialName,
      ) ?? null;
    if (!entry) {
      return {
        value: null,
        source: "missing",
        credentialName,
        metadata: null,
        warnings: [`Credential '${options.namespace}/${credentialName}' was not found in store.`],
      };
    }
    return {
      value: decryptSecret(entry.secret, masterKey),
      source: "credential_store",
      credentialName,
      metadata: entry.metadata,
      warnings: [],
    };
  } catch (error) {
    return {
      value: null,
      source: "missing",
      credentialName,
      metadata: null,
      warnings: [
        `Credential '${options.namespace}/${credentialName}' could not be resolved: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

export function listCredentialMetadata(
  options?: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  },
): CredentialMetadataRecord[] {
  return getCredentialMetadataSnapshot(options).entries;
}

export function getCredentialMetadataSnapshot(
  options?: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  },
): CredentialMetadataSnapshot {
  const env = options?.env ?? process.env;
  const cwd = options?.cwd ?? process.cwd();
  const storePath = getStorePath(env, cwd);
  const storeRead = tryReadStoreFile(storePath);
  return {
    path: storePath,
    entries: storeRead.file.credentials.map((item) => ({
      namespace: item.namespace,
      name: item.name,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      metadata: item.metadata,
    })),
    warnings: storeRead.warning ? [storeRead.warning] : [],
  };
}
