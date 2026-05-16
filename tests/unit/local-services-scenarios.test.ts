import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCAL_SERVICES_SCENARIOS,
  LOCAL_SERVICES_SCENARIO_IDS,
  mergeLocalServicesScenarioOverrides,
  parseLocalServicesScenario,
  parseLocalServicesScenarioList,
} from "../../apps/demo-frontend/app-shell/src/lib/local-services-scenarios.ts";

test("local-services scenarios keep the four fixed P0 lanes valid", () => {
  assert.deepEqual(
    DEFAULT_LOCAL_SERVICES_SCENARIOS.map((scenario) => scenario.id),
    [...LOCAL_SERVICES_SCENARIO_IDS],
  );

  for (const scenario of DEFAULT_LOCAL_SERVICES_SCENARIOS) {
    assert.deepEqual(parseLocalServicesScenario(scenario), scenario);
    assert.equal(scenario.operatorGate.requiresApproval, true);
    assert.ok(scenario.operatorGate.blocks.length > 0);
    assert.ok(scenario.outOfScope.length > 0);
  }
});

test("local-services scenario overrides stay bounded to the fixed scenario set", () => {
  const override = {
    ...DEFAULT_LOCAL_SERVICES_SCENARIOS[0],
    title: "Custom AC pilot script",
  };

  const merged = mergeLocalServicesScenarioOverrides(DEFAULT_LOCAL_SERVICES_SCENARIOS, [override]);
  assert.equal(merged[0].title, "Custom AC pilot script");
  assert.equal(merged[1].title, DEFAULT_LOCAL_SERVICES_SCENARIOS[1].title);

  assert.throws(() => parseLocalServicesScenarioList(DEFAULT_LOCAL_SERVICES_SCENARIOS.slice(0, 3)));
  assert.deepEqual(
    mergeLocalServicesScenarioOverrides(DEFAULT_LOCAL_SERVICES_SCENARIOS, [{ id: "not-supported" }]),
    DEFAULT_LOCAL_SERVICES_SCENARIOS,
  );
});
