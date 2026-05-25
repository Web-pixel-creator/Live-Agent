# demo-e2e-visa-flows-execution-mode-aware-summary Bugfix Design

## Overview

The previous visa-flow fix made the paused-state predicate aware of
`executionMode`. The remaining failure is the summary layer: validation still
assumes the real-Playwright proof shape for every lane.

This follow-up should refactor the summary contract, not hide the failure with
a broad skip. The goal is to let PR Quality validate the simulation lane
honestly while preserving strict real-Playwright evidence for release gates.

## Proposed Contract

Extend `VisaFlowSummary` additively with mode-specific fields:

```ts
type NavigatorVisaFlowValidationMode =
  | "real_playwright"
  | "simulated"
  | "mixed"
  | "unknown";

interface VisaFlowSummary {
  validated: boolean;
  validationMode: NavigatorVisaFlowValidationMode;
  realPlaywrightValidated: boolean;
  simulatedValidated: boolean;
  strictPersistentSessionValidated: boolean;
  executionModeCounts: {
    real_playwright: number;
    simulated: number;
    unknown: number;
  };
}
```

`validated` should mean "the configured scenario validated according to the
declared execution mode." It must not be the only field downstream gates use
when they need strict persistent-session evidence.

## Real-Playwright Criteria

For `validationMode === "real_playwright"`:

```text
validated =
  totalFlows >= 3
  && succeededFlows === totalFlows
  && persistentSessionCount === totalFlows
  && replayBundleCount === totalFlows
  && verifiedCount === totalFlows
  && staleRecoveryObservedCount === totalFlows
  && healedRecoveryObservedCount === totalFlows
  && resumedCheckpointCount === totalFlows
```

This matches the current strict criteria and must remain the release-quality
proof.

## Simulation Criteria

For `validationMode === "simulated"`:

```text
validated =
  totalFlows >= 3
  && succeededFlows === totalFlows
  && every result.executionMode === "simulated"
  && every result.finalStatus === "completed"
  && every result.pausedStatus === "paused"
```

Simulation criteria must not increment `persistentSessionCount` or
`replayBundleCount` by pretending a real browser session existed.

## Mixed Mode

For `validationMode === "mixed"` or `"unknown"`, `validated` should be `false`
until a deliberate mixed-mode contract is designed.

## Downstream Gate Update

Before changing the TypeScript summary, audit every downstream consumer of the
navigator visa-flows artifact:

1. `scripts/demo-e2e.ps1`
2. `scripts/release-readiness.ps1`
3. `tests/unit/release-readiness.test.ts`
4. `tests/unit/release-evidence-report.test.ts`
5. `tests/unit/runbook-release-alignment.test.ts`

PR Quality may accept `validated === true` with
`validationMode === "simulated"` only when the workflow is explicitly a
simulation lane.

Release-strict gates must require either:

1. `validationMode === "real_playwright"`, or
2. `strictPersistentSessionValidated === true`

depending on the local gate style.

## Non-Goals

Do not:

1. skip `ui.navigator.visa_vertical_flows` in release-strict workflows;
2. fake replay bundles or persistent sessions in simulation;
3. weaken real-Playwright assertions;
4. modify local-services dispatcher UI or backend;
5. turn this into a broader immigration Action Desk refactor.

