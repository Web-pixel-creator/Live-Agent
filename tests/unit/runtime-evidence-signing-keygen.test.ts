import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const scriptPath = resolve(process.cwd(), "scripts", "runtime-evidence-signing-keygen.mjs");

function derivePublicKeyFingerprint(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({
    format: "der",
    type: "spki",
  });
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

test("runtime evidence signing keygen writes a reusable Ed25519 bundle", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "mla-runtime-evidence-keygen-"));
  try {
    const outputDir = join(tempRoot, "keys");
    const result = spawnSync(
      process.execPath,
      [scriptPath, "--outputDir", outputDir, "--keyId", "unit-key", "--signerId", "api-backend-test"],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const stdout = JSON.parse(result.stdout) as {
      ok?: boolean;
      keyId?: string;
      signerId?: string;
      outputDir?: string;
      envSnippetPath?: string;
      publicKeyPemPath?: string;
      summaryJsonPath?: string;
      publicKeyFingerprint?: string;
    };
    assert.equal(stdout.ok, true);
    assert.equal(stdout.keyId, "unit-key");
    assert.equal(stdout.signerId, "api-backend-test");

    const privateKeyPem = readFileSync(join(outputDir, "runtime-evidence-private-key.pem"), "utf8");
    const privateKeyBase64 = readFileSync(
      join(outputDir, "runtime-evidence-private-key.base64.txt"),
      "utf8",
    ).trim();
    const publicKeyPem = readFileSync(join(outputDir, "runtime-evidence-public-key.pem"), "utf8");
    const envSnippet = readFileSync(join(outputDir, "runtime-evidence.env"), "utf8");
    const summary = JSON.parse(
      readFileSync(join(outputDir, "runtime-evidence-summary.json"), "utf8"),
    ) as {
      algorithm?: string;
      canonicalization?: string;
      keyId?: string;
      signerId?: string;
      publicKeyFingerprint?: string;
    };

    assert.match(privateKeyPem, /BEGIN PRIVATE KEY/);
    assert.match(publicKeyPem, /BEGIN PUBLIC KEY/);
    assert.equal(Buffer.from(privateKeyBase64, "base64").toString("utf8"), privateKeyPem);
    assert.match(envSnippet, /RUNTIME_EVIDENCE_SIGNING_ENABLED=true/);
    assert.match(envSnippet, /RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_BASE64=/);
    assert.match(envSnippet, /RUNTIME_EVIDENCE_SIGNING_KEY_ID=unit-key/);
    assert.match(envSnippet, /RUNTIME_EVIDENCE_SIGNING_SIGNER_ID=api-backend-test/);
    assert.equal(summary.algorithm, "ed25519-sha256");
    assert.equal(summary.canonicalization, "json-stable-v1");
    assert.equal(summary.keyId, "unit-key");
    assert.equal(summary.signerId, "api-backend-test");
    assert.equal(summary.publicKeyFingerprint, derivePublicKeyFingerprint(publicKeyPem));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("runtime evidence signing keygen protects existing bundles unless overwrite is requested", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "mla-runtime-evidence-keygen-overwrite-"));
  try {
    const outputDir = join(tempRoot, "keys");
    const first = spawnSync(process.execPath, [scriptPath, "--outputDir", outputDir], {
      encoding: "utf8",
    });
    assert.equal(first.status, 0, `${first.stderr}\n${first.stdout}`);

    const second = spawnSync(process.execPath, [scriptPath, "--outputDir", outputDir], {
      encoding: "utf8",
    });
    assert.notEqual(second.status, 0);
    assert.match(`${second.stderr}\n${second.stdout}`, /Refusing to overwrite existing runtime evidence signing files/i);

    const third = spawnSync(
      process.execPath,
      [scriptPath, "--outputDir", outputDir, "--overwrite", "true"],
      { encoding: "utf8" },
    );
    assert.equal(third.status, 0, `${third.stderr}\n${third.stdout}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("runtime evidence signing keygen stays wired in package and docs", () => {
  const packageSource = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const localDevelopment = readFileSync(resolve(process.cwd(), "docs", "local-development.md"), "utf8");

  assert.match(packageSource, /"runtime:evidence:keygen": "node \.\/scripts\/runtime-evidence-signing-keygen\.mjs"/);
  assert.match(envExample, /runtime:evidence:keygen/i);
  assert.match(readme, /runtime:evidence:keygen/i);
  assert.match(localDevelopment, /runtime:evidence:keygen/i);
  assert.match(localDevelopment, /runtime-evidence-private-key\.base64\.txt/i);
});
