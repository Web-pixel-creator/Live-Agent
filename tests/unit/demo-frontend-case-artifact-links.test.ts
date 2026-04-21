import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCaseBundlePath,
  buildCaseEvidencePath,
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
});
