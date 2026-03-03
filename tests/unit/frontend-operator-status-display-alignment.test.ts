import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console maps placeholder status/value text to demo-friendly labels", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const appSource = readFileSync(appPath, "utf8");

  const requiredTokens = [
    "function resolveStatusPillDisplayText(value)",
    'return "awaiting_refresh";',
    'return "refresh_failed";',
    "node.dataset.statusCode = statusCode;",
    "node.textContent = resolveStatusPillDisplayText(statusCode);",
    "statusNode.dataset.statusCode ?? statusNode.textContent ?? \"\"",
    "if (typeof value === \"string\" && value.trim().toLowerCase() === \"n/a\") {",
    "node.textContent = \"pending\";",
  ];

  for (const token of requiredTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator status-display token: ${token}`);
  }
});

