import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend custom dropdowns keep keyboard and screen-reader accessibility controls", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "const CUSTOM_SELECT_EXCLUDE_IDS = new Set();",
    "let customSelectObserver = null;",
    "function createCustomSelect(select) {",
    "select.setAttribute(\"aria-hidden\", \"true\");",
    "select.tabIndex = -1;",
    "select.addEventListener(\"mousedown\", (event) => {",
    "event.preventDefault();",
    "trigger.setAttribute(\"role\", \"combobox\");",
    "trigger.setAttribute(\"aria-haspopup\", \"listbox\");",
    "trigger.setAttribute(\"aria-autocomplete\", \"none\");",
    "trigger.setAttribute(\"aria-controls\", menuId);",
    "menu.setAttribute(\"role\", \"listbox\");",
    "menu.setAttribute(\"aria-labelledby\", triggerId);",
    "const setCustomSelectActiveDescendant = (optionButton = null) => {",
    "trigger.setAttribute(\"aria-activedescendant\", optionButton.id);",
    "trigger.removeAttribute(\"aria-activedescendant\");",
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
    "optionButton.setAttribute(\"role\", \"option\");",
    "optionButton.setAttribute(\"aria-selected\", option.selected ? \"true\" : \"false\");",
    "optionButton.setAttribute(\"aria-disabled\", option.disabled ? \"true\" : \"false\");",
    "optionButton.addEventListener(\"focus\", () => {",
    "setCustomSelectActiveDescendant(optionButton);",
    "closeCustomSelectMenu(true);",
    "function observeCustomSelectControls() {",
    "customSelectObserver.observe(document.body, {",
    "observeCustomSelectControls();",
  ];

  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing custom select accessibility token: ${token}`);
  }
  assert.ok(
    !appSource.includes("const CUSTOM_SELECT_EXCLUDE_IDS = new Set([\"storyTimelineSelect\"]);"),
    "frontend runtime still excludes storyTimelineSelect from custom dropdown styling",
  );

  assert.ok(
    readmeSource.includes("Custom dropdown controls support keyboard navigation"),
    "README missing keyboard-accessibility guidance for custom dropdown controls",
  );

  assert.ok(
    readmeSource.includes("combobox/listbox ARIA semantics"),
    "README missing screen-reader ARIA guidance for custom dropdown controls",
  );

  assert.ok(
    operatorGuideSource.includes("Custom dropdown controls support keyboard navigation"),
    "operator guide missing keyboard-accessibility guidance for custom dropdown controls",
  );

  assert.ok(
    operatorGuideSource.includes("combobox/listbox ARIA semantics"),
    "operator guide missing screen-reader ARIA guidance for custom dropdown controls",
  );
});
