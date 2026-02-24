import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release script aliases stay aligned with release-readiness flags", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const pkgRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };

  const strictScript = pkg.scripts?.["verify:release:strict"] ?? "";
  const strictSkipPerfRunScript = pkg.scripts?.["verify:release:strict:skip-perf-run"] ?? "";
  const artifactOnlyScript = pkg.scripts?.["verify:release:artifact-only"] ?? "";
  const artifactOnlySmokeScript = pkg.scripts?.["verify:release:artifact-only:smoke"] ?? "";
  const artifactOnlySmokeStrictScript = pkg.scripts?.["verify:release:artifact-only:smoke:strict"] ?? "";
  const artifactOnlySmokeKeepTempScript = pkg.scripts?.["verify:release:artifact-only:smoke:keep-temp"] ?? "";
  const demoFastRetryScript = pkg.scripts?.["demo:e2e:fast:retry"] ?? "";

  assert.match(strictScript, /release-readiness\.ps1/);
  assert.match(strictScript, /-StrictFinalRun/);

  assert.match(strictSkipPerfRunScript, /release-readiness\.ps1/);
  assert.match(strictSkipPerfRunScript, /-StrictFinalRun/);
  assert.match(strictSkipPerfRunScript, /-SkipPerfRun/);

  assert.match(artifactOnlyScript, /release-readiness\.ps1/);
  assert.match(artifactOnlyScript, /-SkipBuild/);
  assert.match(artifactOnlyScript, /-SkipUnitTests/);
  assert.match(artifactOnlyScript, /-SkipMonitoringTemplates/);
  assert.match(artifactOnlyScript, /-SkipProfileSmoke/);
  assert.match(artifactOnlyScript, /-SkipDemoE2E/);
  assert.match(artifactOnlyScript, /-SkipPolicy/);
  assert.match(artifactOnlyScript, /-SkipBadge/);
  assert.match(artifactOnlyScript, /-SkipPerfRun/);

  assert.match(artifactOnlySmokeScript, /release-artifact-only-smoke\.ps1/);

  assert.match(artifactOnlySmokeStrictScript, /release-artifact-only-smoke\.ps1/);
  assert.match(artifactOnlySmokeStrictScript, /-StrictFinalRun/);

  assert.match(artifactOnlySmokeKeepTempScript, /release-artifact-only-smoke\.ps1/);
  assert.match(artifactOnlySmokeKeepTempScript, /-KeepTemp/);

  assert.match(demoFastRetryScript, /release-readiness\.ps1/);
  assert.match(demoFastRetryScript, /-SkipBuild/);
  assert.match(demoFastRetryScript, /-SkipUnitTests/);
  assert.match(demoFastRetryScript, /-SkipMonitoringTemplates/);
  assert.match(demoFastRetryScript, /-SkipProfileSmoke/);
  assert.match(demoFastRetryScript, /-SkipPolicy/);
  assert.match(demoFastRetryScript, /-SkipBadge/);
  assert.match(demoFastRetryScript, /-SkipPerfLoad/);
  assert.match(demoFastRetryScript, /-UseFastDemoE2E/);
});
