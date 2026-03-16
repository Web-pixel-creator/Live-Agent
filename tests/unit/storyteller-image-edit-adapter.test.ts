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

test("storyteller image edit request applies fal continuity pass with lineage metadata", async () => {
  await withEnv(
    {
      GEMINI_API_KEY: "",
      STORYTELLER_GEMINI_API_KEY: "",
      STORYTELLER_USE_GEMINI_PLANNER: "false",
      STORYTELLER_IMAGE_EDIT_ENABLED: "false",
      STORYTELLER_IMAGE_EDIT_MODEL: "fal-ai/nano-banana-2/edit",
    },
    async () => {
      const request = createEnvelope({
        userId: "story-user",
        sessionId: `story-image-edit-${Date.now()}`,
        runId: "story-image-edit",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "story",
          input: {
            prompt: "A short cinematic harbor sequence with strong continuity.",
            includeImages: true,
            includeVideo: false,
            imageEditRequested: true,
            imageEditPrompt: "Preserve wardrobe continuity and sharpen lighting cues.",
            imageEditReferenceRef: "style://harbor/continuity-board",
            segmentCount: 2,
          },
        },
      }) as OrchestratorRequest;

      const response = await runStorytellerAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const generation = asObject(output.generation);
      const capabilityProfile = asObject(generation.capabilityProfile);
      const imageEdit = asObject(capabilityProfile.image_edit);
      const imageEditSummary = asObject(generation.imageEdit);
      const assets = Array.isArray(output.assets) ? output.assets.map((asset) => asObject(asset)) : [];
      const imageAsset = assets.find((asset) => asset.kind === "image");

      assert.equal(imageEdit.provider, "fal");
      assert.equal(imageEdit.model, "fal-ai/nano-banana-2/edit");
      assert.equal(imageEdit.mode, "fallback");
      assert.equal(imageEditSummary.requested, true);
      assert.equal(imageEditSummary.applied, true);
      assert.equal(imageEditSummary.defaultProvider, "fal");
      assert.equal(imageEditSummary.defaultModel, "fal-ai/nano-banana-2/edit");
      assert.equal(imageEditSummary.selectionReason, "request_input");
      assert.equal(imageEditSummary.referenceRef, "style://harbor/continuity-board");
      assert.ok(Number(imageEditSummary.editedAssetCount) >= 1);
      assert.ok(imageAsset);
      assert.equal(imageAsset?.provider, "fal");
      assert.equal(imageAsset?.model, "fal-ai/nano-banana-2/edit");
      assert.equal(typeof imageAsset?.sourceRef, "string");
      assert.equal(imageAsset?.sourceProvider, "google_cloud");
      assert.equal(imageAsset?.sourceModel, "imagen-4");
      assert.notEqual(imageAsset?.ref, imageAsset?.sourceRef);
    },
  );
});
