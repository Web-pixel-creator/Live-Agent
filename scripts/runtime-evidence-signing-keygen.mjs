import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const EVIDENCE_SIGNATURE_ALGORITHM = "ed25519-sha256";
const EVIDENCE_SIGNATURE_CANONICALIZATION = "json-stable-v1";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function toOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function writeUtf8NoBomFile(path, content) {
  const encoding = new TextEncoder();
  writeFileSync(path, encoding.encode(content));
}

function buildDefaultKeyId(now) {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");
  return `local-dev-${year}${month}${day}-${hour}${minute}${second}`;
}

function derivePublicKeyFingerprint(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({
    format: "der",
    type: "spki",
  });
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

const args = parseArgs(process.argv.slice(2));
const generatedAt = new Date();
const outputDir = resolve(
  toOptionalString(args.outputDir) ?? ".credentials/runtime-evidence-signing",
);
const overwrite = toBoolean(args.overwrite);
const keyId = toOptionalString(args.keyId) ?? buildDefaultKeyId(generatedAt);
const signerId = toOptionalString(args.signerId) ?? "api-backend";

const privateKeyPemPath = join(outputDir, "runtime-evidence-private-key.pem");
const privateKeyBase64Path = join(outputDir, "runtime-evidence-private-key.base64.txt");
const publicKeyPemPath = join(outputDir, "runtime-evidence-public-key.pem");
const envSnippetPath = join(outputDir, "runtime-evidence.env");
const summaryJsonPath = join(outputDir, "runtime-evidence-summary.json");
const summaryMarkdownPath = join(outputDir, "runtime-evidence-summary.md");

const targetPaths = [
  privateKeyPemPath,
  privateKeyBase64Path,
  publicKeyPemPath,
  envSnippetPath,
  summaryJsonPath,
  summaryMarkdownPath,
];

const existingTargets = targetPaths.filter((path) => existsSync(path));
if (existingTargets.length > 0 && !overwrite) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: "Refusing to overwrite existing runtime evidence signing files. Re-run with --overwrite true.",
        outputDir,
        existingTargets,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
const privateKeyBase64 = Buffer.from(privateKeyPem, "utf8").toString("base64");
const publicKeyFingerprint = derivePublicKeyFingerprint(publicKeyPem);

const envSnippet = [
  "# Runtime evidence signing",
  "RUNTIME_EVIDENCE_SIGNING_ENABLED=true",
  `RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_BASE64=${privateKeyBase64}`,
  `RUNTIME_EVIDENCE_SIGNING_KEY_ID=${keyId}`,
  `RUNTIME_EVIDENCE_SIGNING_SIGNER_ID=${signerId}`,
  "",
].join("\n");

const summary = {
  schemaVersion: 1,
  generatedAt: generatedAt.toISOString(),
  algorithm: EVIDENCE_SIGNATURE_ALGORITHM,
  canonicalization: EVIDENCE_SIGNATURE_CANONICALIZATION,
  keyId,
  signerId,
  outputDir,
  publicKeyFingerprint,
  files: {
    privateKeyPemPath,
    privateKeyBase64Path,
    publicKeyPemPath,
    envSnippetPath,
    summaryJsonPath,
    summaryMarkdownPath,
  },
};

const markdown = [
  "# Runtime Evidence Signing Key",
  "",
  `- generatedAt: ${summary.generatedAt}`,
  `- algorithm: ${summary.algorithm}`,
  `- canonicalization: ${summary.canonicalization}`,
  `- keyId: ${summary.keyId}`,
  `- signerId: ${summary.signerId}`,
  `- publicKeyFingerprint: ${summary.publicKeyFingerprint}`,
  `- privateKeyPemPath: ${summary.files.privateKeyPemPath}`,
  `- privateKeyBase64Path: ${summary.files.privateKeyBase64Path}`,
  `- publicKeyPemPath: ${summary.files.publicKeyPemPath}`,
  `- envSnippetPath: ${summary.files.envSnippetPath}`,
  "",
  "Use the env snippet for local `.env` or secret-manager input. Do not commit the private key files.",
  "",
].join("\n");

writeUtf8NoBomFile(privateKeyPemPath, privateKeyPem);
writeUtf8NoBomFile(privateKeyBase64Path, `${privateKeyBase64}\n`);
writeUtf8NoBomFile(publicKeyPemPath, publicKeyPem);
writeUtf8NoBomFile(envSnippetPath, envSnippet);
writeUtf8NoBomFile(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`);
writeUtf8NoBomFile(summaryMarkdownPath, markdown);

console.log(
  JSON.stringify(
    {
      ok: true,
      keyId,
      signerId,
      publicKeyFingerprint,
      outputDir,
      summaryJsonPath,
      envSnippetPath,
      publicKeyPemPath,
    },
    null,
    2,
  ),
);
