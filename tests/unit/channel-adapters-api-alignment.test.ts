import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes multi-channel adapter/session routes and conflict contracts", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "/v1/channels/adapters",
    "/v1/channels/sessions/index",
    "/v1/channels/sessions",
    "/v1/channels/sessions/resolve",
    "/v1/channels/sessions/bind",
    "configuredChannelAdapters",
    "allowCustomChannelAdapters",
    "listChannelSessionBindings",
    "listChannelSessionBindingIndex",
    "getChannelSessionBinding",
    "upsertChannelSessionBinding",
    "API_CHANNEL_ADAPTER_NOT_ENABLED",
    "API_CHANNEL_SESSION_VERSION_CONFLICT",
    "API_CHANNEL_SESSION_IDEMPOTENCY_CONFLICT",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `channel adapter API contract missing token: ${token}`);
  }
});
