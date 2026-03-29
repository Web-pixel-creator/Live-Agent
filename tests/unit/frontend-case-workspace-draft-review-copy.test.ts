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

  assert.ok(
    readmeSource.includes("draft-stage `Next step` now points at the protected summary review in the main row"),
    "README should explain that draft-stage next-step copy now points at the protected summary review",
  );
  assert.ok(
    operatorGuideSource.includes("draft-stage `Next step` now points at the protected summary review in the main row"),
    "operator guide should explain that draft-stage next-step copy now points at the protected summary review",
  );
});
