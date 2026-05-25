# Bugfix Requirements Document

## Introduction

This is a follow-up to
`.kiro/specs/demo-e2e-browser-job-paused-race-condition/`.

The previous bugfix removed the deterministic 100+ second timeout in the
`ui.navigator.visa_vertical_flows` demo-e2e scenario by making the browser-job
polling predicate execution-mode-aware. On CI run `26368008011` at commit
`3aa4d877`, the same scenario no longer timed out. It failed quickly instead:

```text
[demo-e2e] Scenario ui.navigator.visa_vertical_flows: failed (7211 ms)
- Navigator visa proof must validate all configured flows.
```

The failure moved from the paused-state predicate to the validation summary.
`scripts/demo-e2e-navigator-visa-flows.ts`
`summarizeNavigatorVisaFlowResults()` still computes `validated === true` only
when every flow has real persistent-session and replay-bundle proof:

1. `persistentSessionCount === totalFlows`
2. `replayBundleCount === totalFlows`
3. `verifiedCount === totalFlows`
4. stale / healed ref recovery counts across all flows
5. resumed checkpoints across all flows

That contract is valid for the real-Playwright release proof. It is not
reachable on the simulated PR-quality lane, where the runtime can honestly
emit `executionMode === "simulated"` and complete the scenario without holding
a real persistent browser session or producing a real replay bundle.

This is an immigration Action Desk proof surface, not the current
local-services dispatcher wedge. It must be fixed as a separate,
execution-mode-aware validation contract. Do not let this follow-up pull the
local-services dashboard work off its critical path unless the PR merge is
technically blocked by a required check.

## Requirements

### R1. Current Defect

WHEN `ui.navigator.visa_vertical_flows` runs on the PR-quality Windows
simulation lane AND all configured flows reach their simulated terminal states
THEN `summarizeNavigatorVisaFlowResults()` can still return
`validated === false` because it applies real-Playwright persistent-session and
replay-bundle criteria to simulated results.

### R2. Execution Mode Must Be Explicit In The Summary Contract

WHEN the summary is built from `VisaFlowResult[]` THEN the validation contract
MUST distinguish at least:

1. `real_playwright` validation
2. `simulated` validation
3. mixed / unknown validation

The artifact must not collapse those modes into a single ambiguous
`validated` boolean without additional fields explaining what was actually
validated.

### R3. Real-Playwright Proof Must Not Be Weakened

WHEN all results are `executionMode === "real_playwright"` THEN the existing
strict production criteria MUST remain required:

1. every configured flow succeeds;
2. every flow has a persistent session ready and released;
3. every flow has a replay bundle;
4. every flow is verified;
5. stale / healed recovery and resumed checkpoint proof are present.

No real-Playwright assertion may be removed to make the PR-quality simulation
lane pass.

### R4. Simulated Proof Must Be Honest

WHEN all results are `executionMode === "simulated"` THEN the summary may
validate the simulated lane only if the artifact clearly says it was simulated
and the scenario proves the simulated contract that PR Quality actually owns:

1. all configured flows ran;
2. all configured flows succeeded under simulation;
3. every flow reached the expected paused / completed lifecycle;
4. every flow emitted the additive execution-mode fields;
5. no artifact claims real persistent-session or replay-bundle coverage.

### R5. Downstream Gates Must Keep Their Meaning

WHEN a strict release gate consumes the navigator visa-flows artifact THEN it
MUST be able to reject a simulation-only proof if the gate requires real
Playwright evidence.

WHEN PR Quality consumes the same artifact THEN it MAY accept a simulation-mode
proof if the workflow is explicitly configured as a simulation lane.

### R6. Local-Services Scope Must Stay Untouched

This follow-up MUST NOT modify:

1. `apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`
2. local-services workspace adapter / backend persistence
3. outreach execution pack
4. dispatcher dashboard routes or layout
5. local-services docs except for a short operational handoff note

The current commercial wedge remains `AI Dispatcher for local service
businesses in Tashkent`.

