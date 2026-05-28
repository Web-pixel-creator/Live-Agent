# release-evidence-report-windows-shortpath Bugfix Design

## Overview

Two unit tests in `tests/unit/release-evidence-report.test.ts` fail on the GitHub Actions
`windows-2025` runner image because `os.tmpdir()` and the script
`scripts/release-evidence-report.ps1` agree on the *physical* directory but disagree on its
*spelling* (Windows 8.3 short-name form `RUNNER~1` vs long form `runneradmin`). The fix is
purely in the test layer: normalize both sides of each path comparison through
`fs.realpathSync`, which collapses any 8.3 short-path / long-path spelling variant to one
canonical form on Windows and is a no-op for symlink-free paths on Linux. The production script
is not touched and continues to emit the same canonical-form paths it emits today.

## Glossary

- **Bug_Condition (C)**: Two textually different path strings that resolve to the same physical
  filesystem entry are compared with `assert.equal` and the test fails.
- **Property (P)**: After the fix, two paths that resolve to the same physical filesystem entry
  compare equal; two paths that resolve to different entries (or fail to resolve) still fail
  the assertion.
- **Preservation**: All other assertions in the two affected tests, all assertions in all
  other tests, the production script's output format, and Linux behavior remain unchanged.
- **8.3 short path**: Legacy Windows path form (e.g. `C:\Users\RUNNER~1\AppData\Local\Temp`)
  that aliases the long form (e.g. `C:\Users\runneradmin\AppData\Local\Temp`).
- **`fs.realpathSync(p)`**: Node API that returns the canonical absolute path for `p`; on
  Windows this also collapses 8.3 short names to long names.
- **`assertSamePath(actual, expected, label?)`**: New local test helper that wraps
  `fs.realpathSync` on both sides and surfaces a readable failure message if either path is
  missing.

## Bug Details

### Bug Condition

The bug manifests when a test compares two path strings via `assert.equal` and the two strings
refer to the same physical filesystem entry but use different Windows path spellings (one in
8.3 short-name form, the other in long-name form). The textual comparison rejects them as
unequal even though the filesystem treats them as the same file.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { actualPath: string, expectedPath: string }
  OUTPUT: boolean

  RETURN actualPath != expectedPath                                      // textually different
         AND fs.realpathSync(actualPath) == fs.realpathSync(expectedPath) // same physical entry
END FUNCTION
```

### Examples

- `actual = "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\foo\\artifact.json"`,
  `expected = "C:\\Users\\runneradmin\\AppData\\Local\\Temp\\foo\\artifact.json"` — same file,
  textual `assert.equal` fails. Bug.
- `actual = "/tmp/xyz/foo/artifact.json"`, `expected = "/tmp/xyz/foo/artifact.json"` (Linux) —
  identical strings, `assert.equal` passes. Not bug.
- `actual = "C:\\Users\\runneradmin\\AppData\\Local\\Temp\\foo\\WRONG.json"`,
  `expected = "C:\\Users\\runneradmin\\AppData\\Local\\Temp\\foo\\artifact.json"` — different
  files, `assert.equal` fails. Not bug; this is a legitimate failure that must keep failing
  after the fix.
- `actual = "C:\\does\\not\\exist\\artifact.json"`, `expected = "<long form temp>"` — different
  files (one missing), assertion must still fail.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All non-path assertions in the two affected tests (status, summary, KPI, structural fields)
  fire and pass exactly as today.
- All assertions in all other tests in `tests/unit/release-evidence-report.test.ts` and the
  rest of the suite are unaffected.
- The production script `scripts/release-evidence-report.ps1` is not modified; its emitted
  path format on the canonical release path is unchanged.
- Linux behavior of the two affected tests is unchanged (`fs.realpathSync` is a no-op for
  symlink-free paths).
- Genuine path regressions (wrong filename, wrong directory, missing file) still cause the
  affected assertions to fail.

**Scope:**
All inputs that do NOT trigger the bug condition pass through unaffected:
- Linux paths (no 8.3 short-name aliasing exists on POSIX).
- Windows paths where both sides already share the same spelling.
- Path comparisons in any other test file.
- Non-path assertions in the affected tests.

## Hypothesized Root Cause

Based on the bug description in `bugfix.md`, the most likely issue is well-understood and
single-cause:

1. **Textual path comparison on Windows**: `assert.equal(string, string)` compares byte-for-byte.
   When `os.tmpdir()` (Node) and the PowerShell script's path-normalization routines
   (`Resolve-Path`, `[System.IO.Path]::GetFullPath`) emit the same physical directory in
   different short-vs-long spellings, the textual comparison fails.

2. **Asymmetric source of paths**: The test fixture builds `expected` via `path.join(os.tmpdir(), ...)`
   on the Node side, while `actual` flows through the PowerShell script and back through JSON.
   Each pipeline can independently choose 8.3 short or long form depending on what the runner
   image returns from environment variables (`%TEMP%`, `%USERPROFILE%`).

3. **Runner image change**: The `windows-2025` image (observed `20260518.141`) increased the
   probability of 8.3 short-path leakage in `os.tmpdir()` (`RUNNER~1` segment), which is what
   exposed the latent textual-comparison fragility.

The fix is independent of which side leaks the short form, because canonicalizing both sides
collapses any short/long divergence to a single form before comparison.

## Correctness Properties

Property 1: Bug Condition - Same-File Path Comparison Succeeds Across 8.3 Short-Path Spelling

_For any_ pair of path strings `(actual, expected)` where both paths reference the same
physical filesystem entry on a Windows host (one in 8.3 short-name form, the other in long
form, or any mix), the fixed test assertion strategy SHALL succeed.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Different-File Path Comparison Still Fails; Other Behavior Unchanged

_For any_ pair of path strings `(actual, expected)` that do NOT reference the same physical
filesystem entry (different filenames, different directories, missing files, or any case where
canonical resolution differs or fails), and for any path comparison on Linux, the fixed test
assertion strategy SHALL produce the same result as the original `assert.equal` strategy: it
fails when the paths denote different entries and passes when they denote the same entry. The
fix MUST NOT weaken what the test verifies.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct, the fix is a localized change in one test file.

**File**: `tests/unit/release-evidence-report.test.ts`

**Specific Changes**:

1. **Add a local helper at the top of the test file** (not exported, scoped to this file):
   `assertSamePath(actual: string, expected: string, label?: string): void`. It calls
   `fs.realpathSync` on both sides and `assert.equal`s the results. If either path does not
   exist, it surfaces a readable error including `label`.

2. **Replace the path-equality assertion at line 745**: change
   `assert.equal(report.consultationBookingProof.calendarConnector?.approvedBookingArtifactPath, approvedBookingArtifactPath)`
   to use `assertSamePath(...)`. Surrounding non-path assertions are untouched.

3. **Replace the path-equality assertion at line 1456**: change
   `assert.equal(report.source.runtimeSurfaceSnapshotPath, runtimeSurfaceSnapshotPath)` to
   use `assertSamePath(...)`. Surrounding non-path assertions are untouched.

4. **Replace the manifest-side path-equality assertion at approximately line 1492**: change
   `assert.equal(manifest.source.runtimeSurfaceSnapshotPath, runtimeSurfaceSnapshotPath)` to
   use `assertSamePath(...)`. Surrounding non-path assertions are untouched.

5. **Add the exploratory PBT** described in the Testing Strategy below as a new `test()` block
   in the same file. The PBT skips on non-Windows hosts.

The production script `scripts/release-evidence-report.ps1` is NOT modified. No other tests
are modified. No platform-specific branching is added inside any assertion.

## Components and Interfaces

- `tests/unit/release-evidence-report.test.ts` — three assertion replacements at approximately
  lines 745, 1456, and 1492 (manifest-side); one new helper; one new exploratory PBT block.
- `assertSamePath(actual: string, expected: string, label?: string): void` — local helper in
  the same test file, NOT exported.
- New `test()` block in the same file:
  `release evidence report path-equality assertion strategy survives Windows 8.3 short-path mismatch (exploratory PBT)`.

## Testing Strategy

### Validation Approach

Two phases. First, surface a deterministic counterexample on the unfixed assertion strategy
to confirm the root cause. Second, verify the fixed strategy passes for same-file pairs and
still fails for different-file pairs, on both Windows and Linux.

### Exploratory Bug Condition Checking

**Goal**: Reproduce the bug deterministically without depending on GitHub Actions runner image
specifics, and confirm the root cause is 8.3 short-path vs long-path spelling.

**Test Plan**: A new exploratory PBT block in the same test file. It skips on non-Windows
hosts (`process.platform !== "win32"`). On Windows it does:

1. Create a real temp directory with `fs.mkdtempSync(path.join(os.tmpdir(), "shortpath-pbt-"))`.
2. Compute the 8.3 short-path form of that directory by invoking
   `child_process.execSync('cmd /c for %A in ("<longPath>") do @echo %~sA', { encoding: "utf8" })`
   and trimming the result. Properly quote the long path.
3. Assert the two forms are textually different (precondition: the runner actually generates
   distinct short/long forms; if the platform returned the same string for both, skip the
   assertion comparison phase with a clear `console.warn` because the bug condition cannot be
   exercised on this filesystem).
4. Verify `fs.realpathSync(shortForm)` and `fs.realpathSync(longForm)` return the same string
   (proves they reference the same physical entry).
5. Show that the OLD strategy (`assert.equal(shortForm, longForm)`) throws `AssertionError`,
   demonstrating the bug.
6. Show that the NEW strategy (`assertSamePath(shortForm, longForm)`) does NOT throw,
   demonstrating the fix.

The PBT uses `fast-check` (already used elsewhere in the suite if available; otherwise a small
hand-rolled generator) to vary the temp directory name across runs, ensuring the property
holds across many distinct paths, not just one.

**Expected Counterexamples (on UNFIXED code)**:
- `assert.equal(shortForm, longForm)` throws because the strings differ textually.
- Root cause confirmed: textual comparison cannot see Windows path-spelling aliases.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed assertion
strategy succeeds.

**Pseudocode:**
```
FOR ALL (actual, expected) WHERE isBugCondition({ actualPath: actual, expectedPath: expected }) DO
  ASSERT assertSamePath(actual, expected) does not throw
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed strategy
produces the same outcome as the original `assert.equal` strategy.

**Pseudocode:**
```
FOR ALL (actual, expected) WHERE NOT isBugCondition({ actualPath: actual, expectedPath: expected }) DO
  oldOutcome := outcomeOf(assert.equal(actual, expected))      // pass or AssertionError
  newOutcome := outcomeOf(assertSamePath(actual, expected))     // pass or AssertionError
  ASSERT oldOutcome.kind == newOutcome.kind
END FOR
```

**Testing Approach**: Property-based testing is appropriate for preservation because the
non-bug input domain is large (Linux paths, Windows paths with matching spellings, paths to
different files, missing paths). PBT samples this domain broadly and catches edge cases that
hand-written unit tests would miss.

**Test Cases**:
1. **Linux Path Preservation**: On Linux, run the existing two affected tests; assert all
   path-equality assertions still pass.
2. **Different-File Path Failure Preservation**: Inject a wrong filename into the path the
   script returns and assert that `assertSamePath` throws (PBT).
3. **Missing File Failure Preservation**: Pass a path that does not exist; assert that
   `assertSamePath` throws with a readable message including the `label`.
4. **Non-Path Assertion Preservation**: All non-path assertions in both affected tests
   continue to fire and pass after the fix (verified by running the full test file).

### Unit Tests

- The two existing affected tests at lines 745 and 1456 (and the manifest-side assertion at
  ~1492) keep their full assertion bodies; only the three path-equality calls switch from
  `assert.equal` to `assertSamePath`.
- New unit tests for `assertSamePath`: same-string inputs pass; different existing files fail;
  missing path produces a readable error including `label`.

### Property-Based Tests

- The exploratory PBT described above (Windows-only, skips elsewhere).
- A small fast-check-driven preservation property: for randomly generated `(p1, p2)` pairs
  where both are written real files with distinct contents, `assertSamePath(p1, p2)` throws
  whenever `p1 !== p2` after canonical resolution.

### Integration Tests

- Re-run `npm run test:unit` locally on Windows (if available) or rely on the `pr-quality`
  GitHub Actions workflow on the `windows-2025` runner image as the integration check.
- Re-run `npm run test:unit` on Linux to confirm zero regression.
- Confirm the `pr-quality` workflow goes green for both `release evidence report surfaces
  hosted direct-live proof in report and manifest` and `release evidence report surfaces case
  wiki runtime-surface ingress in report manifest and runtime proof` after pushing the fix.

## Out of Scope

- No changes to `scripts/release-evidence-report.ps1` or the production canonical path output
  format.
- No changes to release KPI gates or to `.github/workflows/release-strict-final.yml`.
- No changes to any other test file.
- No platform-specific assertion bifurcation that would hide the regression on Linux or on
  future runner images.
- No skipping of the affected tests on Windows; the fix must make them pass on both platforms.
