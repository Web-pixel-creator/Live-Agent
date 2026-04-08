import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const workflowDir = resolve(process.cwd(), ".github", "workflows");
const node24OptIn = /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*"true"/;
const javascriptActionPattern =
  /actions\/checkout@v5|actions\/setup-node@v5|actions\/upload-artifact@v6|actions\/github-script@v8/;
const deprecatedActionPattern =
  /actions\/checkout@v4|actions\/setup-node@v4|actions\/upload-artifact@v4|actions\/github-script@v7/;

test("workflow jobs opt JavaScript actions into Node 24 runtime", () => {
  const workflowFiles = readdirSync(workflowDir).filter((entry) => entry.endsWith(".yml"));

  for (const workflowFile of workflowFiles) {
    const workflowPath = resolve(workflowDir, workflowFile);
    const source = readFileSync(workflowPath, "utf8");

    if (javascriptActionPattern.test(source)) {
      assert.match(
        source,
        node24OptIn,
        `${workflowFile} must set FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true for JavaScript-based actions`
      );
    }

    assert.doesNotMatch(
      source,
      deprecatedActionPattern,
      `${workflowFile} must not pin deprecated Node 20-era JavaScript action majors`
    );
  }
});

test("readme documents repo-wide Node 24 JavaScript actions posture", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");

  assert.match(readme, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true/);
  assert.match(readme, /actions\/checkout@v5/);
  assert.match(readme, /actions\/setup-node@v5/);
  assert.match(readme, /actions\/upload-artifact@v6/);
  assert.match(readme, /actions\/github-script@v8/);
  assert.match(readme, /Node 24-compatible action majors/i);
  assert.match(readme, /Node 20 deprecation window/i);
});
