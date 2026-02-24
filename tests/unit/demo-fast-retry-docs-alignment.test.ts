import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo fast retry alias is documented in README and runbook", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const readmePath = resolve(process.cwd(), "README.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");

  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
  const readmeSource = readFileSync(readmePath, "utf8");
  const runbookSource = readFileSync(runbookPath, "utf8");

  const alias = "demo:e2e:fast:retry";
  assert.ok(pkg.scripts && typeof pkg.scripts[alias] === "string", `package.json missing script alias ${alias}`);
  assert.ok(
    pkg.scripts![alias].includes("release-readiness.ps1"),
    "demo:e2e:fast:retry should be implemented via release-readiness retry harness",
  );

  assert.ok(readmeSource.includes("npm run demo:e2e:fast:retry"), "README missing demo fast retry command");
  assert.ok(
    runbookSource.includes("npm run demo:e2e:fast:retry"),
    "challenge runbook missing demo fast retry command",
  );
});
