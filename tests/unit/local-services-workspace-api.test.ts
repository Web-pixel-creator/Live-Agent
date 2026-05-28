import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalServicesPilotExport,
  LOCAL_SERVICES_WORKSPACE_STORAGE_KEY,
  readLocalServicesWorkspace,
  recordLocalServicesCaseDecision,
  recordLocalServicesSetupEvent,
  saveLocalServicesScenarioOverrides,
  writeLocalServicesWorkspace,
} from "../../apps/api-backend/src/local-services-workspace.ts";
import { DEFAULT_LOCAL_SERVICES_SCENARIOS } from "../../apps/demo-frontend/app-shell/src/lib/local-services-scenarios.ts";

test("local-services workspace API persists pilot state per tenant", () => {
  const tenantId = "unit-local-services";
  const initial = readLocalServicesWorkspace(tenantId);
  assert.equal(initial.storageKey, LOCAL_SERVICES_WORKSPACE_STORAGE_KEY);
  assert.deepEqual(initial.snapshot, {});

  const written = writeLocalServicesWorkspace(tenantId, {
    selectedProspectByService: { "ac-repair-dispatch": "coolmax" },
    scenarioOverrides: DEFAULT_LOCAL_SERVICES_SCENARIOS,
  });
  assert.equal(written.snapshot.selectedProspectByService instanceof Object, true);
  assert.equal(Array.isArray(written.snapshot.scenarioOverrides), true);

  const withDecision = recordLocalServicesCaseDecision(tenantId, "AD-2421", {
    action: "approve",
    reason: "operator approved dispatch draft",
  });
  assert.deepEqual(
    (withDecision.snapshot.operatorDecisionByCaseRef as Record<string, unknown>)["AD-2421"],
    {
      action: "approve",
      reason: "operator approved dispatch draft",
      decidedAt: (withDecision.snapshot.operatorDecisionByCaseRef as Record<string, { decidedAt: string }>)["AD-2421"]
        .decidedAt,
    },
  );

  const withSetupEvent = recordLocalServicesSetupEvent(tenantId, "pricing", {
    lanes: ["ac-repair-dispatch", "plumbing-emergency"],
  });
  assert.equal(Array.isArray(withSetupEvent.snapshot.setupEvents), true);

  const exportPacket = buildLocalServicesPilotExport(tenantId);
  assert.match(exportPacket.humanText, /no outreach, dispatch, CRM write, billing, or customer send/i);
  assert.match(exportPacket.jsonText, /local_services_workspace_api/);
});

test("local-services scenario overrides stay bounded on the API side", () => {
  const tenantId = "unit-local-services-scenarios";
  const saved = saveLocalServicesScenarioOverrides(tenantId, DEFAULT_LOCAL_SERVICES_SCENARIOS);
  assert.equal(Array.isArray(saved.snapshot.scenarioOverrides), true);

  assert.throws(
    () =>
      saveLocalServicesScenarioOverrides(tenantId, [
        {
          id: "restaurant-booking",
        },
      ]),
    /unsupported scenario id/,
  );
});
