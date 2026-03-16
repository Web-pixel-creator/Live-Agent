import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("local development doc stays aligned with current quick-start scripts and in-process agent baseline", () => {
  const doc = readFileSync(resolve(process.cwd(), "docs", "local-development.md"), "utf8");
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const orchestratorIndex = readFileSync(resolve(process.cwd(), "agents", "orchestrator", "src", "index.ts"), "utf8");
  const orchestratorFlow = readFileSync(
    resolve(process.cwd(), "agents", "orchestrator", "src", "orchestrate.ts"),
    "utf8",
  );

  for (const token of [
    "npm run dev:orchestrator",
    "npm run dev:api",
    "npm run dev:gateway",
    "npm run dev:ui-executor",
    "npm run dev:frontend",
    "npm run dev:live-mock",
    "Current baseline note:",
    "dev:orchestrator` already links the repo-owned domain agents in-process",
    "npm run dev:live-agent",
    "npm run dev:storyteller-agent",
    "npm run dev:ui-agent",
    "npm run test:unit",
    "npm run build",
    "npm run verify:release",
    "npm run verify:release:strict",
  ]) {
    assert.ok(doc.includes(token), `local development doc missing token: ${token}`);
  }

  assert.equal(packageJson.scripts?.["dev:orchestrator"], "npm run dev -w @mla/orchestrator");
  assert.equal(packageJson.scripts?.["dev:api"], "npm run dev -w @mla/api-backend");
  assert.equal(packageJson.scripts?.["dev:gateway"], "npm run dev -w @mla/realtime-gateway");
  assert.equal(packageJson.scripts?.["dev:ui-executor"], "npm run dev -w @mla/ui-executor");
  assert.equal(packageJson.scripts?.["dev:frontend"], "npm run dev -w @mla/demo-frontend");
  assert.equal(packageJson.scripts?.["dev:live-agent"], "npm run dev -w @mla/live-agent");
  assert.equal(packageJson.scripts?.["dev:storyteller-agent"], "npm run dev -w @mla/storyteller-agent");
  assert.equal(packageJson.scripts?.["dev:ui-agent"], "npm run dev -w @mla/ui-navigator-agent");

  assert.ok(orchestratorIndex.includes('} from "@mla/storyteller-agent";'));
  assert.ok(orchestratorFlow.includes('import { runLiveAgent } from "@mla/live-agent";'));
  assert.ok(orchestratorFlow.includes('import { runStorytellerAgent } from "@mla/storyteller-agent";'));
  assert.ok(orchestratorFlow.includes('import { runUiNavigatorAgent } from "@mla/ui-navigator-agent";'));
});
