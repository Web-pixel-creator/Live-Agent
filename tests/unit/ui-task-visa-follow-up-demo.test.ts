import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("visa follow-up demo fixture exposes stable anchors for the seeded UI task flow", () => {
  const fixturePath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "public",
    "ui-task-visa-follow-up-demo.html",
  );
  const source = readFileSync(fixturePath, "utf8");

  const requiredTokens = [
    'id="crm-client-row"',
    'data-testid="crm-client-row"',
    "Elena Morozova",
    "VISA-2048",
    "Post-intake follow-up",
    'id="missing-doc-checklist"',
    'data-testid="missing-doc-checklist"',
    'data-doc-status="received"',
    'data-doc-status="missing"',
    'data-doc-status="pending"',
    "Passport scan",
    "Proof of address",
    "Employment letter",
    'id="reminder-state"',
    'data-testid="reminder-state"',
    "Current reminder",
    "Scheduled",
    "Email + CRM note",
    'id="protected-step-boundary"',
    'data-testid="protected-step-boundary"',
    'id="approval-required-btn"',
    "Send follow-up for approval",
    "Protected boundary: no client-facing send occurs before approval.",
    'id="approved-confirmation"',
    'data-testid="approved-confirmation"',
    'data-state="approved"',
    "Final verification complete. The follow-up summary is approved and ready for dispatch.",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `visa follow-up fixture missing token: ${token}`);
  }

  assert.match(
    source,
    /<section[^>]*id="protected-step-boundary"[^>]*>[\s\S]*<button[^>]*id="approval-required-btn"[^>]*disabled[^>]*>[\s\S]*Send follow-up for approval[\s\S]*<\/section>/,
    "protected step boundary should clearly contain the blocked send action",
  );

  assert.match(
    source,
    /<section[^>]*id="approved-confirmation"[^>]*data-state="approved"[^>]*>[\s\S]*<h3>Approved path confirmation<\/h3>/,
    "approved confirmation should be visible and explicit",
  );

  assert.ok(!source.includes("<script src="), "fixture should not depend on external scripts");
  assert.ok(!source.includes('action="'), "fixture should remain self-contained without form submission");
});
