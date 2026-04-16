import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const releaseEvidenceReportScriptPath = resolve(process.cwd(), "scripts", "release-evidence-report.ps1");

function resolvePowerShellBinary(): string | null {
  const candidates = process.platform === "win32" ? ["powershell", "pwsh"] : ["pwsh", "powershell"];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      encoding: "utf8",
    });
    if (probe.status === 0) {
      return candidate;
    }
  }
  return null;
}

const powershellBin = resolvePowerShellBinary();
const skipIfNoPowerShell = powershellBin ? false : "PowerShell binary is not available";

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

function createPassingCaseWikiComplianceEvidence(
  signatureStatus: "signed" | "unsigned" = "signed",
): Record<string, unknown> {
  const enabled = signatureStatus === "signed";
  const keyState = signatureStatus === "signed" ? "loaded" : "missing";
  const keyId = signatureStatus === "signed" ? "local-dev-key" : null;
  return {
    status: "pass",
    validated: true,
    observed: true,
    tenantId: "governance-demo-tenant",
    templateId: "strict",
    requestedTemplateId: "strict",
    source: "tenant_override",
    fallbackApplied: false,
    controls: {
      piiRedactionLevel: "high",
      crossTenantAdminOnly: true,
      approvalSlaEnforced: true,
      auditTrailRequired: true,
    },
    retention: {
      rawMediaDays: 2,
      auditLogsDays: 540,
      eventsDays: 400,
      sessionsDays: 45,
    },
    evidenceSigning: {
      enabled,
      expectedSignatureStatus: signatureStatus,
      keyState,
      signerId: "api-backend",
      keyId,
    },
    observedSignatureStatus: signatureStatus,
    signatureMatch: true,
    summary: `template=strict | tenant_override | pii=high | rawMedia=2d | audit=required | signing=${signatureStatus}`,
  };
}

test(
  "release evidence report surfaces hosted direct-live proof in report and manifest",
  { skip: skipIfNoPowerShell },
  () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "release-evidence-report-hosted-proof-"));
    const badgeDetailsPath = join(tempRoot, "artifacts", "demo-e2e", "badge-details.json");
    const directLiveProofPath = join(tempRoot, "artifacts", "deploy", "direct-live-proof.json");
    const outputJsonPath = join(tempRoot, "artifacts", "release-evidence", "report.json");
    const outputMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "report.md");
    const outputRuntimeProofJsonPath = join(tempRoot, "artifacts", "release-evidence", "runtime-proof-report.json");
    const outputRuntimeProofMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "runtime-proof-report.md");
    const outputManifestJsonPath = join(tempRoot, "artifacts", "release-evidence", "manifest.json");
    const outputManifestMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "manifest.md");

    writeJson(badgeDetailsPath, {
      liveTransport: {
        status: "pass",
        validated: true,
        runtime: {
          validated: true,
          requestedMode: "direct_live",
          activeMode: "direct_live",
          fallbackActive: false,
          evidenceSource: "runtime.lifecycle.endpoints",
        },
        session: {
          observed: true,
          activeMode: "direct_live",
          provider: "gemini_live_api",
          model: "gemini-live-2.5-flash-native-audio",
          bootstrapState: "prepared_direct",
          fallbackReason: null,
          evidenceSource: "session_events",
          connectedEventType: "session.connected",
        },
        summary: "runtime=direct_live | session=direct_live | source=session_events",
      },
      evidence: {
        caseWikiEvidenceSignature: {
          status: "pass",
          validated: true,
          totalArtifacts: 1,
          signedArtifacts: 1,
          unsignedArtifacts: 0,
          signatureStatus: "signed",
          algorithm: "ed25519-sha256",
          canonicalization: "json-stable-v1",
          payloadHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          signerId: "api-backend",
          signedAt: "2026-04-11T00:00:00.000Z",
          signedAtIsIso: true,
          signaturePresent: true,
          caseId: "case-123",
          sessionId: "session-123",
          overviewStatus: "active",
          nextAction: "Request passport scan",
          sourceRefsCount: 1,
        },
        caseWikiCompliance: createPassingCaseWikiComplianceEvidence("signed"),
        caseWikiRoutingContext: {
          status: "pass",
          validated: true,
          observed: true,
          contextSource: "case_wiki",
          focusId: "question:passport-scan",
          blocker: "Need passport scan",
          nextAction: "Request passport scan",
          route: "live-agent",
          mode: "deterministic",
          requestedIntent: "conversation",
          routedIntent: "conversation",
        },
        caseWikiGatewayHydration: {
          status: "pass",
          validated: true,
          observed: true,
          sessionId: "session-hydration-123",
          noteEventId: "event-case-wiki-note-123",
          questionId: "question:operator-note:event-case-wiki-note-123",
          questionMatched: true,
          noteSourceRefSeen: true,
          questionSuggestedNextStep: "Request passport scan",
          contextSource: "case_wiki",
          focusId: "question:operator-note:event-case-wiki-note-123",
          blocker: "Need passport scan",
          nextAction: "Request passport scan",
          route: "live-agent",
          mode: "assistive_override",
          requestedIntent: "conversation",
          routedIntent: "conversation",
        },
        caseWikiContextAdoption: {
          status: "pass",
          validated: true,
          observed: true,
          observedCount: 21,
          caseWikiObservedCount: 20,
          inputOnlyObservedCount: 1,
          unknownObservedCount: 0,
          caseWikiRate: 0.952381,
        },
        uiRefHealing: {
          status: "pass",
          validated: true,
          observed: true,
          finalStatus: "completed",
          adapterMode: "remote_http",
          healedRefCount: 2,
          healedRefTargets: ["email", "submit_primary"],
          staleRefCount: 0,
          staleRefTargets: [],
          traceCount: 5,
          retries: 0,
          disabledSubmitSeen: true,
          enabledSubmitSeen: true,
          healingObservationSeen: true,
          healingNoteSeen: true,
        },
        browserWorkerRecovery: {
          status: "pass",
          validated: true,
          observed: true,
          finalStatus: "completed",
          adapterMode: "remote_http",
          checkpointCount: 1,
          resumedCheckpointCount: 1,
          healedRefCount: 2,
          healedRefTargets: ["email", "submit_primary"],
          staleRefCount: 2,
          staleRefTargets: ["email", "submit_primary"],
          traceCount: 7,
          retryCount: 0,
          runtimeRetryCount: 0,
          runtimeResumedCheckpointCount: 1,
          runtimeStaleRefCount: 2,
          runtimeHealedRefCount: 2,
          checkpointReadyCleared: true,
          summary: "healed 2 stale grounding refs; resumed 1 checkpoint.",
        },
        navigatorVisaFlows: {
          status: "pass",
          validated: true,
          observed: true,
          totalFlows: 3,
          succeededFlows: 3,
          successRate: 1,
          persistentSessionCount: 3,
          replayBundleCount: 3,
          verifiedCount: 3,
          staleRecoveryObservedCount: 3,
          healedRecoveryObservedCount: 3,
          resumedCheckpointCount: 3,
          checkpointReadyClearedCount: 3,
          scenarioNames: ["reminder", "handoff", "escalation"],
          summary: "3/3 visa flows passed; persistent=3; verified=3; staleRecovery=3; resumed=3.",
        },
      },
      providerUsage: {
        status: "pass",
        validated: true,
        activeSecondaryProviders: 0,
        entries: [],
      },
    });

    const hostedProofGeneratedAt = new Date().toISOString();

    writeJson(directLiveProofPath, {
      generatedAt: hostedProofGeneratedAt,
      status: "pass",
      frontendPublicUrl: "https://live-agent-frontend-production.up.railway.app",
      apiPublicUrl: "https://live-agent-api-production.up.railway.app",
      apiPublicUrlSource: "frontend_config",
      requestedSessionId: "requested-session-123",
      sessionId: "session-123",
      runtimeStatus: {
        preferredMode: "direct_live",
        activeMode: "direct_live",
      },
      replay: {
        liveTransport: {
          activeMode: "direct_live",
          evidenceSource: "session_events",
          firstAudioMs: 640,
          firstOutputMs: 410,
          fallbackEventCount: 0,
          fallbackReason: null,
        },
      },
      runtimeDiagnostics: {
        apiBackendEvidenceSigning: {
          expectedSignatureStatus: "signed",
          keyState: "loaded",
        },
      },
      caseWikiEvidenceSignatureExpectation: {
        expectedStatus: "signed",
        source: "runtime_diagnostics",
      },
      caseWiki: {
        evidenceSignature: {
          status: "signed",
          signaturePresent: true,
        },
      },
      summary: "direct_live observed via session_events",
    });

    const result = spawnSync(
      powershellBin!,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        releaseEvidenceReportScriptPath,
        "-BadgeDetailsPath",
        badgeDetailsPath,
        "-OutputJsonPath",
        outputJsonPath,
        "-OutputMarkdownPath",
        outputMarkdownPath,
        "-OutputManifestJsonPath",
        outputManifestJsonPath,
        "-OutputManifestMarkdownPath",
        outputManifestMarkdownPath,
      ],
      {
        cwd: tempRoot,
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);

    const report = JSON.parse(readFileSync(outputJsonPath, "utf8")) as {
      statuses: {
        hostedDirectLiveProofStatus?: string;
        caseWikiGatewayHydrationStatus?: string;
        caseWikiContextAdoptionStatus?: string;
        uiRefHealingStatus?: string;
        browserWorkerRecoveryStatus?: string;
        navigatorVisaFlowsStatus?: string;
      };
      hostedDirectLiveProof: {
        observed?: boolean;
        generatedAt?: string | null;
        generatedAtIsIso?: boolean;
        freshnessStatus?: string;
        freshnessSummary?: string | null;
        freshnessAgeMinutes?: number | null;
        freshnessMaxAgeHours?: number | null;
        apiPublicUrlSource?: string;
        firstAudioMs?: number | null;
        firstOutputMs?: number | null;
        replayEvidenceSource?: string | null;
        runtimeEvidenceExpectedSignatureStatus?: string | null;
        runtimeEvidenceKeyState?: string | null;
        caseWikiExpectedSignatureStatus?: string | null;
        caseWikiExpectedSignatureSource?: string | null;
        caseWikiSignatureStatus?: string | null;
        latencyObserved?: boolean;
      };
      caseWikiEvidenceSignature: {
        source?: string | null;
        status?: string;
        validated?: boolean;
        signatureStatus?: string | null;
      };
      caseWikiGatewayHydration: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        sessionId?: string | null;
        noteEventId?: string | null;
        questionId?: string | null;
        questionMatched?: boolean | null;
        noteSourceRefSeen?: boolean | null;
        questionSuggestedNextStep?: string | null;
        contextSource?: string | null;
        focusId?: string | null;
        blocker?: string | null;
        nextAction?: string | null;
        route?: string | null;
        mode?: string | null;
        requestedIntent?: string | null;
        routedIntent?: string | null;
      };
      caseWikiContextAdoption: {
        status?: string;
        observedCount?: number;
        caseWikiObservedCount?: number;
        inputOnlyObservedCount?: number;
        caseWikiRate?: number | null;
      };
      uiRefHealing: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        finalStatus?: string | null;
        adapterMode?: string | null;
        healedRefCount?: number;
        healedRefTargets?: string[];
        staleRefCount?: number;
        staleRefTargets?: string[];
        traceCount?: number;
        retries?: number;
        disabledSubmitSeen?: boolean | null;
        enabledSubmitSeen?: boolean | null;
        healingObservationSeen?: boolean | null;
        healingNoteSeen?: boolean | null;
      };
      browserWorkerRecovery: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        finalStatus?: string | null;
        adapterMode?: string | null;
        checkpointCount?: number;
        resumedCheckpointCount?: number;
        healedRefCount?: number;
        healedRefTargets?: string[];
        staleRefCount?: number;
        staleRefTargets?: string[];
        traceCount?: number;
        retryCount?: number;
        runtimeRetryCount?: number;
        runtimeResumedCheckpointCount?: number;
        runtimeStaleRefCount?: number;
        runtimeHealedRefCount?: number;
        checkpointReadyCleared?: boolean | null;
        summary?: string | null;
      };
      navigatorVisaFlows: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        totalFlows?: number;
        succeededFlows?: number;
        successRate?: number | null;
        persistentSessionCount?: number;
        replayBundleCount?: number;
        verifiedCount?: number;
        staleRecoveryObservedCount?: number;
        healedRecoveryObservedCount?: number;
        resumedCheckpointCount?: number;
        checkpointReadyClearedCount?: number;
        scenarioNames?: string[];
        summary?: string | null;
      };
    };
    assert.equal(report.statuses.hostedDirectLiveProofStatus, "pass");
    assert.equal(report.statuses.caseWikiGatewayHydrationStatus, "pass");
    assert.equal(report.statuses.caseWikiContextAdoptionStatus, "pass");
    assert.equal(report.statuses.uiRefHealingStatus, "pass");
    assert.equal(report.statuses.browserWorkerRecoveryStatus, "pass");
    assert.equal(report.statuses.navigatorVisaFlowsStatus, "pass");
    assert.equal(report.hostedDirectLiveProof.observed, true);
    assert.equal(Date.parse(report.hostedDirectLiveProof.generatedAt ?? ""), Date.parse(hostedProofGeneratedAt));
    assert.equal(report.hostedDirectLiveProof.generatedAtIsIso, true);
    assert.equal(report.hostedDirectLiveProof.freshnessStatus, "pass");
    assert.equal(report.hostedDirectLiveProof.freshnessMaxAgeHours, 24);
    assert.equal(typeof report.hostedDirectLiveProof.freshnessAgeMinutes, "number");
    assert.match(report.hostedDirectLiveProof.freshnessSummary ?? "", /fresh:/);
    assert.equal(report.hostedDirectLiveProof.apiPublicUrlSource, "frontend_config");
    assert.equal(report.hostedDirectLiveProof.replayEvidenceSource, "session_events");
    assert.equal(report.hostedDirectLiveProof.firstAudioMs, 640);
    assert.equal(report.hostedDirectLiveProof.firstOutputMs, 410);
    assert.equal(report.hostedDirectLiveProof.runtimeEvidenceExpectedSignatureStatus, "signed");
    assert.equal(report.hostedDirectLiveProof.runtimeEvidenceKeyState, "loaded");
    assert.equal(report.hostedDirectLiveProof.caseWikiExpectedSignatureStatus, "signed");
    assert.equal(report.hostedDirectLiveProof.caseWikiExpectedSignatureSource, "runtime_diagnostics");
    assert.equal(report.hostedDirectLiveProof.caseWikiSignatureStatus, "signed");
    assert.equal(report.hostedDirectLiveProof.latencyObserved, true);
    assert.equal(report.caseWikiEvidenceSignature.source, "hosted_direct_live_proof");
    assert.equal(report.caseWikiEvidenceSignature.status, "pass");
    assert.equal(report.caseWikiEvidenceSignature.validated, true);
    assert.equal(report.caseWikiEvidenceSignature.signatureStatus, "signed");
    assert.equal(report.caseWikiGatewayHydration.status, "pass");
    assert.equal(report.caseWikiGatewayHydration.validated, true);
    assert.equal(report.caseWikiGatewayHydration.observed, true);
    assert.equal(report.caseWikiGatewayHydration.sessionId, "session-hydration-123");
    assert.equal(report.caseWikiGatewayHydration.noteEventId, "event-case-wiki-note-123");
    assert.equal(report.caseWikiGatewayHydration.questionId, "question:operator-note:event-case-wiki-note-123");
    assert.equal(report.caseWikiGatewayHydration.questionMatched, true);
    assert.equal(report.caseWikiGatewayHydration.noteSourceRefSeen, true);
    assert.equal(report.caseWikiGatewayHydration.questionSuggestedNextStep, "Request passport scan");
    assert.equal(report.caseWikiGatewayHydration.contextSource, "case_wiki");
    assert.equal(report.caseWikiGatewayHydration.focusId, "question:operator-note:event-case-wiki-note-123");
    assert.equal(report.caseWikiGatewayHydration.blocker, "Need passport scan");
    assert.equal(report.caseWikiGatewayHydration.nextAction, "Request passport scan");
    assert.equal(report.caseWikiGatewayHydration.route, "live-agent");
    assert.equal(report.caseWikiGatewayHydration.mode, "assistive_override");
    assert.equal(report.caseWikiGatewayHydration.requestedIntent, "conversation");
    assert.equal(report.caseWikiGatewayHydration.routedIntent, "conversation");
    assert.equal(report.caseWikiContextAdoption.status, "pass");
    assert.equal(report.caseWikiContextAdoption.observedCount, 21);
    assert.equal(report.caseWikiContextAdoption.caseWikiObservedCount, 20);
    assert.equal(report.caseWikiContextAdoption.inputOnlyObservedCount, 1);
    assert.equal(report.caseWikiContextAdoption.caseWikiRate, 0.952381);
    assert.equal(report.uiRefHealing.status, "pass");
    assert.equal(report.uiRefHealing.validated, true);
    assert.equal(report.uiRefHealing.observed, true);
    assert.equal(report.uiRefHealing.finalStatus, "completed");
    assert.equal(report.uiRefHealing.adapterMode, "remote_http");
    assert.equal(report.uiRefHealing.healedRefCount, 2);
    assert.deepEqual(report.uiRefHealing.healedRefTargets, ["email", "submit_primary"]);
    assert.equal(report.uiRefHealing.staleRefCount, 0);
    assert.deepEqual(report.uiRefHealing.staleRefTargets, []);
    assert.equal(report.uiRefHealing.traceCount, 5);
    assert.equal(report.uiRefHealing.retries, 0);
    assert.equal(report.uiRefHealing.disabledSubmitSeen, true);
    assert.equal(report.uiRefHealing.enabledSubmitSeen, true);
    assert.equal(report.uiRefHealing.healingObservationSeen, true);
    assert.equal(report.uiRefHealing.healingNoteSeen, true);
    assert.equal(report.browserWorkerRecovery.status, "pass");
    assert.equal(report.browserWorkerRecovery.validated, true);
    assert.equal(report.browserWorkerRecovery.observed, true);
    assert.equal(report.browserWorkerRecovery.finalStatus, "completed");
    assert.equal(report.browserWorkerRecovery.adapterMode, "remote_http");
    assert.equal(report.browserWorkerRecovery.checkpointCount, 1);
    assert.equal(report.browserWorkerRecovery.resumedCheckpointCount, 1);
    assert.equal(report.browserWorkerRecovery.healedRefCount, 2);
    assert.deepEqual(report.browserWorkerRecovery.healedRefTargets, ["email", "submit_primary"]);
    assert.equal(report.browserWorkerRecovery.staleRefCount, 2);
    assert.deepEqual(report.browserWorkerRecovery.staleRefTargets, ["email", "submit_primary"]);
    assert.equal(report.browserWorkerRecovery.traceCount, 7);
    assert.equal(report.browserWorkerRecovery.retryCount, 0);
    assert.equal(report.browserWorkerRecovery.runtimeRetryCount, 0);
    assert.equal(report.browserWorkerRecovery.runtimeResumedCheckpointCount, 1);
    assert.equal(report.browserWorkerRecovery.runtimeStaleRefCount, 2);
    assert.equal(report.browserWorkerRecovery.runtimeHealedRefCount, 2);
    assert.equal(report.browserWorkerRecovery.checkpointReadyCleared, true);
    assert.equal(report.browserWorkerRecovery.summary, "healed 2 stale grounding refs; resumed 1 checkpoint.");
    assert.equal(report.navigatorVisaFlows.status, "pass");
    assert.equal(report.navigatorVisaFlows.validated, true);
    assert.equal(report.navigatorVisaFlows.observed, true);
    assert.equal(report.navigatorVisaFlows.totalFlows, 3);
    assert.equal(report.navigatorVisaFlows.succeededFlows, 3);
    assert.equal(report.navigatorVisaFlows.successRate, 1);
    assert.equal(report.navigatorVisaFlows.persistentSessionCount, 3);
    assert.equal(report.navigatorVisaFlows.replayBundleCount, 3);
    assert.equal(report.navigatorVisaFlows.verifiedCount, 3);
    assert.equal(report.navigatorVisaFlows.staleRecoveryObservedCount, 3);
    assert.equal(report.navigatorVisaFlows.healedRecoveryObservedCount, 3);
    assert.equal(report.navigatorVisaFlows.resumedCheckpointCount, 3);
    assert.equal(report.navigatorVisaFlows.checkpointReadyClearedCount, 3);
    assert.deepEqual(report.navigatorVisaFlows.scenarioNames, ["reminder", "handoff", "escalation"]);
    assert.equal(
      report.navigatorVisaFlows.summary,
      "3/3 visa flows passed; persistent=3; verified=3; staleRecovery=3; resumed=3.",
    );

    const manifest = JSON.parse(readFileSync(outputManifestJsonPath, "utf8")) as {
      criticalEvidenceStatuses: {
        hostedDirectLiveProofStatus?: string;
        caseWikiGatewayHydrationStatus?: string;
        caseWikiContextAdoptionStatus?: string;
        uiRefHealingStatus?: string;
        browserWorkerRecoveryStatus?: string;
        navigatorVisaFlowsStatus?: string;
      };
      hostedDirectLiveProof: {
        observed?: boolean;
        generatedAt?: string | null;
        generatedAtIsIso?: boolean;
        freshnessStatus?: string;
        freshnessSummary?: string | null;
        freshnessAgeMinutes?: number | null;
        freshnessMaxAgeHours?: number | null;
        replayEvidenceSource?: string | null;
        firstAudioMs?: number | null;
        firstOutputMs?: number | null;
        runtimeEvidenceExpectedSignatureStatus?: string | null;
        runtimeEvidenceKeyState?: string | null;
        caseWikiExpectedSignatureStatus?: string | null;
        caseWikiExpectedSignatureSource?: string | null;
        caseWikiSignatureStatus?: string | null;
        latencyObserved?: boolean;
      };
      caseWikiEvidenceSignature: {
        source?: string | null;
        status?: string;
        signatureStatus?: string | null;
      };
      caseWikiGatewayHydration: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        sessionId?: string | null;
        noteEventId?: string | null;
        questionId?: string | null;
        questionMatched?: boolean | null;
        noteSourceRefSeen?: boolean | null;
        questionSuggestedNextStep?: string | null;
        contextSource?: string | null;
        focusId?: string | null;
        blocker?: string | null;
        nextAction?: string | null;
        route?: string | null;
        mode?: string | null;
        requestedIntent?: string | null;
        routedIntent?: string | null;
      };
      caseWikiContextAdoption: {
        status?: string;
        observedCount?: number;
        caseWikiObservedCount?: number;
        inputOnlyObservedCount?: number;
        caseWikiRate?: number | null;
      };
      uiRefHealing: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        finalStatus?: string | null;
        adapterMode?: string | null;
        healedRefCount?: number;
        healedRefTargets?: string[];
        staleRefCount?: number;
        staleRefTargets?: string[];
        traceCount?: number;
        retries?: number;
        disabledSubmitSeen?: boolean | null;
        enabledSubmitSeen?: boolean | null;
        healingObservationSeen?: boolean | null;
        healingNoteSeen?: boolean | null;
      };
      browserWorkerRecovery: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        finalStatus?: string | null;
        adapterMode?: string | null;
        checkpointCount?: number;
        resumedCheckpointCount?: number;
        healedRefCount?: number;
        healedRefTargets?: string[];
        staleRefCount?: number;
        staleRefTargets?: string[];
        traceCount?: number;
        retryCount?: number;
        runtimeRetryCount?: number;
        runtimeResumedCheckpointCount?: number;
        runtimeStaleRefCount?: number;
        runtimeHealedRefCount?: number;
        checkpointReadyCleared?: boolean | null;
        summary?: string | null;
      };
      navigatorVisaFlows: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        totalFlows?: number;
        succeededFlows?: number;
        successRate?: number | null;
        persistentSessionCount?: number;
        replayBundleCount?: number;
        verifiedCount?: number;
        staleRecoveryObservedCount?: number;
        healedRecoveryObservedCount?: number;
        resumedCheckpointCount?: number;
        checkpointReadyClearedCount?: number;
        scenarioNames?: string[];
        summary?: string | null;
      };
      artifacts: Array<{ id?: string; present?: boolean }>;
      runtimeProof: {
        status?: string;
        readyForOperatorDemo?: boolean;
        passedLanes?: number;
        totalLanes?: number;
        blockerCount?: number;
        directLiveStatus?: string;
        caseWikiStatus?: string;
        navigatorStatus?: string;
      };
    };
    assert.equal(manifest.criticalEvidenceStatuses.hostedDirectLiveProofStatus, "pass");
    assert.equal(manifest.criticalEvidenceStatuses.caseWikiGatewayHydrationStatus, "pass");
    assert.equal(manifest.criticalEvidenceStatuses.caseWikiContextAdoptionStatus, "pass");
    assert.equal(manifest.criticalEvidenceStatuses.uiRefHealingStatus, "pass");
    assert.equal(manifest.criticalEvidenceStatuses.browserWorkerRecoveryStatus, "pass");
    assert.equal(manifest.criticalEvidenceStatuses.navigatorVisaFlowsStatus, "pass");
    assert.equal(manifest.hostedDirectLiveProof.observed, true);
    assert.equal(Date.parse(manifest.hostedDirectLiveProof.generatedAt ?? ""), Date.parse(hostedProofGeneratedAt));
    assert.equal(manifest.hostedDirectLiveProof.generatedAtIsIso, true);
    assert.equal(manifest.hostedDirectLiveProof.freshnessStatus, "pass");
    assert.equal(manifest.hostedDirectLiveProof.freshnessMaxAgeHours, 24);
    assert.equal(typeof manifest.hostedDirectLiveProof.freshnessAgeMinutes, "number");
    assert.match(manifest.hostedDirectLiveProof.freshnessSummary ?? "", /fresh:/);
    assert.equal(manifest.hostedDirectLiveProof.replayEvidenceSource, "session_events");
    assert.equal(manifest.hostedDirectLiveProof.firstAudioMs, 640);
    assert.equal(manifest.hostedDirectLiveProof.firstOutputMs, 410);
    assert.equal(manifest.hostedDirectLiveProof.runtimeEvidenceExpectedSignatureStatus, "signed");
    assert.equal(manifest.hostedDirectLiveProof.runtimeEvidenceKeyState, "loaded");
    assert.equal(manifest.hostedDirectLiveProof.caseWikiExpectedSignatureStatus, "signed");
    assert.equal(manifest.hostedDirectLiveProof.caseWikiExpectedSignatureSource, "runtime_diagnostics");
    assert.equal(manifest.hostedDirectLiveProof.caseWikiSignatureStatus, "signed");
    assert.equal(manifest.hostedDirectLiveProof.latencyObserved, true);
    assert.equal(manifest.caseWikiEvidenceSignature.source, "hosted_direct_live_proof");
    assert.equal(manifest.caseWikiEvidenceSignature.status, "pass");
    assert.equal(manifest.caseWikiEvidenceSignature.signatureStatus, "signed");
    assert.equal(manifest.caseWikiGatewayHydration.status, "pass");
    assert.equal(manifest.caseWikiGatewayHydration.validated, true);
    assert.equal(manifest.caseWikiGatewayHydration.observed, true);
    assert.equal(manifest.caseWikiGatewayHydration.sessionId, "session-hydration-123");
    assert.equal(manifest.caseWikiGatewayHydration.noteEventId, "event-case-wiki-note-123");
    assert.equal(manifest.caseWikiGatewayHydration.questionId, "question:operator-note:event-case-wiki-note-123");
    assert.equal(manifest.caseWikiGatewayHydration.questionMatched, true);
    assert.equal(manifest.caseWikiGatewayHydration.noteSourceRefSeen, true);
    assert.equal(manifest.caseWikiGatewayHydration.questionSuggestedNextStep, "Request passport scan");
    assert.equal(manifest.caseWikiGatewayHydration.contextSource, "case_wiki");
    assert.equal(manifest.caseWikiGatewayHydration.focusId, "question:operator-note:event-case-wiki-note-123");
    assert.equal(manifest.caseWikiGatewayHydration.blocker, "Need passport scan");
    assert.equal(manifest.caseWikiGatewayHydration.nextAction, "Request passport scan");
    assert.equal(manifest.caseWikiGatewayHydration.route, "live-agent");
    assert.equal(manifest.caseWikiGatewayHydration.mode, "assistive_override");
    assert.equal(manifest.caseWikiGatewayHydration.requestedIntent, "conversation");
    assert.equal(manifest.caseWikiGatewayHydration.routedIntent, "conversation");
    assert.equal(manifest.caseWikiContextAdoption.status, "pass");
    assert.equal(manifest.caseWikiContextAdoption.observedCount, 21);
    assert.equal(manifest.caseWikiContextAdoption.caseWikiObservedCount, 20);
    assert.equal(manifest.caseWikiContextAdoption.inputOnlyObservedCount, 1);
    assert.equal(manifest.caseWikiContextAdoption.caseWikiRate, 0.952381);
    assert.equal(manifest.uiRefHealing.status, "pass");
    assert.equal(manifest.uiRefHealing.validated, true);
    assert.equal(manifest.uiRefHealing.observed, true);
    assert.equal(manifest.uiRefHealing.finalStatus, "completed");
    assert.equal(manifest.uiRefHealing.adapterMode, "remote_http");
    assert.equal(manifest.uiRefHealing.healedRefCount, 2);
    assert.deepEqual(manifest.uiRefHealing.healedRefTargets, ["email", "submit_primary"]);
    assert.equal(manifest.uiRefHealing.staleRefCount, 0);
    assert.deepEqual(manifest.uiRefHealing.staleRefTargets, []);
    assert.equal(manifest.uiRefHealing.traceCount, 5);
    assert.equal(manifest.uiRefHealing.retries, 0);
    assert.equal(manifest.uiRefHealing.disabledSubmitSeen, true);
    assert.equal(manifest.uiRefHealing.enabledSubmitSeen, true);
    assert.equal(manifest.uiRefHealing.healingObservationSeen, true);
    assert.equal(manifest.uiRefHealing.healingNoteSeen, true);
    assert.equal(manifest.browserWorkerRecovery.status, "pass");
    assert.equal(manifest.browserWorkerRecovery.validated, true);
    assert.equal(manifest.browserWorkerRecovery.observed, true);
    assert.equal(manifest.browserWorkerRecovery.finalStatus, "completed");
    assert.equal(manifest.browserWorkerRecovery.adapterMode, "remote_http");
    assert.equal(manifest.browserWorkerRecovery.checkpointCount, 1);
    assert.equal(manifest.browserWorkerRecovery.resumedCheckpointCount, 1);
    assert.equal(manifest.browserWorkerRecovery.healedRefCount, 2);
    assert.deepEqual(manifest.browserWorkerRecovery.healedRefTargets, ["email", "submit_primary"]);
    assert.equal(manifest.browserWorkerRecovery.staleRefCount, 2);
    assert.deepEqual(manifest.browserWorkerRecovery.staleRefTargets, ["email", "submit_primary"]);
    assert.equal(manifest.browserWorkerRecovery.traceCount, 7);
    assert.equal(manifest.browserWorkerRecovery.retryCount, 0);
    assert.equal(manifest.browserWorkerRecovery.runtimeRetryCount, 0);
    assert.equal(manifest.browserWorkerRecovery.runtimeResumedCheckpointCount, 1);
    assert.equal(manifest.browserWorkerRecovery.runtimeStaleRefCount, 2);
    assert.equal(manifest.browserWorkerRecovery.runtimeHealedRefCount, 2);
    assert.equal(manifest.browserWorkerRecovery.checkpointReadyCleared, true);
    assert.equal(manifest.browserWorkerRecovery.summary, "healed 2 stale grounding refs; resumed 1 checkpoint.");
    assert.equal(manifest.navigatorVisaFlows.status, "pass");
    assert.equal(manifest.navigatorVisaFlows.validated, true);
    assert.equal(manifest.navigatorVisaFlows.observed, true);
    assert.equal(manifest.navigatorVisaFlows.totalFlows, 3);
    assert.equal(manifest.navigatorVisaFlows.succeededFlows, 3);
    assert.equal(manifest.navigatorVisaFlows.successRate, 1);
    assert.equal(manifest.navigatorVisaFlows.persistentSessionCount, 3);
    assert.equal(manifest.navigatorVisaFlows.replayBundleCount, 3);
    assert.equal(manifest.navigatorVisaFlows.verifiedCount, 3);
    assert.equal(manifest.navigatorVisaFlows.staleRecoveryObservedCount, 3);
    assert.equal(manifest.navigatorVisaFlows.healedRecoveryObservedCount, 3);
    assert.equal(manifest.navigatorVisaFlows.resumedCheckpointCount, 3);
    assert.equal(manifest.navigatorVisaFlows.checkpointReadyClearedCount, 3);
    assert.deepEqual(manifest.navigatorVisaFlows.scenarioNames, ["reminder", "handoff", "escalation"]);
    assert.equal(
      manifest.navigatorVisaFlows.summary,
      "3/3 visa flows passed; persistent=3; verified=3; staleRecovery=3; resumed=3.",
    );
    assert.equal(
      manifest.artifacts.find((entry) => entry.id === "deploy.directLiveProofJson")?.present,
      true,
    );
    assert.equal(
      manifest.artifacts.find((entry) => entry.id === "release.runtimeProofReportJson")?.present,
      true,
    );
    assert.equal(
      manifest.artifacts.find((entry) => entry.id === "release.runtimeProofReportMarkdown")?.present,
      true,
    );
    assert.equal(manifest.runtimeProof.status, "pass");
    assert.equal(manifest.runtimeProof.readyForOperatorDemo, true);
    assert.equal(manifest.runtimeProof.passedLanes, 3);
    assert.equal(manifest.runtimeProof.totalLanes, 3);
    assert.equal(manifest.runtimeProof.blockerCount, 0);
    assert.equal(manifest.runtimeProof.directLiveStatus, "pass");
    assert.equal(manifest.runtimeProof.caseWikiStatus, "pass");
    assert.equal(manifest.runtimeProof.navigatorStatus, "pass");

    const runtimeProof = JSON.parse(readFileSync(outputRuntimeProofJsonPath, "utf8")) as {
      status?: string;
      readyForOperatorDemo?: boolean;
      summary?: {
        totalLanes?: number;
        passedLanes?: number;
        blockerCount?: number;
        overallSummary?: string;
        laneStatuses?: {
          directLive?: string;
          caseWiki?: string;
          navigator?: string;
        };
      };
      lanes?: {
        directLive?: {
          status?: string;
          replayActiveMode?: string | null;
          replayEvidenceSource?: string | null;
          firstAudioMs?: number | null;
          firstOutputMs?: number | null;
          fallbackEventCount?: number;
        };
        caseWiki?: {
          status?: string;
          contextSource?: string | null;
          blocker?: string | null;
          nextAction?: string | null;
          caseWikiRate?: number | null;
        };
        navigator?: {
          status?: string;
          totalFlows?: number;
          succeededFlows?: number;
          successRate?: number | null;
          scenarioNames?: string[];
        };
      };
      blockers?: Array<{ lane?: string; status?: string; reason?: string }>;
    };
    assert.equal(runtimeProof.status, "pass");
    assert.equal(runtimeProof.readyForOperatorDemo, true);
    assert.equal(runtimeProof.summary?.totalLanes, 3);
    assert.equal(runtimeProof.summary?.passedLanes, 3);
    assert.equal(runtimeProof.summary?.blockerCount, 0);
    assert.equal(runtimeProof.summary?.laneStatuses?.directLive, "pass");
    assert.equal(runtimeProof.summary?.laneStatuses?.caseWiki, "pass");
    assert.equal(runtimeProof.summary?.laneStatuses?.navigator, "pass");
    assert.match(runtimeProof.summary?.overallSummary ?? "", /direct_live=pass/);
    assert.equal(runtimeProof.lanes?.directLive?.status, "pass");
    assert.equal(runtimeProof.lanes?.directLive?.replayActiveMode, "direct_live");
    assert.equal(runtimeProof.lanes?.directLive?.replayEvidenceSource, "session_events");
    assert.equal(runtimeProof.lanes?.directLive?.firstAudioMs, 640);
    assert.equal(runtimeProof.lanes?.directLive?.firstOutputMs, 410);
    assert.equal(runtimeProof.lanes?.directLive?.fallbackEventCount, 0);
    assert.equal(runtimeProof.lanes?.caseWiki?.status, "pass");
    assert.equal(runtimeProof.lanes?.caseWiki?.contextSource, "case_wiki");
    assert.equal(runtimeProof.lanes?.caseWiki?.blocker, "Need passport scan");
    assert.equal(runtimeProof.lanes?.caseWiki?.nextAction, "Request passport scan");
    assert.equal(runtimeProof.lanes?.caseWiki?.caseWikiRate, 0.952381);
    assert.equal(runtimeProof.lanes?.navigator?.status, "pass");
    assert.equal(runtimeProof.lanes?.navigator?.totalFlows, 3);
    assert.equal(runtimeProof.lanes?.navigator?.succeededFlows, 3);
    assert.equal(runtimeProof.lanes?.navigator?.successRate, 1);
    assert.deepEqual(runtimeProof.lanes?.navigator?.scenarioNames, ["reminder", "handoff", "escalation"]);
    assert.deepEqual(runtimeProof.blockers, []);

    const reportMarkdown = readFileSync(outputMarkdownPath, "utf8");
    assert.match(reportMarkdown, /## Hosted Direct-Live Proof Snapshot/);
    assert.match(reportMarkdown, /- generatedAt: /);
    assert.match(reportMarkdown, /- generatedAtIsIso: True/i);
    assert.match(reportMarkdown, /- freshnessStatus: pass/);
    assert.match(reportMarkdown, /- firstAudioMs: 640/);
    assert.match(reportMarkdown, /- firstOutputMs: 410/);
    assert.match(reportMarkdown, /- runtimeEvidenceExpectedSignatureStatus: signed/);
    assert.match(reportMarkdown, /- caseWikiExpectedSignatureSource: runtime_diagnostics/);
    assert.match(reportMarkdown, /## Case Wiki Gateway Hydration Snapshot/);
    assert.match(reportMarkdown, /- sessionId: session-hydration-123/);
    assert.match(reportMarkdown, /## Case Wiki Context Adoption Snapshot/);
    assert.match(reportMarkdown, /- observedCount: 21/);
    assert.match(reportMarkdown, /## UI Ref Healing Snapshot/);
    assert.match(reportMarkdown, /- healedRefTargets: email, submit_primary/);
    assert.match(reportMarkdown, /## Browser Worker Recovery Snapshot/);
    assert.match(reportMarkdown, /- resumedCheckpointCount: 1/);
    assert.match(reportMarkdown, /## Navigator Visa Flows Snapshot/);
    assert.match(reportMarkdown, /- totalFlows: 3/);
    assert.match(reportMarkdown, /- scenarioNames: reminder, handoff, escalation/);

    const manifestMarkdown = readFileSync(outputManifestMarkdownPath, "utf8");
    const runtimeProofMarkdown = readFileSync(outputRuntimeProofMarkdownPath, "utf8");
    assert.match(runtimeProofMarkdown, /# Runtime Proof Report/);
    assert.match(runtimeProofMarkdown, /- Overall status: pass/);
    assert.match(runtimeProofMarkdown, /\| direct_live \| pass \|/);
    assert.match(runtimeProofMarkdown, /\| case_wiki \| pass \|/);
    assert.match(runtimeProofMarkdown, /\| navigator \| pass \|/);
    assert.match(runtimeProofMarkdown, /## Direct Live Proof/);
    assert.match(runtimeProofMarkdown, /- firstAudioMs: 640/);
    assert.match(runtimeProofMarkdown, /## Case Wiki Proof/);
    assert.match(runtimeProofMarkdown, /- contextSource: case_wiki/);
    assert.match(runtimeProofMarkdown, /## Navigator Proof/);
    assert.match(runtimeProofMarkdown, /- totalFlows: 3/);
    assert.match(runtimeProofMarkdown, /## Blockers/);
    assert.match(runtimeProofMarkdown, /- none/);
    assert.match(manifestMarkdown, /## Hosted Direct-Live Proof/);
    assert.match(manifestMarkdown, /## Runtime Proof Report/);
    assert.match(manifestMarkdown, /\| status \| pass \|/);
    assert.match(manifestMarkdown, /\| freshnessStatus \| pass \|/);
    assert.match(manifestMarkdown, /\| firstAudioMs \| 640 \|/);
    assert.match(manifestMarkdown, /\| firstOutputMs \| 410 \|/);
    assert.match(manifestMarkdown, /\| runtimeEvidenceExpectedSignatureStatus \| signed \|/);
    assert.match(manifestMarkdown, /\| caseWikiExpectedSignatureSource \| runtime_diagnostics \|/);
    assert.match(manifestMarkdown, /## Case Wiki Gateway Hydration/);
    assert.match(manifestMarkdown, /\| sessionId \| session-hydration-123 \|/);
    assert.match(manifestMarkdown, /## Case Wiki Context Adoption/);
    assert.match(manifestMarkdown, /\| observedCount \| 21 \|/);
    assert.match(manifestMarkdown, /## UI Ref Healing/);
    assert.match(manifestMarkdown, /\| healedRefTargets \| email, submit_primary \|/);
    assert.match(manifestMarkdown, /## Browser Worker Recovery/);
    assert.match(manifestMarkdown, /\| resumedCheckpointCount \| 1 \|/);
    assert.match(manifestMarkdown, /\| navigatorVisaFlows \| pass \|/);
    assert.match(manifestMarkdown, /## Navigator Visa Flows/);
    assert.match(manifestMarkdown, /\| totalFlows \| 3 \|/);
  },
);

test(
  "release evidence report fails stale hosted direct-live proof and falls back to local case wiki signature evidence",
  { skip: skipIfNoPowerShell },
  () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "release-evidence-report-stale-hosted-proof-"));
    const badgeDetailsPath = join(tempRoot, "artifacts", "demo-e2e", "badge-details.json");
    const directLiveProofPath = join(tempRoot, "artifacts", "deploy", "direct-live-proof.json");
    const outputJsonPath = join(tempRoot, "artifacts", "release-evidence", "report.json");
    const outputMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "report.md");
    const outputManifestJsonPath = join(tempRoot, "artifacts", "release-evidence", "manifest.json");
    const outputManifestMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "manifest.md");

    writeJson(badgeDetailsPath, {
      evidence: {
        caseWikiEvidenceSignature: {
          status: "pass",
          validated: true,
          totalArtifacts: 1,
          signedArtifacts: 1,
          unsignedArtifacts: 0,
          signatureStatus: "signed",
          algorithm: "ed25519-sha256",
          canonicalization: "json-stable-v1",
          payloadHash: "sha256:local-signed-payload",
          keyId: "local-dev-key",
          signerId: "api-backend",
          signedAt: "2026-04-15T09:10:00.000Z",
          signedAtIsIso: true,
          signaturePresent: true,
          caseId: "local-case-123",
          sessionId: "local-session-123",
          overviewStatus: "active",
          nextAction: "Review the latest case evidence",
          sourceRefsCount: 0,
        },
        caseWikiCompliance: createPassingCaseWikiComplianceEvidence("signed"),
      },
    });

    writeJson(directLiveProofPath, {
      generatedAt: "2020-01-01T00:00:00.000Z",
      status: "pass",
      runtimeStatus: {
        preferredMode: "direct_live",
        activeMode: "direct_live",
      },
      replay: {
        liveTransport: {
          activeMode: "direct_live",
          evidenceSource: "session_events",
          firstAudioMs: 964,
          firstOutputMs: 964,
          fallbackEventCount: 0,
        },
      },
      runtimeDiagnostics: {
        apiBackendEvidenceSigning: {
          expectedSignatureStatus: "signed",
          keyState: "loaded",
        },
      },
      caseWikiEvidenceSignatureExpectation: {
        expectedStatus: "signed",
        source: "runtime_diagnostics",
      },
      caseWiki: {
        evidenceSignature: {
          status: "signed",
          signaturePresent: true,
        },
      },
      summary: "direct_live observed via session_events first_audio=964ms",
    });

    const result = spawnSync(
      powershellBin!,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        releaseEvidenceReportScriptPath,
        "-BadgeDetailsPath",
        badgeDetailsPath,
        "-OutputJsonPath",
        outputJsonPath,
        "-OutputMarkdownPath",
        outputMarkdownPath,
        "-OutputManifestJsonPath",
        outputManifestJsonPath,
        "-OutputManifestMarkdownPath",
        outputManifestMarkdownPath,
        "-HostedDirectLiveProofMaxAgeHours",
        "24",
      ],
      {
        cwd: tempRoot,
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);

    const report = JSON.parse(readFileSync(outputJsonPath, "utf8")) as {
      statuses: {
        hostedDirectLiveProofStatus?: string;
        caseWikiEvidenceSignatureStatus?: string;
      };
      hostedDirectLiveProof: {
        status?: string;
        generatedAt?: string | null;
        generatedAtIsIso?: boolean;
        freshnessStatus?: string;
        freshnessSummary?: string | null;
        freshnessAgeMinutes?: number | null;
      };
      caseWikiEvidenceSignature: {
        source?: string | null;
        status?: string;
        signatureStatus?: string | null;
        keyId?: string | null;
      };
    };
    assert.equal(report.statuses.hostedDirectLiveProofStatus, "fail");
    assert.equal(report.hostedDirectLiveProof.status, "fail");
    assert.equal(report.hostedDirectLiveProof.generatedAt, "2020-01-01T00:00:00.0000000+00:00");
    assert.equal(report.hostedDirectLiveProof.generatedAtIsIso, true);
    assert.equal(report.hostedDirectLiveProof.freshnessStatus, "fail");
    assert.match(report.hostedDirectLiveProof.freshnessSummary ?? "", /stale:/);
    assert.equal(typeof report.hostedDirectLiveProof.freshnessAgeMinutes, "number");
    assert.equal(report.statuses.caseWikiEvidenceSignatureStatus, "pass");
    assert.equal(report.caseWikiEvidenceSignature.source, "badge_details");
    assert.equal(report.caseWikiEvidenceSignature.status, "pass");
    assert.equal(report.caseWikiEvidenceSignature.signatureStatus, "signed");
    assert.equal(report.caseWikiEvidenceSignature.keyId, "local-dev-key");

    const manifest = JSON.parse(readFileSync(outputManifestJsonPath, "utf8")) as {
      criticalEvidenceStatuses: {
        hostedDirectLiveProofStatus?: string;
        caseWikiEvidenceSignatureStatus?: string;
      };
      hostedDirectLiveProof: {
        status?: string;
        freshnessStatus?: string;
        freshnessSummary?: string | null;
      };
      caseWikiEvidenceSignature: {
        source?: string | null;
        status?: string;
      };
    };
    assert.equal(manifest.criticalEvidenceStatuses.hostedDirectLiveProofStatus, "fail");
    assert.equal(manifest.hostedDirectLiveProof.status, "fail");
    assert.equal(manifest.hostedDirectLiveProof.freshnessStatus, "fail");
    assert.match(manifest.hostedDirectLiveProof.freshnessSummary ?? "", /stale:/);
    assert.equal(manifest.criticalEvidenceStatuses.caseWikiEvidenceSignatureStatus, "pass");
    assert.equal(manifest.caseWikiEvidenceSignature.source, "badge_details");
    assert.equal(manifest.caseWikiEvidenceSignature.status, "pass");

    const reportMarkdown = readFileSync(outputMarkdownPath, "utf8");
    assert.match(reportMarkdown, /\| hostedDirectLiveProof \| fail \|/);
    assert.match(reportMarkdown, /- freshnessStatus: fail/);
    assert.match(reportMarkdown, /- freshnessSummary: stale:/);

    const manifestMarkdown = readFileSync(outputManifestMarkdownPath, "utf8");
    assert.match(manifestMarkdown, /\| hostedDirectLiveProof \| fail \|/);
    assert.match(manifestMarkdown, /\| freshnessStatus \| fail \|/);
  },
);

test(
  "release evidence report normalizes legacy unsigned case wiki signature evidence from pass to warn",
  { skip: skipIfNoPowerShell },
  () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "release-evidence-report-unsigned-signature-"));
    const badgeDetailsPath = join(tempRoot, "artifacts", "demo-e2e", "badge-details.json");
    const outputJsonPath = join(tempRoot, "artifacts", "release-evidence", "report.json");
    const outputMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "report.md");
    const outputManifestJsonPath = join(tempRoot, "artifacts", "release-evidence", "manifest.json");
    const outputManifestMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "manifest.md");

    writeJson(badgeDetailsPath, {
      evidence: {
        caseWikiEvidenceSignature: {
          status: "pass",
          validated: true,
          totalArtifacts: 1,
          signedArtifacts: 0,
          unsignedArtifacts: 1,
          signatureStatus: "unsigned",
          algorithm: "ed25519-sha256",
          canonicalization: "json-stable-v1",
          payloadHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          signerId: "api-backend",
          signedAt: "2026-04-14T09:00:00.000Z",
          signedAtIsIso: true,
          signaturePresent: false,
          caseId: "case-unsigned-123",
          sessionId: "session-unsigned-123",
          overviewStatus: "waiting_on_operator",
          nextAction: "Resolve pending approval",
          sourceRefsCount: 0,
        },
        caseWikiCompliance: createPassingCaseWikiComplianceEvidence("unsigned"),
      },
    });

    const result = spawnSync(
      powershellBin!,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        releaseEvidenceReportScriptPath,
        "-BadgeDetailsPath",
        badgeDetailsPath,
        "-OutputJsonPath",
        outputJsonPath,
        "-OutputMarkdownPath",
        outputMarkdownPath,
        "-OutputManifestJsonPath",
        outputManifestJsonPath,
        "-OutputManifestMarkdownPath",
        outputManifestMarkdownPath,
      ],
      {
        cwd: tempRoot,
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);

    const report = JSON.parse(readFileSync(outputJsonPath, "utf8")) as {
      statuses: { caseWikiEvidenceSignatureStatus?: string };
      caseWikiEvidenceSignature: {
        status?: string;
        validated?: boolean;
        signatureStatus?: string | null;
        signedArtifacts?: number;
        unsignedArtifacts?: number;
        signaturePresent?: boolean | null;
      };
    };
    assert.equal(report.statuses.caseWikiEvidenceSignatureStatus, "warn");
    assert.equal(report.caseWikiEvidenceSignature.status, "warn");
    assert.equal(report.caseWikiEvidenceSignature.validated, true);
    assert.equal(report.caseWikiEvidenceSignature.signatureStatus, "unsigned");
    assert.equal(report.caseWikiEvidenceSignature.signedArtifacts, 0);
    assert.equal(report.caseWikiEvidenceSignature.unsignedArtifacts, 1);
    assert.equal(report.caseWikiEvidenceSignature.signaturePresent, false);

    const manifest = JSON.parse(readFileSync(outputManifestJsonPath, "utf8")) as {
      criticalEvidenceStatuses: { caseWikiEvidenceSignatureStatus?: string };
      caseWikiEvidenceSignature: {
        status?: string;
        signatureStatus?: string | null;
        signedArtifacts?: number;
        unsignedArtifacts?: number;
      };
    };
    assert.equal(manifest.criticalEvidenceStatuses.caseWikiEvidenceSignatureStatus, "warn");
    assert.equal(manifest.caseWikiEvidenceSignature.status, "warn");
    assert.equal(manifest.caseWikiEvidenceSignature.signatureStatus, "unsigned");
    assert.equal(manifest.caseWikiEvidenceSignature.signedArtifacts, 0);
    assert.equal(manifest.caseWikiEvidenceSignature.unsignedArtifacts, 1);

    const reportMarkdown = readFileSync(outputMarkdownPath, "utf8");
    assert.match(reportMarkdown, /\| caseWikiEvidenceSignature \| warn \|/);
    assert.match(reportMarkdown, /## Case Wiki Evidence Signature Snapshot/);
    assert.match(reportMarkdown, /- status: warn/);
    assert.match(reportMarkdown, /- signatureStatus: unsigned/);

    const manifestMarkdown = readFileSync(outputManifestMarkdownPath, "utf8");
    assert.match(manifestMarkdown, /\| caseWikiEvidenceSignature \| warn \|/);
    assert.match(manifestMarkdown, /## Case Wiki Evidence Signature/);
    assert.match(manifestMarkdown, /\| status \| warn \|/);
    assert.match(manifestMarkdown, /\| signatureStatus \| unsigned \|/);
  },
);

test(
  "release evidence report prefers hosted signed case wiki signature proof when direct-live runtime proves signed posture",
  { skip: skipIfNoPowerShell },
  () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "release-evidence-report-hosted-signed-case-wiki-"));
    const badgeDetailsPath = join(tempRoot, "artifacts", "demo-e2e", "badge-details.json");
    const directLiveProofPath = join(tempRoot, "artifacts", "deploy", "direct-live-proof.json");
    const outputJsonPath = join(tempRoot, "artifacts", "release-evidence", "report.json");
    const outputMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "report.md");
    const outputManifestJsonPath = join(tempRoot, "artifacts", "release-evidence", "manifest.json");
    const outputManifestMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "manifest.md");

    writeJson(badgeDetailsPath, {
      evidence: {
        caseWikiEvidenceSignature: {
          status: "pass",
          validated: true,
          totalArtifacts: 1,
          signedArtifacts: 0,
          unsignedArtifacts: 1,
          signatureStatus: "unsigned",
          algorithm: "ed25519-sha256",
          canonicalization: "json-stable-v1",
          payloadHash: "sha256:local-unsigned-payload",
          signerId: "api-backend",
          signedAt: "2026-04-15T09:00:00.000Z",
          signedAtIsIso: true,
          signaturePresent: false,
          caseId: "local-case-123",
          sessionId: "local-session-123",
          overviewStatus: "waiting_on_operator",
          nextAction: "Resolve pending approval",
          sourceRefsCount: 0,
        },
        caseWikiCompliance: createPassingCaseWikiComplianceEvidence("unsigned"),
      },
    });

    writeJson(directLiveProofPath, {
      generatedAt: new Date().toISOString(),
      status: "pass",
      runtimeStatus: {
        preferredMode: "direct_live",
        activeMode: "direct_live",
      },
      replay: {
        liveTransport: {
          activeMode: "direct_live",
          evidenceSource: "session_events",
          firstAudioMs: 964,
          firstOutputMs: 964,
          fallbackEventCount: 0,
        },
      },
      runtimeDiagnostics: {
        apiBackendEvidenceSigning: {
          expectedSignatureStatus: "signed",
          keyState: "loaded",
        },
      },
      caseWikiEvidenceSignatureExpectation: {
        expectedStatus: "signed",
        source: "runtime_diagnostics",
      },
      caseWiki: {
        caseId: "deploy-direct-live-proof-case-123",
        sessionId: "deploy-direct-live-proof-session-123",
        overviewStatus: "active",
        recommendedNextAction: "Review the latest case evidence",
        sourceRefsCount: 0,
        evidenceSignature: {
          status: "signed",
          algorithm: "ed25519-sha256",
          canonicalization: "json-stable-v1",
          payloadHash: "sha256:hosted-signed-payload",
          keyId: "runtime-evidence-20260410",
          signerId: "api-backend",
          signedAt: "2026-04-15T09:10:00.000Z",
          signaturePresent: true,
        },
      },
      summary: "direct_live observed via session_events first_audio=964ms",
    });

    const result = spawnSync(
      powershellBin!,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        releaseEvidenceReportScriptPath,
        "-BadgeDetailsPath",
        badgeDetailsPath,
        "-OutputJsonPath",
        outputJsonPath,
        "-OutputMarkdownPath",
        outputMarkdownPath,
        "-OutputManifestJsonPath",
        outputManifestJsonPath,
        "-OutputManifestMarkdownPath",
        outputManifestMarkdownPath,
      ],
      {
        cwd: tempRoot,
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);

    const report = JSON.parse(readFileSync(outputJsonPath, "utf8")) as {
      statuses: { caseWikiEvidenceSignatureStatus?: string };
      caseWikiEvidenceSignature: {
        source?: string | null;
        status?: string;
        validated?: boolean;
        signatureStatus?: string | null;
        signedArtifacts?: number;
        unsignedArtifacts?: number;
        signerId?: string | null;
        keyId?: string | null;
        payloadHash?: string | null;
        caseId?: string | null;
        sessionId?: string | null;
      };
      caseWikiCompliance: {
        status?: string;
        observedSignatureStatus?: string | null;
        signatureMatch?: boolean | null;
        evidenceSigning?: {
          expectedSignatureStatus?: string | null;
          keyState?: string | null;
        };
      };
    };
    assert.equal(report.statuses.caseWikiEvidenceSignatureStatus, "pass");
    assert.equal(report.caseWikiEvidenceSignature.source, "hosted_direct_live_proof");
    assert.equal(report.caseWikiEvidenceSignature.status, "pass");
    assert.equal(report.caseWikiEvidenceSignature.validated, true);
    assert.equal(report.caseWikiEvidenceSignature.signatureStatus, "signed");
    assert.equal(report.caseWikiEvidenceSignature.signedArtifacts, 1);
    assert.equal(report.caseWikiEvidenceSignature.unsignedArtifacts, 0);
    assert.equal(report.caseWikiEvidenceSignature.signerId, "api-backend");
    assert.equal(report.caseWikiEvidenceSignature.keyId, "runtime-evidence-20260410");
    assert.equal(report.caseWikiEvidenceSignature.payloadHash, "sha256:hosted-signed-payload");
    assert.equal(report.caseWikiEvidenceSignature.caseId, "deploy-direct-live-proof-case-123");
    assert.equal(report.caseWikiEvidenceSignature.sessionId, "deploy-direct-live-proof-session-123");
    assert.equal(report.caseWikiCompliance.status, "pass");
    assert.equal(report.caseWikiCompliance.evidenceSigning?.expectedSignatureStatus, "signed");
    assert.equal(report.caseWikiCompliance.evidenceSigning?.keyState, "loaded");
    assert.equal(report.caseWikiCompliance.observedSignatureStatus, "signed");
    assert.equal(report.caseWikiCompliance.signatureMatch, true);

    const manifest = JSON.parse(readFileSync(outputManifestJsonPath, "utf8")) as {
      criticalEvidenceStatuses: { caseWikiEvidenceSignatureStatus?: string };
      caseWikiEvidenceSignature: {
        source?: string | null;
        status?: string;
        signatureStatus?: string | null;
        signedArtifacts?: number;
        unsignedArtifacts?: number;
      };
    };
    assert.equal(manifest.criticalEvidenceStatuses.caseWikiEvidenceSignatureStatus, "pass");
    assert.equal(manifest.caseWikiEvidenceSignature.source, "hosted_direct_live_proof");
    assert.equal(manifest.caseWikiEvidenceSignature.status, "pass");
    assert.equal(manifest.caseWikiEvidenceSignature.signatureStatus, "signed");
    assert.equal(manifest.caseWikiEvidenceSignature.signedArtifacts, 1);
    assert.equal(manifest.caseWikiEvidenceSignature.unsignedArtifacts, 0);

    const reportMarkdown = readFileSync(outputMarkdownPath, "utf8");
    assert.match(reportMarkdown, /\| caseWikiEvidenceSignature \| pass \|/);
    assert.match(reportMarkdown, /- source: hosted_direct_live_proof/);
    assert.match(reportMarkdown, /- signatureStatus: signed/);

    const manifestMarkdown = readFileSync(outputManifestMarkdownPath, "utf8");
    assert.match(manifestMarkdown, /\| caseWikiEvidenceSignature \| pass \|/);
    assert.match(manifestMarkdown, /\| source \| hosted_direct_live_proof \|/);
    assert.match(manifestMarkdown, /\| signatureStatus \| signed \|/);
  },
);
