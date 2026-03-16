import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("demo frontend keeps translation mic start available before websocket connect", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");
  const runbookSource = readFileSync(runbookPath, "utf8");

  const startToken = "function syncLiveControlButtonStates() {";
  const endToken = "\n\nfunction setConnectionStatus(text) {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing syncLiveControlButtonStates helper");
  assert.notEqual(endIndex, -1, "frontend runtime missing connection-status helper boundary");

  class FakeButton {
    disabled = false;
    textContent = "";
    classList = {
      toggled: new Map<string, boolean>(),
      toggle: (token: string, force?: boolean) => {
        this.classList.toggled.set(token, Boolean(force));
      },
    };
  }

  const helperSource = appSource.slice(startIndex, endIndex);
  const scope = {
    state: {
      micProcessor: null,
      micCaptureIntent: null,
      pttEnabled: false,
      pttPressed: false,
      mode: "voice",
    },
    el: {
      startMicBtn: new FakeButton(),
      stopMicBtn: new FakeButton(),
      pttToggleBtn: new FakeButton(),
      pttHoldBtn: new FakeButton(),
      fallbackBtn: new FakeButton(),
    },
    HTMLButtonElement: FakeButton,
    isRealtimeSocketConnected: () => false,
    getCurrentLiveIntentValue: () => "translation",
    shouldUseMicTranslationCapture: (intent: unknown) => intent === "translation",
    t: (value: string) => value,
  };

  const syncLiveControlButtonStates = runInNewContext(`(${helperSource})`, scope) as () => void;

  syncLiveControlButtonStates();
  assert.equal(scope.el.startMicBtn.disabled, false, "translation mic start should stay available without websocket");
  assert.equal(scope.el.stopMicBtn.disabled, true);
  assert.equal(scope.el.pttToggleBtn.disabled, true, "PTT should still require a websocket session");

  scope.getCurrentLiveIntentValue = () => "conversation";
  syncLiveControlButtonStates();
  assert.equal(scope.el.startMicBtn.disabled, true, "conversation mic start should still require websocket connect");

  scope.isRealtimeSocketConnected = () => true;
  syncLiveControlButtonStates();
  assert.equal(scope.el.startMicBtn.disabled, false, "socket-connected live conversation should re-enable mic start");

  assert.ok(
    readmeSource.includes("Start mic` stays available even before `Connect`"),
    "README should document translation mic availability before Connect",
  );
  assert.ok(
    operatorGuideSource.includes("Start mic` remains available even before `Connect`"),
    "operator guide should document translation mic availability before Connect",
  );
  assert.ok(
    runbookSource.includes("Start mic` can also begin before `Connect`"),
    "challenge runbook should explain the translation mic pre-connect path",
  );
});
