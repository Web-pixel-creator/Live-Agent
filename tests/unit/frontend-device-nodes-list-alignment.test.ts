import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend presents device nodes as selectable cards with guided empty state", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = ['id="deviceNodeListHint"', 'class="events device-node-list"', 'id="deviceNodeList"'];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing device-node list token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'deviceNodeListHint: document.getElementById("deviceNodeListHint")',
    "function setDeviceNodeListHint(text)",
    "function renderDeviceNodeEmptyState()",
    "function createDeviceNodeCard(node, isSelected)",
    "Use Demo Template",
    "applyDemoDeviceNodeTemplate",
    "setDeviceNodeListHint(\"No nodes yet. Use Demo Template and Create / Update Node to bootstrap the lane.\");",
    "setDeviceNodeListHint(\"Click any node card to load it into the form and run status/heartbeat actions.\");",
    "card.className = \"device-node-card\";",
    "card.classList.add(\"is-selected\");",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing device-node list token: ${token}`);
  }

  const requiredStyleTokens = [
    ".device-node-list-hint {",
    ".device-node-list {",
    ".device-node-empty-state {",
    ".device-node-empty-action {",
    ".device-node-card {",
    ".device-node-card.is-selected {",
    ".device-node-card-meta {",
    ".device-node-cap-pill {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing device-node list token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Device Nodes` tab renders registered nodes as selectable status cards"),
    "README missing device-node card list note",
  );
  assert.ok(
    operatorGuideSource.includes("selectable node cards with status pills"),
    "operator guide missing device-node card list note",
  );
});
