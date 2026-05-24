# Bugfix Requirements Document

## Introduction

Two unit tests in `tests/unit/release-evidence-report.test.ts` fail on the GitHub Actions
`windows-2025` runner image (observed on image `20260518.141` and confirmed across at least
five consecutive PR Quality runs on branch `codex/runtime-case-wiki-signed-proof`):

1. `release evidence report surfaces hosted direct-live proof in report and manifest`
2. `release evidence report surfaces case wiki runtime-surface ingress in report manifest and runtime proof`

Both tests fail with `AssertionError [ERR_ASSERTION]` on `assert.equal` comparisons of two
filesystem paths that reference the same physical temp directory but are spelled in different
textual forms. One side carries the Windows 8.3 short-path form (e.g. `C:\Users\RUNNER~1\...`),
while the other side carries the long form (e.g. `C:\Users\runneradmin\...`). Node's
`os.tmpdir()` and the underlying Windows runner image disagree about which form to emit, and the
`scripts/release-evidence-report.ps1` PowerShell script normalizes paths through
`[System.IO.Path]::GetFullPath` / `Resolve-Path`, which produces a different textual form than
the form the test fixture constructed with `path.join(tmpdir(), ...)`.

The two paths refer to the same directory; only the spelling differs. The failure is therefore
a textual-comparison regression in the test layer, triggered by an environmental change in the
Windows runner image. It is unrelated to the `dispatcher-flow-connect` product slice.

The fix MUST be additive: it must not weaken assertions, skip tests, or hide the regression on
Linux runners. The test must keep verifying that the report's emitted path identifies the
expected file. After the fix, `npm run test:unit` should pass on the Windows runner image and
remain green on Linux.

Affected assertions are at approximately:

- `tests/unit/release-evidence-report.test.ts:745`
  `assert.equal(report.consultationBookingProof.calendarConnector?.approvedBookingArtifactPath, approvedBookingArtifactPath)`
- `tests/unit/release-evidence-report.test.ts:1456`
  `assert.equal(report.source.runtimeSurfaceSnapshotPath, runtimeSurfaceSnapshotPath)`
  (and the equivalent manifest-side assertion that follows)

## Bug Analysis

### Current Behavior (Defect)

When the Windows runner emits `os.tmpdir()` and the PowerShell script's path-normalization
routines in different short-vs-long-path forms, the test compares the two strings byte-for-byte
and fails even though both paths resolve to the same file on disk.

1.1 WHEN the test runs on a Windows host AND `os.tmpdir()` yields a path containing the 8.3
short-name segment (e.g. `RUNNER~1`) AND the PowerShell script returns the corresponding
long-name form (e.g. `runneradmin`) for the same temp directory THEN the test
`release evidence report surfaces hosted direct-live proof in report and manifest` fails with
`AssertionError` on `assert.equal(report.consultationBookingProof.calendarConnector?.approvedBookingArtifactPath, approvedBookingArtifactPath)`
because the two strings differ textually.

1.2 WHEN the test runs on a Windows host AND `os.tmpdir()` yields a path containing the 8.3
short-name segment AND the PowerShell script returns the corresponding long-name form for the
same temp directory THEN the test
`release evidence report surfaces case wiki runtime-surface ingress in report manifest and runtime proof`
fails with `AssertionError` on
`assert.equal(report.source.runtimeSurfaceSnapshotPath, runtimeSurfaceSnapshotPath)`
(and the manifest-side equivalent) because the two strings differ textually.

### Expected Behavior (Correct)

Path comparisons in these tests SHALL succeed whenever the two compared paths reference the
same physical filesystem entry, regardless of whether one or both spellings use the Windows
8.3 short-name form or the long-name form.

2.1 WHEN the test runs on a Windows host AND the path returned by the script and the path
constructed by the test reference the same physical filesystem entry THEN the assertion in
`release evidence report surfaces hosted direct-live proof in report and manifest` SHALL pass,
even if the two path strings differ only in 8.3 short-name vs long-name spelling.

2.2 WHEN the test runs on a Windows host AND the path returned by the script and the path
constructed by the test reference the same physical filesystem entry THEN the assertions in
`release evidence report surfaces case wiki runtime-surface ingress in report manifest and runtime proof`
SHALL pass, even if the two path strings differ only in 8.3 short-name vs long-name spelling.

### Unchanged Behavior (Regression Prevention)

The fix must not weaken what the tests verify. They must continue to assert that the path
emitted by the script identifies the same file the fixture wrote, that all non-path
assertions in both tests still execute and pass, and that the same tests keep passing on
Linux runners where 8.3 short-path normalization is irrelevant.

3.1 WHEN the test runs on Linux (or any non-Windows host where short-path normalization does
not apply) THEN both tests SHALL CONTINUE TO pass with all existing path and non-path
assertions intact.

3.2 WHEN the test runs on a Windows host AND the script emits a path that does NOT resolve to
the same physical filesystem entry as the fixture-constructed path (e.g. a wrong filename or a
different directory) THEN the test SHALL CONTINUE TO fail, so genuine path-emission regressions
are still detected.

3.3 WHEN any assertion in either test other than the path-equality assertions fires THEN it
SHALL CONTINUE TO be evaluated and reported exactly as today (no test skipping, no test-level
early return, no platform-specific branch that hides failures).

3.4 WHEN the script `scripts/release-evidence-report.ps1` is invoked outside the test
(production/CI release flow) THEN it SHALL CONTINUE TO emit the same canonical-form paths it
emits today; the production output format is not changed by this fix.
