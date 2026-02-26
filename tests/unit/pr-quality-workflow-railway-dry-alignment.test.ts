import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("pr-quality workflow runs railway deploy dry contracts before main gate", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "pr-quality.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*PR Quality Gate/);
  assert.match(source, /- name:\s*Run Railway Deploy Dry Contracts/);
  assert.match(source, /run:\s*npm run verify:deploy:railway:dry/);
  assert.match(source, /- name:\s*Run PR Quality Gate/);
  assert.match(source, /run:\s*npm run verify:pr/);

  const dryIndex = source.indexOf("run: npm run verify:deploy:railway:dry");
  const prIndex = source.indexOf("run: npm run verify:pr");
  assert.ok(dryIndex >= 0, "Missing dry deploy gate command");
  assert.ok(prIndex >= 0, "Missing main PR gate command");
  assert.ok(dryIndex < prIndex, "Dry deploy gate must execute before main PR gate");
});

test("readme documents railway dry deploy gate in PR workflow", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /verify:deploy:railway:dry/);
  assert.match(readme, /before `npm run verify:pr`/);
});
