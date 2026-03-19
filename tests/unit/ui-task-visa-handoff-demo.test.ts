import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("visa CRM handoff demo fixture exposes stable anchors for the seeded handoff flow", () => {
  const fixturePath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "public",
    "ui-task-visa-handoff-demo.html",
  );
  const source = readFileSync(fixturePath, "utf8");

  const requiredTokens = [
    'id="crm-handoff-card"',
    'data-testid="crm-handoff-card"',
    "Anna Petrova",
    "VISA-2048",
    "Sofia Kim",
    "Reminder follow-through",
    'id="crm-note-draft"',
    'data-testid="crm-note-draft"',
    "Latest case note",
    "Checklist handoff",
    'id="operator-handoff-panel"',
    'data-testid="operator-handoff-panel"',
    "Assigned owner",
    "Tomorrow 10:00",
    'id="protected-crm-boundary"',
    'data-testid="protected-crm-boundary"',
    'id="commit-crm-update-btn"',
    "Commit CRM update for approval",
    "Protected boundary: the CRM writeback stays blocked before approval.",
    'id="approved-crm-confirmation"',
    'data-testid="approved-crm-confirmation"',
    'data-state="approved"',
    "Final verification complete. The CRM update handoff is approved and ready for the operator queue.",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `visa handoff fixture missing token: ${token}`);
  }

  assert.match(
    source,
    /<section[^>]*id="protected-crm-boundary"[^>]*>[\s\S]*<button[^>]*id="commit-crm-update-btn"[^>]*disabled[^>]*>[\s\S]*Commit CRM update for approval[\s\S]*<\/section>/,
    "protected CRM boundary should clearly contain the blocked writeback action",
  );

  assert.match(
    source,
    /<section[^>]*id="approved-crm-confirmation"[^>]*data-state="approved"[^>]*>[\s\S]*<h3>Approved CRM handoff confirmation<\/h3>/,
    "approved CRM confirmation should be visible and explicit",
  );

  assert.ok(!source.includes("<script src="), "fixture should not depend on external scripts");
  assert.ok(!source.includes('action="'), "fixture should remain self-contained without form submission");
});
