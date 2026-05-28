# demo-e2e-browser-job-paused-race-condition Bugfix Design

## Overview

The `ui.navigator.visa_vertical_flows` scenario in
`scripts/demo-e2e-navigator-visa-flows.ts` deterministically times out on the
GitHub Actions `windows-2025` runner image because the polling helper
`waitForBrowserJobState` combines a `status` check with a `predicate` that
the simulation code path inside `apps/ui-executor/src/index.ts`
(`simulateExecution()`) cannot satisfy. Real-Playwright execution emits a
populated `session` field with `persistenceEnabled`, `status`, and other
lifecycle markers; simulation execution does not emit a `session` field at
all, so the browser-job session record retains its initial default state
(`persistenceEnabled: false`, `status: "pending"`) for the entire job
lifetime, and the predicate fails forever.

The fix has two cooperating layers, both in production code, both small:

1. **`apps/ui-executor/src/index.ts`** — make `simulateExecution()` emit a
   well-formed `session` field that mirrors the real-Playwright shape but
   self-identifies as simulated, so the browser-job session record reaches
   a deterministic terminal state in simulation.
2. **`scripts/demo-e2e-navigator-visa-flows.ts`** — extend the
   `VisaFlowResult` and persisted artifact shapes with an `executionMode`
   discriminator (`"real_playwright"` vs `"simulated"`), and gate the
   strict persistent-session proof on `executionMode === "real_playwright"`
   while keeping a softer simulation-mode proof for the CI fallback path.
   Also extend `waitForBrowserJobState`'s error message to surface the
   predicate observation when it times out.

This design respects three project-wide constraints: it touches production
code only where the runtime asymmetry actually lives (no test-only band-aid
that masks the real cause), it does NOT weaken any existing real-Playwright
assertion, and it keeps the two CI lanes (PR-quality fast path on
windows-2025, release-strict-final lane on real Playwright) symmetric.

## Glossary

- **Bug_Condition (C)**: The polling helper `waitForBrowserJobState`
  enters a state where `lastResponse.data.job.status` matches one of the
  target `statuses` (specifically `"paused"`) but the `predicate` returns
  `false` indefinitely because `simulateExecution()` does not emit a
  `session` field, leaving the browser-job session record at
  `{persistenceEnabled: false, status: "pending"}` while the predicate
  requires `persistenceEnabled === true` and `status ∈ {"ready", "active"}`.
- **Property 1 (Bug Condition fix)**: After the fix, the visa flows
  scenario completes within its timeout on a Windows runner using the
  PR-quality env (no Playwright, simulation fallback enabled), with a
  deterministic outcome.
- **Property 2 (Preservation)**: After the fix, on real-Playwright paths
  (and on Linux paths that do not exercise the simulation fallback), every
  existing assertion in
  `tests/unit/release-evidence-report.test.ts`,
  `tests/unit/demo-e2e-navigator-visa-flows.test.ts`,
  `scripts/demo-e2e-navigator-visa-flows.ts` continues to pass exactly as
  today, and the navigator-visa-flows artifact schema remains
  backwards-compatible (no required field is removed; the new
  `executionMode` field is additive).
- **`executionMode`**: A new discriminator field on the navigator-visa-flows
  result and artifact. Values: `"real_playwright"` when the ui-executor
  ran a real Playwright browser; `"simulated"` when it fell back to
  `simulateExecution()`. Inferred from the `executor` and `adapterMode`
  fields plus the presence of a populated `session.persistenceEnabled` on
  the response.
- **Simulation-mode session proof**: A weaker but still meaningful
  assertion set used when `executionMode === "simulated"`: the job reaches
  `paused` and `completed` in the correct order, a checkpoint is recorded,
  and the run yields the same `VisaFlowResult` schema, but the persistent
  session lifecycle markers are reported as simulated and the strict
  predicate is not enforced.

## Bug Details

### Bug Condition

The bug manifests when the visa flows scenario polls the browser-job state
through `waitForBrowserJobState(uiExecutorBaseUrl, jobId, ["paused"],
timeoutMs, predicate)` and the runtime answers `status === "paused"` but the
`predicate` cannot be satisfied. The predicate currently is:

```ts
(response) => {
  const session = response.data?.job?.session;
  return (
    session?.mode === "resumable" &&
    session?.persistenceEnabled === true &&
    (session?.status === "ready" || session?.status === "active")
  );
}
```

In simulation mode `simulateExecution()` returns `ExecuteResponse` without a
`session` field, so the browser-job session record stays at the default
factory shape from
`createInitialBrowserJobSessionRecord()`:

```ts
{
  mode: persistenceRequested ? "resumable" : "ephemeral",
  key: persistenceRequested ? "browser-session-<jobId>" : null,
  persistenceRequested,
  persistenceEnabled: false,                       // <- never flips to true
  status: persistenceRequested ? "pending" : "ephemeral",  // <- never flips to "ready"
  ...
}
```

So `predicate` returns false forever; the loop polls until `Date.now() >=
deadline` and throws `Timed out waiting for browser job <jobId> to reach
paused. Last status: paused`.

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type {
    jobStatus: string,                 // observed via /browser-jobs/<id>
    sessionMode: string | null,
    sessionPersistenceEnabled: boolean | null,
    sessionStatus: string | null,
    targetStatuses: string[],          // e.g. ["paused"]
    predicateRequiresSession: boolean  // true on visa flows scenario
  }
  OUTPUT: boolean

  RETURN
    targetStatuses.includes(jobStatus)
    AND predicateRequiresSession == true
    AND (
      sessionMode != "resumable"
      OR sessionPersistenceEnabled != true
      OR sessionStatus NOT IN {"ready", "active"}
    )
END FUNCTION
```

### Examples

- `jobStatus = "paused"`, `sessionMode = "resumable"`,
  `sessionPersistenceEnabled = false`, `sessionStatus = "pending"` (the
  current CI failure shape from simulateExecution path) — predicate fails
  forever, polling times out. **Bug.**
- `jobStatus = "paused"`, `sessionMode = "resumable"`,
  `sessionPersistenceEnabled = true`, `sessionStatus = "ready"` (real
  Playwright, persistent sessions enabled) — predicate matches, polling
  returns. **Not bug.**
- `jobStatus = "running"`, anything else — predicate not even consulted
  yet because `targetStatuses.includes("running")` is false.
  **Not bug.** (regular polling progress)
- `jobStatus = "paused"`, predicate returns true on first poll — polling
  returns immediately. **Not bug.**

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- All real-Playwright assertions in
  `scripts/demo-e2e-navigator-visa-flows.ts` continue to fire and pass
  exactly as today.
- All existing assertions in
  `tests/unit/release-evidence-report.test.ts` and
  `tests/unit/demo-e2e-navigator-visa-flows.test.ts` continue to pass.
- The navigator-visa-flows artifact schema is additive only; no required
  field is removed or renamed.
- `release-strict-final.yml` and `railway-deploy-api.yml` continue to run
  the visa flows scenario in real-Playwright mode and emit
  `executionMode === "real_playwright"`.
- Linux paths that already passed today continue to pass.

**Scope:**

All inputs that do NOT trigger the bug condition pass through unaffected:

- Real-Playwright runs on any host.
- Linux dev runs that already exercise the simulation fallback (no current
  failure observed) — they will start emitting `executionMode === "simulated"`
  but the existing assertion set still applies because the simulated session
  proof is honored.
- Polls with `targetStatuses` other than `["paused"]` (e.g. `["completed"]`)
  — same predicate gating applies but with the simulation-mode session proof
  the predicate now matches.

## Hypothesized Root Cause

Two cooperating defects:

1. **`simulateExecution()` in `apps/ui-executor/src/index.ts` does not emit
   a `session` field.** The real-Playwright execution path constructs and
   returns a fully-populated `session` field at lines 1373-1389;
   `simulateExecution()` (lines 625-657) returns `ExecuteResponse` with
   `session` omitted, so `applyBrowserJobSessionUpdate(latest.session,
   undefined)` is a no-op and the session record stays at the factory
   default forever.

2. **The visa flows scenario's predicate is too strict for the simulation
   fallback.** The predicate requires runtime markers
   (`persistenceEnabled === true`, `status ∈ {"ready", "active"}`) that
   only the real Playwright path can produce. When real Playwright is
   unavailable, the predicate is unsatisfiable.

The fix addresses both halves: (1) make simulation emit a deterministic
session shape so the runtime is not silently ill-formed, and (2) gate the
strict predicate on a clear `executionMode === "real_playwright"` signal
and use a softer simulation-mode predicate otherwise.

A single-defect fix (e.g. only patching `simulateExecution()` to emit
fake-but-passing session markers) would be wrong for two reasons: it
would let the artifact lie about whether a real persistent session was
exercised, and it would weaken the production proof. A single-defect fix
to only the scenario predicate (e.g. dropping the persistent-session
assertion) would be wrong for the same reason. The two-layer fix keeps
production proof intact and makes the simulation honest.

## Correctness Properties

### Property 1: Bug Condition - Visa Flows Scenario Completes On Simulation Fallback

_For any_ run of `ui.navigator.visa_vertical_flows` on a host where
`simulateExecution()` is exercised (no Playwright available,
`UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE=true`), the scenario SHALL complete
within its retry budget without `waitForBrowserJobState` timing out on
the `paused` state, AND the resulting `VisaFlowResult` SHALL carry
`executionMode === "simulated"`, AND the artifact at
`artifacts/demo-e2e/navigator-visa-flows.json` SHALL truthfully report
`executionMode === "simulated"` for that lane.

**Validates: Requirements 1.1, 1.2, 2.2, 3.4, 3.6**

### Property 2: Preservation - Real-Playwright Proof And Schema Compatibility Are Unchanged

_For any_ run of `ui.navigator.visa_vertical_flows` on a host where the
real-Playwright path is exercised, every existing assertion (the
persistent-session proof, the checkpoint count, the resume lifecycle, the
artifact schema fields, the release-evidence-report consumer assertions)
SHALL continue to fire and pass exactly as today, AND the
`executionMode` field SHALL be `"real_playwright"` so downstream
consumers can distinguish the two paths.

**Validates: Requirements 2.1, 3.1, 3.2, 3.3, 3.5**

## Fix Implementation

### Changes Required

**File 1**: `apps/ui-executor/src/index.ts`

Make `simulateExecution()` return a fully-formed `session` field that
mirrors the real-Playwright shape and self-identifies as simulated:

```ts
session: {
  mode: persistenceRequested ? "resumable" : "ephemeral",
  key: persistenceEnabled ? requestedSessionKey : null,
  persistenceRequested,
  persistenceEnabled,
  status: !persistenceEnabled
    ? "ephemeral"
    : !persistAfterRun || finalStatus === "failed"
      ? finalStatus === "failed" ? "closed" : "released"
      : "ready",
  reuseCount: 0,
  lastPageUrl: null,
  notes: ["Simulated browser session: no real persistent session was held."],
}
```

The `persistenceRequested` / `persistenceEnabled` / `persistAfterRun`
locals are computed identically to the real-Playwright path
(`request.session?.mode === "resumable"` && a valid key, gated by
`config.persistentBrowserSessions`); the difference is purely that no
real Playwright browser is involved. The `notes` field carries an
explicit simulation marker.

This single change unblocks the bug condition: the session record
transitions to a coherent terminal state, and the predicate's session
checks become satisfiable in simulation mode.

**File 2**: `scripts/demo-e2e-navigator-visa-flows.ts`

1. Add `executionMode: "real_playwright" | "simulated"` to the
   `VisaFlowResult` shape and to the persisted artifact shape. Infer it
   from the runner response: real-Playwright when the response includes
   `notes` like `"Persistent browser session reused"` / `"Persistent
   browser session created"` or when `adapterMode === "remote_http"` and
   `executor === "ui-executor-service"` AND the simulation marker is
   absent; otherwise simulated.
   - Concrete inference: `executionMode = jobAdapterNotes.some(note =>
     /Forced simulation|Playwright unavailable in ui-executor|Simulated
     browser session/i.test(note)) ? "simulated" : "real_playwright"`.

2. Split the paused-state assertion into two paths gated by
   `executionMode`:
   - Real-Playwright: keep the existing strict predicate
     (`persistenceEnabled === true`, `status ∈ {"ready", "active"}`)
     and the existing post-condition asserts.
   - Simulated: use a softer predicate that requires the job's `status`
     to reach `"paused"` and the session record to be coherent
     (`mode === "resumable"`, `persistenceRequested === true`), but
     does NOT require `persistenceEnabled === true` because that lane
     does not exercise a real persistent session. The post-condition
     asserts that `executionMode === "simulated"` and the
     simulation-mode markers are present.

3. Extend `waitForBrowserJobState`'s timeout error message to include a
   single-line summary of the last observed predicate observation: which
   fields the predicate read and what they were. The summary is
   produced via a new optional `describeLastObservation?: (response) =>
   string` parameter so each caller can provide its own observation
   shape; the visa flows scenario passes a function that emits e.g.
   `predicate observed mode=resumable, persistenceEnabled=false,
   status=pending; required persistenceEnabled=true,
   status∈{ready, active}`.

The production script `apps/ui-executor/src/index.ts` IS modified (this is
where the runtime asymmetry lives); the production script
`scripts/release-evidence-report.ps1` is NOT modified.

## Components and Interfaces

- `apps/ui-executor/src/index.ts` — `simulateExecution()` gains a populated
  `session` field. Same locals as the real path; same shape; new explicit
  simulation note.
- `scripts/demo-e2e-navigator-visa-flows.ts` — `VisaFlowResult` gains
  `executionMode`. `waitForBrowserJobState` gains an optional
  `describeLastObservation` argument used in error messages. The visa
  flows runner gains an `inferExecutionMode(adapterNotes: string[])`
  helper. The paused-state poll splits into two predicate paths based on
  `executionMode` (the inference must be done before the poll, by
  examining the orchestrator response or by issuing a probe poll for
  `running`/`paused`/`completed`; see Testing Strategy for detail).
- `tests/unit/demo-e2e-navigator-visa-flows.test.ts` — extended with new
  cases for the `executionMode` discriminator and the simulation-mode
  preservation property; existing cases are not weakened.
- New `test()` block: exploratory PBT for the bug condition (Property 1).

## Testing Strategy

### Validation Approach

Two phases. First, surface a deterministic counterexample of the
unfixed `waitForBrowserJobState` behavior on a synthetic in-process
double of the ui-executor runtime (no real Playwright, no real network,
just the contract). Second, prove the fixed strategy passes for both
real-Playwright-shaped and simulation-shaped runner outputs.

### Exploratory Bug Condition Checking

**Goal**: Reproduce the bug deterministically without depending on a real
GitHub Actions runner image, and confirm the root cause is the missing
`session` field in `simulateExecution()` plus the strict predicate.

**Test Plan**: A new exploratory PBT block in
`tests/unit/demo-e2e-navigator-visa-flows.test.ts`. It exercises the
poll/predicate flow against a synthetic browser-job state machine:

1. Hand-roll a `FakeBrowserJobsApi` that serves
   `/browser-jobs/<jobId>` responses driven by a small generator producing
   N (e.g. 8) `(jobStatus, sessionShape)` pairs sampled from the failure
   domain. Each pair keeps `jobStatus = "paused"` and varies
   `sessionShape` over `{persistenceEnabled: false, status: "pending"}`,
   `{persistenceEnabled: false, status: "ephemeral"}`, missing `session`
   field, etc.
2. Drive `waitForBrowserJobState` (extracted as a callable export or
   wrapped in a small test harness) against the FakeBrowserJobsApi using
   the strict predicate, with a small timeout (e.g. 750 ms) so the test
   completes quickly.
3. Show that the OLD strategy times out on every sample — capture the
   error message and confirm it says `Last status: paused`. This is the
   counterexample: status matches, predicate fails forever.
4. Show that the NEW strategy (predicate gated on `executionMode`)
   accepts every same sample once we mark the run as `executionMode ===
   "simulated"`.

**Expected Counterexamples (on UNFIXED code)**:

- `jobStatus="paused"`, no `session` field on the response → strict
  predicate fails forever → poll times out with `Last status: paused`.
  Root cause confirmed.
- `jobStatus="paused"`, `session.persistenceEnabled=false`,
  `session.status="pending"` → same outcome.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the
fixed assertion strategy succeeds.

**Pseudocode:**

```
FOR ALL (jobStatus, sessionShape, executionMode) WHERE
  isBugCondition({
    jobStatus,
    sessionMode: sessionShape.mode,
    sessionPersistenceEnabled: sessionShape.persistenceEnabled,
    sessionStatus: sessionShape.status,
    targetStatuses: ["paused"],
    predicateRequiresSession: true
  })
  AND executionMode == "simulated"
DO
  ASSERT pollWithExecutionModeAwarePredicate(...) returns within timeout
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT
hold (real-Playwright shape, ephemeral sessions, completed status), the
fixed strategy produces the same outcome as the original strategy.

**Pseudocode:**

```
FOR ALL (jobStatus, sessionShape) WHERE NOT isBugCondition(...) OR
                                           executionMode == "real_playwright"
DO
  oldOutcome := outcomeOf(strictPredicate(jobStatus, sessionShape))
  newOutcome := outcomeOf(executionModeAwarePredicate(jobStatus, sessionShape, executionMode))
  ASSERT oldOutcome.kind == newOutcome.kind
END FOR
```

**Testing Approach**: Property-based testing because the input domain is
broad (multiple job statuses, multiple session shapes, two execution
modes, predicate may or may not require session). PBT samples this
domain and catches edge cases that hand-written unit tests would miss.

**Test Cases**:

1. **Real-Playwright Preservation**: For runs where
   `executionMode === "real_playwright"` and `session.persistenceEnabled
   === true` and `session.status ∈ {"ready", "active"}`, the predicate
   matches on first poll (same as today).
2. **Simulated Mode Property 1**: For runs where `executionMode ===
   "simulated"` and `jobStatus === "paused"`, the predicate matches on
   first poll (the fixed `simulateExecution()` returns a coherent
   session shape, and the simulation-mode predicate accepts it).
3. **Status-Mismatch Preservation**: For runs where `jobStatus ===
   "running"`, the predicate stays false on either path (still polling).
4. **Schema Compatibility**: For real-Playwright runs, the
   navigator-visa-flows artifact retains every field it has today and
   gains `executionMode === "real_playwright"`. The
   `release-evidence-report` test's existing assertions on the artifact
   continue to pass.
5. **Error Message Improvement**: For runs that DO genuinely time out
   (e.g. real-Playwright run where session never reaches ready), the
   error message includes the predicate observation summary, so future
   debugging is faster.

### Unit Tests

- Existing tests in `tests/unit/demo-e2e-navigator-visa-flows.test.ts`
  keep their full assertion bodies; new tests are added for the
  `executionMode` discriminator and the simulation-mode predicate path.
- New unit tests in `tests/unit/ui-executor-browser-jobs.test.ts` (or a
  new file `tests/unit/ui-executor-simulate-session-shape.test.ts` if
  the existing file is too crowded) for the simulation session shape:
  `simulateExecution()` returns a session field whose
  `persistenceEnabled` reflects the requested persistence + config flag,
  whose `status` matches the simulated lifecycle, and whose `notes`
  include the simulation marker.

### Property-Based Tests

- Exploratory PBT (Property 1, Windows simulation fallback) — described
  above.
- Preservation PBT (Property 2, real-Playwright shape) — small fast-check-
  driven property that for randomly generated session shapes the
  execution-mode-aware predicate produces the same outcome as the strict
  predicate when `executionMode === "real_playwright"`.

### Integration Tests

- Re-run `npm run test:unit` locally to confirm no regression on the
  whole suite.
- Re-run `npm run build` to confirm strict TS still compiles.
- Push to PR #2's branch and confirm the demo-e2e visa flows scenario
  passes on the `windows-2025` runner image (the integration check that
  PR Quality Gate will exercise).
- Real-Playwright path is exercised by `release-strict-final.yml` which
  runs on a separate path; confirm via local probe (or via the workflow
  on a follow-up release-strict run) that real-Playwright still emits
  `executionMode === "real_playwright"` and the strict predicate still
  matches.

## Out of Scope

- No changes to `scripts/release-evidence-report.ps1`.
- No changes to release KPI gates or to release-strict-final.yml.
- No changes to the `Wait-ForBrowserJobState` helper in
  `scripts/demo-e2e.ps1` (different scenario lane; the visa flows
  scenario is TS-driven via `scripts/demo-e2e-navigator-visa-flows.ts`).
- No introduction of `fast-check` as a dev dependency (hand-rolled
  generator, consistent with the previous bugfix slice).
- No skipping of the visa flows scenario on Windows; the fix must make
  it pass on simulation fallback as well as real Playwright.
- No silent renaming or removal of any existing field on the
  navigator-visa-flows artifact; only additive `executionMode`.
