import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  canonicalizeEvidencePayload,
  hashEvidencePayload,
  signEvidencePayload,
  verifyEvidencePayloadSignature,
} from "../../apps/api-backend/src/runtime-evidence-signer.js";

test("runtime evidence signer emits deterministic unsigned hash when signing key is absent", () => {
  const payload = {
    z: "last",
    a: {
      b: 2,
      a: 1,
    },
  };

  const signature = signEvidencePayload(payload, {
    enabled: false,
    privateKeyPem: null,
    keyId: null,
    signerId: "api-backend-test",
    signedAt: "2026-04-10T09:00:00.000Z",
  });

  assert.equal(signature.status, "unsigned");
  assert.equal(signature.algorithm, "ed25519-sha256");
  assert.equal(signature.canonicalization, "json-stable-v1");
  assert.equal(signature.payloadHash, hashEvidencePayload({ a: { a: 1, b: 2 }, z: "last" }));
  assert.equal(signature.signature, null);
  assert.equal(signature.signerId, "api-backend-test");
  assert.equal(signature.signedAt, "2026-04-10T09:00:00.000Z");
});

test("runtime evidence signer signs and verifies Ed25519 payloads", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const payload = {
    caseId: "case-42",
    evidencePack: {
      sourceRefs: ["workflow:control-plane"],
    },
  };

  const evidenceSignature = signEvidencePayload(payload, {
    enabled: true,
    privateKeyPem,
    keyId: "unit-key",
    signerId: "api-backend-test",
    signedAt: "2026-04-10T09:00:00.000Z",
  });

  assert.equal(evidenceSignature.status, "signed");
  assert.equal(evidenceSignature.keyId, "unit-key");
  assert.match(evidenceSignature.signature ?? "", /^[A-Za-z0-9_-]+$/);

  assert.deepEqual(
    verifyEvidencePayloadSignature({
      payload,
      evidenceSignature,
      publicKeyPem,
    }),
    {
      ok: true,
      reason: "verified",
      payloadHash: evidenceSignature.payloadHash,
    },
  );

  const tampered = {
    ...payload,
    caseId: "case-43",
  };
  assert.equal(
    verifyEvidencePayloadSignature({
      payload: tampered,
      evidenceSignature,
      publicKeyPem,
    }).reason,
    "hash_mismatch",
  );
});

test("runtime evidence signer canonicalization ignores existing evidenceSignature field", () => {
  const payload = {
    caseId: "case-42",
    evidenceSignature: {
      signature: "old",
    },
    nested: {
      z: 1,
      a: 2,
    },
  };

  assert.equal(
    canonicalizeEvidencePayload(payload),
    canonicalizeEvidencePayload({
      nested: {
        a: 2,
        z: 1,
      },
      caseId: "case-42",
    }),
  );
});
