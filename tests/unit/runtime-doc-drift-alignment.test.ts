import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function expectTokens(source: string, tokens: string[], context: string): void {
  for (const token of tokens) {
    assert.ok(source.includes(token), `${context} missing token: ${token}`);
  }
}

test("README keeps operator summary verification fields and release evidence routes aligned with api-backend", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const apiIndex = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "index.ts"), "utf8");
  const operatorTraces = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "operator-traces.ts"), "utf8");
  const firestore = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "firestore.ts"), "utf8");

  expectTokens(
    apiIndex,
    [
      "/v1/operator/summary",
      "buildTaskQueueSummary(activeTasks)",
      "buildOperatorTraceSummary({",
      "runtimeDiagnostics",
    ],
    "api-backend operator summary",
  );

  expectTokens(
    operatorTraces,
    [
      "verificationState",
      "verificationFailureClass",
      "verificationSummary",
      "verifySteps",
      "recentRuns",
    ],
    "operator trace summary",
  );

  expectTokens(
    firestore,
    [
      "verificationState?: string;",
      "verificationFailureClass?: string;",
      "verificationSummary?: string;",
      "verificationState =",
      "verificationFailureClass =",
      "verificationSummary =",
    ],
    "firestore event mapping",
  );

  expectTokens(
    readme,
    [
      "GET /v1/operator/summary",
      "verificationState",
      "verificationFailureClass",
      "verificationSummary",
      "verifySteps",
      "artifacts/deploy/gcp-cloud-run-summary.json",
      "artifacts/release-evidence/gcp-runtime-proof.json",
      "artifacts/release-evidence/submission-refresh-status.json",
      "badge-details.json",
      "runtimeGuardrailsSignalPaths",
    ],
    "README runtime evidence",
  );
});

test("eval docs stay pinned to promptfoo commands and the latest run artifact", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const evals = readFileSync(resolve(process.cwd(), "docs", "evals.md"), "utf8");

  const expectedScripts = [
    "eval:promptfoo",
    "eval:promptfoo:translation",
    "eval:promptfoo:negotiation",
    "eval:promptfoo:research",
    "eval:promptfoo:ui-safety",
    "eval:promptfoo:red-team",
    "eval:promptfoo:gate",
  ];
  for (const scriptName of expectedScripts) {
    assert.ok(packageJson.scripts?.[scriptName], `package.json missing eval script: ${scriptName}`);
    assert.ok(
      evals.includes(`npm run ${scriptName}`),
      `docs/evals.md missing eval command token: npm run ${scriptName}`,
    );
  }

  expectTokens(
    evals,
    ["artifacts/evals/latest-run.json", "red-team", "verify:release", "GOOGLE_API_KEY"],
    "eval docs",
  );
});

test("ws protocol docs keep grounding and function-call tokens aligned with realtime gateway source", () => {
  const wsProtocol = readFileSync(resolve(process.cwd(), "docs", "ws-protocol.md"), "utf8");
  const gatewayIndex = readFileSync(resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts"), "utf8");
  const liveBridge = readFileSync(resolve(process.cwd(), "apps", "realtime-gateway", "src", "live-bridge.ts"), "utf8");

  expectTokens(
    wsProtocol,
    [
      "live.setup",
      "live.input.commit",
      "conversation.item.delete",
      "live.function_call_output",
      "refMap",
      "task.started",
      "task.completed",
      "task.failed",
    ],
    "ws protocol docs",
  );

  expectTokens(
    gatewayIndex,
    [
      "conversation.item.delete",
      "live.function_call_output",
      "task.started",
      "task.completed",
      "task.failed",
    ],
    "realtime gateway source",
  );

  expectTokens(
    liveBridge,
    [
      "live.function_call_output.sent",
      "live.turn.deleted",
    ],
    "live bridge source",
  );
});
