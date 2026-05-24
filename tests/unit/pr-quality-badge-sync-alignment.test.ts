import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("pr-quality uses release-readiness with public badge sync disabled", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "pr-quality.ps1"), "utf8");

  assert.match(source, /SkipPerfLoad\s*=\s*\$true/);
  assert.match(source, /UseFastDemoE2E\s*=\s*\$true/);
  assert.match(source, /SkipPublicBadgeSync\s*=\s*\$true/);
});

test("pr-quality forwards SkipPromptfooRedTeam switch to release-readiness", () => {
  // Operator-facing escape hatch: -SkipPromptfooRedTeam on `npm run verify:pr`
  // must propagate through pr-quality.ps1 into release-readiness.ps1's same-
  // named switch so the red-team gate can be skipped on environments that
  // legitimately cannot run promptfoo (no Gemini key, no fallback fixture,
  // explicit operator opt-out).
  const source = readFileSync(resolve(process.cwd(), "scripts", "pr-quality.ps1"), "utf8");

  assert.match(source, /\[switch\]\$SkipPromptfooRedTeam/);
  assert.match(
    source,
    /if\s*\(\$SkipPromptfooRedTeam\)\s*{\s*\$params\.SkipPromptfooRedTeam\s*=\s*\$true\s*}/,
  );
});

test("pr-quality stages a repo-owned promptfoo red-team fallback summary when no Gemini key is available", () => {
  // When neither the operator passed -SkipPromptfooRedTeam, nor a Gemini /
  // Google API key is present in env, nor a real artifacts/evals/latest-run.json
  // already exists, pr-quality.ps1 must stage the repo-owned fallback summary
  // at configs/evals/promptfoo/red-team-fallback-summary.json into
  // artifacts/evals/latest-run.json so release-readiness's
  // Assert-PromptfooRedTeamSummary can validate it. release-strict-final.yml
  // and railway-deploy-api.yml wire the secret in their job env, so on those
  // lanes a real promptfoo eval still runs and overwrites the fallback before
  // validation; PR-quality is the ONLY lane that can land on the fallback.
  const source = readFileSync(resolve(process.cwd(), "scripts", "pr-quality.ps1"), "utf8");

  assert.match(source, /promptfooFallbackSourcePath/);
  assert.match(
    source,
    /configs\\evals\\promptfoo\\red-team-fallback-summary\.json/,
  );
  assert.match(source, /artifacts\\evals\\latest-run\.json/);
  assert.match(source, /Test-PrQualityHasPromptfooApiKey/);
  assert.match(source, /GEMINI_API_KEY/);
  assert.match(source, /GOOGLE_API_KEY/);
  assert.match(source, /GOOGLE_GENERATIVE_AI_API_KEY/);
  assert.match(source, /GOOGLE_GENAI_API_KEY/);

  // The fixture file itself MUST exist, MUST parse as a non-dry-run summary,
  // and MUST contain a passing red-team suite so
  // Assert-PromptfooRedTeamSummary in release-readiness.ps1 succeeds.
  const fixturePath = resolve(
    process.cwd(),
    "configs",
    "evals",
    "promptfoo",
    "red-team-fallback-summary.json",
  );
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    dryRun?: boolean;
    fallbackFixture?: boolean;
    suites?: Array<{
      id?: string;
      name?: string;
      passed?: boolean;
      exitCode?: number;
      dryRun?: boolean;
    }>;
  };
  assert.equal(fixture.dryRun, false, "fallback fixture must not be flagged as a dry-run");
  assert.equal(
    fixture.fallbackFixture,
    true,
    "fallback fixture must self-identify via fallbackFixture=true so log readers can distinguish it from a real eval",
  );
  const redTeam = (fixture.suites ?? []).find((suite) => suite.id === "red-team");
  assert.ok(redTeam, "fallback fixture must contain a suite with id='red-team'");
  assert.equal(redTeam!.passed, true);
  assert.equal(redTeam!.exitCode, 0);
  assert.notEqual(redTeam!.dryRun, true);
  assert.match(
    redTeam!.name ?? "",
    /fallback/i,
    "fallback fixture suite name must include 'fallback' so judge logs distinguish it from a real eval",
  );
});

test("pr-quality workflow wires Gemini and Google API keys into the gate env", () => {
  // pr-quality.yml must propagate GEMINI_API_KEY and GOOGLE_API_KEY from repo
  // secrets into the job env so the red-team gate inside `verify:pr` can
  // generate a real promptfoo summary, symmetrically to what
  // release-strict-final.yml and railway-deploy-api.yml already do. When the
  // secret is absent (e.g. fork PRs), the fallback fixture path in
  // pr-quality.ps1 keeps the gate deterministic.
  const workflow = readFileSync(
    resolve(process.cwd(), ".github", "workflows", "pr-quality.yml"),
    "utf8",
  );

  assert.match(workflow, /GEMINI_API_KEY:\s*\$\{\{\s*secrets\.GEMINI_API_KEY\s*\}\}/);
  assert.match(workflow, /GOOGLE_API_KEY:\s*\$\{\{\s*secrets\.GOOGLE_API_KEY\s*\}\}/);
});
