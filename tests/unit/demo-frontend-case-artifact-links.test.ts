import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCaseBundlePath,
  buildCaseEvidencePath,
  buildCaseRuntimeSupportPath,
  buildCaseVaultPath,
  resolveCaseArtifactRef,
} from "../../apps/demo-frontend/app-shell/src/lib/case-artifact-links";

test("case artifact links prefer repo-owned runtime ids before legacy refs", () => {
  const target = {
    ref: "VS-2841",
    caseId: "case-visa-042",
    sessionId: "session-042",
  };

  assert.equal(resolveCaseArtifactRef(target), "case-visa-042");
  assert.equal(buildCaseBundlePath(target), "/bundle/case-visa-042");
  assert.equal(buildCaseEvidencePath(target), "/evidence/case-visa-042");
  assert.equal(
    buildCaseRuntimeSupportPath(target),
    "/app/console/runtime?ref=case-visa-042",
  );
  assert.equal(
    buildCaseVaultPath(target),
    "/app/console/runtime?ref=case-visa-042#case-vault",
  );
});

test("case artifact links fall back to session id or plain ref when case id is absent", () => {
  assert.equal(
    resolveCaseArtifactRef({
      ref: "VS-9201",
      sessionId: "session-9201",
    }),
    "session-9201",
  );
  assert.equal(
    buildCaseBundlePath({
      ref: "VS-9201",
      sessionId: "session-9201",
    }),
    "/bundle/session-9201",
  );
  assert.equal(buildCaseEvidencePath("VS-9201"), "/evidence/VS-9201");
  assert.equal(
    buildCaseRuntimeSupportPath("VS-9201"),
    "/app/console/runtime?ref=VS-9201",
  );
  assert.equal(buildCaseVaultPath("VS-9201"), "/app/console/runtime?ref=VS-9201#case-vault");
});

test("case artifact runtime helpers fall back to support roots without a target", () => {
  assert.equal(buildCaseRuntimeSupportPath(undefined), "/app/console/runtime");
  assert.equal(buildCaseVaultPath(undefined), "/app/console/runtime#case-vault");
});
