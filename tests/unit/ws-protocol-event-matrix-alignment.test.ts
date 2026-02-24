import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function extractSet(source: string, pattern: RegExp): Set<string> {
  const values = [...source.matchAll(pattern)].map((match) => match[1]);
  return new Set(values);
}

function toSorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

test("ws protocol documents gateway->frontend events emitted by realtime gateway runtime", () => {
  const wsProtocolPath = resolve(process.cwd(), "docs", "ws-protocol.md");
  const gatewayIndexPath = resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts");
  const liveBridgePath = resolve(process.cwd(), "apps", "realtime-gateway", "src", "live-bridge.ts");

  const wsProtocolSource = readFileSync(wsProtocolPath, "utf8");
  const gatewayIndexSource = readFileSync(gatewayIndexPath, "utf8");
  const liveBridgeSource = readFileSync(liveBridgePath, "utf8");

  const documentedEvents = extractSet(wsProtocolSource, /`([a-z0-9_.]+)`/g);
  const gatewayEnvelopeTypes = extractSet(gatewayIndexSource, /type:\s*"([a-z0-9_.]+)"/g);
  const liveBridgeEvents = extractSet(liveBridgeSource, /this\.emit\("([a-z0-9_.]+)"/g);

  const runtimeOutboundEvents = toSorted(
    [...gatewayEnvelopeTypes, ...liveBridgeEvents].filter((eventType) =>
      /^(gateway|session|orchestrator|task|live)\./.test(eventType),
    ),
  );

  assert.ok(runtimeOutboundEvents.length >= 20, "expected broad gateway outbound event surface");
  for (const eventType of runtimeOutboundEvents) {
    assert.ok(
      documentedEvents.has(eventType),
      `docs/ws-protocol.md missing gateway outbound event: ${eventType}`,
    );
  }
});

test("ws protocol documents frontend->gateway events emitted by demo frontend", () => {
  const wsProtocolPath = resolve(process.cwd(), "docs", "ws-protocol.md");
  const frontendAppPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");

  const wsProtocolSource = readFileSync(wsProtocolPath, "utf8");
  const frontendSource = readFileSync(frontendAppPath, "utf8");

  const documentedEvents = extractSet(wsProtocolSource, /`([a-z0-9_.]+)`/g);
  const frontendOutboundEvents = toSorted(extractSet(frontendSource, /sendEnvelope\("([a-z0-9_.]+)"/g));

  assert.ok(frontendOutboundEvents.length >= 3, "expected multiple frontend outbound websocket events");
  for (const eventType of frontendOutboundEvents) {
    assert.ok(
      documentedEvents.has(eventType),
      `docs/ws-protocol.md missing frontend outbound event: ${eventType}`,
    );
  }
});
