import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes configurable CORS guardrails for demo frontend", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "API_CORS_ALLOWED_ORIGINS",
    "DEMO_FRONTEND_PUBLIC_URL",
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
    "req.method === \"OPTIONS\"",
    "CORS origin is not allowed",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend CORS contract missing token: ${token}`);
  }
});

test("local development docs include CORS origin override for api-backend", () => {
  const docsPath = resolve(process.cwd(), "docs", "local-development.md");
  const docs = readFileSync(docsPath, "utf8");

  assert.match(docs, /API_CORS_ALLOWED_ORIGINS/);
});
