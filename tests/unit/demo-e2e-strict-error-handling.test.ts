import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e avoids direct Exception.Response access under strict mode", () => {
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const source = readFileSync(demoPath, "utf8");

  assert.match(source, /function\s+Get-ExceptionPropertyValue\s*\{/);
  assert.match(
    source,
    /Get-ExceptionPropertyValue\s+-Exception\s+\$_\.Exception\s+-Name\s+"Response"/,
  );
  assert.match(
    source,
    /Get-ExceptionPropertyValue\s+-Exception\s+\$ErrorRecord\.Exception\s+-Name\s+"Response"/,
  );
  assert.doesNotMatch(source, /\.Exception\.Response\b/);
});
