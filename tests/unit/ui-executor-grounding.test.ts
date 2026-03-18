import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeGroundingRefMap,
  resolveGroundingObservation,
  resolveGroundingTarget,
} from "../../apps/ui-executor/src/grounding.ts";

test("ui-executor grounding resolves field selectors from synthetic DOM context", () => {
  const observation = resolveGroundingObservation("field:email", {
    domSnapshot: "<main><input id='email' name='email' /></main>",
    accessibilityTree: null,
    markHints: ["email_field@(420,280)"],
  });
  assert.equal(observation, "grounding-confirmed field:email");
});

test("ui-executor grounding resolves generic button selectors from DOM or accessibility hints", () => {
  const observation = resolveGroundingObservation('css:button,[role="button"],input[type="button"],input[type="submit"]', {
    domSnapshot: "<main><header><button id='refresh'>Refresh</button></header></main>",
    accessibilityTree: "main > header > button[name=Refresh]",
    markHints: ["refresh_button@(192,96)"],
  });
  assert.equal(observation, "grounding-confirmed button selector");
});

test("ui-executor grounding resolves submit controls from synthetic context", () => {
  const observation = resolveGroundingObservation("button:submit", {
    domSnapshot: "<form><button type='submit'>Submit order</button></form>",
    accessibilityTree: null,
    markHints: ["submit_order@(620,520)"],
  });
  assert.equal(observation, "grounding-confirmed submit control");
});

test("ui-executor grounding resolves bare id selectors emitted by Gemini planner", () => {
  const observation = resolveGroundingObservation("#email", {
    domSnapshot: "<main><form><input id='email' name='email' /></form></main>",
    accessibilityTree: "main > form > textbox[name=email]",
    markHints: ["email_field@(420,280)"],
  });
  assert.equal(observation, "grounding-confirmed css:#email");
});

test("ui-executor grounding resolves bare name selectors emitted by Gemini planner", () => {
  const observation = resolveGroundingObservation("[name=note]", {
    domSnapshot: "<main><form><textarea id='note' name='note'></textarea></form></main>",
    accessibilityTree: "main > form > textbox[name=note]",
    markHints: ["note_field@(420,360)"],
  });
  assert.equal(observation, "grounding-confirmed css:[name=note]");
});

test("ui-executor grounding returns null when target has no matching context", () => {
  const observation = resolveGroundingObservation("field:cardLabel", {
    domSnapshot: "<main><button id='refresh'>Refresh</button></main>",
    accessibilityTree: "main > header > button[name=Refresh]",
    markHints: [],
  });
  assert.equal(observation, null);
});

test("ui-executor grounding resolves stable ref targets from refMap", () => {
  const refMap = normalizeGroundingRefMap({
    email: {
      selector: "#email",
      kind: "field",
      label: "Email field",
      aliases: ["email", "work email"],
    },
  });
  const resolved = resolveGroundingTarget("ref:email", {
    refMap,
  });
  const observation = resolveGroundingObservation("ref:email", {
    domSnapshot: "<main><form><input id='email' name='email' /></form></main>",
    accessibilityTree: "main > form > textbox[name=email]",
    markHints: ["email_field@(420,280)"],
    refMap,
  });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.selector, "#email");
  assert.equal(observation, "grounding-confirmed ref:email");
});

test("ui-executor grounding reports missing refs when refMap entry is absent", () => {
  const resolved = resolveGroundingTarget("ref:submit_primary", {
    refMap: normalizeGroundingRefMap({}),
  });
  assert.equal(resolved.status, "missing_ref");
  assert.equal(resolved.selector, null);
});
