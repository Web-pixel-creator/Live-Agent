## Summary

- What changed:
- Why:
- Main files touched:

## Demo Readiness Checklist

- [ ] (Optional but recommended) local gate `npm run verify:pr` passed.
- [ ] `PR Quality Gate` workflow passed for this PR.
- [ ] KPI policy gate passed (`demo:e2e:policy`).
- [ ] `artifacts/demo-e2e/summary.json` is available in workflow artifacts.
- [ ] `artifacts/demo-e2e/summary.md` is available in workflow artifacts.
- [ ] `artifacts/demo-e2e/policy-check.md` is available in workflow artifacts.
- [ ] `artifacts/demo-e2e/policy-check.json` is available in workflow artifacts.
- [ ] `artifacts/demo-e2e/badge.json` is available in workflow artifacts.
- [ ] Verified KPI expectations from report:
  - [ ] `negotiationConstraintsSatisfied=true`
  - [ ] `gatewayWsResponseStatus=completed`
  - [ ] `gatewayWsInvalidEnvelopeCode=GATEWAY_INVALID_ENVELOPE`
  - [ ] `approvalsInvalidIntentStatusCode=400`
  - [ ] `uiApprovalResumeRequestAttempts` in `1..2`
  - [ ] `scenario.ui.approval.approve_resume.elapsedMs <= 60000`

## Risk and Rollback

- Risk level (`low|medium|high`):
- Known limitations:
- Rollback approach:

## Evidence

- Workflow run URL:
- Full `Demo E2E` + perf gate on `main/master` will execute after merge.
- Notes for reviewers/judges:
