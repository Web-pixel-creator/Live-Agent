import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  listCredentialMetadata,
  resolveCredentialValue,
  upsertCredentialStoreEntry,
} from "../../shared/skills/src/credential-store.js";

function createCredentialEnv(rootDir: string): NodeJS.ProcessEnv {
  return {
    CREDENTIAL_STORE_FILE: "credentials/store.json",
    CREDENTIAL_STORE_MASTER_KEY: "test-master-key",
  };
}

test("credential store writes encrypted payloads with metadata separated and atomic file replacement", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-credential-store-"));
  try {
    const env = createCredentialEnv(rootDir);
    const secretValue = "super-secret-token";

    upsertCredentialStoreEntry(
      {
        namespace: "skills.managed_index.auth_token",
        name: "catalog-token",
        secretValue,
        metadata: {
          service: "skills",
          purpose: "managed-index",
          keyId: "catalog-main",
          token: "should-not-be-stored-in-metadata",
        },
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-06T00:00:00.000Z",
      },
    );

    const storePath = join(rootDir, "credentials", "store.json");
    const raw = readFileSync(storePath, "utf8");
    assert.ok(!raw.includes(secretValue), "secret should not be stored in plaintext");
    assert.ok(!raw.includes("should-not-be-stored-in-metadata"), "sensitive metadata should be redacted");

    const listed = listCredentialMetadata({ env, cwd: rootDir });
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.metadata.service, "skills");
    assert.equal(listed[0]?.metadata.keyId, "catalog-main");
    assert.equal("token" in (listed[0]?.metadata ?? {}), false);

    const resolved = resolveCredentialValue({
      namespace: "skills.managed_index.auth_token",
      credentialName: "catalog-token",
      env,
      cwd: rootDir,
    });
    assert.equal(resolved.value, secretValue);
    assert.equal(resolved.source, "credential_store");
    assert.equal(resolved.metadata?.purpose, "managed-index");

    const files = readdirSync(join(rootDir, "credentials"));
    assert.deepEqual(files, ["store.json"]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("credential store keeps direct env values authoritative over stored credentials", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-credential-store-env-"));
  try {
    const env = createCredentialEnv(rootDir);
    upsertCredentialStoreEntry(
      {
        namespace: "ui_navigator.device_node_index.auth_token",
        name: "device-index-token",
        secretValue: "stored-secret",
      },
      {
        env,
        cwd: rootDir,
      },
    );

    const resolved = resolveCredentialValue({
      namespace: "ui_navigator.device_node_index.auth_token",
      directValue: "env-secret",
      credentialName: "device-index-token",
      env,
      cwd: rootDir,
    });

    assert.equal(resolved.value, "env-secret");
    assert.equal(resolved.source, "direct_env");
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("credential store reports missing credentials without crashing", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-credential-store-missing-"));
  try {
    const env = createCredentialEnv(rootDir);
    const resolved = resolveCredentialValue({
      namespace: "api.skill_plugin.signing_keys",
      credentialName: "missing-keyset",
      env,
      cwd: rootDir,
    });

    assert.equal(resolved.value, null);
    assert.equal(resolved.source, "missing");
    assert.match(resolved.warnings.join(" "), /missing/i);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("credential store read paths stay safe when the store file is malformed", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-credential-store-invalid-"));
  try {
    const env = createCredentialEnv(rootDir);
    const storePath = join(rootDir, "credentials", "store.json");
    mkdirSync(join(rootDir, "credentials"), { recursive: true });
    writeFileSync(storePath, "{invalid", "utf8");

    const resolved = resolveCredentialValue({
      namespace: "skills.managed_index.auth_token",
      credentialName: "broken-entry",
      env,
      cwd: rootDir,
    });
    assert.equal(resolved.value, null);
    assert.equal(resolved.source, "missing");
    assert.match(resolved.warnings.join(" "), /could not be parsed/i);

    const listed = listCredentialMetadata({ env, cwd: rootDir });
    assert.deepEqual(listed, []);

    assert.throws(
      () =>
        upsertCredentialStoreEntry(
          {
            namespace: "skills.managed_index.auth_token",
            name: "catalog-token",
            secretValue: "secret",
          },
          {
            env,
            cwd: rootDir,
          },
        ),
      /could not be parsed/i,
    );
    assert.equal(readFileSync(storePath, "utf8"), "{invalid");
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
