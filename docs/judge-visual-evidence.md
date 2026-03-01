# Judge Visual Evidence Pack

## Purpose

Create one reproducible visual bundle for judges:

1. Screenshot checklist status (present/missing).
2. Critical badge-evidence lane status (`pass/fail/unavailable`).
3. Single manifest for quick go/no-go before submission.

## Commands

Generate pack (non-strict):

```bash
npm run demo:e2e:visual-pack
```

Generate pack in strict mode (fails when required captures or critical badge lanes are missing):

```bash
npm run demo:e2e:visual-pack:strict
```

## Inputs

Defaults used by `scripts/judge-visual-evidence-pack.mjs`:

1. Badge details: `artifacts/demo-e2e/badge-details.json`
2. Demo summary: `artifacts/demo-e2e/summary.json`
3. Screenshot directory: `artifacts/judge-visual-evidence/screenshots`

## Outputs

1. `artifacts/judge-visual-evidence/manifest.json`
2. `artifacts/judge-visual-evidence/manifest.md`

## Required Screenshot Filenames

Put files into `artifacts/judge-visual-evidence/screenshots`:

1. `live-console-main.png`
2. `operator-console-evidence.png`
3. `storyteller-timeline.png`
4. `approval-flow-pending.png`
5. `approval-flow-approved.png`
6. `observability-dashboard.png`
7. `observability-alert-gateway-latency.png`
8. `observability-alert-service-error-rate.png`
9. `observability-alert-orchestrator-persistence.png`

## Critical Badge Lanes

Pack marks these as critical:

1. `operatorTurnTruncation`
2. `operatorTurnDelete`
3. `operatorDamageControl`
4. `governancePolicy`
5. `skillsRegistry`
6. `deviceNodes`
7. `agentUsage`
8. `deviceNodeUpdates` (derived from `deviceNodes` updates fields)
