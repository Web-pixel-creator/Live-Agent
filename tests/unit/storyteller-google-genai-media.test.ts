import assert from "node:assert/strict";
import { createServer } from "node:http";
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

test("storyteller mediaMode=default uses Google GenAI SDK-backed image and TTS lanes", async () => {
  const requests: string[] = [];
  const server = createServer(async (req, res) => {
    requests.push(req.url ?? "/");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    if ((req.url ?? "").endsWith(":predict")) {
      res.end(
        JSON.stringify({
          predictions: [
            {
              bytesBase64Encoded: Buffer.from("story-image").toString("base64"),
              mimeType: "image/png",
            },
          ],
        }),
      );
      return;
    }

    res.end(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: Buffer.from("story-audio").toString("base64"),
                  },
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 4,
          candidatesTokenCount: 3,
          totalTokenCount: 7,
        },
      }),
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1beta`;

  try {
    await withEnv(
      {
        GEMINI_API_BASE_URL: baseUrl,
        GEMINI_API_KEY: "story-sdk-key",
        STORYTELLER_GEMINI_API_KEY: "story-sdk-key",
        STORYTELLER_USE_GEMINI_PLANNER: "false",
        STORYTELLER_MEDIA_MODE: "default",
        STORYTELLER_TTS_MODEL: "gemini-2.5-flash-preview-tts",
        STORYTELLER_TTS_PROVIDER_OVERRIDE: "gemini_api",
        STORYTELLER_TTS_SECONDARY_ENABLED: "false",
      },
      async () => {
        const request = createEnvelope({
          userId: "story-sdk-user",
          sessionId: `story-sdk-${Date.now()}`,
          runId: "story-sdk-run",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "story",
            input: {
              prompt: "A short cinematic launch vignette.",
              includeImages: true,
              includeVideo: false,
              segmentCount: 2,
              mediaMode: "default",
            },
          },
        }) as OrchestratorRequest;

        const response = await runStorytellerAgent(request);
        assert.equal(response.payload.status, "completed");

        const output = asObject(response.payload.output);
        const generation = asObject(output.generation);
        const capabilityProfile = asObject(generation.capabilityProfile);
        const imageCapability = asObject(capabilityProfile.image);
        const ttsCapability = asObject(capabilityProfile.tts);
        const assets = Array.isArray(output.assets) ? output.assets.map((asset) => asObject(asset)) : [];
        const imageAsset = assets.find((asset) => asset.kind === "image");
        const audioAsset = assets.find((asset) => asset.kind === "audio");

        assert.equal(generation.mediaMode, "default");
        assert.equal(imageCapability.mode, "default");
        assert.equal(ttsCapability.mode, "default");
        assert.equal(imageAsset?.fallbackAsset, false);
        assert.equal(audioAsset?.fallbackAsset, false);
        assert.equal(imageAsset?.provider, "google_cloud");
        assert.equal(audioAsset?.provider, "gemini_api");
        assert.match(String(imageAsset?.ref ?? ""), /^data:image\/png;base64,/i);
        assert.match(String(audioAsset?.ref ?? ""), /^data:audio\/wav;base64,/i);
      },
    );

    assert.ok(requests.some((url) => url.endsWith("/models/imagen-4:predict")));
    assert.ok(requests.some((url) => url.endsWith("/models/gemini-2.5-flash-preview-tts:generateContent")));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("storyteller mediaMode=default uses Google GenAI SDK-backed video lane", async () => {
  const requests: string[] = [];
  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";
    requests.push(url);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    if (url.endsWith(":predictLongRunning")) {
      res.end(
        JSON.stringify({
          name: "operations/story-video-123",
          done: false,
        }),
      );
      return;
    }

    if (url.endsWith("/operations/story-video-123")) {
      res.end(
        JSON.stringify({
          name: "operations/story-video-123",
          done: true,
          response: {
            generateVideoResponse: {
              generatedSamples: [
                {
                  video: {
                    uri: "gs://story-videos/live-scene-1.mp4",
                    encoding: "video/mp4",
                  },
                },
              ],
            },
          },
        }),
      );
      return;
    }

    res.end(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: Buffer.from("story-audio").toString("base64"),
                  },
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 4,
          candidatesTokenCount: 3,
          totalTokenCount: 7,
        },
      }),
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1beta`;

  try {
    await withEnv(
      {
        GEMINI_API_BASE_URL: baseUrl,
        GEMINI_API_KEY: "story-sdk-key",
        STORYTELLER_GEMINI_API_KEY: "story-sdk-key",
        STORYTELLER_USE_GEMINI_PLANNER: "false",
        STORYTELLER_MEDIA_MODE: "default",
        STORYTELLER_VIDEO_POLL_MS: "5",
        STORYTELLER_VIDEO_MAX_WAIT_MS: "200",
        STORYTELLER_TTS_MODEL: "gemini-2.5-flash-preview-tts",
        STORYTELLER_TTS_PROVIDER_OVERRIDE: "gemini_api",
        STORYTELLER_TTS_SECONDARY_ENABLED: "false",
      },
      async () => {
        const request = createEnvelope({
          userId: "story-video-user",
          sessionId: `story-video-${Date.now()}`,
          runId: "story-video-run",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "story",
            input: {
              prompt: "A kinetic teaser with one hero shot.",
              includeImages: false,
              includeVideo: true,
              segmentCount: 2,
              mediaMode: "default",
            },
          },
        }) as OrchestratorRequest;

        const response = await runStorytellerAgent(request);
        assert.equal(response.payload.status, "completed");

        const output = asObject(response.payload.output);
        const generation = asObject(output.generation);
        const capabilityProfile = asObject(generation.capabilityProfile);
        const videoCapability = asObject(capabilityProfile.video);
        const assets = Array.isArray(output.assets) ? output.assets.map((asset) => asObject(asset)) : [];
        const videoAsset = assets.find((asset) => asset.kind === "video");

        assert.equal(generation.mediaMode, "default");
        assert.equal(generation.videoAsync, false);
        assert.equal(videoCapability.mode, "default");
        assert.equal(videoCapability.adapterId, "google-genai-sdk-veo");
        assert.equal(videoAsset?.fallbackAsset, false);
        assert.equal(videoAsset?.provider, "google_cloud");
        assert.equal(videoAsset?.status, "ready");
        assert.equal(videoAsset?.ref, "gs://story-videos/live-scene-1.mp4");
        assert.equal(videoAsset?.jobId, null);
      },
    );

    assert.ok(requests.some((url) => url.endsWith("/models/veo-3.1:predictLongRunning")));
    assert.ok(requests.some((url) => url.endsWith("/operations/story-video-123")));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
