import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence flips dormant CTA priority after the first refresh", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "const hasManualRefresh = state.operatorSummaryUserRefreshed === true;",
    'kind: hasManualRefresh ? "secondary" : undefined,',
    'kind: hasManualRefresh ? undefined : "secondary",',
    "return hasManualRefresh ? [openAction, seedAction] : [seedAction, openAction];",
    "return hasManualRefresh ? [openAction, hydrateAction] : [hydrateAction, openAction];",
    "return hasManualRefresh ? [openAction, refreshAction] : [refreshAction, openAction];",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-priority token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("flip their primary emphasis after the first refresh"),
    "README should document workspace dormant CTA priority",
  );
  assert.ok(
    operatorGuideSource.includes("flip their primary emphasis after the first refresh"),
    "operator guide should document workspace dormant CTA priority",
  );
});
