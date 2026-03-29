import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("verified case results keep next-step copy on the case path while summary review stays in result tools", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    '"live.caseWorkspace.intakeResultBody": "The intake result is verified. The next step is the missing-document follow-up for the client."',
    '"live.caseWorkspace.intakeResultStatus": "Visa intake verified"',
    '"live.caseWorkspace.followUpResultStatus": "Document follow-up verified"',
    '"live.caseWorkspace.followUpResultBody": "The follow-up result is verified. The next step is the consultation reminder."',
    '"live.caseWorkspace.reminderResultStatus": "Consultation reminder verified"',
    '"live.caseWorkspace.reminderResultBody": "The reminder is verified. The next step is the CRM update."',
    '"live.caseWorkspace.handoffResultStatus": "CRM update verified"',
    '"live.caseWorkspace.handoffResultBody": "The CRM update is verified. The next step is specialist handoff only if the case still needs escalation."',
    '"live.caseWorkspace.escalationResultStatus": "Specialist handoff verified"',
    '"live.caseWorkspace.escalationResultBody": "The specialist handoff is verified. The next step is continuing the case with the assigned human owner."',
    '"The intake result is verified. The next step is the missing-document follow-up for the client."',
    '"Visa intake verified"',
    '"Document follow-up verified"',
    '"The follow-up result is verified. The next step is the consultation reminder."',
    '"Consultation reminder verified"',
    '"The reminder is verified. The next step is the CRM update."',
    '"CRM update verified"',
    '"The CRM update is verified. The next step is specialist handoff only if the case still needs escalation."',
    '"Specialist handoff verified"',
    '"The specialist handoff is verified. The next step is continuing the case with the assigned human owner."',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing verified result next-step token: ${token}`);
  }

  for (const staleToken of [
    '"The intake result is verified. Move the case into follow-up or copy the operator summary."',
    '"Visa intake completed"',
    '"Waiting on missing documents"',
    '"Document follow-up completed"',
    '"Consultation reminder completed"',
    '"The reminder is verified. Move the case into CRM writeback or copy the reminder handoff note."',
    '"CRM handoff completed"',
    '"Case handed to a specialist"',
    '"The CRM update is verified. Copy the handoff summary or move to specialist review only if the case still needs escalation."',
    '"The specialist handoff is verified. Share the summary, then continue the case with the assigned human owner."',
  ]) {
    assert.ok(!appSource.includes(staleToken), `app.js should not keep mixed result next-step copy: ${staleToken}`);
  }

  assert.ok(
    readmeSource.includes("verified-result `Next step` now stays on the next case move or human continuation"),
    "README should explain that verified result next-step copy stays on the case path",
  );
  assert.ok(
    readmeSource.includes("verified intake state now reads as `Visa intake verified`"),
    "README should explain the intake result status alignment",
  );
  assert.ok(
    readmeSource.includes("verified document follow-up state now reads as `Document follow-up verified`"),
    "README should explain the follow-up result status alignment",
  );
  assert.ok(
    readmeSource.includes("verified reminder state now reads as `Consultation reminder verified`"),
    "README should explain the reminder result status alignment",
  );
  assert.ok(
    readmeSource.includes("verified CRM state now reads as `CRM update verified`"),
    "README should explain the CRM result status alignment",
  );
  assert.ok(
    readmeSource.includes("verified specialist handoff state now reads as `Specialist handoff verified`"),
    "README should explain the specialist handoff result status alignment",
  );
  assert.ok(
    operatorGuideSource.includes("verified-result `Next step` now stays on the next case move or human continuation"),
    "operator guide should explain that verified result next-step copy stays on the case path",
  );
  assert.ok(
    operatorGuideSource.includes("verified intake state now reads as `Visa intake verified`"),
    "operator guide should explain the intake result status alignment",
  );
  assert.ok(
    operatorGuideSource.includes("verified document follow-up state now reads as `Document follow-up verified`"),
    "operator guide should explain the follow-up result status alignment",
  );
  assert.ok(
    operatorGuideSource.includes("verified reminder state now reads as `Consultation reminder verified`"),
    "operator guide should explain the reminder result status alignment",
  );
  assert.ok(
    operatorGuideSource.includes("verified CRM state now reads as `CRM update verified`"),
    "operator guide should explain the CRM result status alignment",
  );
  assert.ok(
    operatorGuideSource.includes("verified specialist handoff state now reads as `Specialist handoff verified`"),
    "operator guide should explain the specialist handoff result status alignment",
  );
});
