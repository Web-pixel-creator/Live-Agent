import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
  ManagedSkillPluginManifest,
  ManagedSkillPluginPermission,
  ManagedSkillTrustLevel,
} from "./firestore.js";

const SKILL_PLUGIN_PERMISSION_ALLOWLIST: ReadonlySet<ManagedSkillPluginPermission> = new Set([
  "live.conversation",
  "live.translation",
  "live.negotiation",
  "story.generate",
  "story.media",
  "ui.execute",
  "ui.visual_test",
  "governance.read",
  "governance.write",
  "operator.actions",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePermissions(raw: unknown): {
  permissions: ManagedSkillPluginPermission[];
  invalid: string[];
} {
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  const permissions: ManagedSkillPluginPermission[] = [];
  const invalid: string[] = [];
  const seen = new Set<ManagedSkillPluginPermission>();
  for (const item of values) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim().toLowerCase();
    if (normalized.length === 0) {
      continue;
    }
    if (!SKILL_PLUGIN_PERMISSION_ALLOWLIST.has(normalized as ManagedSkillPluginPermission)) {
      invalid.push(normalized);
      continue;
    }
    const permission = normalized as ManagedSkillPluginPermission;
    if (seen.has(permission)) {
      continue;
    }
    seen.add(permission);
    permissions.push(permission);
  }
  return {
    permissions,
    invalid,
  };
}

export function parseSkillPluginSigningKeys(raw: string | undefined | null): {
  keys: Map<string, string>;
  configError: string | null;
} {
  const value = toOptionalString(raw);
  if (!value) {
    return {
      keys: new Map<string, string>(),
      configError: null,
    };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) {
      return {
        keys: new Map<string, string>(),
        configError: "SKILL_PLUGIN_SIGNING_KEYS_JSON must be a JSON object",
      };
    }
    const keys = new Map<string, string>();
    for (const [keyIdRaw, secretRaw] of Object.entries(parsed)) {
      const keyId = toOptionalString(keyIdRaw)?.toLowerCase() ?? null;
      const secret = toOptionalString(secretRaw);
      if (!keyId || !secret) {
        continue;
      }
      keys.set(keyId, secret);
    }
    return {
      keys,
      configError: null,
    };
  } catch {
    return {
      keys: new Map<string, string>(),
      configError: "SKILL_PLUGIN_SIGNING_KEYS_JSON is not valid JSON",
    };
  }
}

type SkillPluginManifestValidationInput = {
  raw: unknown;
  requireSignature: boolean;
  signingKeys: Map<string, string>;
  signingKeysConfigError: string | null;
  skill: {
    skillId: string;
    name: string;
    prompt: string;
    scope: string[];
    trustLevel: ManagedSkillTrustLevel;
    publisher: string | null;
    checksum: string | null;
  };
  nowIso: string;
};

type SkillPluginManifestValidationError = {
  ok: false;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type SkillPluginManifestValidationSuccess = {
  ok: true;
  manifest: ManagedSkillPluginManifest | null;
};

export type SkillPluginManifestValidationResult =
  | SkillPluginManifestValidationError
  | SkillPluginManifestValidationSuccess;

function canonicalPayload(params: {
  skillId: string;
  name: string;
  prompt: string;
  scope: string[];
  trustLevel: ManagedSkillTrustLevel;
  publisher: string | null;
  checksum: string | null;
  permissions: ManagedSkillPluginPermission[];
}): string {
  return JSON.stringify({
    skillId: params.skillId,
    name: params.name,
    prompt: params.prompt,
    scope: params.scope,
    trustLevel: params.trustLevel,
    publisher: params.publisher,
    checksum: params.checksum,
    permissions: params.permissions,
  });
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

function equalConstantTime(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizeSkillPluginManifest(
  params: SkillPluginManifestValidationInput,
): SkillPluginManifestValidationResult {
  if (!isRecord(params.raw)) {
    return {
      ok: true,
      manifest: null,
    };
  }

  const { permissions, invalid } = normalizePermissions(params.raw.permissions);
  if (invalid.length > 0) {
    return {
      ok: false,
      code: "API_SKILL_PLUGIN_PERMISSION_INVALID",
      message: "Plugin manifest contains unsupported permissions",
      details: {
        invalidPermissions: invalid,
        allowedPermissions: Array.from(SKILL_PLUGIN_PERMISSION_ALLOWLIST.values()),
      },
    };
  }
  if (permissions.length === 0) {
    return {
      ok: false,
      code: "API_SKILL_PLUGIN_PERMISSION_INVALID",
      message: "Plugin manifest must declare at least one permission",
      details: {
        allowedPermissions: Array.from(SKILL_PLUGIN_PERMISSION_ALLOWLIST.values()),
      },
    };
  }

  const signingRaw = isRecord(params.raw.signing) ? params.raw.signing : {};
  const algorithm = toOptionalString(signingRaw.algorithm)?.toLowerCase() ?? "hmac-sha256";
  if (algorithm !== "hmac-sha256") {
    return {
      ok: false,
      code: "API_SKILL_PLUGIN_SIGNATURE_INVALID",
      message: "Unsupported plugin signature algorithm",
      details: {
        algorithm,
        supportedAlgorithms: ["hmac-sha256"],
      },
    };
  }

  const keyId = toOptionalString(signingRaw.keyId)?.toLowerCase() ?? null;
  const signature = toOptionalString(signingRaw.signature)?.toLowerCase() ?? null;
  const payloadHash = sha256Hex(
    canonicalPayload({
      ...params.skill,
      permissions,
    }),
  );

  if (!signature || !keyId) {
    if (params.requireSignature) {
      return {
        ok: false,
        code: "API_SKILL_PLUGIN_SIGNATURE_REQUIRED",
        message: "Plugin manifest signature is required",
        details: {
          requires: ["signing.keyId", "signing.signature"],
        },
      };
    }
    return {
      ok: true,
      manifest: {
        permissions,
        signing: {
          algorithm: "hmac-sha256",
          keyId,
          signature,
          payloadSha256: payloadHash,
          status: "unsigned",
          verifiedAt: null,
        },
      },
    };
  }

  if (params.signingKeysConfigError) {
    return {
      ok: false,
      code: "API_SKILL_PLUGIN_SIGNING_CONFIG_INVALID",
      message: "Plugin signing keys configuration is invalid",
      details: {
        configError: params.signingKeysConfigError,
      },
    };
  }

  const signingSecret = params.signingKeys.get(keyId) ?? null;
  if (!signingSecret) {
    return {
      ok: false,
      code: "API_SKILL_PLUGIN_SIGNING_KEY_NOT_FOUND",
      message: "Plugin signing keyId is not trusted",
      details: {
        keyId,
      },
    };
  }

  const expectedSignature = hmacHex(signingSecret, payloadHash);
  if (!equalConstantTime(signature, expectedSignature)) {
    return {
      ok: false,
      code: "API_SKILL_PLUGIN_SIGNATURE_INVALID",
      message: "Plugin signature verification failed",
      details: {
        keyId,
      },
    };
  }

  return {
    ok: true,
    manifest: {
      permissions,
      signing: {
        algorithm: "hmac-sha256",
        keyId,
        signature,
        payloadSha256: payloadHash,
        status: "verified",
        verifiedAt: params.nowIso,
      },
    },
  };
}

