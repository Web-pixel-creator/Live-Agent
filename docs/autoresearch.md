# Autoresearch Integration

This repo now includes a repo-owned adaptation of [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

We did **not** import the Python training loop into production runtime. The useful part for this project is the experiment contract:

1. one narrow target at a time
2. fixed validation budget
3. one objective metric
4. explicit keep/discard/crash decision
5. results recorded as evidence

## What was integrated

- `scripts/autoresearch-harness.mjs`
  - generic experiment runner for this TypeScript/Node repo
- `configs/autoresearch/runtime-perf.json`
  - a ready profile that optimizes runtime speed against `artifacts/perf-load/summary.json`
- `configs/autoresearch/runtime-perf.program.md`
  - human/agent operating guide for the runtime-perf loop

## Why this fits our project

`autoresearch` is strong because it keeps the editable surface tiny and the acceptance rule objective. That maps well to our existing evidence lanes:

- `artifacts/perf-load/summary.json`
- `artifacts/demo-e2e/policy-check.json`
- `artifacts/release-evidence/report.json`
- `artifacts/judge-visual-evidence/manifest.json`

For this platform, the best initial use is **runtime/perf tuning**, not autonomous visual design. UI/UX still benefits from human review and screenshot-based judgment even when the implementation loop is agent-assisted.

## Runtime-perf profile

The included profile measures:

- objective metric: `live_voice_translation.p95`
- source artifact: `artifacts/perf-load/summary.json`
- objective: `minimize`

Guardrails:

- `aggregate.errorRatePct <= 0`
- `ui_navigation_execution.adapterModes.remote_http >= 1`
- `gateway_ws_request_replay.contract.responseIdReusedAll == true`
- `gateway_ws_request_replay.contract.taskStartedExactlyOneAll == true`

## How to run

Start the local stack that `perf:profile` needs, then run:

```bash
npm run autoresearch:runtime-perf -- --description baseline
```

Subsequent candidate run:

```bash
npm run autoresearch:runtime-perf -- --description "reduce gateway replay overhead"
```

Outputs:

- `artifacts/autoresearch/runtime-perf/results.tsv`
- `artifacts/autoresearch/runtime-perf/run.log`
- `artifacts/autoresearch/runtime-perf/last-run.json`

The harness appends one row per experiment and classifies it as:

- `keep`
- `discard`
- `crash`

## Decision model

- `baseline`: first successful guarded run
- `keep`: objective metric improved and all guardrails passed
- `discard`: run succeeded but did not improve or violated guardrails
- `crash`: command failed, timed out, or metric artifact could not be read

## Limits

- This is intentionally **not** a fully autonomous forever-loop.
- Git reset/revert is **not** automatic.
- The harness is safe-by-default: it reports the decision, logs the result, and leaves the branch decision to the operator/agent.

That keeps the spirit of `autoresearch` while matching this repo's production and evidence constraints.
