import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("local release artifact revalidation script is exposed via npm alias", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const pkgRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };

  const alias = pkg.scripts?.["verify:release:artifact:revalidate"] ?? "";
  assert.match(alias, /release-artifact-revalidate\.ps1/);
});

test("local release artifact revalidation script keeps expected source and gate defaults", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-artifact-revalidate.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /\$env:GITHUB_TOKEN/);
  assert.match(source, /\$env:GH_TOKEN/);
  assert.match(source, /demo-e2e\.yml/);
  assert.match(source, /release-strict-final\.yml/);
  assert.match(source, /release-strict-final-artifacts/);
  assert.match(source, /demo-e2e-artifacts/);
  assert.match(source, /pr-quality-artifacts/);
  assert.match(source, /npm run verify:release:artifact-only/);
});
