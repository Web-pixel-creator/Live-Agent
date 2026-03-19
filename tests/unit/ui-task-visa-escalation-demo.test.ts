import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("visa escalation demo fixture exposes stable anchors for the human handoff flow", () => {
  const fixturePath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "public",
    "ui-task-visa-escalation-demo.html",
  );
  const source = readFileSync(fixturePath, "utf8");

  const requiredTokens = [
    'id="crm-client-row"',
    'data-testid="crm-client-row"',
    "Anna Petrova",
    "VISA-2048",
    "Case escalation",
    "Human handoff required",
    'id="missing-doc-checklist"',
    'data-testid="missing-doc-checklist"',
    'data-doc-status="received"',
    'data-doc-status="missing"',
    'data-doc-status="pending"',
    "Passport scan",
    "Proof of address",
    "Escalation note",
    'id="escalation-routing"',
    'data-testid="escalation-routing"',
    "Escalation owner",
    "Sofia Kim",
    "Visa Escalations Tier 2",
    "2 business hours",
    "High",
    'id="reminder-state"',
    'data-testid="reminder-state"',
    "Escalation draft prepared",
    "Human handoff pending",
    'id="protected-step-boundary"',
    'data-testid="protected-step-boundary"',
    'id="approval-required-btn"',
    "Send for human approval",
    "Protected boundary: no client-facing handoff occurs before approval.",
    'id="approved-confirmation"',
    'data-testid="approved-confirmation"',
    'data-state="approved"',
    "Approved handoff confirmation",
    "Final verification complete. The escalation is approved and ready for human queue intake.",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `visa escalation fixture missing token: ${token}`);
  }

  assert.match(
    source,
    /<section[^>]*id="protected-step-boundary"[^>]*>[\s\S]*<button[^>]*id="approval-required-btn"[^>]*disabled[^>]*>[\s\S]*Send for human approval[\s\S]*<\/section>/,
    "protected step boundary should clearly contain the blocked handoff action",
  );

  assert.match(
    source,
    /<section[^>]*id="approved-confirmation"[^>]*data-state="approved"[^>]*>[\s\S]*<h3>Approved handoff confirmation<\/h3>/,
    "approved confirmation should be visible and explicit",
  );

  assert.ok(!source.includes("<script src="), "fixture should not depend on external scripts");
  assert.ok(!source.includes('action="'), "fixture should remain self-contained without form submission");
});
