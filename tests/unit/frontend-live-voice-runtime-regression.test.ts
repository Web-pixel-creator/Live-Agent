import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("demo frontend waits for an explicit Connect action before opening the live websocket", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");
  const runbookSource = readFileSync(runbookPath, "utf8");

  const startToken = 'document.getElementById("connectBtn").addEventListener("click", connectWebSocket);';
  const endToken = "\n  if (el.exportMarkdownBtn) {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing manual connect binding");
  assert.notEqual(endIndex, -1, "frontend runtime missing export controls boundary after connect bindings");

  const bootstrapSource = appSource.slice(startIndex, endIndex);
  assert.ok(
    bootstrapSource.includes('document.getElementById("disconnectBtn").addEventListener("click", disconnectWebSocket);'),
    "frontend runtime missing disconnect binding near connect controls",
  );
  assert.ok(
    !bootstrapSource.includes("connectWebSocket();"),
    "frontend should not auto-connect the websocket during page bootstrap",
  );

  assert.ok(
    readmeSource.includes("Voice runtime now stays manual on first paint"),
    "README should document manual connect behavior for voice runtime",
  );
  assert.ok(
    operatorGuideSource.includes("Voice runtime note: `Connect` is manual on first paint"),
    "operator guide should document manual connect behavior for live runtime",
  );
  assert.ok(
    runbookSource.includes("The live lane no longer auto-connects on first paint."),
    "challenge runbook should instruct reviewers to click Connect explicitly",
  );
});

test("demo frontend keeps transient live_forwarded churn out of the main session pill", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const startToken = "function isEphemeralSessionState(text) {";
  const endToken = "\n\nfunction syncLiveControlButtonStates() {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing ephemeral session-state helper");
  assert.notEqual(endIndex, -1, "frontend runtime missing session-state helper boundary");

  const helperSource = appSource.slice(startIndex, endIndex);
  const helpers = runInNewContext(`${helperSource}; ({ isEphemeralSessionState, shouldRenderSessionState })`) as {
    isEphemeralSessionState: (value: unknown) => boolean;
    shouldRenderSessionState: (value: unknown) => boolean;
  };

  assert.equal(helpers.isEphemeralSessionState("live_forwarded"), true);
  assert.equal(helpers.isEphemeralSessionState("session_bound"), false);
  assert.equal(helpers.shouldRenderSessionState("live_forwarded"), false);
  assert.equal(helpers.shouldRenderSessionState("orchestrator_completed"), true);

  assert.ok(
    appSource.includes("if (shouldRenderSessionState(nextState)) {"),
    "frontend runtime should gate session-pill updates behind shouldRenderSessionState",
  );
  assert.ok(
    readmeSource.includes("transient `live_forwarded` bridge pulses stay in debug events"),
    "README should document that live_forwarded stays out of the main session pill",
  );
});

test("demo frontend can convert captured mic speech into a real translation request", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const readmePath = resolve(process.cwd(), "README.md");

  const appSource = readFileSync(appPath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const startToken = "function shouldUseMicTranslationCapture(intent = getCurrentLiveIntentValue()) {";
  const endToken = "\n\nfunction syncLiveControlButtonStates() {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing mic translation helpers");
  assert.notEqual(endIndex, -1, "frontend runtime missing mic translation helper boundary");

  const helperSource = appSource.slice(startIndex, endIndex);
  const calls: Array<Record<string, unknown>> = [];
  const transcriptEvents: Array<{ role: string; text: string }> = [];
  const scope = {
    state: {
      languageMode: "en",
      micCaptureIntent: "translation",
      micCaptureSpeechLanguage: "ru-RU",
      micSpeechTranscript: "",
      micSpeechInterimTranscript: "",
      micSpeechAutoStopTimer: null,
    },
    el: {
      message: {
        value: "",
      },
    },
    appendTranscript(role: string, text: string) {
      transcriptEvents.push({ role, text });
    },
    sendIntentRequest(options: Record<string, unknown>) {
      calls.push(options);
    },
    getLiveTargetLanguageValue() {
      return "de";
    },
    getLiveSpeechLanguageValue() {
      return "ru-RU";
    },
    getCurrentLiveIntentValue() {
      return "translation";
    },
    globalThis: {},
  };
  const helpers = runInNewContext(
    `${helperSource}; ({ shouldUseMicTranslationCapture, shouldForwardMicAudioToLiveRuntime, normalizeMicSpeechTranscript, formatMicSpeechTranscriptForCompose, finalizeMicTranslationFromTranscript })`,
    scope,
  ) as {
    shouldUseMicTranslationCapture: (intent: string) => boolean;
    shouldForwardMicAudioToLiveRuntime: (intent: string) => boolean;
    normalizeMicSpeechTranscript: (value: unknown) => string;
    formatMicSpeechTranscriptForCompose: (value: unknown, options?: Record<string, unknown>) => string;
    finalizeMicTranslationFromTranscript: (
      transcript: unknown,
      options?: Record<string, unknown>,
    ) => boolean;
  };

  assert.equal(helpers.shouldUseMicTranslationCapture("translation"), true);
  assert.equal(helpers.shouldUseMicTranslationCapture("conversation"), false);
  assert.equal(helpers.shouldForwardMicAudioToLiveRuntime("translation"), false);
  assert.equal(helpers.shouldForwardMicAudioToLiveRuntime("conversation"), true);
  assert.equal(helpers.normalizeMicSpeechTranscript("  Привет   мир  "), "Привет мир");
  assert.equal(
    helpers.formatMicSpeechTranscriptForCompose("привет как дела чем занимаешься", { speechLanguage: "ru-RU" }),
    "Привет, как дела, чем занимаешься?",
    "voice translation formatter should add basic readability punctuation for Russian prompts",
  );

  const dispatched = helpers.finalizeMicTranslationFromTranscript("  Привет   мир  ", {
    targetLanguage: "en",
    source: "ptt",
  });

  assert.equal(dispatched, true, "captured speech should dispatch a translation request");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {
      intent: "translation",
      keepMessage: true,
      message: "Привет мир.",
      targetLanguage: "en",
      metadata: {
        inputMode: "voice_mic_translation",
        source: "ptt",
        speechRecognition: true,
        speechLanguage: "ru-RU",
      },
    },
  ]);
  assert.equal(
    scope.el.message.value,
    calls[0]?.message,
    "voice translation should mirror the formatted recognized phrase into the compose textarea",
  );

  const emptyDispatch = helpers.finalizeMicTranslationFromTranscript("   ", {
    targetLanguage: "en",
  });
  assert.equal(emptyDispatch, false, "empty captured speech should not dispatch a translation request");
  assert.equal(transcriptEvents.at(-1)?.role, "error");

  assert.ok(
    operatorGuideSource.includes("browser speech recognition"),
    "operator guide should document browser speech recognition for voice translation",
  );
  assert.ok(
    operatorGuideSource.includes("From language -> Translate to"),
    "operator guide should document the clearer source/target direction for voice translation",
  );
  assert.ok(
    readmeSource.includes("light readability pass"),
    "README should document the light readability cleanup for recognized voice phrases",
  );
});

test("demo frontend auto-submits translation mic capture after a short speech pause", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");

  const appSource = readFileSync(appPath, "utf8");

  const startToken = "function shouldUseMicTranslationCapture(intent = getCurrentLiveIntentValue()) {";
  const endToken = "\n\nfunction syncLiveControlButtonStates() {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing mic translation helpers");
  assert.notEqual(endIndex, -1, "frontend runtime missing mic translation helper boundary");

  const helperSource = appSource.slice(startIndex, endIndex);
  const calls: Array<Record<string, unknown>> = [];
  const transcriptEvents: Array<{ role: string; text: string }> = [];
  const stoppedTracks: string[] = [];
  let syncCalls = 0;
  let scheduledPauseCallback: (() => void) | null = null;

  class FakeRecognition {
    static instance: FakeRecognition | null = null;
    lang = "";
    continuous = false;
    interimResults = false;
    maxAlternatives = 0;
    onresult: ((event: Record<string, unknown>) => void) | null = null;
    onerror: ((event: Record<string, unknown>) => void) | null = null;
    onend: (() => void) | null = null;
    onspeechend: (() => void) | null = null;
    onaudioend: (() => void) | null = null;

    constructor() {
      FakeRecognition.instance = this;
    }

    start() {
      return undefined;
    }

    stop() {
      this.onend?.();
      return undefined;
    }
  }

  const scope = {
    state: {
      languageMode: "en",
      micCaptureIntent: "translation",
      micCaptureTargetLanguage: "en",
      micCaptureSpeechLanguage: "ru-RU",
      micSpeechRecognition: null,
      micSpeechDispatchPending: false,
      micSpeechSource: null,
      micSpeechError: null,
      micSpeechTranscript: "",
      micSpeechInterimTranscript: "",
      micSpeechDraftBeforeCapture: "",
      micSpeechAutoStopTimer: null,
      micSpeechUnavailableNotified: false,
      pttEnabled: false,
      micProcessor: {
        disconnect() {
          stoppedTracks.push("processor");
        },
        onaudioprocess: null,
      },
      micGain: {
        disconnect() {
          stoppedTracks.push("gain");
        },
      },
      micStream: {
        getTracks() {
          return [
            {
              stop() {
                stoppedTracks.push("track");
              },
            },
          ];
        },
      },
      micContext: {
        close() {
          stoppedTracks.push("context");
        },
      },
    },
    el: {
      message: {
        value: "",
      },
    },
    appendTranscript(role: string, text: string) {
      transcriptEvents.push({ role, text });
    },
    sendIntentRequest(options: Record<string, unknown>) {
      calls.push(options);
    },
    getLiveTargetLanguageValue() {
      return "en";
    },
    getLiveSpeechLanguageValue() {
      return "ru-RU";
    },
    getCurrentLiveIntentValue() {
      return "translation";
    },
    syncLiveControlButtonStates() {
      syncCalls += 1;
    },
    setTimeout(callback: () => void) {
      scheduledPauseCallback = callback;
      return 1;
    },
    clearTimeout() {
      scheduledPauseCallback = null;
    },
    globalThis: {
      SpeechRecognition: FakeRecognition,
    },
  };

  const helpers = runInNewContext(
    `${helperSource}; ({ beginMicSpeechCapture })`,
    scope,
  ) as {
    beginMicSpeechCapture: (options?: Record<string, unknown>) => boolean;
  };

  const started = helpers.beginMicSpeechCapture({
    intent: "translation",
    targetLanguage: "en",
    speechLanguage: "ru-RU",
    source: "mic",
  });

  assert.equal(started, true, "translation mic capture should start when SpeechRecognition is available");
  assert.ok(FakeRecognition.instance, "translation mic capture should create a recognition instance");
  assert.equal(FakeRecognition.instance?.continuous, false, "default mic translation should use single-utterance recognition");

  FakeRecognition.instance?.onresult?.({
    resultIndex: 0,
    results: [
      {
        0: { transcript: "привет как дела чем занимаешься" },
        isFinal: true,
      },
    ],
  });

  assert.equal(
    scope.el.message.value,
    "Привет, как дела, чем занимаешься?",
    "recognized speech should be lightly formatted in the compose field before dispatch",
  );
  assert.ok(scheduledPauseCallback, "translation mic capture should schedule an auto-submit after speech pause");

  scheduledPauseCallback?.();

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {
      intent: "translation",
      keepMessage: true,
      message: "Привет, как дела, чем занимаешься?",
      targetLanguage: "en",
      metadata: {
        inputMode: "voice_mic_translation",
        source: "mic",
        speechRecognition: true,
        speechLanguage: "ru-RU",
      },
    },
  ]);
  assert.equal(scope.state.micProcessor, null, "auto-submit should release the mic processor after speech pause");
  assert.equal(scope.state.micGain, null, "auto-submit should release the mic gain after speech pause");
  assert.equal(scope.state.micStream, null, "auto-submit should release the mic stream after speech pause");
  assert.equal(scope.state.micContext, null, "auto-submit should release the mic context after speech pause");
  assert.equal(scope.state.micCaptureIntent, null, "auto-submit should clear the active mic capture intent");
  assert.ok(stoppedTracks.includes("processor") && stoppedTracks.includes("track"), "auto-submit should stop mic resources");
  assert.equal(syncCalls > 0, true, "auto-submit should refresh mic button state after stopping the mic");
  assert.equal(
    transcriptEvents.at(-1)?.text,
    "Speech pause detected. Translation sent and mic stopped automatically.",
    "auto-submit should leave a system hint when translation is dispatched on speech pause",
  );
});
