import assert from "node:assert/strict";
import test from "node:test";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import {
  resetStorytellerRuntimeControlPlaneOverrideForTests,
  runStorytellerAgent,
} from "../../agents/storyteller-agent/src/index.js";

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function withEnv(overrides: Record<string, string | null>, runner: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(overrides)) {
    previous.set(name, process.env[name]);
    if (value === null) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  return runner().finally(() => {
    for (const [name, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    resetStorytellerRuntimeControlPlaneOverrideForTests();
  });
}

test("storyteller tts provider override selects deepgram and exposes metadata", async () => {
  await withEnv(
    {
      GEMINI_API_KEY: "",
      STORYTELLER_GEMINI_API_KEY: "",
      STORYTELLER_USE_GEMINI_PLANNER: "false",
      STORYTELLER_TTS_PROVIDER_OVERRIDE: "deepgram",
      STORYTELLER_TTS_SECONDARY_ENABLED: "true",
      STORYTELLER_TTS_SECONDARY_MODEL: "aura-2",
      STORYTELLER_TTS_SECONDARY_LOCALES: "",
    },
    async () => {
      const request = createEnvelope({
        userId: "story-user",
        sessionId: `story-tts-override-${Date.now()}`,
        runId: "story-tts-override",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "story",
          input: {
            prompt: "A concise futuristic fable.",
            language: "en",
            includeImages: false,
            includeVideo: false,
            segmentCount: 1,
          },
        },
      }) as OrchestratorRequest;

      const response = await runStorytellerAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const generation = asObject(output.generation);
      const capabilityProfile = asObject(generation.capabilityProfile);
      const tts = asObject(capabilityProfile.tts);
      const assets = Array.isArray(output.assets) ? output.assets : [];
      const audioAsset = asObject(assets.find((asset) => asObject(asset).kind === "audio"));

      assert.equal(tts.provider, "deepgram");
      assert.equal(tts.model, "aura-2");
      assert.equal(generation.ttsProvider, "deepgram");
      assert.equal(generation.ttsModel, "aura-2");
      assert.equal(generation.ttsDefaultProvider, "gemini_api");
      assert.equal(generation.ttsSelectionReason, "provider_override");
      assert.equal(generation.ttsSecondaryProvider, "deepgram");
      assert.equal(audioAsset.provider, "deepgram");
      assert.equal(audioAsset.model, "aura-2");
    },
  );
});

test("storyteller locale-based tts fallback selects deepgram when locale matches", async () => {
  await withEnv(
    {
      GEMINI_API_KEY: "",
      STORYTELLER_GEMINI_API_KEY: "",
      STORYTELLER_USE_GEMINI_PLANNER: "false",
      STORYTELLER_TTS_PROVIDER_OVERRIDE: null,
      STORYTELLER_TTS_SECONDARY_ENABLED: "true",
      STORYTELLER_TTS_SECONDARY_MODEL: "aura-2",
      STORYTELLER_TTS_SECONDARY_LOCALES: "fr,es",
    },
    async () => {
      const request = createEnvelope({
        userId: "story-user",
        sessionId: `story-tts-locale-${Date.now()}`,
        runId: "story-tts-locale",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "story",
          input: {
            prompt: "A short bilingual harbor tale.",
            language: "fr-FR",
            includeImages: false,
            includeVideo: false,
            segmentCount: 1,
          },
        },
      }) as OrchestratorRequest;

      const response = await runStorytellerAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const generation = asObject(output.generation);
      const capabilityProfile = asObject(generation.capabilityProfile);
      const tts = asObject(capabilityProfile.tts);

      assert.equal(tts.provider, "deepgram");
      assert.equal(generation.ttsProvider, "deepgram");
      assert.equal(generation.ttsSelectionReason, "locale_fallback");
      assert.equal(generation.ttsDefaultProvider, "gemini_api");
      assert.equal(generation.ttsSecondaryProvider, "deepgram");
    },
  );
});
