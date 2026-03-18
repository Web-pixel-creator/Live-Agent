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

test("storyteller explicit simulation mode emits Simulation Lab metadata", async () => {
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
        userId: "story-sim-user",
        sessionId: `story-sim-${Date.now()}`,
        runId: "story-sim-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "story",
          input: {
            prompt: "Run a realistic sales rehearsal for a new product pitch.",
            audience: "sales team",
            style: "training",
            language: "en",
            includeImages: false,
            includeVideo: false,
            segmentCount: 3,
            simulationMode: "sales_rehearsal",
          },
        },
      }) as OrchestratorRequest;

      const response = await runStorytellerAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const story = asObject(output.story);
      const generation = asObject(output.generation);
      const generationSimulation = asObject(generation.simulation);
      const simulation = asObject(story.simulation);

      assert.equal(simulation.active, true);
      assert.equal(simulation.track, "simulation_lab");
      assert.equal(simulation.mode, "sales_rehearsal");
      assert.equal(simulation.label, "Sales Rehearsal");
      assert.equal(simulation.role, "sales representative");
      assert.equal(simulation.businessUseCase, "sales coaching");
      assert.equal(simulation.sceneCount, 3);
      assert.equal(simulation.templateSceneCount, 4);
      assert.equal(simulation.mediaFastPath, true);
      assert.equal(simulation.includeImages, false);
      assert.equal(simulation.includeVideo, false);
      assert.ok(Array.isArray(simulation.decisionPoints));
      assert.equal(Array.isArray(simulation.decisionPoints) ? simulation.decisionPoints.length : 0, 3);
      assert.equal(generationSimulation.active, true);
      assert.equal(generationSimulation.track, "simulation_lab");
      assert.equal(generationSimulation.mode, "sales_rehearsal");
      assert.equal(generationSimulation.role, "sales representative");
      assert.equal(generationSimulation.businessUseCase, "sales coaching");
      assert.equal(generationSimulation.templateSceneCount, 4);
      assert.equal(generationSimulation.mediaFastPath, true);
      assert.match(String(output.message ?? ""), /Sales Rehearsal ready/i);
      assert.match(String(story.title ?? ""), /Sales Rehearsal/i);
      assert.match(String(story.logline ?? ""), /sales rehearsal/i);
    },
  );
});

test("storyteller can infer negotiation drill metadata from the prompt", async () => {
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
        userId: "story-sim-user",
        sessionId: `story-sim-${Date.now()}`,
        runId: "story-sim-inferred-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "story",
          input: {
            prompt: "Practice a pricing counteroffer and close the deal cleanly.",
            audience: "partnership team",
            style: "training",
            language: "en",
            includeImages: false,
            includeVideo: false,
            segmentCount: 3,
          },
        },
      }) as OrchestratorRequest;

      const response = await runStorytellerAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const story = asObject(output.story);
      const generation = asObject(output.generation);
      const generationSimulation = asObject(generation.simulation);
      const simulation = asObject(story.simulation);

      assert.equal(simulation.active, true);
      assert.equal(simulation.track, "simulation_lab");
      assert.equal(simulation.mode, "negotiation_drills");
      assert.equal(simulation.role, "deal negotiator");
      assert.equal(simulation.businessUseCase, "deal negotiation");
      assert.equal(simulation.mediaFastPath, true);
      assert.equal(generationSimulation.active, true);
      assert.equal(generationSimulation.track, "simulation_lab");
      assert.equal(generationSimulation.mode, "negotiation_drills");
      assert.equal(generationSimulation.role, "deal negotiator");
      assert.equal(generationSimulation.businessUseCase, "deal negotiation");
      assert.equal(generationSimulation.mediaFastPath, true);
      assert.match(String(story.title ?? ""), /Negotiation Drills/i);
      assert.match(String(story.logline ?? ""), /negotiation/i);
      assert.match(String(output.message ?? ""), /Negotiation Drills ready/i);
    },
  );
});

test("storyteller async simulation media jobs carry Simulation Lab metadata", async () => {
  await withEnv(
    {
      GEMINI_API_KEY: "",
      STORYTELLER_GEMINI_API_KEY: "",
      STORYTELLER_USE_GEMINI_PLANNER: "false",
      STORYTELLER_MEDIA_MODE: "simulated",
      STORYTELLER_MEDIA_WORKER_ENABLED: "false",
      DEEPGRAM_API_KEY: "",
      STORYTELLER_TTS_PROVIDER_OVERRIDE: "gemini_api",
      STORYTELLER_TTS_SECONDARY_ENABLED: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "story-sim-user",
        sessionId: `story-sim-${Date.now()}`,
        runId: "story-sim-media-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "story",
          input: {
            prompt: "Practice the first onboarding flow with a clear product walkthrough.",
            audience: "product team",
            style: "training",
            language: "en",
            includeImages: false,
            includeVideo: true,
            segmentCount: 2,
            simulationMode: "onboarding_simulation",
          },
        },
      }) as OrchestratorRequest;

      const response = await runStorytellerAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const generation = asObject(output.generation);
      const generationSimulation = asObject(generation.simulation);
      const mediaJobs = asObject(output.mediaJobs);
      const videoJobs = Array.isArray(mediaJobs.video) ? mediaJobs.video.map(asObject) : [];

      assert.equal(generationSimulation.track, "simulation_lab");
      assert.equal(generationSimulation.mode, "onboarding_simulation");
      assert.equal(generationSimulation.role, "onboarding specialist");
      assert.equal(generationSimulation.businessUseCase, "customer onboarding");
      assert.equal(generationSimulation.mediaFastPath, false);
      assert.ok(videoJobs.length > 0);
      assert.equal(videoJobs[0].mode, "simulated");
      assert.equal(videoJobs[0].simulationTrack, "simulation_lab");
      assert.equal(videoJobs[0].simulationMode, "onboarding_simulation");
      assert.equal(videoJobs[0].simulationLabel, "Onboarding Simulation");
      assert.equal(videoJobs[0].simulationRole, "onboarding specialist");
      assert.equal(videoJobs[0].simulationBusinessUseCase, "customer onboarding");
      assert.equal(videoJobs[0].simulationSource, "explicit");
    },
  );
});
