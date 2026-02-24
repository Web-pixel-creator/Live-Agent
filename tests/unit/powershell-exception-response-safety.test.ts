import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

function collectPowerShellScripts(root: string): string[] {
  const result: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.toLowerCase().endsWith(".ps1")) {
        result.push(fullPath);
      }
    }
  }

  return result.sort();
}

test("PowerShell scripts avoid direct Exception.Response property access", () => {
  const scriptsRoot = resolve(process.cwd(), "scripts");
  const scripts = collectPowerShellScripts(scriptsRoot);
  const offenders: string[] = [];

  for (const scriptPath of scripts) {
    const source = readFileSync(scriptPath, "utf8");
    if (/\.Exception\.Response\b/.test(source)) {
      offenders.push(relative(process.cwd(), scriptPath));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `direct '.Exception.Response' usage detected in scripts: ${offenders.join(", ")}`,
  );
});
