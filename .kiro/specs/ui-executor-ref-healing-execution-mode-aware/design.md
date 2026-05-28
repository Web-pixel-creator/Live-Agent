# ui-executor-ref-healing-execution-mode-aware Bugfix Design

## Overview

The previous slice
(`.kiro/specs/demo-e2e-visa-flows-execution-mode-aware-summary/`) made the
`ui.navigator.visa_vertical_flows` summary contract execution-mode-aware so
the PR Quality `windows-2025-vs2026` lane could honestly accept simulated
proof while release-strict-final kept its real-Playwright requirement
byte-identical.

The same lane still fails on two sibling demo-e2e scenarios that exercise
real-DOM ref healing — `ui.executor.ref_healing` and
`ui.browser_worker.checkpoint_resume`. Both POST to
`http://localhost:8090/execute` with stale legacy selectors
(`#legacy-email`, `#legacy-submit`) and rely on `recoverGroundingRefSelector()`
in `apps/ui-executor/src/index.ts` to swap them for the real selectors
against a real DOM. On the PR Quality lane Playwright is not installed, so
`simulateExecution()` (not `executeWithPlaywright()`) handles the request and
the response carries empty `staleRefTargets: []` and `healedRefTargets: []`.
The two scenarios then assertion-fail on the missing `email` / `submit_primary`
healed-ref entries.

This follow-up should refactor the assertion surface in the demo-e2e script,
not the UI executor runtime. The simulation honest-zero behavior is correct
and stays untouched. The fix is on `scripts/demo-e2e.ps1` only: introduce an
execution-mode-aware opt-out env that PR Quality sets to skip the real-DOM
healing assertions while keeping mode-independent invariants
(`finalStatus`, `adapterMode`, trace count, checkpoint counts, queue cleared)
strict on both lanes. Release-strict workflows leave the env unset so their
real-Playwright assertions remain byte-identical to today.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when the
  `ui.executor.ref_healing` or `ui.browser_worker.checkpoint_resume`
  scenario executes against a `ui-executor` instance running in
  simulation mode (Playwright unavailable), causing the response to
  carry empty `healedRefTargets` and the strict real-DOM assertion to
  fail.
- **Property (P)**: The desired behavior when the bug condition holds —
  the scenario still validates mode-independent invariants
  (`finalStatus`, `adapterMode`, trace count, checkpoint counts, queue
  cleared) but skips the real-DOM-only healing assertions, gated on an
  execution-mode-aware env var. The release-strict default keeps today's
  strict real-DOM healing requirement byte-identical.
- **Preservation**: Today's release-strict assertion behavior — when
  `DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT` is unset OR `"true"`,
  the assertion text and conditions in `scripts/demo-e2e.ps1` are
  byte-identical to today.
- **`simulateExecution()`**: The function in
  `apps/ui-executor/src/index.ts` (lines ~625-690) that handles
  `/execute` requests when Playwright is unavailable. It emits
  `groundingResponse(request)` with empty `staleRefTargets` and
  `healedRefTargets`. Stays untouched per R4.
- **`executeWithPlaywright()`**: The function in
  `apps/ui-executor/src/index.ts` (lines ~1131-1444) that handles
  `/execute` requests when Playwright is installed. Calls
  `recoverGroundingRefSelector()` (line ~1246) to swap stale legacy
  selectors for real selectors against a real DOM. Stays untouched per
  R4.
- **`adapterMode`**: The response field that reports which adapter
  served the request. Always `"remote_http"` for both scenarios on
  both lanes; the lane difference is which internal handler ran.
- **`DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT`**: The new
  execution-mode-aware env var. Default behavior (env unset or
  `"true"` / `"1"` / `"yes"` / `"on"`) requires real-DOM ref-healing
  evidence. Opt-out (`"false"` / `"0"` / `"no"` / `"off"`) skips the
  real-DOM healing assertions while keeping mode-independent
  invariants strict.

## Bug Details

### Bug Condition

The bug manifests when the `ui.executor.ref_healing` or
`ui.browser_worker.checkpoint_resume` demo-e2e scenario runs on the PR
Quality `windows-2025-vs2026` lane against a `ui-executor` instance
without Playwright installed. The `simulateExecution()` handler returns
a response carrying empty `staleRefTargets` and empty `healedRefTargets`
because it does not invoke `recoverGroundingRefSelector()`. The
scenario's strict assertion `healedRefTargets -contains "email"` then
fails.

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type ExecuteResponse + scenario name + env state
  OUTPUT: boolean

  RETURN input.adapterMode = "remote_http"
         AND input.handlerThatRan = "simulateExecution"
         AND input.scenario IN { "ui.executor.ref_healing",
                                 "ui.browser_worker.checkpoint_resume" }
         AND input.requestRefsHaveStaleLegacySelectors
         AND input.grounding.healedRefTargets = []
         AND input.grounding.staleRefTargets = []
END FUNCTION
```

### Examples

- `ui.executor.ref_healing` on PR Quality lane → response has
  `adapterMode: "remote_http"`, `finalStatus: "completed"`,
  `grounding.healedRefTargets: []`, `grounding.staleRefTargets: []` →
  expected: scenario passes (env=`"false"`); actual on unfixed code:
  scenario fails with `UI executor ref-healing should recover the
  email ref.`
- `ui.browser_worker.checkpoint_resume` on PR Quality lane → response
  has `recovery.healedRefTargets: []`,
  `recovery.healedRefCount: 0` → expected: scenario passes
  (env=`"false"`); actual on unfixed code: scenario fails with
  `Browser worker recovery should heal the email ref.`
- `ui.executor.ref_healing` on release-strict-final lane → response
  has `grounding.healedRefTargets: ["email", "submit_primary"]` →
  expected: scenario passes (env unset, default behavior); actual:
  scenario passes (no change in behavior).
- Edge case: `ui.executor.ref_healing` on a hypothetical lane where
  Playwright is installed AND the env is `"false"` → real DOM produces
  populated `healedRefTargets`, but the assertion is skipped per the
  env opt-out. This is fine — the env opt-out is a "skip the strict
  check", not a "require simulation". The mode-independent invariants
  still validate.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Today's `scripts/demo-e2e.ps1` ref-healing assertion text and
  conditions, when the env is unset OR `"true"` / `"1"` / `"yes"` /
  `"on"` (release-strict default).
- `simulateExecution()` and `executeWithPlaywright()` in
  `apps/ui-executor/src/index.ts`, including
  `recoverGroundingRefSelector()` and the `groundingResponse(request)`
  shape returned in simulation mode.
- All other assertions in both scenarios that test mode-independent
  invariants (status, adapter, trace count, checkpoint counts, queue
  cleared, honest-zero `staleRefTargets`) — these stay unconditional
  on both lanes.
- Every release workflow YAML
  (`release-strict-final.yml`,
  `release-artifact-only-smoke.yml`,
  `release-artifact-revalidation.yml`,
  `railway-deploy-api.yml`,
  `railway-deploy-all.yml`).
- `tests/unit/demo-e2e-policy-check.test.ts` real-Playwright fixture
  values; any simulation-shape fixture is additive.
- `apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`
  and any other local-services workspace UI.

**Scope:**

All inputs that do NOT involve the simulation-mode handler running on
the two affected scenarios should be completely unaffected by this fix.
This includes:

- `ui.executor.ref_healing` and `ui.browser_worker.checkpoint_resume`
  on lanes where Playwright is installed (release-strict-final).
- All other demo-e2e scenarios on every lane.
- All consumers of the existing healing-related KPI fields in
  `scripts/demo-e2e.ps1`'s summary block; KPI shape is unchanged.
- The release-evidence report and badge-details surface, which
  continue to consume the same fields with the same shape.

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct (assertion surface, not
runtime), the fix is a smallest-diff change to two files plus one new
test file.

**File**: `scripts/demo-e2e.ps1`

**Function**: the inline assertion blocks for the two scenarios — there
is no named PowerShell function wrapping them; they are expanded inline
in the scenario closures.

**Specific Changes**:

1. **Env discriminator block**: Add a small, idempotent helper at the
   top of the script (or inline near the first use) that resolves
   `DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT` to a boolean
   `$refHealingRequireRealPlaywright` per the rule documented in
   Proposed Contract → Assertion Gate. Default (env unset) is `$true`.
   Falsy values (`"0"`, `"false"`, `"no"`, `"off"`, case-insensitive)
   resolve to `$false`. All other values resolve to `$true`. Mirror
   the visa-flows comment style.
2. **`ui.executor.ref_healing` assertion gating**: Wrap the two
   `Assert-Condition` calls at lines ~2982-2983
   (`should recover the email ref.`,
   `should recover the submit ref.`) in
   `if ($refHealingRequireRealPlaywright) { ... }`. When the env opt-out
   is active, emit one `Write-Step` evidence line per scenario before
   the gated block, naming the env state and the reason. Leave line
   ~2985 (`Recovered UI refs should not remain in staleRefTargets.`)
   UNCONDITIONAL — see Affected Assertion Lines for the rationale.
3. **`ui.browser_worker.checkpoint_resume` assertion gating**: Wrap the
   `Assert-Condition` calls at lines ~3170-3176 (the email/submit heal
   assertions, `healedRefCount -ge 2`, the
   `staleRefCount -ge $healedRefCount` comparison, the
   `staleRefTargets -contains "email"` /
   `staleRefTargets -contains "submit_primary"` siblings, and the two
   runtime sibling assertions
   `runtimeHealedRefCount -ge $healedRefCount` /
   `runtimeStaleRefCount -ge $staleRefCount`) in the same
   `if ($refHealingRequireRealPlaywright) { ... }`. Emit one
   `Write-Step` evidence line. Leave the mode-independent invariants
   (`finalStatus`, `adapterMode`, `checkpointCount`,
   `resumedCheckpointCount`, `traceCount`, `checkpointReadyCleared`)
   unconditional.
4. **No KPI emission change**: the summary block at lines ~6719-6752
   stays byte-identical. KPI fields continue to report whatever the
   request actually produced (empty arrays on simulation, real values
   on real-Playwright).

**File**: `.github/workflows/pr-quality.yml`

**Specific Changes**:

5. Add `DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT: "false"` to the
   job env block, next to the existing
   `DEMO_E2E_VISA_FLOWS_ACCEPT_SIMULATION: "true"`. Add a documentation
   comment that mirrors the visa-flows comment shape (purpose, why
   release-strict leaves it unset, link back to this spec directory).

**File**: `tests/unit/demo-e2e-ref-healing-execution-mode-aware.test.ts`
(new)

**Specific Changes**:

6. New test file with two PBT cases (Property 1 Exploration and
   Property 2 Preservation) per the PBT Strategy section. Hand-rolled
   generators, N=8 samples per case, no `fast-check` dep, pure
   in-process.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface
counterexamples that demonstrate the bug on unfixed code, then verify
the fix works correctly on the simulation lane and preserves existing
behavior on the real-Playwright lane.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE
implementing the fix. Confirm or refute the root cause analysis. If the
counterexamples refute the analysis, re-hypothesize before writing
production code.

**Test Plan**: Write a property-based test in
`tests/unit/demo-e2e-ref-healing-execution-mode-aware.test.ts` that
generates `simulateExecution`-shape responses and applies today's strict
assertion predicate (inlined in TS) to each one. Run on UNFIXED
production code to capture failure evidence — the test FAILING is the
SUCCESS signal of the exploration phase per the bugfix workflow.

**Test Cases**:

1. **`ui.executor.ref_healing` Simulation Shape**: Generate 8 response
   samples with `adapterMode: "remote_http"`,
   `finalStatus: "completed"`, `grounding.healedRefTargets: []`,
   `grounding.staleRefTargets: []`, varying trace length. Assert the
   inlined OLD strict predicate returns `false` for every sample (will
   fail on unfixed code expectation: predicate is `false`, captured as
   counterexample evidence).
2. **`ui.browser_worker.checkpoint_resume` Simulation Shape**: Generate
   8 response samples with the same simulation shape plus
   `recovery.healedRefCount: 0`, `recovery.staleRefCount: 0`,
   `checkpointCount: 1`, `resumedCheckpointCount: 1`,
   `checkpointReadyCleared: true`. Assert the inlined OLD strict
   predicate returns `false`.
3. **Mode-Independent Invariants Hold**: For each sample in 1 and 2,
   assert the NEW env-gated predicate (with env=`"false"`) returns
   `true` — the mode-independent invariants validate.
4. **Edge Case — Empty Trace**: Generate a sample with `trace.length: 0`
   to confirm the `traceCount >= 5` / `traceCount >= 7` invariant fails
   the env-gated predicate too (sanity check that the gate is not too
   loose).

**Expected Counterexamples**:

- Every simulation-shape sample produces OLD strict predicate `false`,
  confirming the assertion surface bug.
- Possible causes: assertion blind to `executionMode`; runtime correctly
  honest-zero per design; symmetric to visa-flows symptom.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds
(simulation lane), the fixed assertion block produces the expected
behavior (mode-independent invariants validate; real-DOM healing
assertions are skipped with a `Write-Step` evidence line).

**Pseudocode:**

```
FOR ALL input WHERE isBugCondition(input) DO
  result := assertionBlock_fixed(input, env="false")
  ASSERT result.accepted = true
  ASSERT result.skippedAssertions INCLUDES
    [healedRefTargets_email, healedRefTargets_submit,
     healedRefCount, staleRefCount, staleRefTargets_email,
     staleRefTargets_submit, runtimeHealedRefCount,
     runtimeStaleRefCount]
  ASSERT result.evidenceLogContains
    "simulation lane does not exercise real-DOM ref healing"
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT
hold (real-Playwright lane with populated healing fields), the fixed
assertion block produces the same result as the original assertion
block.

**Pseudocode:**

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT assertionBlock_original(input) = assertionBlock_fixed(input, env=unset)
  ASSERT assertionBlock_original(input) = assertionBlock_fixed(input, env="true")
END FOR
```

**Testing Approach**: Property-based testing is recommended for
preservation checking because:

- It generates many test cases automatically across the input domain
  (varying trace length, varying scenario name, varying KPI values
  within the strict-acceptance band).
- It catches edge cases that manual unit tests might miss (e.g. counters
  exactly at the boundary `traceCount === 7`).
- It provides strong guarantees that release-strict assertion behavior
  is unchanged for all real-Playwright inputs.

**Test Plan**: Observe the strict assertion predicate's behavior on
UNFIXED code first for real-Playwright-shape inputs, record the
observed outcomes as `// observed:` comments, then write the property
asserting both the env-gated predicate and the unconditional predicate
return identical booleans for every sample.

**Test Cases**:

1. **Real-Playwright Happy Path**: 8 samples with
   `healedRefTargets: ["email", "submit_primary"]`,
   `staleRefTargets: ["email", "submit_primary"]`, all counters
   populated per Real-Playwright Criteria → both predicates accept;
   identical outcomes.
2. **Real-Playwright Boundary**: 8 samples with counters exactly at
   strict thresholds (`traceCount === 5`, `healedRefCount === 2`,
   `checkpointCount === 1`) → both predicates accept; identical
   outcomes.
3. **Real-Playwright Missing Email**: 8 samples with
   `healedRefTargets: ["submit_primary"]` (missing "email") → both
   predicates reject; identical outcomes (release-strict still fails
   loudly on partial healing).

### Unit Tests

- Inline TS predicates that mirror the PowerShell strict and env-gated
  assertion blocks.
- Boundary tests for `traceCount`, `healedRefCount`,
  `resumedCheckpointCount`.
- Env discriminator parsing tests:
  `DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT` unset → require real;
  `"true"` / `"1"` / `"yes"` / `"on"` → require real;
  `"false"` / `"0"` / `"no"` / `"off"` → opt out;
  `"FALSE"` / `" false "` (case + whitespace) → opt out;
  any other value → require real (conservative default).

### Property-Based Tests

- **Property 1 (Exploration)**: simulation-shape responses fail today's
  strict predicate; pass the env-gated predicate with env=`"false"`. 8
  samples per scenario, hand-rolled generators.
- **Property 2 (Preservation)**: real-Playwright-shape responses produce
  identical outcomes from the strict and env-gated predicates with env
  unset OR `"true"`. 8 samples per case, three cases (happy path,
  boundary, missing email).

### Integration Tests

- Out of scope for this slice — the existing CI lanes already provide
  integration coverage. PR Quality runs the actual `scripts/demo-e2e.ps1`
  against a real `ui-executor` instance in simulation mode; if the env
  wiring or the assertion gate is wrong, the CI lane catches it. No
  additional integration test is needed.
- `tests/unit/demo-e2e-policy-check.test.ts` continues to provide
  fixture-driven integration coverage of the KPI / policy contract;
  any new simulation-shape fixture is additive.

## Hypothesized Root Cause

Reference R1 (Bug Condition). The bug exists because the assertion surface
is execution-mode-blind, not because the runtime is wrong.

Confirmed:

1. `simulateExecution()` in `apps/ui-executor/src/index.ts` (lines ~625-690)
   does NOT call `recoverGroundingRefSelector()`. Only
   `executeWithPlaywright()` (line ~1246) invokes the helper. On the
   simulation lane the response carries `groundingResponse(request)` with
   empty `staleRefTargets` and empty `healedRefTargets` (no overload
   arguments, defaults to `[]`).
2. The two demo-e2e scenarios (`scripts/demo-e2e.ps1` lines ~2982-2985 and
   ~3170-3176) assert `healedRefTargets -contains "email"` and
   `healedRefTargets -contains "submit_primary"` directly, with no
   awareness that the lane is simulation-only.
3. This is symmetric to the visa-flows symptom solved by the previous
   slice — the assertion surface assumed the real-Playwright proof shape
   on every lane. Same root cause class, same wedge of the fix
   (execution-mode-aware assertion gating, not runtime behavior change).

## Proposed Contract

The fix is on the demo-e2e assertion surface only. Do NOT touch
`simulateExecution()` or any other file under `apps/ui-executor/`.

### Env Discriminator

`DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT` with values:

- `"true"` (default when unset, also `"1"`, `"yes"`, `"on"`): require real-DOM
  ref-healing evidence — release-strict semantics byte-identical to today.
- `"false"` (also `"0"`, `"no"`, `"off"`): skip real-DOM healing assertions —
  PR Quality opt-out. Mode-independent invariants stay strict.

The naming is inverted relative to `DEMO_E2E_VISA_FLOWS_ACCEPT_SIMULATION`
(opt-in into simulation acceptance) because the default differs:
release-strict already requires real Playwright here, so the env names what
release-strict requires. Semantics are symmetric: PR Quality opts out, every
release workflow leaves the env unset.

### Assertion Gate (PowerShell)

The gate is inline in `scripts/demo-e2e.ps1`, mirroring the inline
`$navigatorVisaFlowsAcceptSimulationEnabled` check from the visa-flows slice.
No new helper module; the logic is small enough to read at the call site.

```powershell
$refHealingRequireRealPlaywrightEnv = [Environment]::GetEnvironmentVariable("DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT")
$refHealingRequireRealPlaywrightEnvDisplay = if ($null -eq $refHealingRequireRealPlaywrightEnv) { "<unset>" } else { $refHealingRequireRealPlaywrightEnv }
$refHealingRequireRealPlaywright = $true
if ($null -ne $refHealingRequireRealPlaywrightEnv) {
  $refHealingRequireRealPlaywright = -not (@("0", "false", "no", "off") -contains $refHealingRequireRealPlaywrightEnv.ToString().Trim().ToLowerInvariant())
}
```

`$refHealingRequireRealPlaywright` is `$true` whenever the env is unset OR
set to anything other than the falsy values; the helper goes false ONLY when
the env is explicitly opted out. This preserves R3 (release-strict default
unchanged) byte-identical to today.

### Branching Contract

When `$refHealingRequireRealPlaywright -eq $true` (release-strict default,
env unset):

- All 8 healing assertions in both scenarios stay byte-identical to today's
  `scripts/demo-e2e.ps1`.
- No `Write-Step` skip line is emitted.

When `$refHealingRequireRealPlaywright -eq $false` (PR Quality opt-out):

- Both scenarios still execute the request and still assert the
  mode-independent invariants (see Simulation Criteria below).
- The 8 healing assertions are SKIPPED with a single `Write-Step` log line
  per scenario that names the scenario and notes that simulation lane does
  not exercise real-DOM ref healing. Log shape mirrors the visa-flows slice's
  `Write-Step` evidence.

### Affected Assertion Lines

Cited by current `scripts/demo-e2e.ps1` line numbers and assertion message
text so the fix is unambiguous.

`ui.executor.ref_healing` block (around lines ~2982-2985):

- line ~2982 — `UI executor ref-healing should recover the email ref.`
  GATED.
- line ~2983 — `UI executor ref-healing should recover the submit ref.`
  GATED.
- line ~2985 — `Recovered UI refs should not remain in staleRefTargets.`
  STAYS UNCONDITIONAL. The assertion `(@($staleRefTargets).Count -eq 0)`
  holds on the simulation lane too because `simulateExecution()` returns
  `staleRefTargets: []`. The assertion is therefore an honest invariant
  on both lanes and must NOT be downgraded to "skipped" — keeping it
  strict makes simulation-mode regressions visible if the runtime ever
  starts emitting non-empty `staleRefTargets` from `simulateExecution()`.

`ui.browser_worker.checkpoint_resume` block (around lines ~3170-3176):

- line ~3170 — `Browser worker recovery should heal the email ref.` GATED.
- line ~3171 — `Browser worker recovery should heal the submit ref.` GATED.
- line ~3172 — `Browser worker recovery should record both healed refs.`
  (`healedRefCount -ge 2`). GATED.
- line ~3174 — `Browser worker recovery should expose observed stale refs
  alongside healed refs.` (`staleRefCount -ge $healedRefCount`). GATED
  because both sides become 0 in simulation, so the assertion is
  mathematically vacuous; gating it keeps the intent (compare healed
  against stale) tied to the real-DOM lane.
- line ~3175 — `Browser worker recovery should record email as an observed
  stale ref.` GATED.
- line ~3176 — `Browser worker recovery should record submit_primary as an
  observed stale ref.` GATED.
- runtime healed-ref / runtime stale-ref siblings
  (`runtimeHealedRefCount -ge $healedRefCount`,
  `runtimeStaleRefCount -ge $staleRefCount`). GATED.

### Workflow Env Wiring

- `.github/workflows/pr-quality.yml` env block: add
  `DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT: "false"` next to the
  existing `DEMO_E2E_VISA_FLOWS_ACCEPT_SIMULATION: "true"`, with a
  documentation comment that mirrors the visa-flows comment style
  (purpose, why release-strict leaves it unset, link back to this spec
  directory).
- `.github/workflows/release-strict-final.yml`,
  `.github/workflows/release-artifact-only-smoke.yml`,
  `.github/workflows/release-artifact-revalidation.yml`,
  `.github/workflows/railway-deploy-api.yml`,
  `.github/workflows/railway-deploy-all.yml` MUST leave the env unset so
  the default branch (require real Playwright) applies and today's
  release-strict assertion behavior is byte-identical.

## Real-Playwright Criteria

When the env is unset (or set to `"true"` / `"1"` / `"yes"` / `"on"`), the
two scenarios execute today's strict assertion text byte-identical to the
current `scripts/demo-e2e.ps1`.

`ui.executor.ref_healing` strict assertions:

```text
adapterMode === "remote_http"
finalStatus === "completed"
healedRefTargets -contains "email"
healedRefTargets -contains "submit_primary"
@(staleRefTargets).Count -eq 0
traceCount >= 5
disabledSubmitSeen
enabledSubmitSeen
healingObservationSeen   # at least 2 grounding-healed observations
healingNoteSeen           # at least 2 healed grounding notes
```

`ui.browser_worker.checkpoint_resume` strict assertions:

```text
adapterMode === "remote_http"
finalStatus === "completed"
checkpointCount >= 1
resumedCheckpointCount >= 1
healedRefTargets -contains "email"
healedRefTargets -contains "submit_primary"
healedRefCount >= 2
staleRefCount >= healedRefCount
staleRefTargets -contains "email"
staleRefTargets -contains "submit_primary"
traceCount >= 7
runtimeResumedCheckpointCount >= resumedCheckpointCount
runtimeHealedRefCount >= healedRefCount
runtimeStaleRefCount >= staleRefCount
checkpointReadyCleared === true
```

This pins the regression-test PBT (Property 2): for any input that satisfies
all of the above, the env-gated assertion block and the unconditional
assertion block must produce IDENTICAL outcomes.

## Simulation Criteria (Opt-Out Path)

When the env is `"false"` (or `"0"` / `"no"` / `"off"`), both scenarios MUST
still run the request and MUST still assert the following mode-independent
invariants:

`ui.executor.ref_healing`:

```text
finalStatus === "completed"
adapterMode === "remote_http"
traceCount >= 5
@(staleRefTargets).Count -eq 0   # honest-zero invariant on both lanes
```

`ui.browser_worker.checkpoint_resume`:

```text
finalStatus === "completed"
adapterMode === "remote_http"
traceCount >= 7
checkpointCount >= 1
resumedCheckpointCount >= 1
checkpointReadyCleared === true
```

The 8 healing assertions listed in Proposed Contract → Affected Assertion
Lines are skipped. A single `Write-Step` evidence line per scenario MUST be
visible in CI logs for diagnosability, e.g.:

```text
[step] ui.executor.ref_healing: skipping real-DOM ref-healing assertions because DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT="false"; simulation lane does not exercise real-DOM ref healing.
```

Explicitly: the assertion `@($staleRefTargets).Count -eq 0` MUST NOT be
downgraded to "skipped" — it stays a strict invariant on both lanes because
`simulateExecution()`'s `groundingResponse(request)` already returns an empty
array and any future deviation should fail loudly.

## Mixed Mode (Out of Scope)

There is no mixed mode here. A single demo-e2e scenario runs against a
single `ui-executor` instance which runs in exactly one execution mode for
the duration of the request. Either Playwright is installed and
`executeWithPlaywright()` runs, or it isn't and `simulateExecution()` runs.
The scenario produces one response with one `adapterMode` and one grounding
shape.

The PBT does NOT need a "mixed" generator. Property 1 (Exploration)
generates only simulation-shape responses. Property 2 (Preservation)
generates only real-Playwright-shape responses. There is no third lane.

## Downstream Gate Update

Audit the consumers of the existing healing-related KPI fields emitted in
`scripts/demo-e2e.ps1`'s summary block (around lines ~6719-6752):

```text
kpi.uiRefHealingHealedRefCount
kpi.uiRefHealingHealedRefTargets
kpi.uiRefHealingStaleRefCount
kpi.uiRefHealingStaleRefTargets
kpi.uiRefHealingFinalStatus
kpi.uiRefHealingAdapterMode

kpi.browserWorkerRecoveryHealedRefCount
kpi.browserWorkerRecoveryHealedRefTargets
kpi.browserWorkerRecoveryStaleRefCount
kpi.browserWorkerRecoveryStaleRefTargets
kpi.browserWorkerRecoveryCheckpointCount
kpi.browserWorkerRecoveryResumedCheckpointCount
```

Audit findings:

1. `scripts/release-readiness.ps1`: does NOT consume any `uiRefHealing*` or
   `browserWorkerRecovery*` KPI directly (verified by grep). The release
   readiness gate is unaffected by this slice.
2. `scripts/demo-e2e-policy-check.mjs`: consumes
   `kpi.browserWorkerRecoveryValidated` (line ~1782) and
   `kpi.uiBrowserWorkerRecoveryScenarioAttempts` (line ~1625). It does NOT
   consume the `*HealedRefTargets` / `*HealedRefCount` /
   `*StaleRefTargets` / `*StaleRefCount` fields. Policy check is unaffected
   by gating those fields on the simulation lane because the policy-check
   gate reads only the boolean `validated` summary and the scenario attempt
   counter.
3. `scripts/release-evidence-report.ps1`: consumes
   `badgeDetails.evidence.uiRefHealing.*` and
   `badgeDetails.evidence.browserWorkerRecovery.*` fields (status,
   validated, healedRefCount, healedRefTargets, staleRefCount,
   staleRefTargets, etc.). The release-evidence report renders these
   fields verbatim. The release-evidence report is invoked from
   release-strict-final, where the env is unset and real-DOM ref-healing
   evidence is required, so the badge-details fields will continue to
   carry real-Playwright values. The release-evidence report is NOT
   invoked from PR Quality, so the simulation-shape KPIs never reach
   the badge-details surface.

Conclusion: NO downstream gate becomes env-gated in this slice. The smallest
diff is to keep the demo-e2e KPI emission (`scripts/demo-e2e.ps1`'s summary
block) byte-identical and let it report whatever the request actually
produced — empty arrays on the simulation lane, real values on the
real-Playwright lane. No new KPI shape is needed. No new env discriminator
is needed at the badge / release-evidence layer.

If a future slice surfaces a need to gate badge-details on declared mode,
introduce `DEMO_E2E_REQUIRE_REAL_REF_HEALING_KPI` at that time, mirroring
the visa-flows slice's `*StrictPersistentSessionValidated` field. That is
out of scope here.

`tests/unit/demo-e2e-policy-check.test.ts` continues to pass with its
existing real-Playwright fixtures (the relevant lines populate
`browserWorkerRecoveryValidated: true` at ~286). New simulation-shape
fixtures, if added in Task 3.2, MUST be additive and MUST NOT modify the
existing real-Playwright fixture lines.

## Correctness Properties

Property 1: Bug Condition — Simulation Lane Cannot Satisfy Strict Real-DOM Healing Assertions

_For any_ ui-executor response where `adapterMode === "remote_http"` AND
the response carries `simulateExecution`-shape grounding (empty
`staleRefTargets`, empty `healedRefTargets`), the OLD strict assertion
block (today's `scripts/demo-e2e.ps1` ref-healing assertions, applied
unconditionally) SHALL fail on `healedRefTargets -contains "email"`. The
NEW env-gated assertion block SHALL accept the same input when
`DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT === "false"`, asserting only
the mode-independent invariants (`finalStatus === "completed"`,
`adapterMode === "remote_http"`, `traceCount >= 5` for ref_healing or
`>= 7` for checkpoint_resume, `staleRefTargets.Count === 0`,
`checkpointCount >= 1` and `resumedCheckpointCount >= 1` for
checkpoint_resume).

**Validates: Requirements R1, R2**

Property 2: Preservation — Real-Playwright Lane Behavior Byte-Identical

_For any_ ui-executor response where
`healedRefTargets` contains both `"email"` and `"submit_primary"` AND all
other strict real-DOM healing fields are populated per Real-Playwright
Criteria, the env-gated assertion block (env unset OR `"true"`) and the
unconditional assertion block (today's `scripts/demo-e2e.ps1`) SHALL
produce IDENTICAL outcomes — both accept. The release-strict path stays
byte-identical: same assertion message text, same condition expressions,
same Pester / `Assert-Condition` log shape.

**Validates: Requirements R3, R5**

## PBT Strategy

Two property-based test cases live in a single new test file
`tests/unit/demo-e2e-ref-healing-execution-mode-aware.test.ts`. The new file
follows the per-scenario test-file convention already established by
`tests/unit/demo-e2e-navigator-visa-flows.test.ts` (which houses the PBT for
the visa-flows scenario from the previous slice).

Generators are hand-rolled (no `fast-check` dependency, per R5 / R6). N=8
samples per case. Pure in-process: no real network, no real `ui-executor`
server, no real Playwright browser.

Property 1 (Exploration) — runs on UNFIXED code, FAILS, captures
counterexamples that demonstrate the bug:

- Generate `ui-executor` response objects with shape:
  `{ adapterMode: "remote_http", finalStatus: "completed", trace: [...8],
  grounding: { staleRefTargets: [], healedRefTargets: [], ... },
  recovery?: { checkpointCount: 1, resumedCheckpointCount: 1,
  healedRefCount: 0, staleRefCount: 0, healedRefTargets: [],
  staleRefTargets: [], runtimeHealedRefCount: 0, runtimeStaleRefCount: 0,
  checkpointReadyCleared: true } }`. Vary trace length, scenario name
  across the 8 samples.
- Inline the OLD strict assertion predicate (today's full
  `Assert-Condition` chain expressed as a TS boolean function) — assert
  it returns `false` for every sample (counterexample evidence).
- Inline the NEW env-gated assertion predicate with env=`"false"` —
  assert it returns `true` for every sample.
- Document captured counterexamples as `// counterexample:` comments per
  the bugfix exploration test contract.

Property 2 (Preservation) — runs on UNFIXED code with an activation gate
that short-circuits until the fix lands; flips on after Task 3.x:

- Generate response objects with shape: `{ adapterMode: "remote_http",
  finalStatus: "completed", trace: [...8], grounding: {
  staleRefTargets: [], healedRefTargets: ["email", "submit_primary"], ...
  }, recovery: { healedRefTargets: ["email", "submit_primary"],
  staleRefTargets: ["email", "submit_primary"], healedRefCount: 2,
  staleRefCount: 2, checkpointCount: 1, resumedCheckpointCount: 1,
  runtimeHealedRefCount: 2, runtimeStaleRefCount: 2,
  checkpointReadyCleared: true } }`.
- Assert the env-gated predicate (env unset OR `"true"`) and the
  unconditional predicate (today's strict assertions) return IDENTICAL
  booleans for every sample (both accept).
- Activation gate: gate the property block on
  `typeof refHealingAssertionRequiresRealPlaywright === "function"` IF
  Task 3.x extracts a TS helper module
  `scripts/demo-e2e-ref-healing-execution-mode.ts`. Otherwise inline the
  rule and gate on `process.env.DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT`
  directly (no activation gate needed because the rule is pure-input).

If inlining is cleaner, do NOT introduce a new TS helper module. The
PowerShell-side change is small (~30 lines around the two assertion blocks
plus a shared `Test-DemoE2eRefHealingRequiresRealPlaywright` helper at the
top of `scripts/demo-e2e.ps1` if duplication is bothersome). The PBT
encodes the predicate logic in TS directly because the assertion is in
PowerShell — there is no shared TS helper to import. The TS predicate must
mirror the PowerShell rule exactly: `requireReal = true` unless the env is
explicitly one of `"0"`, `"false"`, `"no"`, `"off"`.

## Cross-cutting Constraints

Forbidden:

1. modifying any file under `apps/ui-executor/` (R4) — including
   `simulateExecution()`, `executeWithPlaywright()`,
   `recoverGroundingRefSelector()`, and `groundingResponse()`. The
   simulation honest-zero contract is correct and stays untouched.
2. modifying
   `apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`
   or any other local-services dispatcher UI (R6).
3. adding `fast-check` as a runtime or dev dependency (R5). PBT
   generators stay hand-rolled.
4. weakening release-strict default behavior (R3). When the env is unset
   or `"true"`, the assertion text and conditions in
   `scripts/demo-e2e.ps1` MUST be byte-identical to today.
5. skipping the entire scenario on the simulation lane (R2). Only the
   real-DOM healing-specific assertions are gated; the mode-independent
   invariants (status, adapter, trace count, checkpoint counts, queue
   cleared, honest-zero `staleRefTargets`) stay strict.
6. faking `healedRefTargets` data in `simulateExecution()` (Variant B —
   see below).
7. modifying `scripts/release-evidence-report.ps1`,
   `scripts/release-readiness.ps1`, or any release-strict workflow YAML.

Allowed:

1. modifying `scripts/demo-e2e.ps1` — specifically the two assertion
   blocks for `ui.executor.ref_healing` and
   `ui.browser_worker.checkpoint_resume`, plus the inline env-discriminator
   helper.
2. modifying `.github/workflows/pr-quality.yml` — add the single
   `DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT: "false"` env line with
   a documentation comment that mirrors the visa-flows comment style.
3. adding `tests/unit/demo-e2e-ref-healing-execution-mode-aware.test.ts`
   — single new PBT file, hand-rolled generators, N=8 samples per case.
4. additive simulation-shape fixtures in
   `tests/unit/demo-e2e-policy-check.test.ts` if Task 3.2 confirms
   policy-check needs a simulation-shape case (per the visa-flows slice
   precedent in Task 3.2 of that spec). Existing real-Playwright fixtures
   stay byte-identical.

The current commercial wedge remains `AI Dispatcher for local service
businesses in Tashkent`. This bugfix touches an immigration Action Desk
proof surface and the PR-quality CI lane only.

## Why Variant A (Skip on Simulation Lane) over Variant B (Emulate Healing)

Variant A: gate the real-DOM healing assertions in `scripts/demo-e2e.ps1`
on an execution-mode-aware env var, leave `simulateExecution()` alone.

Variant B: extend `simulateExecution()` to fabricate `healedRefTargets`
data so the response shape matches the real-Playwright lane.

Variant A is the chosen design because:

1. Variant B requires fabricating `healedRefTargets` data without a real
   DOM, which violates the cross-cutting "no real persistent-session or
   replay-bundle proof faked in simulation mode" principle established by
   the visa-flows slice. The same principle applies here: simulation must
   stay honest. The simulation lane never executed a real selector swap;
   claiming it did would make every downstream KPI and badge-details
   field a lie.
2. Variant A is the smaller diff: roughly 30 PowerShell lines inside
   `scripts/demo-e2e.ps1`, one YAML env line in `pr-quality.yml`, and one
   new TS test file. Variant B requires modifying
   `apps/ui-executor/src/index.ts`, which is forbidden by R4.
3. Variant A mirrors the precedent set by the visa-flows slice and keeps
   the PR Quality lane operating under the same opt-in/opt-out env
   discipline. The naming is inverted —
   `*_ACCEPT_SIMULATION` for visa flows (default off, opt in to accept
   simulation), `*_REQUIRE_REAL_PLAYWRIGHT` for ref healing (default on,
   opt out to skip real-DOM assertions) — because the default behaviors
   differ. The semantics are symmetric: the env names what release-strict
   wants, PR Quality flips the bit.
4. Variant A keeps the `staleRefTargets.Count -eq 0` assertion strict on
   both lanes, which gives simulation-mode regressions a chance to fail
   loudly if `simulateExecution()` ever starts emitting non-empty
   `staleRefTargets` without a corresponding healing path.
