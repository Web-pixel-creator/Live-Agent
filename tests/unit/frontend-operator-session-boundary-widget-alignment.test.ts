import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function assertStructuredReplayRefreshContract(source) {
  assert.match(source, /approval gate|boundary owner|recovery path|recovery drill/i);
  assert.match(source, /primary step|step progress|checklist|next action target|next operator workspace/i);
  assert.match(source, /structured refresh state|refreshState|refresh state/i);
  assert.match(source, /followuptree|followup tree|followupPath|followup path/i);
  assert.match(source, /compatibility metadata|compatibility block/i);
  assert.ok(
    source.includes("legacy projection") ||
      source.includes("flat `refreshEscalation...` fields") ||
      source.includes("flat `refreshEscalation...` projection"),
    "docs missing transitional flat refreshEscalation legacy projection note",
  );
}
test("operator console exposes compact session boundary widget", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const architecturePath = resolve(process.cwd(), "docs", "architecture.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");
  const architectureSource = readFileSync(architecturePath, "utf8");

  const requiredHtmlTokens = [
    "<h3>Session Boundary</h3>",
    'id="operatorSessionBoundaryStatus"',
    'id="operatorSessionBoundarySession"',
    'id="operatorSessionBoundarySummary"',
    'id="operatorSessionBoundaryOwner"',
    'id="operatorSessionBoundaryApprovalGate"',
    'id="operatorSessionBoundaryNextAction"',
      'id="operatorSessionBoundaryPrimaryStep"',
      'id="operatorSessionBoundaryAfterRefresh"',
      'id="operatorSessionBoundaryAfterRefreshPath"',
      'id="operatorSessionBoundaryStepProgress"',
      'id="operatorSessionBoundaryChecklist"',
    'id="operatorSessionBoundaryLatestProof"',
    'id="operatorSessionBoundaryRecovery"',
    'id="operatorSessionBoundaryHandoff"',
    'id="operatorSessionBoundaryOpenBtn"',
    'id="operatorSessionBoundaryHint"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing session boundary token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorSessionBoundaryOpenBtn: document.getElementById("operatorSessionBoundaryOpenBtn")',
    'operatorSessionBoundaryStatus: document.getElementById("operatorSessionBoundaryStatus")',
    'operatorSessionBoundarySession: document.getElementById("operatorSessionBoundarySession")',
    'operatorSessionBoundarySummary: document.getElementById("operatorSessionBoundarySummary")',
    'operatorSessionBoundaryOwner: document.getElementById("operatorSessionBoundaryOwner")',
    'operatorSessionBoundaryApprovalGate: document.getElementById("operatorSessionBoundaryApprovalGate")',
    'operatorSessionBoundaryNextAction: document.getElementById("operatorSessionBoundaryNextAction")',
    'operatorSessionBoundaryPrimaryStep: document.getElementById("operatorSessionBoundaryPrimaryStep")',
    'operatorSessionBoundaryAfterRefresh: document.getElementById("operatorSessionBoundaryAfterRefresh")',
    'operatorSessionBoundaryAfterRefreshPath: document.getElementById("operatorSessionBoundaryAfterRefreshPath")',
    'operatorSessionBoundaryStepProgress: document.getElementById("operatorSessionBoundaryStepProgress")',
    'operatorSessionBoundaryChecklist: document.getElementById("operatorSessionBoundaryChecklist")',
    'operatorSessionBoundaryLatestProof: document.getElementById("operatorSessionBoundaryLatestProof")',
    'operatorSessionBoundaryRecovery: document.getElementById("operatorSessionBoundaryRecovery")',
    'operatorSessionBoundaryHandoff: document.getElementById("operatorSessionBoundaryHandoff")',
    'operatorSessionBoundaryHint: document.getElementById("operatorSessionBoundaryHint")',
    "setOperatorSessionBoundaryHint",
    "resetOperatorSessionBoundaryWidget",
    "renderOperatorSessionBoundaryWidget",
    "openOperatorSessionBoundaryTarget",
    "buildOperatorReplayRefreshRecoveryFollowupSummary",
    "stringifyOperatorReplayRefreshRecoveryFollowupSummary",
    "buildOperatorReplayPrimaryStepRefreshView",
    "OPERATOR_REPLAY_REFRESH_LEGACY_TEXT_FIELDS",
    "OPERATOR_REPLAY_REFRESH_LEGACY_TARGET_FIELDS",
    "OPERATOR_REPLAY_REFRESH_LEGACY_CTA_FIELDS",
    "function normalizeOperatorReplayLegacyTarget(value, includeMode = false)",
    "function normalizeOperatorReplayLegacyCTA(value)",
    "function normalizeOperatorReplayPrimaryStepRefreshLegacyProjection(value)",
    "function normalizeOperatorReplayRefreshRecoveryFollowupTree(value)",
    "function normalizeOperatorReplayPrimaryStepRefreshState(value)",
    "renderOperatorSessionBoundaryRefreshRecoveryFollowupPath",
    "refreshState",
    "refreshStateSource",
    "refreshStateCompatibility",
    "firstStepRefreshCompatibility=",
    "primaryReadModel",
    "legacyProjection",
    "followupTree",
    "flat_refresh_escalation_fields",
    "refreshRecoveryFollowupPath",
    "primaryStepRefreshView.afterRefreshDetail",
    "primaryStepRefreshView.refreshDisposition",
    "firstStepRefreshFollowupCount=",
    "firstStepRefreshFollowupHead=",
    "firstStepRefreshLegacyFallback=",
    "afterRefreshDetail",
    "refresh_session_replay",
    "await refreshOperatorSessionReplay({",
    'toOptionalText(primaryStepRefreshAction?.ctaLabel) ??',
    'toOptionalText(nextOperatorPrimaryStep?.ctaLabel) ??',
    "renderOperatorSessionBoundaryWidget(state.operatorSessionReplaySnapshot);",
    "openOperatorSessionBoundaryTarget();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing session boundary token: ${token}`);
  }

  assert.ok(readmeSource.includes("`Session Boundary`"), "README missing Session Boundary card note");
  assert.match(readmeSource, /refresh recovery follow-?up path/i);
  assert.match(readmeSource, /structured refresh state/i);
  assert.match(readmeSource, /followuptree|followup tree/i);
  assert.match(readmeSource, /compatibility block|compatibility metadata/i);
  assert.match(readmeSource, /flat `refreshEscalation\.\.\.` fields remain a transitional legacy projection/i);
  assertStructuredReplayRefreshContract(readmeSource);
  assert.ok(operatorGuideSource.includes("`Session Boundary`"), "operator guide missing Session Boundary card note");
  assert.match(operatorGuideSource, /refresh recovery follow-?up path/i);
  assert.match(operatorGuideSource, /structured refresh state/i);
  assert.match(operatorGuideSource, /followuptree|followup tree/i);
  assert.match(operatorGuideSource, /compatibility block|compatibility metadata/i);
  assert.match(operatorGuideSource, /flat `refreshEscalation\.\.\.` fields remain a transitional legacy projection/i);
  assertStructuredReplayRefreshContract(operatorGuideSource);
  assert.match(architectureSource, /refresh recovery follow-?up path/i);
  assert.match(architectureSource, /structured refresh state/i);
  assert.match(architectureSource, /followuptree|followup tree/i);
  assert.match(architectureSource, /compatibility block|compatibility metadata/i);
  assert.match(architectureSource, /flat `refreshEscalation\.\.\.` projection remains transitional/i);
  assertStructuredReplayRefreshContract(architectureSource);
});
