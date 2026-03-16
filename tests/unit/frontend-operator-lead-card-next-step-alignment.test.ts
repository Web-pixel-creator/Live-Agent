import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator desktop lead cards compress calm hint copy into a shorter next-step row", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function shouldUseOperatorCompactLeadHint(card) {",
    "function resolveOperatorCompactLeadActionLabel(actionLabel = \"\") {",
    "function resolveOperatorCompactLeadHintText(card, fallbackText = \"\") {",
    "function syncOperatorLeadCardHint(card) {",
    "const compactActionLabel = resolveOperatorCompactLeadActionLabel(actionLabel);",
    "const preferredActionLabel = useCompactSummary ? compactActionLabel || actionLabel : actionLabel;",
    "const prefersActionFirstHint = Boolean(",
    "/^refresh summary to inspect\\b/iu.test(normalizedFallback)",
    'if (prefersActionFirstHint) {',
    'return `${preferredActionLabel} first.`;',
    'return actionLabel ? `Next: ${actionLabel}, then Refresh Summary.` : "Next: Refresh Summary.";',
    'return "Next: monitor this lane only if related work changes.";',
    'hintNode.classList.toggle("is-compact-lead-hint", shouldUseCompactHint);',
    'const shouldUseCompactShell = shouldUseOperatorCompactLeadSummary(card);',
    'card.classList.toggle("has-compact-lead-shell", shouldUseCompactShell || shouldUseCompactHint);',
    'card.dataset.operatorLeadHintOriginalText = originalText;',
  ];

  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing lead next-step token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-health-card.operator-health-card-lead.has-lead-summary .operator-health-hint.is-compact-lead-hint {",
    'has-compact-lead-shell[data-operator-lead-summary-count="2"] {',
    '.operator-health-card-lead.has-compact-lead-shell[data-operator-lead-summary-count="2"]',
    '.operator-health-card-lead-summary {',
    "font-size: 0.61rem;",
    "line-height: 1.12;",
    "padding: 8px 9px;",
    "text-overflow: ellipsis;",
  ];

  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing lead next-step token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compress calm placeholder/healthy hint copy into a shorter `Next:` row"),
    "README missing lead next-step note",
  );
  assert.ok(
    readmeSource.includes("tighten their shell spacing"),
    "README missing compact lead shell note",
  );
  assert.ok(
    readmeSource.includes("UI Task first."),
    "README missing action-first compact hint note",
  );
  assert.ok(
    readmeSource.includes("even when the hint stays full"),
    "README missing persistent compact shell note",
  );
  assert.ok(
    operatorGuideSource.includes("compress calm placeholder/healthy hint copy into a shorter `Next:` row"),
    "operator guide missing lead next-step note",
  );
  assert.ok(
    operatorGuideSource.includes("tighten their shell spacing"),
    "operator guide missing compact lead shell note",
  );
  assert.ok(
    operatorGuideSource.includes("UI Task first."),
    "operator guide missing action-first compact hint note",
  );
  assert.ok(
    operatorGuideSource.includes("even when the hint stays full"),
    "operator guide missing persistent compact shell note",
  );
});
