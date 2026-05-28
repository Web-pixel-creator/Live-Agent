import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSimulationPolicySnapshots,
  findSimulationPolicy,
} from "../../apps/demo-frontend/app-shell/src/lib/runtime-simulation-policies";

test("runtime simulation policies prefer governance templates and carry recent history", () => {
  const policies = buildSimulationPolicySnapshots(
    {
      tenantId: "tenant-demo",
      source: "tenant_override",
      complianceTemplate: "strict",
      requestedTemplateId: "strict",
      fallbackApplied: false,
      retentionPolicy: {
        rawMediaDays: 2,
        signedEvidenceDays: 30,
        auditTrailDays: 180,
      },
      overrideVersion: 7,
      overrideUpdatedAt: "2026-07-01T12:00:00Z",
    },
    {
      source: "tenant_override",
      activeTemplateId: "strict",
      availableTemplates: [
        { id: "baseline", description: "Baseline template for low-friction intake.", isActive: false },
        { id: "strict", description: "Strict template for documentation-heavy reviews.", isActive: true },
        { id: "regulated", description: "Regulated template for no-auto-approve posture.", isActive: false },
      ],
    },
    [
      {
        actionId: "act-7",
        tenantId: "tenant-demo",
        actorRole: "admin",
        createdAt: "2026-07-01T12:00:00Z",
        outcome: "succeeded",
        reason: "governance policy updated",
        errorCode: null,
        complianceTemplate: "strict",
        version: 7,
      },
      {
        actionId: "act-8",
        tenantId: "tenant-demo",
        actorRole: "admin",
        createdAt: "2026-07-02T08:30:00Z",
        outcome: "succeeded",
        reason: "candidate template reviewed",
        errorCode: null,
        complianceTemplate: "regulated",
        version: 8,
      },
    ],
  );

  assert.deepEqual(
    policies.map((policy) => policy.id),
    ["policy-current", "policy-template-baseline", "policy-template-regulated"],
  );

  const current = policies[0];
  assert.equal(current.name, "current · strict");
  assert.equal(current.isLive, true);
  assert.equal(current.runtimeGovernance?.templateId, "strict");
  assert.equal(current.runtimeGovernance?.promoteable, false);

  const regulated = policies.find((policy) => policy.id === "policy-template-regulated");
  assert.ok(regulated);
  if (!regulated) {
    return;
  }
  assert.equal(regulated.runtimeGovernance?.templateId, "regulated");
  assert.equal(regulated.runtimeGovernance?.promoteable, true);
  assert.match(regulated.description, /Promote to live/i);
  assert.match(regulated.description, /Latest succeeded change v8 by admin/i);
  assert.equal(regulated.author, "admin v8");
});

test("runtime simulation policy lookup falls back from template id to the live current snapshot", () => {
  const policies = buildSimulationPolicySnapshots(
    {
      tenantId: "tenant-demo",
      source: "tenant_override",
      complianceTemplate: "strict",
      requestedTemplateId: "strict",
      fallbackApplied: false,
      retentionPolicy: null,
      overrideVersion: 9,
      overrideUpdatedAt: "2026-07-03T09:00:00Z",
    },
    {
      source: "tenant_override",
      activeTemplateId: "strict",
      availableTemplates: [
        { id: "baseline", description: "Baseline template.", isActive: false },
        { id: "strict", description: "Strict template.", isActive: true },
      ],
    },
    [],
  );

  const fallback = findSimulationPolicy("policy-template-strict", policies);
  assert.ok(fallback);
  if (!fallback) {
    return;
  }
  assert.equal(fallback?.id, "policy-current");
  assert.equal(fallback?.runtimeGovernance?.templateId, "strict");
});
