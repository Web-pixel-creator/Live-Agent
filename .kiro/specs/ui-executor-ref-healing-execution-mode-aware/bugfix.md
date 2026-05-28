# Bugfix Requirements Document

## Introduction

This is a follow-up to
`.kiro/specs/demo-e2e-visa-flows-execution-mode-aware-summary/`.

The previous bugfix made the `ui.navigator.visa_vertical_flows` validation
contract execution-mode-aware so the PR Quality lane on `windows-latest`
(now `windows-2025-vs2026`) could honestly accept simulated proof while the
release-strict-final lane kept its real-Playwright requirement byte-identical.

The same lane still fails on two sibling demo-e2e scenarios that exercise
real-DOM ref healing:

1. `ui.executor.ref_healing`
   (`scripts/demo-e2e.ps1`, assertions at lines ~2982, ~2983):

   ```text
   UI executor ref-healing should recover the email ref.
   UI executor ref-healing should recover the submit ref.
   ```

2. `ui.browser_worker.checkpoint_resume`
   (`scripts/demo-e2e.ps1`, assertions at lines ~3170, ~3171, plus
   `healedRefCount -ge 2`):

   ```text
   Browser worker recovery should heal the email ref.
   Browser worker recovery should heal the submit ref.
   Browser worker recovery should record both healed refs.
   ```

Both scenarios POST to `http://localhost:8090/execute` with refs whose
`selector` is a stale legacy selector (`#legacy-email`, `#legacy-submit`) and
rely on `apps/ui-executor/src/index.ts` `recoverGroundingRefSelector()`
(lines ~778, ~1246) to swap the stale selector for the real one
(`#email`, `#submit-profile`) against real DOM. That helper is only invoked
inside `executeWithPlaywright()` (lines ~1222-1318). On the PR Quality lane
Playwright is not installed, so `simulateExecution()` (lines ~625-690)
handles the request and emits `groundingResponse(request)` with empty
`staleRefTargets: []` and `healedRefTargets: []`. The two scenarios then
assertion-fail on the missing `email` / `submit_primary` healed-ref entries.

This is `windows-2025`-specific. Both scenarios pass on `release-strict-final`
where Playwright is installed and `executeWithPlaywright()` actually runs.

The simulation honest-zero behavior in `apps/ui-executor/src/index.ts` is
correct and stays untouched. The fix is on the demo-e2e assertion surface
only: add an execution-mode-aware opt-out env that PR Quality sets to skip
the real-DOM healing assertions while keeping the `finalStatus`,
`adapterMode`, and trace assertions strict, and that release-strict-final
leaves unset so its real-Playwright assertions remain byte-identical to
today.

This is an immigration Action Desk proof surface, not the current
local-services dispatcher wedge. Do not let this follow-up pull the
local-services dashboard work off its critical path unless the PR merge is
technically blocked by a required check.

## Requirements

### R1. Current Defect (Bug Condition)

WHEN a demo-e2e scenario in `scripts/demo-e2e.ps1` runs on the PR Quality
`windows-2025-vs2026` lane AND the `ui-executor` service handles the request
in `adapterMode === "remote_http"` AND Playwright is unavailable so
`simulateExecution()` (not `executeWithPlaywright()`) handled the request AND
the request was issued with refs whose `selector` is a stale legacy selector
(`#legacy-email`, `#legacy-submit`) THEN the response carries
`staleRefTargets: []` and `healedRefTargets: []` AND the scenario fails its
strict real-DOM healing assertions:

1. `ui.executor.ref_healing` fails on
   `UI executor ref-healing should recover the email ref.` and
   `UI executor ref-healing should recover the submit ref.`
2. `ui.browser_worker.checkpoint_resume` fails on
   `Browser worker recovery should heal the email ref.`,
   `Browser worker recovery should heal the submit ref.`, and
   `Browser worker recovery should record both healed refs.`

Formal bug condition:

```
isBugCondition(X) :=
  X.lane                  = "pr-quality-windows-2025-vs2026"
  AND X.adapterMode       = "remote_http"
  AND X.handler           = "simulateExecution"
  AND X.requestRefsHaveStaleLegacySelectors
  AND X.scenario          IN { "ui.executor.ref_healing",
                               "ui.browser_worker.checkpoint_resume" }
```

### R2. Fix Contract (Execution-Mode-Aware Opt-Out)

WHEN the bug condition holds AND the env var
`DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT` is set to `"false"` THEN the
two scenarios SHALL still execute the request and SHALL still assert the
mode-independent invariants:

1. `finalStatus === "completed"`
2. `adapterMode === "remote_http"`
3. `traceCount` reaches the same lower bound as today
4. (for `ui.browser_worker.checkpoint_resume`) `checkpointCount >= 1`,
   `resumedCheckpointCount >= 1`, runtime queue checkpoint-ready cleared

WHEN the env var is `"false"` THEN the two scenarios SHALL SKIP the real-DOM
healing assertions:

1. `healedRefTargets -contains "email"`
2. `healedRefTargets -contains "submit_primary"`
3. `healedRefCount -ge 2`
4. `staleRefCount -ge $healedRefCount`
5. `staleRefTargets -contains "email"`
6. `staleRefTargets -contains "submit_primary"`
7. `runtimeHealedRefCount -ge $healedRefCount`
8. `runtimeStaleRefCount -ge $staleRefCount`

WHEN the env var is `"false"` AND a healing assertion is skipped THEN the
script SHALL emit a `Write-Step` log line that names the scenario and states
that simulation mode does not exercise real-DOM ref healing, mirroring the
log shape used by `DEMO_E2E_VISA_FLOWS_ACCEPT_SIMULATION` in the previous
slice.

### R3. Preservation of Release-Strict Default

WHEN the env var `DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT` is unset OR
set to `"true"` THEN the two scenarios SHALL CONTINUE TO assert today's
strict real-DOM healing invariants byte-identical to the current
`scripts/demo-e2e.ps1`:

1. for `ui.executor.ref_healing`:
   `healedRefTargets -contains "email"`,
   `healedRefTargets -contains "submit_primary"`,
   and the existing
   `Recovered UI refs should not remain in staleRefTargets.` clause.
2. for `ui.browser_worker.checkpoint_resume`:
   `healedRefTargets -contains "email"`,
   `healedRefTargets -contains "submit_primary"`,
   `healedRefCount -ge 2`,
   `staleRefCount -ge $healedRefCount`,
   `staleRefTargets -contains "email"`,
   `staleRefTargets -contains "submit_primary"`,
   `runtimeHealedRefCount -ge $healedRefCount`,
   `runtimeStaleRefCount -ge $staleRefCount`.

The `release-strict-final.yml` workflow MUST NOT set the env var, so
release-strict proof keeps requiring real-DOM ref-healing evidence with no
behavior change.

### R4. `simulateExecution()` And UI Executor Runtime Stay Untouched

WHEN this bugfix is applied THEN the following files SHALL CONTINUE TO
behave exactly as today:

1. `apps/ui-executor/src/index.ts`
   - `simulateExecution()` (lines ~625-690)
   - `executeWithPlaywright()` (lines ~1222-1318)
   - `recoverGroundingRefSelector()` (lines ~778, ~1246)
   - the `groundingResponse(request)` shape returned in simulation mode
     (`staleRefTargets: []`, `healedRefTargets: []`)
2. any other file under `apps/ui-executor/`

The simulation honest-zero contract is correct. The fix MUST NOT mutate
runtime behavior to fabricate healed-ref data on the simulated lane.

### R5. Test And CI Surface

WHEN the fix lands THEN the following surface SHALL change, and only this
surface SHALL change:

1. `scripts/demo-e2e.ps1`:
   - the two `Assert-Condition` calls at lines ~2982 and ~2983
     (`should recover the email ref.` /
     `should recover the submit ref.`) become env-gated.
   - the `Assert-Condition` calls at lines ~3170, ~3171, ~3173 plus the
     stale-ref / runtime healed-ref / runtime stale-ref siblings inside the
     `ui.browser_worker.checkpoint_resume` block become env-gated using the
     same env var.
   - all other assertions in both scenarios (status, adapter, trace,
     checkpoint, resumed-checkpoint, queue-cleared) remain unconditional.
2. `.github/workflows/pr-quality.yml`:
   - add `DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT: "false"` to the
     job env block, with a documentation comment that mirrors the existing
     `DEMO_E2E_VISA_FLOWS_ACCEPT_SIMULATION` block (purpose, why
     release-strict leaves it unset, link back to this spec directory).
3. tests that lock the assertion behavior or KPI shapes:
   - `tests/unit/demo-e2e-policy-check.test.ts` MUST continue to pass with
     the existing `uiRefHealing*` and `browserWorkerRecovery*` KPI fixtures.
   - `tests/unit/release-evidence-report.test.ts` real-Playwright fixtures
     (lines ~371-394, ~619-642, ~928-951, ~1057-1078) MUST continue to
     pass; if a new simulation-shape fixture is added it MUST be additive.
   - `tests/unit/demo-e2e-badge-json-evidence.test.ts` real-Playwright
     fixtures (lines ~165-184, ~623-644) MUST continue to pass; any new
     simulation-shape fixture MUST be additive.
   - `tests/unit/ui-executor-browser-jobs.test.ts` and
     `tests/unit/ui-navigator-verification.test.ts` MUST continue to pass
     unchanged.
4. property-based tests added by this slice MUST run pure in-process: no
   real network, no real `ui-executor` server, no real Playwright browser,
   no `fast-check` dependency, hand-rolled generators, N=8 samples per
   case.

### R6. Cross-Cutting Scope Guards

WHEN this bugfix is applied THEN the following files and concerns SHALL
remain untouched:

1. `apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`
   and any other local-services workspace UI.
2. `apps/ui-executor/src/index.ts` and any other file under
   `apps/ui-executor/`.
3. local-services adapter / backend persistence, outreach execution pack,
   dispatcher dashboard routes or layout, local-services docs except for a
   short operational handoff note if one is genuinely required.
4. dependency surface: no new runtime or dev dependency, in particular no
   `fast-check`. PBT generators stay hand-rolled.
5. release-strict assertion behavior: when
   `DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT` is unset or `"true"`, the
   ref-healing assertion text and conditions in `scripts/demo-e2e.ps1` MUST
   stay byte-identical to today.

The current commercial wedge remains `AI Dispatcher for local service
businesses in Tashkent`. This bugfix touches an immigration Action Desk
proof surface and the PR-quality CI lane only.
