# Bugfix Requirements Document

## Introduction

The `ui.navigator.visa_vertical_flows` scenario in
`scripts/demo-e2e-navigator-visa-flows.ts` fails on the GitHub Actions
`windows-2025` runner image with a deterministic timeout that surfaces only
after PR #2's earlier two CI gates were unblocked (commits `1c07bf7e` for the
Windows 8.3 short-path mismatch and `a236833c` for the promptfoo red-team
gate). Observed on CI run `26363242464`:

```
[demo-e2e] Scenario ui.navigator.visa_vertical_flows: failed (101629 ms)
  after 2 attempts
- Error: Timed out waiting for browser job <jobId> to reach paused.
  Last status: paused
```

The error wording is misleading. The job DOES reach `paused`. The polling
helper `waitForBrowserJobState` in `scripts/demo-e2e-navigator-visa-flows.ts`
combines `statuses.includes(status)` with a `predicate` filter, and the
scenario passes a predicate that requires the job's `session.persistenceEnabled
=== true` AND `session.status` to be one of `"ready"` or `"active"`. On the CI
runner the ui-executor service falls into `simulateExecution()` because
Playwright is not available and `UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE=true`
(per `.github/workflows/pr-quality.yml`). `simulateExecution()` returns
`ExecuteResponse` WITHOUT a `session` field, so the browser-job session record
stays in its default `pending` / `persistenceEnabled=false` state forever, and
the predicate never matches. The poll loop runs for the configured timeout
(101 s on this scenario), the scenario fails, retries, fails the second
attempt, and the demo-e2e step fails the PR Quality gate.

This is unrelated to the dispatcher-flow-connect product slice and unrelated
to the Windows 8.3 short-path bugfix. It is an asymmetry between the
production (real Playwright) and simulated (CI-fallback) code paths inside
ui-executor, plus a polling assertion in the demo-e2e scenario that is too
strict for the simulated path.

The fix MUST be additive: it must not weaken what the scenario verifies on
production / real-Playwright runners, must not bypass the persistent-session
proof on production paths, and must keep the runtime evidence the existing
release tests expect (the `release evidence report` test in
`tests/unit/release-evidence-report.test.ts` keys off the
navigator-visa-flows artifact under
`artifacts/demo-e2e/navigator-visa-flows.json`). After the fix, the demo-e2e
PR Quality lane should pass on the `windows-2025` runner image without
removing or skipping the visa flows scenario.

Affected files (read-only inspection so far; will be modified by the fix):

- `apps/ui-executor/src/index.ts` — `simulateExecution()` does NOT emit a
  `session` field; real-Playwright execution path DOES (around lines
  1373-1389).
- `apps/ui-executor/src/browser-jobs.ts` — when a runner result lacks a
  session field, `applyBrowserJobSessionUpdate(latest.session, undefined)`
  leaves the session record in its initial default state
  (`persistenceEnabled: false, status: "pending"`); see lines 395-412 (the
  default factory) and line 853 (the merge call site).
- `scripts/demo-e2e-navigator-visa-flows.ts` — the polling predicate at
  approximately line 553 requires `session.persistenceEnabled === true` AND
  `session.status` ∈ {"ready", "active"}; the post-condition at line 567
  asserts the same thing.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the demo-e2e harness runs the `ui.navigator.visa_vertical_flows`
scenario AND the ui-executor service falls into `simulateExecution()` (CI
runner without Playwright AND `UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE=true`)
THEN the scenario times out in `waitForBrowserJobState` after the configured
timeout window even though the job's `status` field correctly reaches
`"paused"`, because the `predicate` argument also requires
`session.persistenceEnabled === true` AND `session.status` to be one of
`"ready"` or `"active"`, and `simulateExecution()` does NOT return a
`session` field, so the browser-job session record retains the default
`{persistenceEnabled: false, status: "pending"}` state from the factory in
`createInitialBrowserJobSessionRecord()`.

1.2 WHEN the demo-e2e harness runs the `ui.navigator.visa_vertical_flows`
scenario on the GitHub Actions `windows-2025` runner image with the
PR-quality env (`UI_EXECUTOR_STRICT_PLAYWRIGHT=false`,
`UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE=true`, no
`UI_EXECUTOR_PERSISTENT_BROWSER_SESSIONS` override) THEN the scenario
deterministically fails after two retries with the message `Timed out
waiting for browser job <jobId> to reach paused. Last status: paused`,
which is misleading because the status DOES match the target set; the
predicate is the gating condition.

### Expected Behavior (Correct)

2.1 WHEN the demo-e2e harness runs the `ui.navigator.visa_vertical_flows`
scenario AND the ui-executor service runs in real-Playwright mode (which
emits a `session` field with `persistenceEnabled` and `status` populated
from the real persistent session lifecycle) THEN the scenario SHALL
continue to pass with the same persistent-session proof it asserts today
(`session.mode === "resumable"`, `session.persistenceEnabled === true`,
`session.status` ∈ {"ready", "active"}).

2.2 WHEN the demo-e2e harness runs the `ui.navigator.visa_vertical_flows`
scenario AND the ui-executor service falls into `simulateExecution()`
(CI fallback or developer machines without Playwright) THEN the scenario
SHALL pass with a clearly-marked simulation-mode session proof that
distinguishes a real persistent session from a simulated one in the
artifact and runtime evidence, without the polling helper timing out on
state that is unreachable in simulation.

2.3 WHEN the polling helper `waitForBrowserJobState` cannot reach a target
state within its timeout AND the failure is caused by a predicate that the
runtime cannot satisfy (rather than by `status` not matching) THEN the
error message SHALL surface the predicate-failure context (which fields
the predicate observed and what they were vs. what it required), so the
operator does not chase a phantom `Last status: paused` race.

### Unchanged Behavior (Regression Prevention)

The fix must not weaken what the scenario verifies on production paths.
It must continue to assert the persistent-session proof when real
Playwright executes, must keep the navigator-visa-flows artifact at
`artifacts/demo-e2e/navigator-visa-flows.json` honest about whether the
session was real or simulated, must not skip the visa flows scenario on
Windows runners, and must keep the release-evidence-report tests passing
on Linux and Windows.

3.1 WHEN the ui-executor service runs in real-Playwright mode THEN the
scenario SHALL CONTINUE TO require and validate `session.persistenceEnabled
=== true` and `session.status` ∈ {"ready", "active"} on the paused state,
and `session.persistenceEnabled === true` plus released/closed status on
the completed state, so the production persistent-session proof is not
weakened.

3.2 WHEN the navigator-visa-flows artifact is written to
`artifacts/demo-e2e/navigator-visa-flows.json` after the fix THEN it
SHALL CONTINUE TO carry the existing schema (per
`scripts/demo-e2e-navigator-visa-flows.ts` `VisaFlowResult` shape) and
SHALL CARRY a clear `executionMode` discriminator (e.g. `"real_playwright"`
vs `"simulated"`) so downstream consumers (release-evidence-report,
release-readiness gates, judge artifacts) can distinguish the two paths
without schema drift on real-Playwright runs.

3.3 WHEN any test in `tests/unit/release-evidence-report.test.ts` or
`tests/unit/demo-e2e-navigator-visa-flows.test.ts` runs (on Linux or
Windows, before or after the fix) THEN it SHALL CONTINUE TO pass with all
existing assertions intact; the fix may extend the assertion set to cover
the new `executionMode` discriminator but must not weaken any existing
assertion.

3.4 WHEN the demo-e2e workflow runs `ui.navigator.visa_vertical_flows` on
the `windows-2025` runner image (real-Playwright unavailable, simulation
fallback used, no `UI_EXECUTOR_PERSISTENT_BROWSER_SESSIONS` override) THEN
the scenario SHALL pass within its retry budget (currently 2 attempts) and
SHALL emit a navigator-visa-flows artifact whose `executionMode` is
`"simulated"` so release-readiness and judge artifacts know the run did
not exercise a real persistent session.

3.5 WHEN the production release path runs (real-Playwright environment,
e.g. via `release-strict-final.yml`) THEN the scenario SHALL pass with
`executionMode === "real_playwright"` and the existing persistent-session
proof intact, so the production demo-e2e run is unchanged.

3.6 WHEN the polling helper `waitForBrowserJobState` times out THEN its
error message SHALL include both the last observed `status` AND a
single-line summary of the predicate observation (e.g. `predicate
observed session.persistenceEnabled=false, session.status=pending; required
persistenceEnabled=true, status∈{ready, active}`), so future debugging
does not require reading source to know why the loop failed.
