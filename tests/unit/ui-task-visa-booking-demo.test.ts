import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("visa booking demo fixture exposes stable anchors for the seeded booking flow", () => {
  const fixturePath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "public",
    "ui-task-visa-booking-demo.html",
  );
  const source = readFileSync(fixturePath, "utf8");

  const requiredTokens = [
    'id="booking-card"',
    'data-testid="booking-card"',
    "Anna Petrova",
    "VISA-2048",
    "Initial consultation",
    "Europe/Madrid",
    'id="slot-options"',
    'data-testid="slot-options"',
    'data-slot-status="ready"',
    "Tomorrow 15:30",
    "Tomorrow 17:00",
    "45 minute video consult",
    'id="booking-draft"',
    'data-testid="booking-draft"',
    "Booking owner",
    "Ana Ruiz",
    'id="protected-booking-boundary"',
    'data-testid="protected-booking-boundary"',
    'id="confirm-booking-btn"',
    "Confirm booking for approval",
    "Protected boundary: no calendar slot is confirmed or written back before approval.",
    'id="approved-booking-confirmation"',
    'data-testid="approved-booking-confirmation"',
    'data-state="approved"',
    "Final verification complete. The consultation booking is approved and ready for calendar writeback.",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `visa booking fixture missing token: ${token}`);
  }

  assert.match(
    source,
    /<section[^>]*id="protected-booking-boundary"[^>]*>[\s\S]*<button[^>]*id="confirm-booking-btn"[^>]*disabled[^>]*>[\s\S]*Confirm booking for approval[\s\S]*<\/section>/,
    "protected booking boundary should clearly contain the blocked confirmation action",
  );

  assert.match(
    source,
    /<section[^>]*id="approved-booking-confirmation"[^>]*data-state="approved"[^>]*>[\s\S]*<h3>Approved booking confirmation<\/h3>/,
    "approved booking confirmation should be visible and explicit",
  );

  assert.ok(!source.includes("<script src="), "fixture should not depend on external scripts");
  assert.ok(!source.includes('action="'), "fixture should remain self-contained without form submission");
});
