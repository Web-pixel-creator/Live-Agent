import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("ai action desk landing page exposes the public visa workflow pitch", () => {
  const source = readFileSync(
    resolve(process.cwd(), "apps", "demo-frontend", "public", "ai-action-desk.html"),
    "utf8",
  );
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const packetSource = readFileSync(
    resolve(process.cwd(), "artifacts", "client-packet", "README.md"),
    "utf8",
  );

  const requiredTokens = [
    "<title>AI Action Desk for Visa and Relocation Teams</title>",
    "Move visa and relocation cases forward from intake to handoff.",
    "AI Action Desk helps your team qualify leads, book consultations, follow up on missing documents,",
    "prepare CRM updates, and escalate difficult cases to the right human owner",
    "Where teams lose time today",
    "One AI workspace for the full case lifecycle",
    "Why this is more useful than a chatbot alone",
    "Built to stay operator-safe",
    "Lead intake",
    "Booking",
    "Document follow-up",
    "CRM handoff",
    "Human escalation",
    'href="/#tab=live-negotiator"',
    "Open live demo",
    "Request a pilot",
    "Public product page for the current commercial wedge: visa and relocation workflow automation.",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `landing page missing token: ${token}`);
  }

  assert.ok(
    !source.includes("<script"),
    "landing page should remain a static marketing route without runtime script dependencies",
  );

  assert.ok(
    readmeSource.includes("docs/visa-landing-page-copy.md"),
    "README should index the landing page copy source",
  );

  assert.ok(
    packetSource.includes("Use this when you want ready-to-paste text for a product page"),
    "client packet should include the landing page copy material",
  );
});
