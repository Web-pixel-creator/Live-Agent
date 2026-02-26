import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const badgeScriptPath = resolve(process.cwd(), "scripts", "demo-e2e-badge-json.mjs");

function runBadgeGenerator(params: {
  policy: Record<string, unknown>;
  summary: Record<string, unknown>;
}): { exitCode: number; details: Record<string, unknown>; badge: Record<string, unknown> } {
  const tempDir = mkdtempSync(join(tmpdir(), "mla-badge-evidence-"));
  try {
    const policyPath = join(tempDir, "policy-check.json");
    const summaryPath = join(tempDir, "summary.json");
    const badgePath = join(tempDir, "badge.json");
    const detailsPath = join(tempDir, "badge-details.json");

    writeFileSync(policyPath, `${JSON.stringify(params.policy, null, 2)}\n`, "utf8");
    writeFileSync(summaryPath, `${JSON.stringify(params.summary, null, 2)}\n`, "utf8");

    const result = spawnSync(
      process.execPath,
      [
        badgeScriptPath,
        "--policy",
        policyPath,
        "--summary",
        summaryPath,
        "--output",
        badgePath,
        "--detailsOutput",
        detailsPath,
      ],
      { encoding: "utf8" },
    );

    const exitCode = result.status ?? 1;
    const badge = JSON.parse(readFileSync(badgePath, "utf8")) as Record<string, unknown>;
    const details = JSON.parse(readFileSync(detailsPath, "utf8")) as Record<string, unknown>;
    return {
      exitCode,
      details,
      badge,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("demo-e2e badge details include operator turn truncation/delete evidence blocks", () => {
  const result = runBadgeGenerator({
    policy: {
      ok: true,
      checks: 205,
      violations: [],
    },
    summary: {
      generatedAt: "2026-02-26T00:00:00.000Z",
      kpis: {
        gatewayWsRoundTripMs: 37,
        operatorTurnTruncationSummaryValidated: true,
        operatorTurnTruncationExpectedEventSeen: true,
        operatorTurnTruncationTotal: 1,
        operatorTurnTruncationUniqueRuns: 1,
        operatorTurnTruncationUniqueSessions: 1,
        operatorTurnTruncationLatestSeenAt: "2026-02-26T00:00:00.000Z",
        operatorTurnTruncationLatestTurnId: "turn-truncate-demo",
        operatorTurnTruncationLatestReason: "demo_truncate_checkpoint",
        operatorTurnDeleteSummaryValidated: true,
        operatorTurnDeleteExpectedEventSeen: true,
        operatorTurnDeleteTotal: 1,
        operatorTurnDeleteUniqueRuns: 1,
        operatorTurnDeleteUniqueSessions: 1,
        operatorTurnDeleteLatestSeenAt: "2026-02-26T00:00:00.000Z",
        operatorTurnDeleteLatestTurnId: "turn-delete-demo",
        operatorTurnDeleteLatestReason: "demo_delete_checkpoint",
        operatorTurnDeleteLatestScope: "session_local",
        damageControlDiagnosticsValidated: true,
        damageControlEnabled: true,
        damageControlVerdict: "ask",
        damageControlSource: "file",
        damageControlMatchedRuleCount: 2,
        damageControlMatchRuleIds: ["requires_approval_sensitive_action", "allow_search_docs"],
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.badge.message, "pass | 205 checks | 37ms ws");
  const evidence = result.details.evidence as Record<string, unknown>;
  assert.ok(evidence && typeof evidence === "object");
  const turnTruncation = evidence.operatorTurnTruncation as Record<string, unknown>;
  const turnDelete = evidence.operatorTurnDelete as Record<string, unknown>;
  const damageControl = evidence.damageControl as Record<string, unknown>;
  assert.equal(turnTruncation.status, "pass");
  assert.equal(turnDelete.status, "pass");
  assert.equal(damageControl.status, "pass");
  assert.equal(turnTruncation.latestTurnId, "turn-truncate-demo");
  assert.equal(turnDelete.latestTurnId, "turn-delete-demo");
  assert.equal(turnDelete.latestScope, "session_local");
  assert.equal(damageControl.verdict, "ask");
  assert.equal(damageControl.source, "file");
  assert.deepEqual(damageControl.matchedRuleIds, ["requires_approval_sensitive_action", "allow_search_docs"]);
});

test("demo-e2e badge details marks operator turn delete evidence as failed when checkpoint is missing", () => {
  const result = runBadgeGenerator({
    policy: {
      ok: false,
      checks: 205,
      violations: [
        "kpi.operatorTurnDeleteSummaryValidated",
        "kpi.operatorTurnDeleteExpectedEventSeen",
        "kpi.operatorTurnDeleteTotal",
      ],
    },
    summary: {
      generatedAt: "2026-02-26T00:00:00.000Z",
      kpis: {
        gatewayWsRoundTripMs: 45,
        operatorTurnDeleteSummaryValidated: false,
        operatorTurnDeleteExpectedEventSeen: false,
        operatorTurnDeleteTotal: 0,
        operatorTurnDeleteUniqueRuns: 0,
        operatorTurnDeleteUniqueSessions: 0,
        operatorTurnDeleteLatestSeenAt: "",
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.badge.color, "red");
  const evidence = result.details.evidence as Record<string, unknown>;
  const turnDelete = evidence.operatorTurnDelete as Record<string, unknown>;
  const damageControl = evidence.damageControl as Record<string, unknown>;
  assert.equal(turnDelete.status, "fail");
  assert.equal(turnDelete.validated, false);
  assert.equal(turnDelete.total, 0);
  assert.equal(turnDelete.latestSeenAtIsIso, false);
  assert.equal(damageControl.status, "fail");
  assert.equal(damageControl.enabled, false);
  assert.equal(damageControl.diagnosticsValidated, false);
  assert.equal(damageControl.matchedRuleCount, 0);
  assert.deepEqual(damageControl.matchedRuleIds, []);
});
