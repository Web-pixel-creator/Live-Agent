# runtime-perf autoresearch

This repo borrows the core idea from `karpathy/autoresearch`, but adapts it to a TypeScript agent platform instead of a single-file GPU training loop.

## Scope

Only use this program when the goal is to improve runtime speed while preserving release guardrails.

### In-scope files

- One runtime or script file at a time.
- Typical targets:
  - `apps/realtime-gateway/src/*`
  - `agents/orchestrator/src/*`
  - `apps/ui-executor/src/*`
  - `scripts/perf-load.mjs`

### Out-of-scope files

- `scripts/autoresearch-harness.mjs`
- `configs/autoresearch/runtime-perf.json`
- Test files unless the candidate behavior needs a matching contract update

## Objective

Lower `live_voice_translation.p95` from `artifacts/perf-load/summary.json` while preserving:

- `aggregate.errorRatePct <= 0`
- `ui_navigation_execution.adapterModes.remote_http >= 1`
- `gateway_ws_request_replay.contract.responseIdReusedAll == true`
- `gateway_ws_request_replay.contract.taskStartedExactlyOneAll == true`

## Setup

1. Create a dedicated branch such as `codex/autoresearch-runtime-perf-mar9`.
2. Read:
   - `README.md`
   - `docs/autoresearch.md`
   - `configs/autoresearch/runtime-perf.json`
   - the single target file you plan to modify
3. Establish a baseline:

```bash
npm run autoresearch:runtime-perf -- --description baseline
```

## Experiment loop

1. Make one focused change in one target file.
2. Run:

```bash
npm run autoresearch:runtime-perf -- --description "short experiment note"
```

3. Read:
   - `artifacts/autoresearch/runtime-perf/last-run.json`
   - `artifacts/autoresearch/runtime-perf/results.tsv`
4. Keep the change only when status is `keep`.
5. Revert the candidate when status is `discard` or `crash`.

## Rules

- One target file at a time.
- Keep changes additive and reversible.
- Do not move the metric or guardrail goalposts.
- If the metric gain is tiny but the code gets much uglier, discard it anyway.
- UI/UX changes remain human-reviewed; this program is for measurable runtime improvement.
