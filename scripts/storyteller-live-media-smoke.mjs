import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { createEnvelope } from "../shared/contracts/src/index.ts";
import {
  clearStorytellerRuntimeControlPlaneOverride,
  purgeStoryCache,
  runStorytellerAgent,
} from "../agents/storyteller-agent/src/index.ts";

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) {
      continue;
    }
    const body = raw.slice(2);
    const separator = body.indexOf("=");
    if (separator === -1) {
      args[body] = "true";
      continue;
    }
    args[body.slice(0, separator)] = body.slice(separator + 1);
  }
  return args;
}

async function loadDotEnvIfPresent() {
  const envPath = resolve(process.cwd(), ".env");
  try {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(envPath, "utf8");
    for (const rawLine of source.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const separator = line.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      const name = line.slice(0, separator).trim();
      if (!name || Object.prototype.hasOwnProperty.call(process.env, name)) {
        continue;
      }
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[name] = value;
    }
    return envPath;
  } catch {
    return null;
  }
}

function toBoolean(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function asObject(value) {
  return typeof value === "object" && value !== null ? value : {};
}

function roundUp(value, step) {
  return Math.ceil(value / step) * step;
}

const args = parseArgs(process.argv.slice(2));
const dotenvPath = await loadDotEnvIfPresent();
const mediaMode = ["default", "fallback", "simulated"].includes(String(args.mediaMode ?? "default"))
  ? String(args.mediaMode ?? "default")
  : "default";
const includeImages = toBoolean(args.includeImages, false);
const includeVideo = toBoolean(args.includeVideo, true);
const imageEditRequested = toBoolean(args.imageEditRequested, false);
const segmentCount = toPositiveInt(args.segmentCount, 1);
const purgeCacheFirst = toBoolean(args.purgeCache, true);
const prompt = typeof args.prompt === "string" && args.prompt.trim().length > 0
  ? args.prompt.trim()
  : "A short cinematic teaser with one decisive visual beat.";
const imageEditPrompt =
  typeof args.imageEditPrompt === "string" && args.imageEditPrompt.trim().length > 0
    ? args.imageEditPrompt.trim()
    : imageEditRequested
      ? "Preserve continuity, sharpen the lighting arc, and keep the wardrobe consistent."
      : null;
const imageEditReferenceRef =
  typeof args.imageEditReferenceRef === "string" && args.imageEditReferenceRef.trim().length > 0
    ? args.imageEditReferenceRef.trim()
    : imageEditRequested
      ? "style://storyteller-live-smoke/reference-board"
      : null;
const outputPath = resolve(
  process.cwd(),
  typeof args.output === "string" && args.output.trim().length > 0
    ? args.output.trim()
    : "artifacts/storyteller-live-media-smoke/latest.json",
);

const currentVideoPollMs = toPositiveInt(process.env.STORYTELLER_VIDEO_POLL_MS, 5000);
const currentVideoMaxWaitMs = toPositiveInt(process.env.STORYTELLER_VIDEO_MAX_WAIT_MS, 90000);

if (purgeCacheFirst) {
  purgeStoryCache();
}
clearStorytellerRuntimeControlPlaneOverride();

const request = createEnvelope({
  userId: "storyteller-smoke-user",
  sessionId: `storyteller-smoke-${Date.now()}`,
  runId: `storyteller-smoke-run-${Date.now()}`,
  type: "orchestrator.request",
  source: "cli",
  payload: {
    intent: "story",
    input: {
      prompt,
      includeImages,
      includeVideo,
      imageEditRequested,
      imageEditPrompt,
      imageEditReferenceRef,
      segmentCount,
      mediaMode,
    },
  },
});

const startedAtIso = new Date().toISOString();
const startedAtMs = Date.now();
const response = await runStorytellerAgent(request);
const elapsedMs = Date.now() - startedAtMs;
const output = asObject(response.payload?.output);
const generation = asObject(output.generation);
const capabilityProfile = asObject(generation.capabilityProfile);
const imageCapability = asObject(capabilityProfile.image);
const videoCapability = asObject(capabilityProfile.video);
const ttsCapability = asObject(capabilityProfile.tts);
const assets = Array.isArray(output.assets) ? output.assets.map((asset) => asObject(asset)) : [];
const imageAssets = assets.filter((asset) => asset.kind === "image");
const videoAssets = assets.filter((asset) => asset.kind === "video");
const audioAssets = assets.filter((asset) => asset.kind === "audio");
const generationImageEdit = asObject(generation.imageEdit);

const videoFallbackCount = videoAssets.filter((asset) => asset.fallbackAsset === true).length;
const videoReadyCount = videoAssets.filter((asset) => asset.status === "ready").length;
const imageFallbackCount = imageAssets.filter((asset) => asset.fallbackAsset === true).length;
const imageReadyCount = imageAssets.filter((asset) => asset.status === "ready").length;

const tuningHints = includeVideo
  ? {
      heuristicOnly: true,
      currentVideoPollMs,
      currentVideoMaxWaitMs,
      recommendedVideoPollMs: roundUp(Math.max(1000, Math.min(5000, elapsedMs / 8)), 250),
      recommendedVideoMaxWaitMs: roundUp(Math.max(currentVideoMaxWaitMs, elapsedMs + 15000), 5000),
    }
  : null;

const issues = [];
if (response.payload?.status !== "completed") {
  issues.push(`Storyteller run did not complete successfully: ${String(response.payload?.status ?? "unknown")}`);
}
if (mediaMode === "default" && includeImages && imageCapability.mode !== "default") {
  issues.push("Primary image lane did not activate in default mode.");
}
if (mediaMode === "default" && includeVideo && videoCapability.mode !== "default") {
  issues.push("Primary video lane did not activate in default mode.");
}
if (includeImages && imageAssets.length === 0) {
  issues.push("Expected at least one image asset, but none were produced.");
}
if (includeVideo && videoAssets.length === 0) {
  issues.push("Expected at least one video asset, but none were produced.");
}
if (mediaMode === "default" && includeVideo && videoFallbackCount > 0) {
  issues.push("Default video run still produced fallback video assets.");
}
if (mediaMode === "default" && includeImages && imageFallbackCount > 0) {
  issues.push("Default image run still produced fallback image assets.");
}
if (imageEditRequested && generationImageEdit.applied !== true) {
  issues.push("Image edit was requested but did not apply.");
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  startedAt: startedAtIso,
  elapsedMs,
  request: {
    prompt,
    mediaMode,
    includeImages,
    includeVideo,
    imageEditRequested,
    imageEditPrompt,
    imageEditReferenceRef,
    segmentCount,
    purgeCacheFirst,
  },
  env: {
    dotenvPath,
    geminiConfigured: Boolean(process.env.STORYTELLER_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
    falConfigured: Boolean(process.env.FAL_KEY || process.env.FAL_API_KEY),
  },
  observed: {
    status: response.payload?.status ?? "unknown",
    generationMediaMode: generation.mediaMode ?? null,
    imageMode: imageCapability.mode ?? null,
    videoMode: videoCapability.mode ?? null,
    ttsMode: ttsCapability.mode ?? null,
    videoAsync: generation.videoAsync ?? null,
    imageEditMode: generationImageEdit.mode ?? null,
    imageEditApplied: generationImageEdit.applied ?? null,
    imageEditProvider: generationImageEdit.provider ?? null,
    imageReadyCount,
    imageFallbackCount,
    videoReadyCount,
    videoFallbackCount,
    audioReadyCount: audioAssets.filter((asset) => asset.status === "ready").length,
    firstImageRef: imageAssets[0]?.ref ?? null,
    firstVideoRef: videoAssets[0]?.ref ?? null,
  },
  tuningHints,
  issues,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) {
  process.exitCode = 1;
}
