import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeSurfaceInventorySnapshot } from "../../apps/api-backend/src/runtime-surface-inventory.js";

test("runtime surface inventory exposes agent, route, control-plane, evidence, and skills overlays", async () => {
  const snapshot = await buildRuntimeSurfaceInventorySnapshot({
    env: {},
    cwd: process.cwd(),
  });

  assert.equal(snapshot.source, "repo_owned_runtime_surface_inventory");
  assert.equal(snapshot.inventoryVersion, 1);
  assert.equal(snapshot.agents.length, 3);
  assert.equal(snapshot.routes.length, 6);
  assert.ok(snapshot.controlPlane.some((item) => item.path === "/v1/runtime/surface"));
  assert.ok(snapshot.controlPlane.some((item) => item.path === "/v1/runtime/surface/readiness"));
  assert.ok(snapshot.evidence.some((item) => item.id === "ui-replay-bundle"));
  assert.ok(snapshot.uiCapabilities.some((item) => item.id === "ui-post-action-verification"));
  assert.ok(snapshot.playbooks.length >= 2);
  assert.ok(snapshot.skills.catalog.personaCount >= 1);
  assert.ok(snapshot.skills.catalog.recipeCount >= 1);
  assert.equal(snapshot.skills.runtimeByAgent.length, 3);
  assert.ok(snapshot.skills.runtimeByAgent.some((item) => item.agentId === "live-agent"));
  assert.ok(snapshot.summary.totalRuntimeActiveSkills >= 0);
  assert.ok(snapshot.summary.totalReleaseCriticalEntries >= 1);
});
