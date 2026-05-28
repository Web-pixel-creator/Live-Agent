import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import type { EvidenceSignature } from "@mla/contracts";

const EVIDENCE_SIGNATURE_ALGORITHM = "ed25519-sha256" as const;
const EVIDENCE_SIGNATURE_CANONICALIZATION = "json-stable-v1" as const;

export type RuntimeEvidenceSignerConfig = {
  enabled: boolean;
  privateKeyPem: string | null;
  keyId: string | null;
  signerId: string;
  signedAt?: string | Date | null;
};

export type RuntimeEvidenceSigningKeyState = "missing" | "loaded" | "invalid";

export type RuntimeEvidenceSigningPosture = {
  enabled: boolean;
  keyState: RuntimeEvidenceSigningKeyState;
  keyLoaded: boolean;
  canSign: boolean;
  expectedSignatureStatus: EvidenceSignature["status"];
  keyId: string | null;
  signerId: string;
  algorithm: typeof EVIDENCE_SIGNATURE_ALGORITHM;
  canonicalization: typeof EVIDENCE_SIGNATURE_CANONICALIZATION;
  publicKeyFingerprint: string | null;
};

export type RuntimeEvidenceVerificationResult = {
  ok: boolean;
  reason: "verified" | "unsigned" | "hash_mismatch" | "missing_signature" | "invalid_public_key" | "verify_failed";
  payloadHash: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePem(value: string | null): string | null {
  const normalized = toNonEmptyString(value);
  return normalized ? normalized.replace(/\\n/g, "\n") : null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = toNonEmptyString(value)?.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function resolvePrivateKeyPemFromEnv(env: NodeJS.ProcessEnv): string | null {
  const direct = normalizePem(env.RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_PEM ?? null);
  if (direct) {
    return direct;
  }
  const encoded = toNonEmptyString(env.RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_BASE64 ?? null);
  if (!encoded) {
    return null;
  }
  try {
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function normalizeSignedAt(value: string | Date | null | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return toNonEmptyString(value) ?? new Date().toISOString();
}

function tryCreatePrivateKey(privateKeyPem: string | null) {
  if (!privateKeyPem) {
    return null;
  }
  try {
    return createPrivateKey(privateKeyPem);
  } catch {
    return null;
  }
}

function derivePublicKeyFingerprint(privateKeyPem: string | null): string | null {
  const privateKey = tryCreatePrivateKey(privateKeyPem);
  if (!privateKey) {
    return null;
  }
  const publicKeyDer = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  return `sha256:${createHash("sha256").update(publicKeyDer).digest("hex")}`;
}

function stripEvidenceSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripEvidenceSignature(item));
  }
  if (!isRecord(value)) {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "evidenceSignature") {
      continue;
    }
    result[key] = stripEvidenceSignature(item);
  }
  return result;
}

export function stableSerializeEvidencePayload(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerializeEvidencePayload(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerializeEvidencePayload(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function canonicalizeEvidencePayload(payload: unknown): string {
  return stableSerializeEvidencePayload(stripEvidenceSignature(payload));
}

export function hashEvidencePayload(payload: unknown): string {
  const canonical = canonicalizeEvidencePayload(payload);
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

export function resolveRuntimeEvidenceSignerConfig(
  env: NodeJS.ProcessEnv,
): RuntimeEvidenceSignerConfig {
  const privateKeyPem = resolvePrivateKeyPemFromEnv(env);
  const enabled = normalizeBoolean(env.RUNTIME_EVIDENCE_SIGNING_ENABLED ?? null) || Boolean(privateKeyPem);
  return {
    enabled,
    privateKeyPem,
    keyId: toNonEmptyString(env.RUNTIME_EVIDENCE_SIGNING_KEY_ID ?? null),
    signerId: toNonEmptyString(env.RUNTIME_EVIDENCE_SIGNING_SIGNER_ID ?? null) ?? "api-backend",
  };
}

export function buildRuntimeEvidenceSigningPosture(
  config: RuntimeEvidenceSignerConfig | null | undefined,
): RuntimeEvidenceSigningPosture {
  const enabled = config?.enabled === true;
  const signerId = toNonEmptyString(config?.signerId) ?? "api-backend";
  const privateKeyPem = normalizePem(config?.privateKeyPem ?? null);
  const keyState: RuntimeEvidenceSigningKeyState =
    !privateKeyPem ? "missing" : tryCreatePrivateKey(privateKeyPem) ? "loaded" : "invalid";
  const canSign = enabled && keyState === "loaded";

  return {
    enabled,
    keyState,
    keyLoaded: keyState === "loaded",
    canSign,
    expectedSignatureStatus: canSign ? "signed" : "unsigned",
    keyId: toNonEmptyString(config?.keyId) ?? null,
    signerId,
    algorithm: EVIDENCE_SIGNATURE_ALGORITHM,
    canonicalization: EVIDENCE_SIGNATURE_CANONICALIZATION,
    publicKeyFingerprint: keyState === "loaded" ? derivePublicKeyFingerprint(privateKeyPem) : null,
  };
}

export function signEvidencePayload(
  payload: unknown,
  config: RuntimeEvidenceSignerConfig | null | undefined,
): EvidenceSignature {
  const payloadHash = hashEvidencePayload(payload);
  const signedAt = normalizeSignedAt(config?.signedAt);
  const signerId = toNonEmptyString(config?.signerId) ?? "api-backend";
  const base = {
    schemaVersion: 1 as const,
    algorithm: EVIDENCE_SIGNATURE_ALGORITHM,
    canonicalization: EVIDENCE_SIGNATURE_CANONICALIZATION,
    payloadHash,
    keyId: toNonEmptyString(config?.keyId) ?? null,
    signerId,
    signedAt,
  };

  const privateKey = tryCreatePrivateKey(normalizePem(config?.privateKeyPem ?? null));
  if (!config?.enabled || !privateKey) {
    return {
      ...base,
      status: "unsigned",
      signature: null,
    };
  }

  const canonical = canonicalizeEvidencePayload(payload);
  return {
    ...base,
    status: "signed",
    signature: sign(null, Buffer.from(canonical, "utf8"), privateKey).toString("base64url"),
  };
}

export function verifyEvidencePayloadSignature(params: {
  payload: unknown;
  evidenceSignature: EvidenceSignature;
  publicKeyPem: string;
}): RuntimeEvidenceVerificationResult {
  const payloadHash = hashEvidencePayload(params.payload);
  if (params.evidenceSignature.status !== "signed") {
    return { ok: false, reason: "unsigned", payloadHash };
  }
  if (payloadHash !== params.evidenceSignature.payloadHash) {
    return { ok: false, reason: "hash_mismatch", payloadHash };
  }
  if (!params.evidenceSignature.signature) {
    return { ok: false, reason: "missing_signature", payloadHash };
  }

  let publicKey: ReturnType<typeof createPublicKey>;
  try {
    publicKey = createPublicKey(params.publicKeyPem);
  } catch {
    return { ok: false, reason: "invalid_public_key", payloadHash };
  }

  const canonical = canonicalizeEvidencePayload(params.payload);
  const ok = verify(
    null,
    Buffer.from(canonical, "utf8"),
    publicKey,
    Buffer.from(params.evidenceSignature.signature, "base64url"),
  );
  return {
    ok,
    reason: ok ? "verified" : "verify_failed",
    payloadHash,
  };
}
