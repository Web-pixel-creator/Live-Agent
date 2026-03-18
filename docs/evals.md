# Eval Plane

The repo now has a promptfoo-based eval scaffold for the product wedge:

- translation
- negotiation
- research
- UI safety
- red-team scenarios

## Commands

- `npm run eval:promptfoo`
- `npm run eval:promptfoo:translation`
- `npm run eval:promptfoo:negotiation`
- `npm run eval:promptfoo:research`
- `npm run eval:promptfoo:ui-safety`
- `npm run eval:promptfoo:red-team`
- `npm run eval:promptfoo:gate`

## Key Files

- `configs/evals/eval-manifest.json`
- `configs/evals/promptfoo/translation.promptfooconfig.yaml`
- `configs/evals/promptfoo/negotiation.promptfooconfig.yaml`
- `configs/evals/promptfoo/research.promptfooconfig.yaml`
- `configs/evals/promptfoo/ui-safety.promptfooconfig.yaml`
- `configs/evals/promptfoo/red-team.promptfooconfig.yaml`
- `scripts/eval-plane.mjs`

## Key Behaviors

- `GEMINI_API_KEY` is mirrored to `GOOGLE_API_KEY` by the eval runner when
  needed so Promptfoo can use the Google provider.
- All suites run against both `google:gemini-2.5-flash` and
  `google:gemini-2.5-pro` to keep a simple model-comparison lane.
- The runner writes a machine-readable run summary to
  `artifacts/evals/latest-run.json`.

## Release Gate

`npm run eval:promptfoo:gate` is the release-facing entry point. It fails if any
suite exits non-zero, so regressions can be caught before release.

`npm run verify:release` also validates Promptfoo red-team proof. The release
gate accepts either:

- a fresh `npm run eval:promptfoo:red-team` run when `GEMINI_API_KEY` or
  `GOOGLE_API_KEY` is available, or
- an existing non-dry-run `artifacts/evals/latest-run.json` that contains a
  passing `red-team` suite result.

Dry-run eval artifacts are not accepted as release proof.
