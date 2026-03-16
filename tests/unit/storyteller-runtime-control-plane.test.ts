import assert from "node:assert/strict";
import test from "node:test";
import {
  clearStorytellerRuntimeControlPlaneOverride,
  getStorytellerRuntimeConfig,
  resetStorytellerRuntimeControlPlaneOverrideForTests,
  setStorytellerRuntimeControlPlaneOverride,
} from "../../agents/storyteller-agent/src/index.ts";

test("storyteller runtime control-plane override applies simulated media mode", () => {
  const previousMediaMode = process.env.STORYTELLER_MEDIA_MODE;
  const previousImageEditEnabled = process.env.STORYTELLER_IMAGE_EDIT_ENABLED;
  const previousImageEditModel = process.env.STORYTELLER_IMAGE_EDIT_MODEL;
  const previousTtsModel = process.env.STORYTELLER_TTS_MODEL;
  const previousTtsSecondaryEnabled = process.env.STORYTELLER_TTS_SECONDARY_ENABLED;
  const previousTtsSecondaryModel = process.env.STORYTELLER_TTS_SECONDARY_MODEL;
  try {
    delete process.env.STORYTELLER_MEDIA_MODE;
    process.env.STORYTELLER_IMAGE_EDIT_ENABLED = "false";
    process.env.STORYTELLER_IMAGE_EDIT_MODEL = "fal-ai/nano-banana-2/edit";
    process.env.STORYTELLER_TTS_MODEL = "gemini-tts";
    process.env.STORYTELLER_TTS_SECONDARY_ENABLED = "true";
    process.env.STORYTELLER_TTS_SECONDARY_MODEL = "aura-2";
    resetStorytellerRuntimeControlPlaneOverrideForTests();

    const baseline = getStorytellerRuntimeConfig();
    assert.equal(baseline.sourceKind, "env");
    assert.equal(baseline.mediaMode, "fallback");
    assert.equal(baseline.imageEdit.enabled, false);
    assert.equal(baseline.imageEdit.provider, "fal");
    assert.equal(baseline.imageEdit.model, "fal-ai/nano-banana-2/edit");
    assert.equal(baseline.imageEdit.effectiveMode, "disabled");
    assert.equal(baseline.tts.defaultProvider, "gemini_api");
    assert.equal(baseline.tts.effectiveProvider, "gemini_api");

    setStorytellerRuntimeControlPlaneOverride({
      rawJson: JSON.stringify({
        mediaMode: "simulated",
        imageEditEnabled: true,
        ttsProvider: "deepgram",
      }),
      reason: "test:storyteller-runtime",
    });

    const overridden = getStorytellerRuntimeConfig();
    assert.equal(overridden.sourceKind, "control_plane_json");
    assert.equal(overridden.mediaMode, "simulated");
    assert.equal(overridden.imageEdit.enabled, true);
    assert.equal(overridden.imageEdit.effectiveMode, "simulated");
    assert.equal(overridden.tts.providerOverride, "deepgram");
    assert.equal(overridden.tts.effectiveProvider, "deepgram");
    assert.equal(overridden.tts.effectiveModel, "aura-2");
    assert.equal(overridden.controlPlaneOverride.active, true);
    assert.equal(overridden.controlPlaneOverride.reason, "test:storyteller-runtime");

    clearStorytellerRuntimeControlPlaneOverride();

    const restored = getStorytellerRuntimeConfig();
    assert.equal(restored.sourceKind, "env");
    assert.equal(restored.mediaMode, "fallback");
    assert.equal(restored.imageEdit.enabled, false);
    assert.equal(restored.imageEdit.effectiveMode, "disabled");
    assert.equal(restored.tts.providerOverride, null);
    assert.equal(restored.tts.effectiveProvider, "gemini_api");
    assert.equal(restored.controlPlaneOverride.active, false);
  } finally {
    if (typeof previousMediaMode === "string") {
      process.env.STORYTELLER_MEDIA_MODE = previousMediaMode;
    } else {
      delete process.env.STORYTELLER_MEDIA_MODE;
    }
    if (typeof previousImageEditEnabled === "string") {
      process.env.STORYTELLER_IMAGE_EDIT_ENABLED = previousImageEditEnabled;
    } else {
      delete process.env.STORYTELLER_IMAGE_EDIT_ENABLED;
    }
    if (typeof previousImageEditModel === "string") {
      process.env.STORYTELLER_IMAGE_EDIT_MODEL = previousImageEditModel;
    } else {
      delete process.env.STORYTELLER_IMAGE_EDIT_MODEL;
    }
    if (typeof previousTtsModel === "string") {
      process.env.STORYTELLER_TTS_MODEL = previousTtsModel;
    } else {
      delete process.env.STORYTELLER_TTS_MODEL;
    }
    if (typeof previousTtsSecondaryEnabled === "string") {
      process.env.STORYTELLER_TTS_SECONDARY_ENABLED = previousTtsSecondaryEnabled;
    } else {
      delete process.env.STORYTELLER_TTS_SECONDARY_ENABLED;
    }
    if (typeof previousTtsSecondaryModel === "string") {
      process.env.STORYTELLER_TTS_SECONDARY_MODEL = previousTtsSecondaryModel;
    } else {
      delete process.env.STORYTELLER_TTS_SECONDARY_MODEL;
    }
    resetStorytellerRuntimeControlPlaneOverrideForTests();
  }
});

test("storyteller runtime control-plane override accepts default media mode", () => {
  const previousMediaMode = process.env.STORYTELLER_MEDIA_MODE;
  try {
    delete process.env.STORYTELLER_MEDIA_MODE;
    resetStorytellerRuntimeControlPlaneOverrideForTests();

    const overridden = setStorytellerRuntimeControlPlaneOverride({
      rawJson: JSON.stringify({
        mediaMode: "default",
      }),
      reason: "test:storyteller-runtime-default",
    });

    assert.equal(overridden.mediaMode, "default");
    assert.equal(overridden.controlPlaneOverride.active, true);
    assert.equal(overridden.controlPlaneOverride.reason, "test:storyteller-runtime-default");
  } finally {
    if (typeof previousMediaMode === "string") {
      process.env.STORYTELLER_MEDIA_MODE = previousMediaMode;
    } else {
      delete process.env.STORYTELLER_MEDIA_MODE;
    }
    resetStorytellerRuntimeControlPlaneOverrideForTests();
  }
});

test("storyteller runtime control-plane override rejects invalid media mode", () => {
  const previousMediaMode = process.env.STORYTELLER_MEDIA_MODE;
  try {
    delete process.env.STORYTELLER_MEDIA_MODE;
    resetStorytellerRuntimeControlPlaneOverrideForTests();

    assert.throws(
      () =>
        setStorytellerRuntimeControlPlaneOverride({
          rawJson: JSON.stringify({
            mediaMode: "broken",
          }),
        }),
      /fallback\|simulated/i,
    );

    assert.throws(
      () =>
        setStorytellerRuntimeControlPlaneOverride({
          rawJson: JSON.stringify({
            ttsProvider: "broken",
          }),
        }),
      /gemini_api\|deepgram/i,
    );

    assert.throws(
      () =>
        setStorytellerRuntimeControlPlaneOverride({
          rawJson: JSON.stringify({
            imageEditEnabled: "broken",
          }),
        }),
      /imageEditEnabled must be boolean/i,
    );

    const status = getStorytellerRuntimeConfig();
    assert.equal(status.sourceKind, "env");
    assert.equal(status.controlPlaneOverride.active, false);
  } finally {
    if (typeof previousMediaMode === "string") {
      process.env.STORYTELLER_MEDIA_MODE = previousMediaMode;
    } else {
      delete process.env.STORYTELLER_MEDIA_MODE;
    }
    resetStorytellerRuntimeControlPlaneOverrideForTests();
  }
});
