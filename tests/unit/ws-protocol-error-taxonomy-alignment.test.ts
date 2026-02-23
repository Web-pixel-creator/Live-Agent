import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function extractGatewayCodesFromPolicy(source: string): string[] {
  const matches = [...source.matchAll(/"((?:GATEWAY|ORCHESTRATOR)_[A-Z0-9_]+)"/g)];
  const unique = new Set(matches.map((item) => item[1]));
  return [...unique].sort();
}

test("ws protocol documents gateway/orchestrator error codes used in policy checks", () => {
  const policyPath = resolve(process.cwd(), "scripts", "demo-e2e-policy-check.mjs");
  const wsProtocolPath = resolve(process.cwd(), "docs", "ws-protocol.md");

  const policySource = readFileSync(policyPath, "utf8");
  const wsProtocolSource = readFileSync(wsProtocolPath, "utf8");

  const policyGatewayCodes = extractGatewayCodesFromPolicy(policySource).filter((code) =>
    code.startsWith("GATEWAY_"),
  );
  assert.ok(policyGatewayCodes.length >= 4, "expected multiple gateway codes from policy");

  const requiredCodes = [...new Set([...policyGatewayCodes, "ORCHESTRATOR_IDEMPOTENCY_CONFLICT"])];

  for (const code of requiredCodes) {
    assert.ok(
      wsProtocolSource.includes(`\`${code}\``),
      `docs/ws-protocol.md missing documented error code: ${code}`,
    );
  }
});

test("ws protocol includes explicit retryability guidance for websocket errors", () => {
  const wsProtocolPath = resolve(process.cwd(), "docs", "ws-protocol.md");
  const wsProtocolSource = readFileSync(wsProtocolPath, "utf8");

  assert.ok(
    wsProtocolSource.includes("Retry guidance"),
    "docs/ws-protocol.md missing 'Retry guidance' section",
  );
  assert.match(wsProtocolSource, /Retryable with backoff/i);
  assert.match(wsProtocolSource, /Non-retryable without client fix/i);
});
