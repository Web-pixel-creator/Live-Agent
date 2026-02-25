import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend enriches gateway.error diagnostics with pending client-event context", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const source = readFileSync(appPath, "utf8");

  const requiredTokens = [
    "PENDING_CLIENT_EVENT_MAX_AGE_MS",
    "prunePendingClientEvents",
    "resolvePendingClientEventContext",
    "pendingContext?.sentType",
    "pendingContext?.conversation",
    "latencyMs=",
    "state.pendingClientEvents.clear()",
  ];
  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `frontend gateway-error correlation token missing: ${token}`);
  }
});
