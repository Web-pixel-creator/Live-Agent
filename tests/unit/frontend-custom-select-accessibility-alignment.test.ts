import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend custom dropdowns support keyboard-first accessibility controls", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function createCustomSelect(select) {",
    "const getEnabledOptionButtons = () =>",
    "const focusCustomSelectOptionByIndex = (index) => {",
    "const focusCustomSelectOptionByOffset = (currentOption, offset) => {",
    "const focusSelectedCustomSelectOption = (fallbackEdge = \"start\") => {",
    "const closeCustomSelectMenu = (restoreTriggerFocus = false) => {",
    "const openCustomSelectMenu = (focusEdge = \"start\") => {",
    "if (event.key === \"ArrowDown\") {",
    "if (event.key === \"ArrowUp\") {",
    "if (event.key === \"Home\") {",
    "if (event.key === \"End\") {",
    "if (event.key === \"Escape\") {",
    "if (event.key === \"Tab\") {",
    "focusCustomSelectOptionByOffset(optionButton, 1);",
    "focusCustomSelectOptionByOffset(optionButton, -1);",
    "openCustomSelectMenu(\"end\");",
    "closeCustomSelectMenu(true);",
  ];

  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing custom select accessibility token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Custom dropdown controls support keyboard navigation"),
    "README missing keyboard-accessibility guidance for custom dropdown controls",
  );

  assert.ok(
    operatorGuideSource.includes("Custom dropdown controls support keyboard navigation"),
    "operator guide missing keyboard-accessibility guidance for custom dropdown controls",
  );
});
