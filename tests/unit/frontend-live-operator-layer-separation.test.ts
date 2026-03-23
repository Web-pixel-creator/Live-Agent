import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("live support dock separates product support from the operator lane", () => {
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
    'id="liveSupportOpenOperatorConsoleBtn"',
    'id="liveSupportQueueSnapshot"',
    'id="liveSupportQueueTitle"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing live dock separation token: ${token}`);
  }

  const workflowBtnIndex = htmlSource.indexOf('id="liveDockWorkflowBtn"');
  const voiceBtnIndex = htmlSource.indexOf('id="liveDockVoiceBtn"');
  const controlBtnIndex = htmlSource.indexOf('id="liveDockControlBtn"');
  const openOperatorConsoleBtnIndex = htmlSource.indexOf('id="liveContextOpenOperatorConsoleBtn"');
  assert.ok(
    workflowBtnIndex !== -1 && voiceBtnIndex !== -1 && controlBtnIndex !== -1 && openOperatorConsoleBtnIndex !== -1,
    "live dock buttons and operator console CTA should exist",
  );
  assert.ok(workflowBtnIndex < controlBtnIndex, "product support buttons should stay before operator tools");
  assert.ok(voiceBtnIndex < controlBtnIndex, "voice lane should stay before the operator lane");
  assert.ok(!htmlSource.includes('id="liveDockMoreBtn"'), "legacy More dock button should be removed");
  const controlTrayIndex = htmlSource.indexOf('id="liveContextTrayControl"');
  const supportSectionIndex = htmlSource.indexOf('class="panel live-support-section"');
  assert.ok(
    controlTrayIndex !== -1 && supportSectionIndex !== -1 && controlTrayIndex < supportSectionIndex,
    "control tray should own the operator approval/queue shell in static HTML",
  );

  for (const token of [
    'liveContextDockLegendProductTitle: document.getElementById("liveContextDockLegendProductTitle")',
    'liveContextDockLegendOperatorTitle: document.getElementById("liveContextDockLegendOperatorTitle")',
    'liveContextDockLegendProductHint: document.getElementById("liveContextDockLegendProductHint")',
    'liveContextDockLegendOperatorHint: document.getElementById("liveContextDockLegendOperatorHint")',
    'liveContextOpenOperatorConsoleBtn: document.getElementById("liveContextOpenOperatorConsoleBtn")',
    '"Support & operator"',
    'Product helpers and the operator lane stay below the case workspace.',
    '"Workflow tools"',
    '"Operator diagnostics"',
    '"Operator approvals & queue snapshot"',
    'section: el.liveTechnicalTimelineSection',
    'section: el.liveInputOptionalToolsSection',
    'mount.section.dataset.liveContextPersistent = mount.persistent === true ? "true" : "false";',
    '"Approvals, queue snapshots, diagnostics, and rare operator tools stay below the main composer."',
    '"Approval decisions, queue snapshots, diagnostics, recovery actions, and rare extras live here. Open deeper operator surfaces in Operator Console."',
    'function renderLiveSupportQueueSummary(count = 0) {',
    '"Queue snapshot"',
    'setActiveTab("operator");',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing live dock separation token: ${token}`);
  }
  assert.ok(
    !appSource.includes('section: el.liveSupportSection, persistent: true, open: true'),
    "control tray should no longer remount the live support shell from below the live surface",
  );

  for (const token of [
    ".live-context-dock-legend",
    ".live-context-dock-legend-card",
    ".live-context-dock-legend-hint",
    '.live-context-dock-btn[data-live-context-group="product"]',
    '.live-context-dock-btn[data-live-context-group="operator"]',
    '.live-context-mounted-section[data-live-context-persistent="false"] > summary',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing live dock separation style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("separates `Product support` (`Workflow`, `Voice`) from one `Operator lane` (`Control`)"),
    "README should document live dock separation",
  );
  assert.ok(
    readmeSource.includes(
      "rare `Operator extras` stay nested inside `Control`, the live lane keeps only approvals plus a compact queue snapshot, and deeper operator surfaces open through `Operator Console`",
    ),
    "README should document the clearer operator/product rail split",
  );
  assert.ok(
    readmeSource.includes("That approval/queue shell now opens only inside the `Control` tray"),
    "README should document the tray-owned approval/queue shell",
  );
  assert.ok(
    operatorGuideSource.includes("separates `Product support` (`Workflow`, `Voice`) from one `Operator lane` (`Control`)"),
    "operator guide should document live dock separation",
  );
  assert.ok(
    operatorGuideSource.includes(
      "rare `Operator extras` stay nested inside `Control`, the live lane keeps only approvals plus a compact queue snapshot, and deeper operator surfaces open through `Operator Console`",
    ),
    "operator guide should document the clearer operator/product rail split",
  );
  assert.ok(
    operatorGuideSource.includes("That approval/queue shell now opens only inside the `Control` tray"),
    "operator guide should document the tray-owned approval/queue shell",
  );
});
