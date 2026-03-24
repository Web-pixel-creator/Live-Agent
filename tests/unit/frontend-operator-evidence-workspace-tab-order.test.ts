import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence reorders its visible tabs by active workspace posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerViewOrder(model) {",
    "return [\"audit\", \"latest\", \"trace\", \"recovery\"];",
    "return needsRecoveryView",
    "[\"trace\", \"recovery\", \"latest\", \"audit\"]",
    "[\"latest\", \"recovery\", \"trace\", \"audit\"]",
    "const viewOrder = resolveOperatorEvidenceDrawerViewOrder({",
    "const viewOrderIndex = new Map(viewOrder.map((viewId, index) => [viewId, index]));",
    "function syncOperatorEvidenceDrawerTabOrder(model) {",
    "el.operatorEvidenceDrawerTabs.append(button);",
    "syncOperatorEvidenceDrawerTabOrder(model);",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-aware tab-order token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("visible `Focused Evidence` tabs now also follow the active workspace posture"),
    "README should document workspace-aware focused evidence tab order",
  );
  assert.ok(
    operatorGuideSource.includes("visible `Focused Evidence` tabs now also follow the active workspace posture"),
    "operator guide should document workspace-aware focused evidence tab order",
  );
});
