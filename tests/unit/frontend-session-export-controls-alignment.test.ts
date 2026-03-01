import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires session export controls and runtime helpers", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlTokens = [
    'id="exportMarkdownBtn"',
    'id="exportJsonBtn"',
    'id="exportAudioBtn"',
    'id="exportStatus"',
    "Export Session Markdown",
    "Export Session JSON",
    "Export Session Audio (WAV)",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing export control token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "setExportStatus",
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
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing export token: ${token}`);
  }
});
