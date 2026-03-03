import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console maps placeholder status/value text to demo-friendly labels", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
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

  const requiredHtmlTokens = [
    'id="operatorSignalBridge" class="status-pill status-neutral" data-status-code="no_data">awaiting_refresh</p>',
    'id="operatorHealthStatus" class="status-pill status-neutral" data-status-code="no_data">awaiting_refresh</p>',
    'id="operatorGatewayErrorSource">pending</span>',
    'id="operatorDamageControlLatest">pending</span>',
    "No gateway errors captured yet. Run flow probes or refresh summary to validate correlation lane.",
    "No damage-control decisions observed yet. Run a UI sandbox flow to populate this lane.",
  ];

  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator status-display token: ${token}`);
  }
});
