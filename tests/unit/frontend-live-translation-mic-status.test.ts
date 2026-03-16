import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("translation composer exposes explicit mic capture status states", () => {
  const indexPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");

  const indexSource = readFileSync(indexPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");
  const runbookSource = readFileSync(runbookPath, "utf8");

  assert.ok(
    indexSource.includes('id="micComposerStatus"') &&
      indexSource.includes('id="micComposerStatusPill"') &&
      indexSource.includes('id="micComposerStatusHint"'),
    "translation composer should expose a dedicated mic-status row in the HTML shell",
  );

  const startToken = "function shouldUseMicTranslationCapture(intent = getCurrentLiveIntentValue()) {";
  const endToken = "\n\nfunction syncLiveControlButtonStates() {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing mic translation helper boundary");
  assert.notEqual(endIndex, -1, "frontend runtime missing syncLiveControlButtonStates boundary");

  const helperSource = appSource.slice(startIndex, endIndex);

  class FakeElement {
    hidden = false;
    textContent = "";
    className = "";
    dataset: Record<string, string> = {};
    attributes = new Map<string, string>();

    setAttribute(name: string, value: string) {
      this.attributes.set(name, String(value));
    }
  }

  const scope = {
    state: {
      languageMode: "en",
      micCaptureIntent: "translation",
      micSpeechRecognition: null,
      micSpeechDispatchPending: false,
      micSpeechSource: null,
      micSpeechTranscript: "",
      micSpeechInterimTranscript: "",
      micSpeechUiPhase: "ready",
      micSpeechUiDetail: null,
      micSpeechError: null,
      micProcessor: null,
    },
    el: {
      micComposerStatus: new FakeElement(),
      micComposerStatusPill: new FakeElement(),
      micComposerStatusHint: new FakeElement(),
    },
    HTMLElement: FakeElement,
    getCurrentLiveIntentValue() {
      return "translation";
    },
  };

  const helpers = runInNewContext(
    `${helperSource}; ({ getMicSpeechComposerStatus, syncMicSpeechComposerStatus, setMicSpeechUiPhase })`,
    scope,
  ) as {
    getMicSpeechComposerStatus: (intent?: string) => {
      visible: boolean;
      code: string;
      toneClass: string;
      label: string;
      hint: string;
    };
    syncMicSpeechComposerStatus: (intent?: string) => {
      visible: boolean;
      code: string;
      toneClass: string;
      label: string;
      hint: string;
    };
    setMicSpeechUiPhase: (phase: string, detail?: string | null) => void;
  };

  let status = helpers.syncMicSpeechComposerStatus("translation");
  assert.equal(status.code, "ready");
  assert.equal(scope.el.micComposerStatusPill.textContent, "Mic ready");

  scope.state.micSpeechRecognition = { stop() {} };
  status = helpers.syncMicSpeechComposerStatus("translation");
  assert.equal(status.code, "listening");
  assert.equal(scope.el.micComposerStatusPill.textContent, "Listening");

  scope.state.micSpeechTranscript = "Привет как дела";
  status = helpers.syncMicSpeechComposerStatus("translation");
  assert.equal(status.code, "recognized");
  assert.equal(scope.el.micComposerStatusPill.textContent, "Recognized");

  scope.state.micSpeechDispatchPending = true;
  status = helpers.syncMicSpeechComposerStatus("translation");
  assert.equal(status.code, "sending");
  assert.equal(scope.el.micComposerStatusPill.textContent, "Sending");

  scope.state.micSpeechRecognition = null;
  scope.state.micSpeechDispatchPending = false;
  helpers.setMicSpeechUiPhase("sent");
  status = helpers.getMicSpeechComposerStatus("translation");
  assert.equal(status.code, "sent");
  assert.equal(scope.el.micComposerStatusPill.textContent, "Sent");

  helpers.setMicSpeechUiPhase("error", "no-speech");
  status = helpers.syncMicSpeechComposerStatus("translation");
  assert.equal(status.code, "no_speech");
  assert.equal(scope.el.micComposerStatusPill.textContent, "No speech");

  status = helpers.syncMicSpeechComposerStatus("conversation");
  assert.equal(status.visible, false, "mic-status row should stay hidden outside translation mode");

  assert.ok(
    readmeSource.includes("mic-status row (`Mic ready -> Listening -> Recognized -> Sending -> Sent/Error`)"),
    "README should document the explicit translation mic-status row",
  );
  assert.ok(
    operatorGuideSource.includes("mic-status row (`Mic ready -> Listening -> Recognized -> Sending -> Sent/Error`)"),
    "operator guide should document the explicit translation mic-status row",
  );
  assert.ok(
    runbookSource.includes("Listening -> Recognized -> Sent/Error"),
    "challenge runbook should tell operators to watch the inline mic-status row",
  );
});
