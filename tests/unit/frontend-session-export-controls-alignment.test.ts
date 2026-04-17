import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires session export controls and runtime helpers", () => {
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

  const requiredHtmlTokens = [
    'class="panel panel-live-top panel-live-connection"',
    'class="action-group action-group-primary"',
    'id="exportMenu"',
    'id="exportMenuSummaryIcon"',
    'id="exportMenuSummaryLabel"',
    'id="exportMenuMeta"',
    'id="exportMenuHistory"',
    'id="exportMarkdownBtn"',
    'id="exportJsonBtn"',
    'id="exportAudioBtn"',
    'id="exportAudioHint"',
    'id="exportStatus"',
    "Export Session",
    "Export Markdown",
    "Export JSON",
    "Export Audio (WAV)",
    "Recent exports",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing export control token: ${token}`);
  }
  assert.ok(
    !htmlSource.includes('class="action-group action-group-secondary action-group-export"'),
    "frontend html still keeps export controls in detached secondary lane",
  );

  const requiredRuntimeTokens = [
    "setExportStatus",
    "resolveExportStatusKind",
    "resolveExportStatusStripLabel",
    "resolveExportMenuSummaryIcon",
    "resolveExportMenuSummaryLabel",
    "renderExportMenuHistory",
    "pushExportHistory",
    "syncExportControlAvailability",
    "resolveOperatorCaseWikiComplianceExportGate",
    "denyOperatorCaseWikiComplianceExport",
    "buildComplianceArtifactDetailText",
    "closeExportMenu",
    "buildSessionExportPayload",
    "buildSessionExportRuntimeGuardrailsEvidence",
    "buildOperatorRuntimeGuardrailExportPath",
    "toMarkdownExport",
    "exportSessionMarkdown",
    "exportSessionJson",
    "exportSessionAudio",
    "buildPcm16WavBytes",
    "recordAssistantAudioChunk",
    "collectAssistantAudioBytes",
    "triggerDownload",
    "Session markdown export downloaded",
    "Session JSON export downloaded",
    "Session audio export downloaded",
    "Last export:",
    "Export Session",
    "Export Session (WAV)",
    "runtimeGuardrailsSignalPaths",
    "## Runtime Guardrails Signal Paths",
    "operatorPurpose",
    "operatorSessionReplay",
    "operatorDiscovery",
    "operatorCaseWiki",
    "liveTransport",
    "## Operator Purpose",
    "## Session Replay",
    "## Case Wiki",
    "## Cross-Agent Discovery",
    "buildSessionExportOperatorCaseWiki",
    "topBlockingQuestion:",
    "topProof:",
    "topEntity:",
    "focus:",
    "evidencePack:",
    "handoffPack:",
    "detailPack:",
    "routingPack:",
    "actionPack:",
    "focusPack:",
    "previewPack:",
    "workspacePack:",
    "operatorPreviewPack:",
    "remediationPreview:",
    "compliance:",
    "auditLog:",
    "evidencePackRefs:",
    "evidencePackProofs:",
    "evidencePackQuestions:",
    "handoffPreview:",
    "handoffFocus:",
    "focusedHandoffBlock:",
    "focusedHandoffRefs:",
    "focusedRoutingBlock:",
    "focusedRemediationDraft:",
    "focusedRoutingLane:",
    "focusedRoutingApproval:",
    "focusedRoutingCta:",
    "focusedRoutingCtaAction:",
    "liveTransport:",
    "liveEvidenceSource:",
    "historyStatus:",
    "lifecycleCounts:",
    "exported markdown",
    "session export blocked",
    "case wiki export blocked",
    "Case Wiki export is blocked until raw evidence refs are redacted",
    "Case Wiki export is blocked until evidence signing passes.",
    "Case Wiki export is ready.",
    "artifactPosture",
    "remediation",
    "primaryAction",
    "operatorActionLabel",
    "blockingRefs",
    "Blocking refs:",
    "buildComplianceRemediationNextStepText",
    "Next step:",
    "no audio",
    "No exports yet",
    "EXPORT_HISTORY_LIMIT",
    "el.exportMarkdownBtn.disabled = exportBlocked;",
    "el.exportJsonBtn.disabled = exportBlocked;",
    "el.exportAudioBtn.disabled = !hasAudioEvidence;",
    "Assistant playback evidence (capture required)",
    "formatLocalizedTurnCount",
    "const sizeLabel = formatByteSize(totalBytes);",
    't("export.audio.ready"',
    't("export.audio.evidence"',
    't("export.audio.trimmed")',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing export token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-live-connection {",
    ".panel-live-connection .action-group-primary > .export-menu {",
    ".panel-live-connection .export-menu[open] {",
    "z-index: 520;",
    ".panel-live-connection .export-menu-list {",
    "z-index: 540;",
    ".export-menu[open] {",
    ".export-menu-list {",
    "z-index: 460;",
    ".export-menu-item:disabled {",
    "cursor: not-allowed;",
    ".export-menu-item:disabled .export-menu-item-icon {",
    "border-style: dashed;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing export token: ${token}`);
  }

  assert.ok(
    operatorGuideSource.includes("single `Export Session` dropdown"),
    "operator guide missing single export dropdown note",
  );
  assert.ok(
    operatorGuideSource.includes("`runtimeGuardrailsSignalPaths`"),
    "operator guide missing runtime guardrails session export note",
  );
  assert.ok(
    operatorGuideSource.includes("`operatorPurpose`"),
    "operator guide missing operator purpose export note",
  );
  assert.ok(
    operatorGuideSource.includes("`operatorCaseWiki`"),
    "operator guide missing operator case wiki export note",
  );
  assert.match(operatorGuideSource, /compliance/i, "operator guide missing operator case wiki compliance export note");
  assert.match(operatorGuideSource, /auditLog/i, "operator guide missing operator case wiki audit export note");
  assert.match(
    operatorGuideSource,
    /focused handoff block/i,
    "operator guide missing focused handoff export note",
  );
  assert.match(
    operatorGuideSource,
    /focused routing/i,
    "operator guide missing focused routing export note",
  );
  assert.match(
    operatorGuideSource,
    /focused remediation/i,
    "operator guide missing focused remediation export note",
  );
  assert.ok(
    readmeSource.includes("`runtimeGuardrailsSignalPaths`"),
    "README missing runtime guardrails session export note",
  );
  assert.ok(readmeSource.includes("`operatorPurpose`"), "README missing operator purpose export note");
  assert.ok(readmeSource.includes("`operatorCaseWiki`"), "README missing operator case wiki export note");
  assert.match(readmeSource, /compliance/i, "README missing operator case wiki compliance export note");
  assert.match(readmeSource, /focused handoff block/i, "README missing focused handoff export note");
  assert.match(readmeSource, /focused routing/i, "README missing focused routing export note");
  assert.match(readmeSource, /focused remediation/i, "README missing focused remediation export note");
  assert.match(readmeSource, /auditLog/i, "README missing operator case wiki audit export note");
  assert.ok(
    readmeSource.includes("`compliance.enforcement.exportReady=false`"),
    "README missing compliance export gate enforcement note",
  );
  assert.ok(readmeSource.includes("`compliance.enforcement.remediation.primaryAction`"), "README missing compliance remediation primary action note");
  assert.ok(
    operatorGuideSource.includes("`compliance.enforcement.exportReady=false`"),
    "operator guide missing compliance export gate enforcement note",
  );
  assert.ok(
    operatorGuideSource.includes("`compliance.enforcement.remediation.primaryAction`"),
    "operator guide missing compliance remediation primary action note",
  );
});
