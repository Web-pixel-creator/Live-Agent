import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e writes summary.json as UTF-8 without BOM", () => {
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const source = readFileSync(demoPath, "utf8");

  assert.match(source, /function\s+Write-Utf8NoBomFile\s*\{/);
  assert.match(source, /New-Object\s+System\.Text\.UTF8Encoding\(\$false\)/);
  assert.match(source, /\[System\.IO\.File\]::WriteAllText\(\$Path,\s*\$Content,\s*\$encoding\)/);
  assert.match(source, /Write-Utf8NoBomFile\s+-Path\s+\$resolvedOutputPath\s+-Content\s+\$summaryJson/);
  assert.doesNotMatch(source, /Set-Content\s+-Path\s+\$resolvedOutputPath\s+-Encoding\s+UTF8/i);
});
