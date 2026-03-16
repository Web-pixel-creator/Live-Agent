import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("translation language pickers share one compact desktop row", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const indexPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const stylesSource = readFileSync(stylesPath, "utf8");
  const indexSource = readFileSync(indexPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  assert.ok(
    indexSource.includes('id="translationLanguageRow" class="translation-language-row"'),
    "translation composer should group language pickers inside a dedicated translation-language row",
  );
  assert.ok(
    stylesSource.includes(".panel-live-intent-composer .translation-language-row {\n  grid-column: 1 / -1;\n  display: flex;\n  flex-wrap: nowrap;"),
    "translation composer should keep the language controls in one dedicated horizontal setup row",
  );
  assert.ok(
    stylesSource.includes(".panel-live-intent-composer .translation-language-row .intent-field-language {\n  flex: 1 1 0;\n  width: auto;\n  max-width: none;\n  min-width: 0;"),
    "language fields should flex evenly inside the dedicated translation row",
  );
  assert.ok(
    stylesSource.includes(".panel-live-intent-composer #speechLanguageField {\n  order: -2;") &&
      stylesSource.includes(".panel-live-intent-composer #intentLanguageField {\n  order: -1;"),
    "desktop translation row should place source language before target language",
  );
  assert.ok(
    stylesSource.includes(".panel-live-intent-composer .intent-field-language :is(select, .select-trigger) {\n  min-height: 44px;\n  font-size: 14px;"),
    "language pickers should use compact 14px text in the live composer",
  );
  assert.ok(
    readmeSource.includes("the two language pickers still share one compact row"),
    "README should document the compact desktop language row",
  );
  assert.ok(
    readmeSource.includes("source picker stays on the left and the target picker stays on the right"),
    "README should document the source-left target-right translation order",
  );
  assert.ok(
    operatorGuideSource.includes("the two language pickers still sit in one compact setup row"),
    "operator guide should document the compact desktop language row",
  );
  assert.ok(
    readmeSource.includes("stay together in one row"),
    "README should document that translation pickers stay together in one row",
  );
  assert.ok(
    operatorGuideSource.includes("source on the left, target on the right"),
    "operator guide should document the source-left target-right translation order",
  );
  assert.ok(
    operatorGuideSource.includes("stay together in one row"),
    "operator guide should document that translation pickers stay together in one row",
  );
});
