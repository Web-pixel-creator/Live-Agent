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
    "const localizedMap = isRu",
    'translation: "translation"',
    'translation: "перевод"',
    'return isRu ? "нужно обновить" : "needs refresh";',
    'return isRu ? "ошибка обновления" : "refresh failed";',
    'return isRu ? "ждёт запрос" : "waiting for request";',
    'if (normalized === "summary_stale") {',
    'return isRu ? "\\u0443\\u0441\\u0442\\u0430\\u0440\\u0435\\u043b\\u043e" : "stale";',
    'normalized.includes("state=unknown")',
    "function resolveOperatorSignalMirrorText(statusCode, fallbackText)",
    'normalized.includes("no_approvals")',
    'return isRu ? "нет согласований" : "no approvals";',
    'normalized.includes("no_nodes")',
    'return isRu ? "нет узлов" : "no nodes";',
    'normalized.includes("idle total=0")',
    'return isRu ? "очередь пуста" : "queue empty";',
    "node.dataset.statusCode = statusCode;",
    "node.textContent = resolveStatusPillDisplayText(statusCode);",
    "statusNode.dataset.statusCode ?? statusNode.textContent ?? \"\"",
    "function syncOperatorMetricPlaceholder(node)",
    "node.closest(\".operator-health-row\")",
    "displayText = \"awaiting_signal\";",
    "displayText = \"none_yet\";",
    "const placeholderText = isPlaceholder",
    '? formatOperatorEvidenceDrawerFactValue("", displayText) || resolveStatusPillDisplayText(displayText)',
    "node.textContent = placeholderText;",
    "node.classList.toggle(\"operator-metric-placeholder\", isPlaceholder);",
    "if (typeof value === \"string\" && value.trim().toLowerCase() === \"n/a\") {",
    "node.textContent = \"pending\";",
    'const failedRefreshReason = "summary_stale";',
    "const exactOperatorMap = isRu",
    'coverage_incomplete: "needs proof"',
    'override_active: "override active"',
    'unknown_state: "unknown state"',
    'const criticalSignalsMatch = normalized.match(/^critical signals=(\\d+)$/);',
    'return isRu ? `\\u043a\\u0440\\u0438\\u0442\\u0438\\u0447\\u043d\\u043e x${criticalSignalsMatch[1]}` : `critical x${criticalSignalsMatch[1]}`;',
    'const degradedSignalsMatch = normalized.match(/^degraded signals=(\\d+)$/);',
    'return isRu ? `\\u0440\\u0438\\u0441\\u043a x${degradedSignalsMatch[1]}` : `watch x${degradedSignalsMatch[1]}`;',
    'const mirrorText = resolveOperatorSignalMirrorText(sourceStatusCode, node.textContent ?? "no_data");',
    'const fullMirrorLabel = resolveStatusPillDisplayText(mirrorText);',
    'const nextMirrorLabel = summaryCard instanceof HTMLElement',
    'mirrorNode.textContent = nextMirrorLabel;',
  ];

  for (const token of requiredTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator status-display token: ${token}`);
  }

  const requiredHtmlTokens = [
    'id="operatorSignalBridge" class="status-pill status-neutral" data-status-code="no_data">awaiting_refresh</p>',
    'id="operatorHealthStatus" class="status-pill status-neutral" data-status-code="no_data">awaiting_refresh</p>',
    'id="operatorGatewayErrorSource">pending</span>',
    'id="operatorDamageControlLatest">pending</span>',
    "Refresh summary to inspect UI fallback readiness.",
    "Refresh summary to inspect workflow path and any temporary override.",
    "<strong>From Tasks</strong>",
    "<strong>SLA Watch/Breach</strong>",
    "Refresh summary to inspect approval backlog and time limits.",
    "No active queue pressure yet. Run one scenario and refresh.",
    "Startup checks not sampled yet. Refresh Summary to pull fresh probe evidence.",
    "No gateway error yet. Refresh after a live run.",
    "No UI safety event yet. Run UI task, then refresh.",
  ];

  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator status-display token: ${token}`);
  }
});

