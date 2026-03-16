import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console prioritizes fail/watch/stale lanes before nominal groups", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "const OPERATOR_GROUP_BASE_ORDER = Object.freeze({",
    "function getOperatorGroupPriorityMeta(group) {",
    "function syncOperatorGroupPriorities() {",
    "meta.group.dataset.operatorGroupState = meta.stateLabel;",
    "meta.group.style.order = String(meta.priorityBucket * 10 + meta.baseOrder);",
    "const highPriority = metas.filter((meta) => meta.stateLabel === \"fail\" || meta.stateLabel === \"watch\");",
    "const stalePriority = metas.filter((meta) => meta.stateLabel === \"stale\");",
    "syncOperatorGroupPriorities();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-group-priority token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-health-group[data-operator-group-state=\"fail\"] {",
    ".operator-health-group[data-operator-group-state=\"watch\"] {",
    ".operator-health-group[data-operator-group-state=\"stale\"] {",
    ".operator-health-group[data-operator-group-state=\"ok\"] {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-group-priority token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("floats `fail` / `watch` / `stale` lanes above nominal ones"),
    "README missing operator lane-priority note",
  );
  assert.ok(
    operatorGuideSource.includes("floats `fail` / `watch` / `stale` lanes above nominal ones"),
    "operator guide missing operator lane-priority note",
  );
});
