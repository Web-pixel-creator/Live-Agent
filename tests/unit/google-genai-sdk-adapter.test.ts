import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  generateGoogleGenAiImage,
  generateGoogleGenAiSpeech,
  generateGoogleGenAiText,
  pollGoogleGenAiVideoOperation,
  resetGoogleGenAiClientCacheForTests,
  startGoogleGenAiVideoOperation,
} from "../../shared/capabilities/src/index.js";

type CapturedRequest = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

async function withMockGeminiServer(
  responder: (request: CapturedRequest) => { statusCode?: number; body: unknown },
  runner: (baseUrl: string, requests: CapturedRequest[]) => Promise<void>,
): Promise<void> {
  const requests: CapturedRequest[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const captured: CapturedRequest = {
      method: req.method ?? "GET",
      url: req.url ?? "/",
      headers: req.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    };
    requests.push(captured);
    const reply = responder(captured);
    res.statusCode = reply.statusCode ?? 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(reply.body));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    resetGoogleGenAiClientCacheForTests();
    await runner(`http://127.0.0.1:${address.port}/v1beta`, requests);
  } finally {
    resetGoogleGenAiClientCacheForTests();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("google genai text adapter uses official SDK request shape and returns usage metadata", async () => {
  await withMockGeminiServer(
    () => ({
      body: {
        candidates: [
          {
            content: {
              parts: [{ text: "sdk-text-ok" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 11,
          candidatesTokenCount: 7,
          totalTokenCount: 18,
        },
      },
    }),
    async (baseUrl, requests) => {
      const result = await generateGoogleGenAiText({
        apiKey: "unit-test-key",
        baseUrl,
        timeoutMs: 5000,
        model: "gemini-3-flash",
        prompt: "hello from sdk",
        responseMimeType: "text/plain",
        temperature: 0.2,
      });

      assert.ok(result);
      assert.equal(result.text, "sdk-text-ok");
      assert.equal(result.usage?.inputTokens, 11);
      assert.equal(result.usage?.outputTokens, 7);
      assert.equal(result.usage?.totalTokens, 18);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "/v1beta/models/gemini-3-flash:generateContent");
      assert.equal(requests[0]?.method, "POST");
      assert.equal(requests[0]?.headers["x-goog-api-key"], "unit-test-key");
      assert.match(requests[0]?.body ?? "", /"responseMimeType":"text\/plain"/);
    },
  );
});

test("google genai speech adapter returns inline audio payload via SDK audio modality", async () => {
  await withMockGeminiServer(
    () => ({
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: Buffer.from("audio-bytes").toString("base64"),
                  },
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      },
    }),
    async (baseUrl, requests) => {
      const result = await generateGoogleGenAiSpeech({
        apiKey: "unit-test-key",
        baseUrl,
        timeoutMs: 5000,
        model: "gemini-2.5-flash-preview-tts",
        text: "narrate this",
        languageCode: "en",
      });

      assert.ok(result);
      assert.equal(result.mimeType, "audio/wav");
      assert.equal(result.audioData, Buffer.from("audio-bytes").toString("base64"));
      assert.equal(result.usage?.totalTokens, 8);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "/v1beta/models/gemini-2.5-flash-preview-tts:generateContent");
      assert.match(requests[0]?.body ?? "", /"responseModalities":\["AUDIO"\]/);
      assert.match(requests[0]?.body ?? "", /"languageCode":"en"/);
    },
  );
});

test("google genai image adapter returns generated image bytes via SDK predict endpoint", async () => {
  await withMockGeminiServer(
    () => ({
      body: {
        predictions: [
          {
            bytesBase64Encoded: Buffer.from("image-bytes").toString("base64"),
            mimeType: "image/png",
          },
        ],
      },
    }),
    async (baseUrl, requests) => {
      const result = await generateGoogleGenAiImage({
        apiKey: "unit-test-key",
        baseUrl,
        timeoutMs: 5000,
        model: "imagen-4",
        prompt: "draw a lighthouse",
        outputMimeType: "image/png",
      });

      assert.ok(result);
      assert.equal(result.mimeType, "image/png");
      assert.equal(result.imageRef, `data:image/png;base64,${Buffer.from("image-bytes").toString("base64")}`);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "/v1beta/models/imagen-4:predict");
      assert.match(requests[0]?.body ?? "", /"prompt":"draw a lighthouse"/);
    },
  );
});

test("google genai image adapter returns inline image payload via Gemini generateContent endpoint", async () => {
  await withMockGeminiServer(
    () => ({
      body: {
        candidates: [
          {
            content: {
              parts: [
                { text: "Here is your image." },
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: Buffer.from("gemini-image-bytes").toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      },
    }),
    async (baseUrl, requests) => {
      const result = await generateGoogleGenAiImage({
        apiKey: "unit-test-key",
        baseUrl,
        timeoutMs: 5000,
        model: "gemini-3.1-flash-image-preview",
        prompt: "draw a cinematic harbor at sunrise",
        outputMimeType: "image/png",
      });

      assert.ok(result);
      assert.equal(result.mimeType, "image/png");
      assert.equal(result.imageRef, `data:image/png;base64,${Buffer.from("gemini-image-bytes").toString("base64")}`);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "/v1beta/models/gemini-3.1-flash-image-preview:generateContent");
      assert.match(requests[0]?.body ?? "", /draw a cinematic harbor at sunrise/);
    },
  );
});

test("google genai video adapter starts and polls long-running operations via SDK", async () => {
  await withMockGeminiServer(
    (request) => {
      if (request.url.endsWith(":predictLongRunning")) {
        return {
          body: {
            name: "operations/video-unit-123",
            done: false,
          },
        };
      }

      return {
        body: {
          name: "operations/video-unit-123",
          done: true,
          response: {
            generateVideoResponse: {
              generatedSamples: [
                {
                  video: {
                    uri: "gs://story-videos/unit-scene.mp4",
                    encoding: "video/mp4",
                  },
                },
              ],
            },
          },
        },
      };
    },
    async (baseUrl, requests) => {
      const started = await startGoogleGenAiVideoOperation({
        apiKey: "unit-test-key",
        baseUrl,
        timeoutMs: 5000,
        model: "veo-3.1",
        prompt: "A launch vehicle lifting through clouds.",
      });

      assert.ok(started);
      assert.equal(started.operationName, "operations/video-unit-123");
      assert.equal(started.done, false);
      assert.equal(started.videoRef, null);

      const completed = await pollGoogleGenAiVideoOperation({
        apiKey: "unit-test-key",
        baseUrl,
        timeoutMs: 5000,
        operationName: started.operationName,
      });

      assert.ok(completed);
      assert.equal(completed.done, true);
      assert.equal(completed.videoRef, "gs://story-videos/unit-scene.mp4");
      assert.equal(completed.mimeType, "video/mp4");
      assert.equal(requests.length, 2);
      assert.equal(requests[0]?.url, "/v1beta/models/veo-3.1:predictLongRunning");
      assert.equal(requests[1]?.url, "/v1beta/operations/video-unit-123");
      assert.equal(requests[1]?.method, "GET");
    },
  );
});
