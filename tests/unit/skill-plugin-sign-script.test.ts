import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

test("skill-plugin-sign script generates canonical payload hash and signature", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "mla-skill-sign-"));
  try {
    const inputPath = join(tempDir, "input.json");
    await writeFile(
      inputPath,
      `${JSON.stringify(
        {
          skillId: "calendar-managed-demo",
          name: "Calendar Managed Demo",
          prompt: "Prioritize scheduling clarity and conflict resolution.",
          scope: ["live", "ui_task", "multi"],
          trustLevel: "reviewed",
          publisher: "web-pixel-creator",
          checksum: null,
          permissions: ["ui.execute", "operator.actions"],
          keyId: "demo-key",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const scriptPath = resolve(process.cwd(), "scripts", "skill-plugin-sign.mjs");
    const secret = "demo-secret";
    const stdout = execFileSync(
      "node",
      [scriptPath, "--input", inputPath, "--secret", secret],
      {
        encoding: "utf8",
      },
    ).trim();
    const parsed = JSON.parse(stdout) as {
      payloadSha256: string;
      signature: string;
      pluginManifest: {
        permissions: string[];
        signing: {
          algorithm: string;
          keyId: string;
          signature: string;
        };
      };
      canonicalPayload: Record<string, unknown>;
    };

    const canonicalPayload = JSON.stringify({
      skillId: "calendar-managed-demo",
      name: "Calendar Managed Demo",
      prompt: "Prioritize scheduling clarity and conflict resolution.",
      scope: ["live", "ui_task", "multi"],
      trustLevel: "reviewed",
      publisher: "web-pixel-creator",
      checksum: null,
      permissions: ["ui.execute", "operator.actions"],
    });
    const expectedPayloadHash = sha256Hex(canonicalPayload);
    const expectedSignature = hmacHex(secret, expectedPayloadHash);

    assert.equal(parsed.payloadSha256, expectedPayloadHash);
    assert.equal(parsed.signature, expectedSignature);
    assert.equal(parsed.pluginManifest.signing.algorithm, "hmac-sha256");
    assert.equal(parsed.pluginManifest.signing.keyId, "demo-key");
    assert.equal(parsed.pluginManifest.signing.signature, expectedSignature);
    assert.deepEqual(parsed.pluginManifest.permissions, ["ui.execute", "operator.actions"]);
    assert.deepEqual(parsed.canonicalPayload, JSON.parse(canonicalPayload));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

