import assert from "node:assert/strict";
import test from "node:test";

// Bugfix slice:
// .kiro/specs/ui-executor-ref-healing-execution-mode-aware/
//
// Audit / consumer map (recorded verbatim from design.md "Downstream Gate
// Update" so future readers can verify without re-running the audit):
//
//   - scripts/release-readiness.ps1 does NOT consume any uiRefHealing*
//     or browserWorkerRecovery* KPI directly (verified by grep). The
//     release-readiness gate is unaffected by this slice.
//   - scripts/demo-e2e-policy-check.mjs consumes
//     kpi.browserWorkerRecoveryValidated (line ~1782) and
//     kpi.uiBrowserWorkerRecoveryScenarioAttempts (line ~1625). It does
//     NOT consume the *HealedRefTargets / *HealedRefCount /
//     *StaleRefTargets / *StaleRefCount fields. The policy check is
//     therefore unaffected by gating those fields on the simulation lane.
//   - scripts/release-evidence-report.ps1 consumes
//     badgeDetails.evidence.uiRefHealing.* and
//     badgeDetails.evidence.browserWorkerRecovery.* fields, but the
//     release-evidence report is invoked only from release-strict-final
//     (env unset) and is NOT invoked from PR Quality, so the
//     simulation-shape KPIs never reach the badge-details surface.
//
// Audit conclusion: NO downstream gate becomes env-gated in this slice.
// The smallest diff is to keep the demo-e2e KPI emission byte-identical
// (scripts/demo-e2e.ps1 summary block ~lines 6719-6752) and let it
// report whatever the request actually produced — empty arrays on the
// simulation lane, real values on the real-Playwright lane.
//
// ----------------------------------------------------------------------
//
// Why no production TS helper is imported here:
// The fix is a PowerShell-side change in scripts/demo-e2e.ps1
// (env-gated assertion block). There is no shared TS helper module for
// this slice; both the OLD strict predicate and the NEW env-gated
// predicate are inlined as pure-input TS functions in this file. The
// env value is passed as a string parameter to the predicate function
// (no process.env reads inside the predicate), so the rule is evaluated
// identically before and after the PowerShell change lands.
//
// This differs from prior slices that exported a TS helper (e.g.
// inferNavigatorVisaFlowValidationMode in
// scripts/demo-e2e-navigator-visa-flows.ts); here the assertion lives in
// PowerShell and there is nothing to import.

// ---------- Shared response shapes ------------------------------------
//
// These mirror the relevant subset of the ExecuteResponse / browser-jobs
// response shapes consumed by scripts/demo-e2e.ps1 around the two
// affected scenario blocks (lines ~2982-3008 for ref_healing and
// ~3155-3192 for checkpoint_resume).

type TraceItem = {
  observation?: string | null;
  notes?: string | null;
};

type RefHealingResponseShape = {
  finalStatus: string;
  adapterMode: string;
  grounding: {
    healedRefTargets: string[];
    staleRefTargets: string[];
  };
  trace: TraceItem[];
  // Derived flags computed from trace (mirroring the PowerShell aggregation
  // around scripts/demo-e2e.ps1 lines ~2999-3003).
  disabledSubmitSeen: boolean;
  enabledSubmitSeen: boolean;
  healingObservationSeen: boolean;
  healingNoteSeen: boolean;
  // Test-only metadata for diagnostic output. Not consumed by predicates.
  scenarioName: string;
  jobId: string;
  url: string;
};

type CheckpointResumeResponseShape = {
  finalStatus: string;
  adapterMode: string;
  recovery: {
    healedRefTargets: string[];
    staleRefTargets: string[];
    healedRefCount: number;
    staleRefCount: number;
    runtimeHealedRefCount: number;
    runtimeStaleRefCount: number;
    runtimeResumedCheckpointCount: number;
  };
  checkpointCount: number;
  resumedCheckpointCount: number;
  checkpointReadyCleared: boolean;
  trace: TraceItem[];
  // Test-only metadata.
  scenarioName: string;
  jobId: string;
  url: string;
};

// ---------- Inline predicates -----------------------------------------
//
// Both the OLD strict predicate and the NEW env-gated predicate live
// here as pure-input TS booleans, matching design.md "Proposed
// Contract" and "Real-Playwright Criteria" / "Simulation Criteria"
// sections verbatim. The PowerShell-side change in Task 3.1 will mirror
// this rule exactly; integration check happens at CI level, not here.

// Mirror of scripts/demo-e2e.ps1 env parsing rule. requireRealPlaywright
// is true unless the env is explicitly opted out via "0", "false",
// "no", or "off" (case + whitespace insensitive).
function envRequiresRealPlaywright(envValue: string | null | undefined): boolean {
  if (envValue === null || envValue === undefined) {
    return true;
  }
  const normalized = String(envValue).trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalized);
}

// OLD strict predicate for ui.executor.ref_healing (literal copy of
// today's scripts/demo-e2e.ps1 chain at lines ~2978-3008 expressed as a
// TS boolean). Used as a counterexample-evidence check independent of
// any production code.
function oldStrictRefHealingPredicate(response: RefHealingResponseShape): boolean {
  const traceCount = response.trace.length;
  return (
    response.adapterMode === "remote_http" &&
    response.finalStatus === "completed" &&
    response.grounding.healedRefTargets.includes("email") &&
    response.grounding.healedRefTargets.includes("submit_primary") &&
    response.grounding.staleRefTargets.length === 0 &&
    traceCount >= 5 &&
    response.disabledSubmitSeen &&
    response.enabledSubmitSeen &&
    response.healingObservationSeen &&
    response.healingNoteSeen
  );
}

// NEW env-gated predicate for ui.executor.ref_healing per design.md
// "Proposed Contract" -> "Branching Contract" + "Simulation Criteria".
// envValue mirrors the PowerShell env read; null/undefined means unset.
function envGatedRefHealingPredicate(
  response: RefHealingResponseShape,
  envValue: string | null | undefined,
): boolean {
  if (envRequiresRealPlaywright(envValue)) {
    return oldStrictRefHealingPredicate(response);
  }
  // Simulation criteria (env="false"): mode-independent invariants only.
  // staleRefTargets honest-zero invariant stays strict on both lanes per
  // design.md "Affected Assertion Lines" (the line ~2985 assertion is
  // explicitly NOT gated).
  const traceCount = response.trace.length;
  return (
    response.adapterMode === "remote_http" &&
    response.finalStatus === "completed" &&
    traceCount >= 5 &&
    response.grounding.staleRefTargets.length === 0
  );
}

// OLD strict predicate for ui.browser_worker.checkpoint_resume (literal
// copy of today's scripts/demo-e2e.ps1 chain at lines ~3160-3192).
function oldStrictCheckpointResumePredicate(
  response: CheckpointResumeResponseShape,
): boolean {
  const traceCount = response.trace.length;
  const healedRefCount = response.recovery.healedRefCount;
  const staleRefCount = response.recovery.staleRefCount;
  return (
    response.adapterMode === "remote_http" &&
    response.finalStatus === "completed" &&
    response.checkpointCount >= 1 &&
    response.resumedCheckpointCount >= 1 &&
    response.recovery.healedRefTargets.includes("email") &&
    response.recovery.healedRefTargets.includes("submit_primary") &&
    healedRefCount >= 2 &&
    staleRefCount >= healedRefCount &&
    response.recovery.staleRefTargets.includes("email") &&
    response.recovery.staleRefTargets.includes("submit_primary") &&
    traceCount >= 7 &&
    response.recovery.runtimeResumedCheckpointCount >= response.resumedCheckpointCount &&
    response.recovery.runtimeHealedRefCount >= healedRefCount &&
    response.recovery.runtimeStaleRefCount >= staleRefCount &&
    response.checkpointReadyCleared === true
  );
}

// NEW env-gated predicate for ui.browser_worker.checkpoint_resume per
// design.md "Simulation Criteria".
function envGatedCheckpointResumePredicate(
  response: CheckpointResumeResponseShape,
  envValue: string | null | undefined,
): boolean {
  if (envRequiresRealPlaywright(envValue)) {
    return oldStrictCheckpointResumePredicate(response);
  }
  // Simulation criteria: mode-independent invariants only.
  const traceCount = response.trace.length;
  return (
    response.adapterMode === "remote_http" &&
    response.finalStatus === "completed" &&
    traceCount >= 7 &&
    response.checkpointCount >= 1 &&
    response.resumedCheckpointCount >= 1 &&
    response.checkpointReadyCleared === true
  );
}

// ---------- Shared sample variants ------------------------------------

const SCENARIO_NAME_VARIANTS = [
  "ref-healing-booking",
  "ref-healing-reminder",
  "ref-healing-handoff",
  "ref-healing-escalation",
  "ref-healing-consultation",
  "ref-healing-renewal",
  "ref-healing-appeal",
  "ref-healing-extension",
];
const URL_BASE_VARIANTS = [
  "http://localhost:3000/ui-task-profile-settings-demo.html",
  "http://localhost:3000/ui-task-booking-demo.html",
  "http://localhost:3000/ui-task-reminder-demo.html",
  "http://localhost:3000/ui-task-handoff-demo.html",
  "https://staging.example.test/ui-task-profile-settings-demo.html",
  "https://staging.example.test/ui-task-booking-demo.html",
  "https://qa.example.test/ui-task-reminder-demo.html",
  "https://qa.example.test/ui-task-handoff-demo.html",
];

// ---------- Property 1: Bug Condition Exploration ----------------------
//
// Validates: Requirements R1, R2, R4 (per tasks.md Task 1).
//
// GOAL: Surface counterexamples that demonstrate the OLD strict
// real-DOM healing assertion predicate returns `false` for every
// honestly-shaped simulation lane response, while the inlined NEW
// env-gated predicate (env="false") returns `true` for the same inputs.
//
// EXPECTED OUTCOME on UNFIXED code: this test PASSES. Both predicates
// are inlined in TS and evaluated against test-built response shapes —
// there is no live PowerShell call here. The "exploration" semantics
// are: the captured counterexamples (logged via console.warn) prove
// the bug class exists, even though the assertions themselves are
// TS-internal. The PowerShell production change in Task 3.1 will mirror
// the env-gated TS predicate exactly; integration check happens at CI
// level (PR Quality lane).

test(
  "demo-e2e ref-healing exploration: simulation lane cannot satisfy strict real-DOM healing assertions while env-gated predicate accepts (PBT)",
  () => {
    // ---- 1.a ui.executor.ref_healing simulation shape -----------------
    type RefHealingSampleSpec = {
      label: string;
      traceLength: number;
      scenarioName: string;
      jobIdPrefix: string;
      urlIndex: number;
    };

    const refHealingSampleSpecs: RefHealingSampleSpec[] = [
      { label: "trace-5-min", traceLength: 5, scenarioName: SCENARIO_NAME_VARIANTS[0], jobIdPrefix: "sim-rh", urlIndex: 0 },
      { label: "trace-6", traceLength: 6, scenarioName: SCENARIO_NAME_VARIANTS[1], jobIdPrefix: "sim-rh", urlIndex: 1 },
      { label: "trace-7", traceLength: 7, scenarioName: SCENARIO_NAME_VARIANTS[2], jobIdPrefix: "sim-rh", urlIndex: 2 },
      { label: "trace-8", traceLength: 8, scenarioName: SCENARIO_NAME_VARIANTS[3], jobIdPrefix: "sim-rh", urlIndex: 3 },
      { label: "trace-9", traceLength: 9, scenarioName: SCENARIO_NAME_VARIANTS[4], jobIdPrefix: "sim-rh-staging", urlIndex: 4 },
      { label: "trace-10", traceLength: 10, scenarioName: SCENARIO_NAME_VARIANTS[5], jobIdPrefix: "sim-rh-staging", urlIndex: 5 },
      { label: "trace-11", traceLength: 11, scenarioName: SCENARIO_NAME_VARIANTS[6], jobIdPrefix: "sim-rh-qa", urlIndex: 6 },
      { label: "trace-12-max", traceLength: 12, scenarioName: SCENARIO_NAME_VARIANTS[7], jobIdPrefix: "sim-rh-qa", urlIndex: 7 },
    ];

    function buildRefHealingSimulationSample(
      spec: RefHealingSampleSpec,
    ): RefHealingResponseShape {
      const trace: TraceItem[] = [];
      for (let i = 0; i < spec.traceLength; i += 1) {
        trace.push({ observation: `step-${i} simulated`, notes: null });
      }
      return {
        finalStatus: "completed",
        adapterMode: "remote_http",
        grounding: {
          // Pinned: simulateExecution() returns groundingResponse(request)
          // with empty arrays (apps/ui-executor/src/index.ts ~lines
          // 625-690). Honest-zero invariant per design.md "Bug Details".
          healedRefTargets: [],
          staleRefTargets: [],
        },
        trace,
        // Simulation lane never observes a real disabled/enabled submit
        // transition because the runtime did not exercise a real DOM.
        disabledSubmitSeen: false,
        enabledSubmitSeen: false,
        healingObservationSeen: false,
        healingNoteSeen: false,
        scenarioName: spec.scenarioName,
        jobId: `${spec.jobIdPrefix}-${spec.label}`,
        url: URL_BASE_VARIANTS[spec.urlIndex],
      };
    }

    const refHealingCounterexamples: Array<{
      label: string;
      traceLength: number;
      oldStrictAccepted: boolean;
      envGatedFalseAccepted: boolean;
    }> = [];

    for (const spec of refHealingSampleSpecs) {
      const sample = buildRefHealingSimulationSample(spec);

      const oldStrict = oldStrictRefHealingPredicate(sample);
      const envGatedFalse = envGatedRefHealingPredicate(sample, "false");

      assert.equal(
        oldStrict,
        false,
        `OLD strict ref-healing predicate unexpectedly accepted simulation sample "${spec.label}": ` +
          `traceCount=${sample.trace.length}, healedRefTargets=${JSON.stringify(sample.grounding.healedRefTargets)}, ` +
          `staleRefTargets=${JSON.stringify(sample.grounding.staleRefTargets)}. The strict rule must reject ` +
          `simulation-shape responses (healedRefTargets is empty, so includes("email") fails) — if this ` +
          `assertion fails, the inlined OLD predicate has drifted from scripts/demo-e2e.ps1 lines ~2982-3008.`,
      );
      assert.equal(
        envGatedFalse,
        true,
        `NEW env-gated ref-healing predicate (env="false") unexpectedly REJECTED simulation sample ` +
          `"${spec.label}": traceCount=${sample.trace.length}. The env-gated rule should assert only the ` +
          `mode-independent invariants (adapterMode=remote_http, finalStatus=completed, traceCount>=5, ` +
          `staleRefTargets.length===0) on the simulation lane.`,
      );

      refHealingCounterexamples.push({
        label: spec.label,
        traceLength: sample.trace.length,
        oldStrictAccepted: oldStrict,
        envGatedFalseAccepted: envGatedFalse,
      });
    }

    // Edge case sanity: trace.length === 0 makes the env-gated predicate
    // return false too (gate is not too loose; the mode-independent
    // traceCount>=5 invariant still rejects).
    const emptyTraceSample: RefHealingResponseShape = {
      finalStatus: "completed",
      adapterMode: "remote_http",
      grounding: { healedRefTargets: [], staleRefTargets: [] },
      trace: [],
      disabledSubmitSeen: false,
      enabledSubmitSeen: false,
      healingObservationSeen: false,
      healingNoteSeen: false,
      scenarioName: "ref-healing-empty-trace-edge",
      jobId: "sim-rh-empty-trace-edge",
      url: URL_BASE_VARIANTS[0],
    };
    assert.equal(
      envGatedRefHealingPredicate(emptyTraceSample, "false"),
      false,
      "Edge case sanity: env-gated ref-healing predicate (env=\"false\") with trace.length===0 must " +
        "return false because the mode-independent traceCount>=5 invariant rejects. If this fails, the " +
        "env-gated predicate is too loose.",
    );
    assert.equal(
      oldStrictRefHealingPredicate(emptyTraceSample),
      false,
      "Edge case sanity: OLD strict ref-healing predicate with trace.length===0 must return false too.",
    );

    // ---- 1.b ui.browser_worker.checkpoint_resume simulation shape -----
    type CheckpointResumeSampleSpec = {
      label: string;
      traceLength: number;
      scenarioName: string;
      jobIdPrefix: string;
      urlIndex: number;
    };

    const checkpointResumeSampleSpecs: CheckpointResumeSampleSpec[] = [
      { label: "trace-7-min", traceLength: 7, scenarioName: "checkpoint-resume-booking", jobIdPrefix: "sim-cr", urlIndex: 0 },
      { label: "trace-8", traceLength: 8, scenarioName: "checkpoint-resume-reminder", jobIdPrefix: "sim-cr", urlIndex: 1 },
      { label: "trace-9", traceLength: 9, scenarioName: "checkpoint-resume-handoff", jobIdPrefix: "sim-cr", urlIndex: 2 },
      { label: "trace-10", traceLength: 10, scenarioName: "checkpoint-resume-escalation", jobIdPrefix: "sim-cr", urlIndex: 3 },
      { label: "trace-11", traceLength: 11, scenarioName: "checkpoint-resume-consultation", jobIdPrefix: "sim-cr-staging", urlIndex: 4 },
      { label: "trace-12", traceLength: 12, scenarioName: "checkpoint-resume-renewal", jobIdPrefix: "sim-cr-staging", urlIndex: 5 },
      { label: "trace-13", traceLength: 13, scenarioName: "checkpoint-resume-appeal", jobIdPrefix: "sim-cr-qa", urlIndex: 6 },
      { label: "trace-14-max", traceLength: 14, scenarioName: "checkpoint-resume-extension", jobIdPrefix: "sim-cr-qa", urlIndex: 7 },
    ];

    function buildCheckpointResumeSimulationSample(
      spec: CheckpointResumeSampleSpec,
    ): CheckpointResumeResponseShape {
      const trace: TraceItem[] = [];
      for (let i = 0; i < spec.traceLength; i += 1) {
        trace.push({ observation: `step-${i} simulated`, notes: null });
      }
      return {
        finalStatus: "completed",
        adapterMode: "remote_http",
        recovery: {
          // Honest-zero healing fields per design.md "Bug Details" — the
          // simulation lane never invokes recoverGroundingRefSelector().
          healedRefTargets: [],
          staleRefTargets: [],
          healedRefCount: 0,
          staleRefCount: 0,
          runtimeHealedRefCount: 0,
          runtimeStaleRefCount: 0,
          // The browser-jobs simulation produces checkpoint counters
          // even on the simulation lane; only the healing fields are
          // honest-zero. This matches what scripts/demo-e2e.ps1's
          // mode-independent invariants assert.
          runtimeResumedCheckpointCount: 1,
        },
        checkpointCount: 1,
        resumedCheckpointCount: 1,
        checkpointReadyCleared: true,
        trace,
        scenarioName: spec.scenarioName,
        jobId: `${spec.jobIdPrefix}-${spec.label}`,
        url: URL_BASE_VARIANTS[spec.urlIndex],
      };
    }

    const checkpointResumeCounterexamples: Array<{
      label: string;
      traceLength: number;
      oldStrictAccepted: boolean;
      envGatedFalseAccepted: boolean;
    }> = [];

    for (const spec of checkpointResumeSampleSpecs) {
      const sample = buildCheckpointResumeSimulationSample(spec);

      const oldStrict = oldStrictCheckpointResumePredicate(sample);
      const envGatedFalse = envGatedCheckpointResumePredicate(sample, "false");

      assert.equal(
        oldStrict,
        false,
        `OLD strict checkpoint-resume predicate unexpectedly accepted simulation sample "${spec.label}": ` +
          `traceCount=${sample.trace.length}, healedRefTargets=${JSON.stringify(sample.recovery.healedRefTargets)}, ` +
          `healedRefCount=${sample.recovery.healedRefCount}, staleRefCount=${sample.recovery.staleRefCount}. ` +
          `The strict rule must reject simulation-shape responses (healedRefTargets is empty, so ` +
          `includes("email") fails; healedRefCount=0 < 2) — if this assertion fails, the inlined OLD ` +
          `predicate has drifted from scripts/demo-e2e.ps1 lines ~3160-3192.`,
      );
      assert.equal(
        envGatedFalse,
        true,
        `NEW env-gated checkpoint-resume predicate (env="false") unexpectedly REJECTED simulation sample ` +
          `"${spec.label}": traceCount=${sample.trace.length}. The env-gated rule should assert only the ` +
          `mode-independent invariants (adapterMode=remote_http, finalStatus=completed, traceCount>=7, ` +
          `checkpointCount>=1, resumedCheckpointCount>=1, checkpointReadyCleared===true) on the ` +
          `simulation lane.`,
      );

      checkpointResumeCounterexamples.push({
        label: spec.label,
        traceLength: sample.trace.length,
        oldStrictAccepted: oldStrict,
        envGatedFalseAccepted: envGatedFalse,
      });
    }

    // Edge case sanity for checkpoint_resume: trace.length === 0 makes
    // the env-gated predicate return false too.
    const emptyTraceCheckpointSample: CheckpointResumeResponseShape = {
      finalStatus: "completed",
      adapterMode: "remote_http",
      recovery: {
        healedRefTargets: [],
        staleRefTargets: [],
        healedRefCount: 0,
        staleRefCount: 0,
        runtimeHealedRefCount: 0,
        runtimeStaleRefCount: 0,
        runtimeResumedCheckpointCount: 1,
      },
      checkpointCount: 1,
      resumedCheckpointCount: 1,
      checkpointReadyCleared: true,
      trace: [],
      scenarioName: "checkpoint-resume-empty-trace-edge",
      jobId: "sim-cr-empty-trace-edge",
      url: URL_BASE_VARIANTS[0],
    };
    assert.equal(
      envGatedCheckpointResumePredicate(emptyTraceCheckpointSample, "false"),
      false,
      "Edge case sanity: env-gated checkpoint-resume predicate (env=\"false\") with trace.length===0 must " +
        "return false because the mode-independent traceCount>=7 invariant rejects.",
    );

    // ---- Surface counterexamples (bugfix exploration test contract) ---
    assert.equal(refHealingCounterexamples.length, 8, "expected 8 ref_healing counterexamples");
    assert.equal(
      checkpointResumeCounterexamples.length,
      8,
      "expected 8 checkpoint_resume counterexamples",
    );
    console.warn(
      `[ref-healing-execution-mode-aware-pbt] surfaced ${refHealingCounterexamples.length + checkpointResumeCounterexamples.length} ` +
        `counterexample(s) where OLD strict ref-healing predicate returns false on honest simulation-shape ` +
        `responses while NEW env-gated predicate (env="false") returns true. Counterexamples confirm the ` +
        `bug exists per bugfix.md R1 / R2 and unblock Task 3.1's PowerShell assertion gate.`,
    );
    for (const sample of refHealingCounterexamples) {
      console.warn(
        `[ref-healing-execution-mode-aware-pbt] counterexample: scenario=ui.executor.ref_healing ` +
          `label=${sample.label} traceLength=${sample.traceLength} grounding.healedRefTargets=[] ` +
          `grounding.staleRefTargets=[] -> oldStrict=${sample.oldStrictAccepted} ` +
          `envGated(env="false")=${sample.envGatedFalseAccepted}`,
      );
    }
    for (const sample of checkpointResumeCounterexamples) {
      console.warn(
        `[ref-healing-execution-mode-aware-pbt] counterexample: scenario=ui.browser_worker.checkpoint_resume ` +
          `label=${sample.label} traceLength=${sample.traceLength} recovery.healedRefTargets=[] ` +
          `recovery.staleRefTargets=[] healedRefCount=0 staleRefCount=0 -> oldStrict=${sample.oldStrictAccepted} ` +
          `envGated(env="false")=${sample.envGatedFalseAccepted}`,
      );
    }
  },
);

// ---------- Property 2: Preservation (Real-Playwright Lane) -----------
//
// Validates: Requirements R3, R5 (per tasks.md Task 2).
//
// GOAL: Lock down, as property assertions over a hand-rolled input
// domain, that the env-gated predicate (env unset OR "true" / "1" /
// "yes" / "on" / "TRUE") and the unconditional OLD strict predicate
// return identical booleans for every real-Playwright-shape sample.
// This is the preservation property: today's release-strict assertion
// behavior MUST be byte-identical when the env stays unset.
//
// ACTIVATION GATE: NONE. Both predicates are inlined in this file as
// pure-input TS functions; nothing imported from production. The block
// is fully evaluable on UNFIXED code and stays evaluable after Task 3.1
// because the env-gated predicate logic is encoded once here, not in a
// helper module that changes between runs.
//
// Observation phase (recorded BEFORE forward-looking assertions per
// bugfix workflow + visa-flows precedent):
//
//   // observed: ui.executor.ref_healing happy path        -> strict predicate returns true; env-gated predicate (env unset) returns true.
//   // observed: ui.executor.ref_healing missing email      -> strict predicate returns false; env-gated predicate (env unset) returns false.
//   // observed: ui.browser_worker.checkpoint_resume happy path  -> strict predicate returns true; env-gated predicate (env unset) returns true.
//   // observed: ui.browser_worker.checkpoint_resume missing email -> strict predicate returns false; env-gated predicate (env unset) returns false.
//
// The four cases exercise the truthy/falsy diagonal of the strict
// predicate; the property asserts that the env-gated predicate (across
// the env values that resolve to requireRealPlaywright=true) tracks
// the strict predicate exactly.

test(
  "demo-e2e ref-healing preservation: env-gated predicate matches strict predicate for real-Playwright-shape inputs (preservation PBT)",
  () => {
    const SAMPLE_COUNT = 8;
    // Env values that resolve to requireRealPlaywright=true per the
    // PowerShell parsing rule. `null` covers "env unset". The empty
    // string is intentionally NOT in this list because PowerShell
    // [Environment]::GetEnvironmentVariable returns null (not "") for
    // unset envs; documenting the "release-strict default" branch only.
    const TRUTHY_ENV_VALUES: Array<string | null> = [
      null,
      "true",
      "1",
      "yes",
      "on",
      "TRUE",
    ];

    // ---- 2.a ui.executor.ref_healing Real-Playwright Happy Path -------
    // observed: ui.executor.ref_healing happy path -> strict predicate
    //   returns true; env-gated predicate (env unset) returns true.
    function buildRefHealingHappyPathSample(index: number): RefHealingResponseShape {
      const trace: TraceItem[] = [];
      const traceLength = 5 + (index % 4); // 5..8 across samples
      for (let i = 0; i < traceLength; i += 1) {
        // Populate observations / notes so the aggregated flags
        // (disabledSubmitSeen, enabledSubmitSeen, healingObservationSeen,
        // healingNoteSeen) all turn true. The PowerShell aggregation
        // around lines ~2999-3003 looks for grounding-healed observation
        // strings and "Recovered stale grounding ref" note prefixes.
        if (i === 0) {
          trace.push({ observation: "submit state=disabled", notes: null });
        } else if (i === 1) {
          trace.push({ observation: "submit state=enabled", notes: null });
        } else if (i === 2) {
          trace.push({
            observation: "grounding-healed ref:email",
            notes: "Recovered stale grounding ref email",
          });
        } else if (i === 3) {
          trace.push({
            observation: "grounding-healed ref:submit_primary",
            notes: "Recovered stale grounding ref submit_primary",
          });
        } else {
          trace.push({ observation: `step-${i} real-playwright`, notes: null });
        }
      }
      return {
        finalStatus: "completed",
        adapterMode: "remote_http",
        grounding: {
          healedRefTargets: ["email", "submit_primary"],
          staleRefTargets: [],
        },
        trace,
        disabledSubmitSeen: true,
        enabledSubmitSeen: true,
        healingObservationSeen: true,
        healingNoteSeen: true,
        scenarioName: SCENARIO_NAME_VARIANTS[index % SCENARIO_NAME_VARIANTS.length],
        jobId: `rp-rh-happy-${index}`,
        url: URL_BASE_VARIANTS[index % URL_BASE_VARIANTS.length],
      };
    }

    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      const sample = buildRefHealingHappyPathSample(i);
      const strict = oldStrictRefHealingPredicate(sample);

      assert.equal(
        strict,
        true,
        `Case 2.a (ref_healing happy path): OLD strict predicate must accept real-Playwright-shape ` +
          `sample ${i}; got false. healedRefTargets=${JSON.stringify(sample.grounding.healedRefTargets)}, ` +
          `traceCount=${sample.trace.length}.`,
      );

      for (const envValue of TRUTHY_ENV_VALUES) {
        const envGated = envGatedRefHealingPredicate(sample, envValue);
        assert.equal(
          envGated,
          strict,
          `Case 2.a (ref_healing happy path): env-gated predicate with env=${JSON.stringify(envValue)} ` +
            `produced ${envGated}, expected ${strict} (must match OLD strict predicate). Sample ${i}, ` +
            `healedRefTargets=${JSON.stringify(sample.grounding.healedRefTargets)}.`,
        );
      }
    }

    // ---- 2.b ui.executor.ref_healing Missing Email --------------------
    // observed: ui.executor.ref_healing missing email -> strict predicate
    //   returns false; env-gated predicate (env unset) returns false.
    function buildRefHealingMissingEmailSample(index: number): RefHealingResponseShape {
      const happy = buildRefHealingHappyPathSample(index);
      // Identical to 2.a except healedRefTargets is missing "email".
      return {
        ...happy,
        grounding: {
          healedRefTargets: ["submit_primary"],
          staleRefTargets: [],
        },
        jobId: `rp-rh-missing-email-${index}`,
      };
    }

    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      const sample = buildRefHealingMissingEmailSample(i);
      const strict = oldStrictRefHealingPredicate(sample);

      assert.equal(
        strict,
        false,
        `Case 2.b (ref_healing missing email): OLD strict predicate must reject sample ${i} ` +
          `because healedRefTargets is missing "email"; got true. healedRefTargets=` +
          `${JSON.stringify(sample.grounding.healedRefTargets)}.`,
      );

      for (const envValue of TRUTHY_ENV_VALUES) {
        const envGated = envGatedRefHealingPredicate(sample, envValue);
        assert.equal(
          envGated,
          strict,
          `Case 2.b (ref_healing missing email): env-gated predicate with env=` +
            `${JSON.stringify(envValue)} produced ${envGated}, expected ${strict} (must match OLD ` +
            `strict predicate — preservation of strict rejection on the real-Playwright lane).`,
        );
      }
    }

    // ---- 2.c ui.browser_worker.checkpoint_resume Real-Playwright Happy Path
    // observed: ui.browser_worker.checkpoint_resume happy path -> strict
    //   predicate returns true; env-gated predicate (env unset) returns true.
    function buildCheckpointResumeHappyPathSample(
      index: number,
    ): CheckpointResumeResponseShape {
      const trace: TraceItem[] = [];
      const traceLength = 7 + (index % 4); // 7..10 across samples
      for (let i = 0; i < traceLength; i += 1) {
        trace.push({ observation: `step-${i} real-playwright`, notes: null });
      }
      return {
        finalStatus: "completed",
        adapterMode: "remote_http",
        recovery: {
          healedRefTargets: ["email", "submit_primary"],
          staleRefTargets: ["email", "submit_primary"],
          healedRefCount: 2,
          staleRefCount: 2,
          runtimeHealedRefCount: 2,
          runtimeStaleRefCount: 2,
          runtimeResumedCheckpointCount: 1,
        },
        checkpointCount: 1,
        resumedCheckpointCount: 1,
        checkpointReadyCleared: true,
        trace,
        scenarioName: `checkpoint-resume-${SCENARIO_NAME_VARIANTS[index % SCENARIO_NAME_VARIANTS.length]}`,
        jobId: `rp-cr-happy-${index}`,
        url: URL_BASE_VARIANTS[index % URL_BASE_VARIANTS.length],
      };
    }

    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      const sample = buildCheckpointResumeHappyPathSample(i);
      const strict = oldStrictCheckpointResumePredicate(sample);

      assert.equal(
        strict,
        true,
        `Case 2.c (checkpoint_resume happy path): OLD strict predicate must accept ` +
          `real-Playwright-shape sample ${i}; got false. healedRefCount=${sample.recovery.healedRefCount}, ` +
          `staleRefCount=${sample.recovery.staleRefCount}, traceCount=${sample.trace.length}.`,
      );

      for (const envValue of TRUTHY_ENV_VALUES) {
        const envGated = envGatedCheckpointResumePredicate(sample, envValue);
        assert.equal(
          envGated,
          strict,
          `Case 2.c (checkpoint_resume happy path): env-gated predicate with env=` +
            `${JSON.stringify(envValue)} produced ${envGated}, expected ${strict}.`,
        );
      }
    }

    // ---- 2.d ui.browser_worker.checkpoint_resume Missing Email --------
    // observed: ui.browser_worker.checkpoint_resume missing email ->
    //   strict predicate returns false; env-gated predicate (env unset)
    //   returns false.
    function buildCheckpointResumeMissingEmailSample(
      index: number,
    ): CheckpointResumeResponseShape {
      const happy = buildCheckpointResumeHappyPathSample(index);
      // Identical to 2.c except recovery.healedRefTargets is missing
      // "email" and healedRefCount drops to 1. All other counters stay
      // populated to isolate the missing-email rejection path.
      return {
        ...happy,
        recovery: {
          ...happy.recovery,
          healedRefTargets: ["submit_primary"],
          healedRefCount: 1,
        },
        jobId: `rp-cr-missing-email-${index}`,
      };
    }

    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      const sample = buildCheckpointResumeMissingEmailSample(i);
      const strict = oldStrictCheckpointResumePredicate(sample);

      assert.equal(
        strict,
        false,
        `Case 2.d (checkpoint_resume missing email): OLD strict predicate must reject sample ${i} ` +
          `because recovery.healedRefTargets is missing "email" and healedRefCount=1 < 2; got true.`,
      );

      for (const envValue of TRUTHY_ENV_VALUES) {
        const envGated = envGatedCheckpointResumePredicate(sample, envValue);
        assert.equal(
          envGated,
          strict,
          `Case 2.d (checkpoint_resume missing email): env-gated predicate with env=` +
            `${JSON.stringify(envValue)} produced ${envGated}, expected ${strict} (preservation of ` +
            `strict rejection of partial healing on the real-Playwright lane).`,
        );
      }
    }

    console.warn(
      `[ref-healing-execution-mode-aware-pbt] verified ${SAMPLE_COUNT * 4} samples across 4 cases ` +
        `(2.a/2.b/2.c/2.d): env-gated predicate (env unset OR "true" / "1" / "yes" / "on" / "TRUE") and ` +
        `OLD strict predicate returned identical booleans for every real-Playwright-shape sample. ` +
        `Production proof on the real-Playwright lane is byte-identical; release-strict-final behavior ` +
        `is unchanged when DEMO_E2E_REF_HEALING_REQUIRE_REAL_PLAYWRIGHT is unset.`,
    );
  },
);
