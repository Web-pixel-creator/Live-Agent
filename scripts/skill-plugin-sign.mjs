import { createHash, createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const TRUST_LEVELS = new Set(["untrusted", "reviewed", "trusted"]);
const ALLOWED_PERMISSIONS = new Set([
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

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function fail(message, details) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: message,
      details: details ?? null,
    })}\n`,
  );
  process.exit(1);
}

function toOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseScope(value) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const scope = [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    scope.push(normalized);
  }
  return scope;
}

function parsePermissions(value) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const permissions = [];
  const invalid = [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    if (!ALLOWED_PERMISSIONS.has(normalized)) {
      invalid.push(normalized);
      continue;
    }
    permissions.push(normalized);
  }
  return {
    permissions,
    invalid,
  };
}

function canonicalPayload(input) {
  return JSON.stringify({
    skillId: input.skillId,
    name: input.name,
    prompt: input.prompt,
    scope: input.scope,
    trustLevel: input.trustLevel,
    publisher: input.publisher,
    checksum: input.checksum,
    permissions: input.permissions,
  });
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacHex(secret, value) {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  return JSON.parse(normalized);
}

function normalizeInput(raw, args) {
  const source = raw && typeof raw === "object" ? raw : {};
  const skillId = toOptionalString(args.skillId ?? source.skillId);
  const name = toOptionalString(args.name ?? source.name);
  const prompt = toOptionalString(args.prompt ?? source.prompt);
  const scope = parseScope(args.scope ?? source.scope);
  const trustLevelRaw = toOptionalString(args.trustLevel ?? source.trustLevel)?.toLowerCase() ?? "reviewed";
  const trustLevel = TRUST_LEVELS.has(trustLevelRaw) ? trustLevelRaw : null;
  const publisher = toOptionalString(args.publisher ?? source.publisher);
  const checksum = toOptionalString(args.checksum ?? source.checksum);
  const keyId = toOptionalString(args.keyId ?? source.keyId)?.toLowerCase() ?? null;
  const secret = toOptionalString(args.secret) ?? toOptionalString(process.env.SKILL_PLUGIN_SIGNING_SECRET);
  const { permissions, invalid } = parsePermissions(args.permissions ?? source.permissions);

  if (!skillId || !name || !prompt) {
    fail("Missing required skill fields", {
      required: ["skillId", "name", "prompt"],
      skillId,
      name,
      prompt: prompt ? "<provided>" : null,
    });
  }
  if (!trustLevel) {
    fail("Invalid trustLevel", {
      allowed: Array.from(TRUST_LEVELS.values()),
      received: trustLevelRaw,
    });
  }
  if (scope.length === 0) {
    fail("Missing scope", {
      required: "scope",
      hint: "Provide --scope live,ui_task,multi or scope[] in input JSON",
    });
  }
  if (permissions.length === 0 || invalid.length > 0) {
    fail("Invalid permissions", {
      invalidPermissions: invalid,
      allowedPermissions: Array.from(ALLOWED_PERMISSIONS.values()),
    });
  }
  if (!keyId) {
    fail("Missing keyId", {
      required: "keyId",
    });
  }
  if (!secret) {
    fail("Missing signing secret", {
      required: "--secret or SKILL_PLUGIN_SIGNING_SECRET",
    });
  }

  return {
    skillId,
    name,
    prompt,
    scope,
    trustLevel,
    publisher,
    checksum,
    permissions,
    keyId,
    secret,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = toOptionalString(args.input);
  const outputPath = toOptionalString(args.output);

  const inputJson = inputPath ? await readJson(resolve(inputPath)) : {};
  const normalized = normalizeInput(inputJson, args);
  const payload = canonicalPayload(normalized);
  const payloadSha256 = sha256Hex(payload);
  const signature = hmacHex(normalized.secret, payloadSha256);

  const result = {
    ok: true,
    algorithm: "hmac-sha256",
    keyId: normalized.keyId,
    payloadSha256,
    signature,
    pluginManifest: {
      permissions: normalized.permissions,
      signing: {
        algorithm: "hmac-sha256",
        keyId: normalized.keyId,
        signature,
      },
    },
    canonicalPayload: JSON.parse(payload),
  };

  if (outputPath) {
    const resolvedOutput = resolve(outputPath);
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  fail("skill-plugin-sign failed", {
    error: error instanceof Error ? error.message : String(error),
  });
});
