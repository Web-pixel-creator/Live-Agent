import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("visa reminder demo fixture exposes stable anchors for the seeded reminder flow", () => {
  const fixturePath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "public",
    "ui-task-visa-reminder-demo.html",
  );
  const source = readFileSync(fixturePath, "utf8");

  const requiredTokens = [
    'id="consultation-card"',
    'data-testid="consultation-card"',
    "Anna Petrova",
    "VISA-2048",
    "Tomorrow 16:00",
    "Video call · Europe/Madrid",
    'id="prep-checklist"',
    'data-testid="prep-checklist"',
    'data-prep-status="ready"',
    "Passport originals",
    "Proof of address",
    "Intake questionnaire",
    'id="reminder-draft"',
    'data-testid="reminder-draft"',
    "Reminder owner",
    "Ana Ruiz",
    'id="protected-reminder-boundary"',
    'data-testid="protected-reminder-boundary"',
    'id="send-reminder-btn"',
    "Send reminder for approval",
    "Protected boundary: no reminder is sent to Anna before approval.",
    'id="approved-reminder-confirmation"',
    'data-testid="approved-reminder-confirmation"',
    'data-state="approved"',
    "Final verification complete. The consultation reminder is approved and ready for dispatch.",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `visa reminder fixture missing token: ${token}`);
  }

  assert.match(
    source,
    /<section[^>]*id="protected-reminder-boundary"[^>]*>[\s\S]*<button[^>]*id="send-reminder-btn"[^>]*disabled[^>]*>[\s\S]*Send reminder for approval[\s\S]*<\/section>/,
    "protected reminder boundary should clearly contain the blocked send action",
  );

  assert.match(
    source,
    /<section[^>]*id="approved-reminder-confirmation"[^>]*data-state="approved"[^>]*>[\s\S]*<h3>Approved reminder confirmation<\/h3>/,
    "approved reminder confirmation should be visible and explicit",
  );

  assert.ok(!source.includes("<script src="), "fixture should not depend on external scripts");
  assert.ok(!source.includes('action="'), "fixture should remain self-contained without form submission");
});
