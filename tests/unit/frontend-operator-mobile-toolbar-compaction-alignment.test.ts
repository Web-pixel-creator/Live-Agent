import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console trims duplicated mobile toolbar controls in favor of the sticky dock", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredStyleTokens = [
    "@media (max-width: 620px) {",
    ".panel-operator-console .operator-toolbar {",
    "grid-template-columns: repeat(2, minmax(0, 1fr));",
    ".panel-operator-console .operator-toolbar .operator-view-mode-actions,",
    ".panel-operator-console .operator-toolbar-cluster-filters {",
    "gap: 6px;",
    ".panel-operator-console .operator-toolbar-cluster-refresh {",
    "justify-self: start;",
    ".panel-operator-console .operator-toolbar #operatorRefreshBtn {",
    "min-width: 148px;",
    ".panel-operator-console .operator-toolbar-cluster-saved,",
    ".panel-operator-console .operator-board-mode-hint {",
    "display: none;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing mobile toolbar compaction token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("hides the duplicated top `Views` cluster"),
    "README missing mobile toolbar compaction note",
  );
  assert.ok(
    readmeSource.includes("shorter operator strip"),
    "README missing mobile toolbar strip note",
  );
  assert.ok(
    operatorGuideSource.includes("hides the duplicated top `Views` cluster"),
    "operator guide missing mobile toolbar compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("shorter operator strip"),
    "operator guide missing mobile toolbar strip note",
  );
});
