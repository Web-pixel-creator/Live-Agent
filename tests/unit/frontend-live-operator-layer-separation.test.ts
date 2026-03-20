import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("live support dock separates product support from operator tools", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'class="live-context-dock-legend"',
    'id="liveContextDockLegendProductTitle"',
    'id="liveContextDockLegendOperatorTitle"',
    'data-live-context-group="product"',
    'data-live-context-group="operator"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing live dock separation token: ${token}`);
  }

  const workflowBtnIndex = htmlSource.indexOf('id="liveDockWorkflowBtn"');
  const voiceBtnIndex = htmlSource.indexOf('id="liveDockVoiceBtn"');
  const controlBtnIndex = htmlSource.indexOf('id="liveDockControlBtn"');
  const moreBtnIndex = htmlSource.indexOf('id="liveDockMoreBtn"');
  assert.ok(workflowBtnIndex !== -1 && voiceBtnIndex !== -1 && controlBtnIndex !== -1 && moreBtnIndex !== -1, "live dock buttons should exist");
  assert.ok(workflowBtnIndex < controlBtnIndex, "product support buttons should stay before operator tools");
  assert.ok(voiceBtnIndex < moreBtnIndex, "voice lane should stay before service/operator lanes");

  for (const token of [
    'liveContextDockLegendProductTitle: document.getElementById("liveContextDockLegendProductTitle")',
    'liveContextDockLegendOperatorTitle: document.getElementById("liveContextDockLegendOperatorTitle")',
    'liveContextDockLegendProductHint: document.getElementById("liveContextDockLegendProductHint")',
    'liveContextDockLegendOperatorHint: document.getElementById("liveContextDockLegendOperatorHint")',
    '"Support & operator"',
    'Product helpers and operator tools stay below the case workspace.',
    '"Workflow tools"',
    '"Operator diagnostics"',
    '"Operator approvals & queue"',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing live dock separation token: ${token}`);
  }

  for (const token of [
    ".live-context-dock-legend",
    ".live-context-dock-legend-card",
    ".live-context-dock-legend-hint",
    '.live-context-dock-btn[data-live-context-group="product"]',
    '.live-context-dock-btn[data-live-context-group="operator"]',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing live dock separation style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("separates `Product support` (`Workflow`, `Voice`) from `Operator tools` (`Control`, `More`)"),
    "README should document live dock separation",
  );
  assert.ok(
    readmeSource.includes("The lower workflow tray now reads as `Workflow tools`, the control lane reads as `Operator approvals & queue`, and the right-rail log reads as `Operator diagnostics`"),
    "README should document the clearer operator/product copy split",
  );
  assert.ok(
    operatorGuideSource.includes("separates `Product support` (`Workflow`, `Voice`) from `Operator tools` (`Control`, `More`)"),
    "operator guide should document live dock separation",
  );
  assert.ok(
    operatorGuideSource.includes("Live copy note: the lower workflow tray now reads as `Workflow tools`, the control tray reads as `Operator approvals & queue`, and the right-rail debug block reads as `Operator diagnostics`"),
    "operator guide should document the clearer operator/product copy split",
  );
});
