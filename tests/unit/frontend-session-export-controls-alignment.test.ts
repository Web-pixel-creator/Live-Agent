import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires session export controls and runtime helpers", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
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
    "closeExportMenu",
    "buildSessionExportPayload",
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
    "exported markdown",
    "no audio",
    "No exports yet",
    "EXPORT_HISTORY_LIMIT",
    "el.exportAudioBtn.disabled = !hasAudioEvidence;",
    "Assistant playback evidence (capture required)",
    "const turnsLabel = uniqueTurns === 1 ? \"1 turn\" : `${uniqueTurns} turns`;",
    "const sizeLabel = formatByteSize(totalBytes);",
    "Assistant audio ready:",
    "trimmed",
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
});
