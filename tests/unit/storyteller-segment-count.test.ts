import assert from "node:assert/strict";
import test from "node:test";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import {
  resetStorytellerRuntimeControlPlaneOverrideForTests,
  runStorytellerAgent,
} from "../../agents/storyteller-agent/src/index.js";

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

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

test("storyteller fallback pads scenes to the requested segmentCount when the fallback pack is shorter", async () => {
  await withEnv(
    {
      GEMINI_API_KEY: "",
      STORYTELLER_GEMINI_API_KEY: "",
      STORYTELLER_USE_GEMINI_PLANNER: "false",
      DEEPGRAM_API_KEY: "",
      STORYTELLER_TTS_PROVIDER_OVERRIDE: "gemini_api",
      STORYTELLER_TTS_SECONDARY_ENABLED: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "story-user",
        sessionId: `story-segment-count-${Date.now()}`,
        runId: "story-segment-count",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "story",
          input: {
            prompt:
              "Собери 4-сценную историю про запуск нового AI-продукта. Главный герой: основатель стартапа. Тон: кинематографичный, но понятный.",
            language: "ru",
            style: "cinematic",
            includeImages: true,
            includeVideo: false,
            segmentCount: 4,
          },
        },
      }) as OrchestratorRequest;

      const response = await runStorytellerAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const story = asObject(output.story);
      const timeline = Array.isArray(story.timeline) ? story.timeline.map((segment) => asObject(segment)) : [];

      assert.equal(timeline.length, 4, "fallback storyteller runs should honor the requested 4-scene length");
      assert.match(String(output.message ?? ""), /with 4 segments/i, "launch summary should report the padded scene count");
      assert.equal(timeline[3]?.index, 4, "the synthesized scene should keep a stable 1-based scene index");
      assert.equal(
        typeof timeline[3]?.text,
        "string",
        "the synthesized scene should still provide narrative copy for the extra beat",
      );
      assert.ok(
        String(timeline[3]?.text ?? "").trim().length > 0,
        "the synthesized scene text should not be empty",
      );
    },
  );
});

test("storyteller fallback adapts structured launch briefs instead of reusing an unrelated static scenario", async () => {
  await withEnv(
    {
      GEMINI_API_KEY: "",
      STORYTELLER_GEMINI_API_KEY: "",
      STORYTELLER_USE_GEMINI_PLANNER: "false",
      DEEPGRAM_API_KEY: "",
      STORYTELLER_TTS_PROVIDER_OVERRIDE: "gemini_api",
      STORYTELLER_TTS_SECONDARY_ENABLED: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "story-user",
        sessionId: `story-launch-quality-${Date.now()}`,
        runId: "story-launch-quality",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "story",
          input: {
            prompt:
              "Собери 4-сценную историю про запуск нового AI-продукта. Главный герой: основатель стартапа. Тон: кинематографичный, но понятный. Нужно: 4 сцены, один сильный визуальный образ в каждой сцене, короткая финальная озвучка.",
            language: "ru",
            style: "cinematic",
            includeImages: true,
            includeVideo: false,
            segmentCount: 4,
          },
        },
      }) as OrchestratorRequest;

      const response = await runStorytellerAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const story = asObject(output.story);
      const timeline = Array.isArray(story.timeline) ? story.timeline.map((segment) => asObject(segment)) : [];

      assert.equal(timeline.length, 4, "prompt-aware fallback should still honor the requested scene count");
      assert.match(
        String(story.title ?? ""),
        /AI|продукт|запуск/i,
        "fallback title should reflect the launch brief instead of a static unrelated scenario title",
      );
      assert.doesNotMatch(
        String(story.title ?? ""),
        /Transit Accord|Echo Harbor/i,
        "fallback title should no longer fall back to the static city-negotiator scenario for structured launch briefs",
      );
      assert.match(
        timeline.map((segment) => String(segment.text ?? "")).join(" "),
        /стартап|AI|продукт|запуск/i,
        "fallback scene copy should keep the user-requested startup + AI product launch context",
      );
      assert.match(
        String(timeline[0]?.imageRef ?? ""),
        /AI%20Product%20Launch|ai-product-launch/i,
        "fallback media refs should align with the adapted launch scenario instead of city-negotiator placeholders",
      );
    },
  );
});
