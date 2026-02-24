import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("artifact JSON writers use UTF-8 no-BOM helpers across release scripts", () => {
  const demoE2eSource = readFileSync(resolve(process.cwd(), "scripts", "demo-e2e.ps1"), "utf8");
  const artifactSmokeSource = readFileSync(
    resolve(process.cwd(), "scripts", "release-artifact-only-smoke.ps1"),
    "utf8",
  );
  const artifactRevalidateSource = readFileSync(
    resolve(process.cwd(), "scripts", "release-artifact-revalidate.ps1"),
    "utf8",
  );

  const requiredNoBomTokens = [
    {
      source: demoE2eSource,
      token: "Write-Utf8NoBomFile -Path $resolvedOutputPath -Content $summaryJson",
      legacy: /Set-Content\s+-Path\s+\$resolvedOutputPath\s+-Encoding\s+UTF8/i,
    },
    {
      source: artifactSmokeSource,
      token: "Write-Utf8NoBomFile -Path $perfSummaryPath -Content $perfSummaryJson",
      legacy: /Set-Content\s+-Path\s+\$perfSummaryPath\s+-Encoding\s+utf8/i,
    },
    {
      source: artifactSmokeSource,
      token: "Write-Utf8NoBomFile -Path $perfPolicyPath -Content $perfPolicyJson",
      legacy: /Set-Content\s+-Path\s+\$perfPolicyPath\s+-Encoding\s+utf8/i,
    },
    {
      source: artifactSmokeSource,
      token: "Write-Utf8NoBomFile -Path $sourceRunManifestPath -Content $sourceRunManifestJson",
      legacy: /Set-Content\s+-Path\s+\$sourceRunManifestPath\s+-Encoding\s+utf8/i,
    },
    {
      source: artifactRevalidateSource,
      token: "Write-Utf8NoBomFile -Path $sourceRunManifestPath -Content $sourceRunManifestJson",
      legacy: /Set-Content\s+-Path\s+\$sourceRunManifestPath\s+-Encoding\s+utf8/i,
    },
  ];

  for (const item of requiredNoBomTokens) {
    assert.ok(item.source.includes(item.token), `missing no-BOM writer token: ${item.token}`);
    assert.doesNotMatch(item.source, item.legacy);
  }
});
