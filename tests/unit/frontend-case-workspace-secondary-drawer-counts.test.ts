import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("secondary case workspace drawers surface waiting counts without noisy zero states", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function formatCaseWorkspaceDrawerCountPill(text, count)",
    "return `${text} ${total}`;",
    "caseDrawerMainOwned ? formatCaseWorkspaceDrawerCountPill(casePathCopy.laterChip, caseLaterVisibleCount) : caseDrawerCopy?.chip || \"\"",
    "resultDrawerMainOwned ? formatCaseWorkspaceDrawerCountPill(resultPathCopy.laterChip, resultLaterVisibleCount) : resultDrawerCopy?.chip || \"\"",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing secondary-drawer count token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("show how many later moves or verified history entries are waiting")
      && readmeSource.includes("stay quiet instead of showing `0`"),
    "README should describe count-aware secondary drawer chips",
  );
  assert.ok(
    operatorGuideSource.includes("show how many later moves or verified history entries are waiting")
      && operatorGuideSource.includes("stay quiet instead of showing `0`"),
    "operator guide should describe count-aware secondary drawer chips",
  );
});
