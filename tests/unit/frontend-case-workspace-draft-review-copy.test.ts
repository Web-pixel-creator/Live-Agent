import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace draft stages point next-step copy at the protected summary review", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    '"live.caseWorkspace.intakeDraftNext": "Open the protected intake summary"',
    '"live.caseWorkspace.followUpDraftNext": "Open the protected follow-up summary"',
    '"live.caseWorkspace.reminderDraftNext": "Open the protected reminder summary"',
    '"live.caseWorkspace.handoffDraftNext": "Open the protected CRM summary"',
    '"live.caseWorkspace.escalationDraftNext": "Open the protected handoff summary"',
    '"Open the protected intake summary from the main row to confirm the seeded submit and close the first case step."',
    '"Open the protected follow-up summary from the main row to confirm the safe outreach step and close the documents stage."',
    '"Open the protected reminder summary from the main row to confirm the reminder send and capture the final handoff."',
    '"Open the protected CRM summary from the main row to confirm the writeback and decide whether specialist review is still needed."',
    '"Open the protected handoff summary from the main row to confirm the human handoff and close the final case step."',
    "function getCaseWorkspaceDraftNextCopy(demoScenario, isRu)",
    'nextStepValue: getCaseWorkspaceDraftNextCopy("visa_intake_draft", isRu)?.value ?? "",',
    'nextStepBody: getCaseWorkspaceDraftNextCopy("visa_intake_draft", isRu)?.body ?? "",',
    'nextStepValue: getCaseWorkspaceDraftNextCopy("visa_follow_up_draft", isRu)?.value ?? "",',
    'nextStepBody: getCaseWorkspaceDraftNextCopy("visa_follow_up_draft", isRu)?.body ?? "",',
    'nextStepValue: getCaseWorkspaceDraftNextCopy("visa_reminder_draft", isRu)?.value ?? "",',
    'nextStepBody: getCaseWorkspaceDraftNextCopy("visa_reminder_draft", isRu)?.body ?? "",',
    'nextStepValue: getCaseWorkspaceDraftNextCopy("visa_handoff_draft", isRu)?.value ?? "",',
    'nextStepBody: getCaseWorkspaceDraftNextCopy("visa_handoff_draft", isRu)?.body ?? "",',
    'nextStepValue: getCaseWorkspaceDraftNextCopy("visa_escalation_draft", isRu)?.value ?? "",',
    'nextStepBody: getCaseWorkspaceDraftNextCopy("visa_escalation_draft", isRu)?.body ?? "",',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing draft review copy token: ${token}`);
  }

  for (const staleToken of [
    '"Confirm the protected submit"',
    '"Open the seeded intake browser, confirm the protected submit when ready, then open the intake summary."',
    '"Confirm the safe outreach step"',
    '"Review the prepared follow-up message, approve the safe outreach step, then open the completed summary."',
    '"Confirm the protected reminder send"',
    '"Approve the reminder send when ready, then open the reminder summary to capture the final handoff."',
    '"Confirm the protected CRM writeback"',
    '"Review the prepared CRM note and owner assignment, then approve the protected writeback step."',
    '"Confirm the protected human handoff"',
    '"Review the escalation reason, approve the protected human handoff, then open the escalation summary."',
  ]) {
    assert.ok(!appSource.includes(staleToken), `app.js should not keep stale draft review copy token: ${staleToken}`);
  }

  assert.ok(
    readmeSource.includes("draft-stage `Next step` now points at the protected summary review in the main row"),
    "README should explain that draft-stage next-step copy now points at the protected summary review",
  );
  assert.ok(
    operatorGuideSource.includes("draft-stage `Next step` now points at the protected summary review in the main row"),
    "operator guide should explain that draft-stage next-step copy now points at the protected summary review",
  );
});
