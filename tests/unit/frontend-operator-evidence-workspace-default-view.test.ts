import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence picks a smarter first-open tab from the active workspace posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerDefaultView(model) {",
    "const needsRecoveryView =",
    "if (model.activeSavedViewId === \"audit\") {",
    "if (model.activeSavedViewId === \"runtime\") {",
    "return needsRecoveryView ? \"recovery\" : \"trace\";",
    "if (model.activeSavedViewId === \"approvals\") {",
    "return needsRecoveryView ? \"recovery\" : \"latest\";",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-aware default-view token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("first-open `Focused Evidence` tab now follows the active workspace posture"),
    "README should document workspace-aware default focused-evidence tab selection",
  );
  assert.ok(
    operatorGuideSource.includes("first-open `Focused Evidence` tab now follows the active workspace posture"),
    "operator guide should document workspace-aware default focused-evidence tab selection",
  );
});
