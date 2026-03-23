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
    'id="liveControlAdvancedSection"',
    'id="operatorConsoleEntry"',
    'id="operatorConsoleEntryApprovalsBtn"',
    'id="operatorConsoleEntryRuntimeBtn"',
    'id="operatorConsoleEntryAuditBtn"',
    'id="operatorConsoleEntryRefreshBtn"',
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
  const controlAdvancedIndex = htmlSource.indexOf('id="liveControlAdvancedSection"');
  const optionalToolsIndex = htmlSource.indexOf('class="advanced-settings live-input-optional-tools"');
  const technicalSectionIndex = htmlSource.indexOf('id="liveTechnicalTimelineSection"');
  assert.ok(
    controlTrayIndex !== -1 && supportSectionIndex !== -1 && controlTrayIndex < supportSectionIndex,
    "control tray should own the operator approval/queue shell in static HTML",
  );
  assert.ok(
    controlTrayIndex !== -1 && optionalToolsIndex !== -1 && controlTrayIndex < optionalToolsIndex,
    "control tray should own operator extras in static HTML",
  );
  assert.ok(
    controlTrayIndex !== -1 && technicalSectionIndex !== -1 && controlTrayIndex < technicalSectionIndex,
    "control tray should own operator diagnostics in static HTML",
  );
  assert.ok(
    supportSectionIndex !== -1 && controlAdvancedIndex !== -1 && supportSectionIndex < controlAdvancedIndex,
    "advanced operator tools should come after the queue snapshot shell",
  );
  assert.ok(
    controlAdvancedIndex !== -1 && optionalToolsIndex !== -1 && controlAdvancedIndex < optionalToolsIndex,
    "advanced operator tools shell should own operator extras",
  );
  assert.ok(
    controlAdvancedIndex !== -1 && technicalSectionIndex !== -1 && controlAdvancedIndex < technicalSectionIndex,
    "advanced operator tools shell should own operator diagnostics",
  );

  for (const token of [
    'liveContextDockLegendProductTitle: document.getElementById("liveContextDockLegendProductTitle")',
    'liveContextDockLegendOperatorTitle: document.getElementById("liveContextDockLegendOperatorTitle")',
    'liveContextDockLegendProductHint: document.getElementById("liveContextDockLegendProductHint")',
    'liveContextDockLegendOperatorHint: document.getElementById("liveContextDockLegendOperatorHint")',
    'liveContextOpenOperatorConsoleBtn: document.getElementById("liveContextOpenOperatorConsoleBtn")',
    'operatorConsoleEntry: document.getElementById("operatorConsoleEntry")',
    'operatorConsoleEntryApprovalsBtn: document.getElementById("operatorConsoleEntryApprovalsBtn")',
    'operatorConsoleEntryRuntimeBtn: document.getElementById("operatorConsoleEntryRuntimeBtn")',
    'operatorConsoleEntryAuditBtn: document.getElementById("operatorConsoleEntryAuditBtn")',
    'operatorConsoleEntryRefreshBtn: document.getElementById("operatorConsoleEntryRefreshBtn")',
    '"Support & operator"',
    'Product helpers and the operator lane stay below the case workspace.',
    '"Workflow tools"',
    '"Operator diagnostics"',
    '"Operator approvals & queue snapshot"',
    'function focusOperatorConsoleEntry(targetId = "operatorConsoleEntry") {',
    'function openOperatorConsoleFromLive(options = {}) {',
    'openOperatorConsoleFromLive();',
    'openOperatorConsoleFromLive({ savedView: "approvals", focusId: "operatorConsoleEntryApprovalsBtn" });',
    'setOperatorSavedView("runtime");',
    'setOperatorSavedView("audit");',
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
  assert.ok(
    !appSource.includes('section: el.liveTechnicalTimelineSection'),
    "control tray should no longer remount operator diagnostics from below the live surface",
  );
  assert.ok(
    !appSource.includes('section: el.liveInputOptionalToolsSection'),
    "control tray should no longer remount operator extras from below the live surface",
  );

  for (const token of [
    ".live-context-dock-legend",
    ".live-context-dock-legend-card",
    ".live-context-dock-legend-hint",
    ".live-control-advanced-shell",
    ".live-control-advanced-stack",
    ".operator-console-entry",
    ".operator-console-entry-actions",
    ".operator-console-entry-action",
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
    readmeSource.includes("The same tray now owns low-frequency operator extras and diagnostics as well"),
    "README should document the tray-owned operator extras and diagnostics",
  );
  assert.ok(
    readmeSource.includes("Those lower-frequency surfaces now sit behind one collapsed `Advanced operator tools` shell"),
    "README should document the collapsed advanced operator tools shell",
  );
  assert.ok(
    readmeSource.includes("`Operator Console` now starts with one explicit `Operator handoff` entry card"),
    "README should document the explicit operator handoff entry",
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
  assert.ok(
    operatorGuideSource.includes("That same Control tray now owns low-frequency operator extras and diagnostics too"),
    "operator guide should document the tray-owned operator extras and diagnostics",
  );
  assert.ok(
    operatorGuideSource.includes("those lower-frequency surfaces now sit behind one collapsed `Advanced operator tools` shell"),
    "operator guide should document the collapsed advanced operator tools shell",
  );
  assert.ok(
    operatorGuideSource.includes("`Operator Console` now starts with one explicit `Operator handoff` card"),
    "operator guide should document the explicit operator handoff entry",
  );
});
