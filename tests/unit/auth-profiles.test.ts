import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  listAuthProfileSnapshots,
  resolveCredentialValueWithProfile,
  rotateAuthProfile,
  upsertCredentialStoreEntry,
} from "../../shared/skills/src/index.js";

test("auth profile rotation selects and resolves the active credential from the repo-owned store", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-auth-profile-"));
  try {
    const env: NodeJS.ProcessEnv = {
      CREDENTIAL_STORE_FILE: "credentials/store.json",
      CREDENTIAL_STORE_MASTER_KEY: "auth-profile-master",
      AUTH_PROFILE_STORE_FILE: "credentials/auth-profiles.json",
    };

    upsertCredentialStoreEntry(
      {
        namespace: "skills.managed_index.auth_token",
        name: "managed-index-a",
        secretValue: "secret-a",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T00:00:00.000Z",
      },
    );
    upsertCredentialStoreEntry(
      {
        namespace: "skills.managed_index.auth_token",
        name: "managed-index-b",
        secretValue: "secret-b",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T00:00:10.000Z",
      },
    );

    const firstRotation = rotateAuthProfile(
      {
        profileId: "skills-managed-index",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T00:00:20.000Z",
      },
    );
    assert.equal(firstRotation.selectedCredentialName, "managed-index-b");

    const firstResolved = resolveCredentialValueWithProfile({
      namespace: "skills.managed_index.auth_token",
      profileId: "skills-managed-index",
      env,
      cwd: rootDir,
    });
    assert.equal(firstResolved.selectionSource, "auth_profile");
    assert.equal(firstResolved.value, "secret-b");

    const secondRotation = rotateAuthProfile(
      {
        profileId: "skills-managed-index",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T00:00:30.000Z",
      },
    );
    assert.equal(secondRotation.selectedCredentialName, "managed-index-a");

    const secondResolved = resolveCredentialValueWithProfile({
      namespace: "skills.managed_index.auth_token",
      profileId: "skills-managed-index",
      env,
      cwd: rootDir,
    });
    assert.equal(secondResolved.selectionSource, "auth_profile");
    assert.equal(secondResolved.value, "secret-a");

    const snapshot = listAuthProfileSnapshots({
      env,
      cwd: rootDir,
    }).find((item) => item.profileId === "skills-managed-index");
    assert.ok(snapshot);
    assert.equal(snapshot.activeCredentialName, "managed-index-a");
    assert.deepEqual(
      snapshot.availableCredentials.map((item) => item.name),
      ["managed-index-b", "managed-index-a"],
    );
    assert.equal(snapshot.warnings.length, 0);
    assert.deepEqual(snapshot.rotation, {
      rotationCount: 2,
      lastRotatedAt: "2026-03-07T00:00:30.000Z",
      previousCredentialName: "managed-index-b",
      currentCredentialName: "managed-index-a",
      lastCredentialUpdatedAt: "2026-03-07T00:00:00.000Z",
    });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("auth profile snapshots warn when direct env credentials override rotation", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-auth-profile-override-"));
  try {
    const env: NodeJS.ProcessEnv = {
      CREDENTIAL_STORE_FILE: "credentials/store.json",
      CREDENTIAL_STORE_MASTER_KEY: "auth-profile-master",
      AUTH_PROFILE_STORE_FILE: "credentials/auth-profiles.json",
      SKILLS_MANAGED_INDEX_AUTH_TOKEN: "direct-secret-token",
    };

    upsertCredentialStoreEntry(
      {
        namespace: "skills.managed_index.auth_token",
        name: "managed-index-store",
        secretValue: "store-secret-token",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T01:00:00.000Z",
      },
    );

    rotateAuthProfile(
      {
        profileId: "skills-managed-index",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T01:00:10.000Z",
      },
    );

    const snapshot = listAuthProfileSnapshots({
      env,
      cwd: rootDir,
    }).find((item) => item.profileId === "skills-managed-index");
    assert.ok(snapshot);
    assert.equal(snapshot.directValueConfigured, true);
    assert.equal(snapshot.effectiveResolution.selectionSource, "direct_env");
    assert.equal(snapshot.effectiveResolution.value, "direct-secret-token");
    assert.ok(
      snapshot.warnings.some((item) => item.includes("Direct env credential is set and overrides auth-profile rotation")),
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("auth profile snapshots include live gateway bindings from LIVE_API_AUTH_PROFILES_JSON", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-auth-profile-live-gateway-"));
  try {
    const env: NodeJS.ProcessEnv = {
      CREDENTIAL_STORE_FILE: "credentials/store.json",
      CREDENTIAL_STORE_MASTER_KEY: "auth-profile-master",
      AUTH_PROFILE_STORE_FILE: "credentials/auth-profiles.json",
      LIVE_API_AUTH_PROFILES_JSON: JSON.stringify([
        {
          name: "primary",
          apiKeyProfileId: "live-gateway-primary-api-key",
        },
      ]),
    };

    upsertCredentialStoreEntry(
      {
        namespace: "live.gateway.auth_profiles.primary.api_key",
        name: "live-primary-a",
        secretValue: "gateway-secret-a",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T01:30:00.000Z",
      },
    );
    upsertCredentialStoreEntry(
      {
        namespace: "live.gateway.auth_profiles.primary.api_key",
        name: "live-primary-b",
        secretValue: "gateway-secret-b",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T01:30:10.000Z",
      },
    );

    rotateAuthProfile(
      {
        profileId: "live-gateway-primary-api-key",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T01:30:20.000Z",
      },
    );

    const snapshot = listAuthProfileSnapshots({
      env,
      cwd: rootDir,
    }).find((item) => item.profileId === "live-gateway-primary-api-key");
    assert.ok(snapshot);
    assert.equal(snapshot.category, "live_gateway");
    assert.equal(snapshot.namespace, "live.gateway.auth_profiles.primary.api_key");
    assert.equal(snapshot.label, "Live Gateway primary API Key");
    assert.equal(snapshot.configuredProfileId, "live-gateway-primary-api-key");
    assert.equal(snapshot.effectiveResolution.selectionSource, "auth_profile");
    assert.equal(snapshot.effectiveResolution.value, "gateway-secret-b");
    assert.equal(snapshot.activeCredentialName, "live-primary-b");
    assert.deepEqual(
      snapshot.availableCredentials.map((item) => item.name),
      ["live-primary-b", "live-primary-a"],
    );
    assert.deepEqual(snapshot.rotation, {
      rotationCount: 1,
      lastRotatedAt: "2026-03-07T01:30:20.000Z",
      previousCredentialName: null,
      currentCredentialName: "live-primary-b",
      lastCredentialUpdatedAt: "2026-03-07T01:30:10.000Z",
    });
    assert.equal(snapshot.warnings.length, 0);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("auth profile snapshots warn but do not crash when the auth-profile store is malformed", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-auth-profile-invalid-"));
  try {
    const env: NodeJS.ProcessEnv = {
      CREDENTIAL_STORE_FILE: "credentials/store.json",
      CREDENTIAL_STORE_MASTER_KEY: "auth-profile-master",
      AUTH_PROFILE_STORE_FILE: "credentials/auth-profiles.json",
    };
    const storePath = join(rootDir, "credentials", "auth-profiles.json");
    mkdirSync(join(rootDir, "credentials"), { recursive: true });
    writeFileSync(storePath, "{invalid", "utf8");
    upsertCredentialStoreEntry(
      {
        namespace: "skills.managed_index.auth_token",
        name: "managed-index-a",
        secretValue: "secret-a",
      },
      {
        env,
        cwd: rootDir,
      },
    );

    const snapshots = listAuthProfileSnapshots({
      env,
      cwd: rootDir,
    });
    const snapshot = snapshots.find((item) => item.profileId === "skills-managed-index");
    assert.ok(snapshot);
    assert.ok(snapshot.warnings.some((item) => /could not be parsed/i.test(item)));
    const resolved = resolveCredentialValueWithProfile({
      namespace: "skills.managed_index.auth_token",
      profileId: "skills-managed-index",
      env,
      cwd: rootDir,
    });
    assert.ok(resolved.warnings.some((item) => /could not be parsed/i.test(item)));

    assert.throws(
      () =>
        rotateAuthProfile(
          {
            profileId: "skills-managed-index",
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
