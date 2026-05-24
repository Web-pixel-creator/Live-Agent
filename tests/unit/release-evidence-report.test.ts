import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

// Local test-file helper introduced by task 3.1 of the bugfix spec
// `release-evidence-report-windows-shortpath` (see
// `.kiro/specs/release-evidence-report-windows-shortpath/design.md` Property 1
// and Property 2). NOT exported - scoped to this test file only.
//
// Why this helper exists: on the GitHub Actions `windows-2025` runner image,
// `os.tmpdir()` and `scripts/release-evidence-report.ps1` agree on the
// physical temp directory but disagree on its spelling (Windows 8.3 short-name
// form `RUNNER~1` vs long form `runneradmin`). Textual `assert.equal` rejects
// the two strings as unequal even though the filesystem treats them as the
// same file. `assertSamePath` canonicalizes both sides before comparing so
// same-file pairs that differ only in 8.3 short-name vs long-name spelling
// compare equal, while genuinely different paths still fail.
//
// Platform note: task 1's exploration PBT surfaced (Node v24.4.0 / Windows 10
// counterexample) that `fs.realpathSync(shortForm)` returns the input
// unchanged on Node 24+; only `fs.realpathSync.native(shortForm)` collapses
// 8.3 spellings on Windows. So on Windows we use `realpathSync.native`. On
// non-Windows platforms we use plain `realpathSync` because it is a no-op for
// symlink-free paths and 8.3 aliasing does not exist on POSIX.
//
// Error shape: when both canonicalizations succeed, the helper delegates to
// `assert.equal`, so the resulting `AssertionError` keeps the standard Node
// assertion shape (`code = "ERR_ASSERTION"`). When canonicalization itself
// throws (e.g. `ENOENT` for a missing path), the helper wraps the underlying
// error in a readable message that includes the label, the side that failed,
// the offending path, and the underlying error code, and tags the wrapper
// with `code = "ERR_ASSERTION"` so callers (including the preservation PBT)
// see a uniform `ERR_ASSERTION` shape across same-file, distinct-file, and
// missing-file cases.
function assertSamePath(actual: string, expected: string, label?: string): void {
  const realpath = process.platform === "win32" ? realpathSync.native : realpathSync;
  const labelPart = label ? `[${label}] ` : "";

  let canonicalActual: string;
  try {
    canonicalActual = realpath(actual);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const codePart = err.code ? ` (${err.code})` : "";
    const wrapped = new Error(
      `${labelPart}assertSamePath: failed to canonicalize actual path "${actual}"${codePart}: ${err.message}`,
    ) as Error & { code?: string };
    wrapped.code = "ERR_ASSERTION";
    throw wrapped;
  }

  let canonicalExpected: string;
  try {
    canonicalExpected = realpath(expected);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const codePart = err.code ? ` (${err.code})` : "";
    const wrapped = new Error(
      `${labelPart}assertSamePath: failed to canonicalize expected path "${expected}"${codePart}: ${err.message}`,
    ) as Error & { code?: string };
    wrapped.code = "ERR_ASSERTION";
    throw wrapped;
  }

  assert.equal(
    canonicalActual,
    canonicalExpected,
    `${labelPart}assertSamePath: canonical paths differ; actual=${canonicalActual}, expected=${canonicalExpected}`,
  );
}

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

type ActionDeskWorkflowKpiReport = {
  product?: string;
  status?: string;
  summary?: {
    totalWorkflows?: number;
    proofReadyWorkflows?: number;
    needsConnectorCount?: number;
    needsEvidenceCount?: number;
    headline?: string;
  };
  metrics?: {
    leadQualificationProofReady?: boolean;
    consultationBookingProofReady?: boolean;
    consultationBookingProofStatus?: string;
    consultationBookingStagedReady?: boolean;
    consultationBookingCalendarWritebackObserved?: boolean;
    consultationBookingApprovedArtifactObserved?: boolean;
    consultationBookingScenarioObserved?: boolean;
    missingDocumentFollowUpProofReady?: boolean;
    crmHandoffProofReady?: boolean;
    navigatorVisaFlowSuccessRate?: number | null;
    navigatorVisaVerifiedCount?: number;
    caseWikiAdoptionRate?: number | null;
    operatorMinutesSaved?: {
      observed?: boolean;
      valueMinutes?: number | null;
      status?: string;
      baselineRequired?: boolean;
    };
  };
  workflows?: Array<{
    id?: string;
    status?: string;
    proofSignal?: string;
    nextGap?: string | null;
  }>;
  pilotGaps?: string[];
};

type ConsultationBookingProofReport = {
  status?: string;
  stagedReady?: boolean;
  proofReady?: boolean;
  summary?: string;
  repoOwnedWorkflow?: {
    personaPresent?: boolean;
    recipePresent?: boolean;
    playbookPresent?: boolean;
    playbookHasApprovalBoundary?: boolean;
    playbookHasSuccessMetrics?: boolean;
    bookingScenarioObserved?: boolean;
    stagedReminderContextObserved?: boolean;
    scenarioNames?: string[];
  };
  calendarConnector?: {
    calendarSkillPresent?: boolean;
    calendarSkillHasApprovalBoundary?: boolean;
    managedSkillSamplePresent?: boolean;
    signingInputSamplePresent?: boolean;
    managedSkillPermissions?: string[];
    permissionsIncludeUiExecute?: boolean;
    permissionsIncludeOperatorActions?: boolean;
    connectorProofObserved?: boolean;
    writebackObserved?: boolean;
    approvedBookingArtifactObserved?: boolean;
    approvedBookingArtifactPath?: string | null;
  };
  nextGaps?: string[];
};

type ActionDeskWorkflowKpiManifest = {
  status?: string;
  totalWorkflows?: number;
  proofReadyWorkflows?: number;
  needsConnectorCount?: number;
  needsEvidenceCount?: number;
  leadQualificationProofReady?: boolean;
  consultationBookingProofReady?: boolean;
  consultationBookingProofStatus?: string;
  consultationBookingStagedReady?: boolean;
  consultationBookingCalendarWritebackObserved?: boolean;
  consultationBookingApprovedArtifactObserved?: boolean;
  consultationBookingScenarioObserved?: boolean;
  missingDocumentFollowUpProofReady?: boolean;
  crmHandoffProofReady?: boolean;
  navigatorVisaFlowSuccessRate?: number | null;
  caseWikiAdoptionRate?: number | null;
  operatorMinutesSavedStatus?: string;
  pilotGaps?: string[];
};

type ConsultationBookingProofManifest = {
  status?: string;
  stagedReady?: boolean;
  proofReady?: boolean;
  bookingScenarioObserved?: boolean;
  stagedReminderContextObserved?: boolean;
  calendarSkillPresent?: boolean;
  managedSkillSamplePresent?: boolean;
  connectorProofObserved?: boolean;
  calendarWritebackObserved?: boolean;
  approvedBookingArtifactObserved?: boolean;
  nextGaps?: string[];
};

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

function findActionDeskWorkflow(report: ActionDeskWorkflowKpiReport, id: string) {
  return report.workflows?.find((workflow) => workflow.id === id);
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
    const approvedBookingArtifactPath = join(tempRoot, "artifacts", "demo-e2e", "consultation-booking-approved.json");
    const directLiveProofPath = join(tempRoot, "artifacts", "deploy", "direct-live-proof.json");
    const outputJsonPath = join(tempRoot, "artifacts", "release-evidence", "report.json");
    const outputMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "report.md");
    const outputRuntimeProofJsonPath = join(tempRoot, "artifacts", "release-evidence", "runtime-proof-report.json");
    const outputRuntimeProofMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "runtime-proof-report.md");
    const outputActionDeskKpiJsonPath = join(tempRoot, "artifacts", "release-evidence", "action-desk-kpi-report.json");
    const outputActionDeskKpiMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "action-desk-kpi-report.md");
    const outputConsultationBookingProofJsonPath = join(
      tempRoot,
      "artifacts",
      "release-evidence",
      "consultation-booking-proof.json",
    );
    const outputConsultationBookingProofMarkdownPath = join(
      tempRoot,
      "artifacts",
      "release-evidence",
      "consultation-booking-proof.md",
    );
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
          ingressSource: "preserved_input_case_wiki",
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
          ingressSource: "gateway_hydrated_case_wiki",
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
          totalFlows: 4,
          succeededFlows: 4,
          successRate: 1,
          persistentSessionCount: 4,
          replayBundleCount: 4,
          verifiedCount: 4,
          staleRecoveryObservedCount: 4,
          healedRecoveryObservedCount: 4,
          resumedCheckpointCount: 4,
          checkpointReadyClearedCount: 4,
          scenarioNames: ["booking", "reminder", "handoff", "escalation"],
          summary: "4/4 visa flows passed; persistent=4; verified=4; staleRecovery=4; resumed=4.",
        },
      },
      providerUsage: {
        status: "pass",
        validated: true,
        activeSecondaryProviders: 0,
        entries: [],
      },
    });

    writeJson(approvedBookingArtifactPath, {
      schemaVersion: "1.0",
      generatedAt: "2026-04-24T00:00:00.000Z",
      artifactType: "consultation_booking_approved",
      product: "AI Action Desk for immigration teams",
      workflow: "consultation_booking",
      scenarioName: "booking",
      status: "approved",
      approvalStatus: "approved",
      approvalBoundaryRespected: true,
      bookingFlowValidated: true,
      calendarWritebackCompleted: false,
      clientName: "Anna Petrova",
      caseId: "VISA-2048",
      service: "Initial consultation",
      timezone: "Europe/Madrid",
      preferredSlot: "Tomorrow 15:30",
      backupSlot: "Tomorrow 17:00",
      evidence: {
        navigatorVisaFlowsPath: "artifacts/demo-e2e/navigator-visa-flows.json",
        latestResultRef: "ui://browser-jobs/job-booking/result-completed",
        jobId: "job-booking",
        verificationState: "verified",
        checkpointCount: 1,
        resumedCheckpointCount: 1,
        replayBundlePresent: true,
        summary: "healed 1 stale grounding ref; resumed 1 checkpoint.",
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
        "-OutputActionDeskKpiJsonPath",
        outputActionDeskKpiJsonPath,
        "-OutputActionDeskKpiMarkdownPath",
        outputActionDeskKpiMarkdownPath,
        "-OutputConsultationBookingProofJsonPath",
        outputConsultationBookingProofJsonPath,
        "-OutputConsultationBookingProofMarkdownPath",
        outputConsultationBookingProofMarkdownPath,
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
        caseWikiRoutingContextStatus?: string;
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
      caseWikiRoutingContext: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        contextSource?: string | null;
        ingressSource?: string | null;
        focusId?: string | null;
        blocker?: string | null;
        nextAction?: string | null;
        route?: string | null;
        mode?: string | null;
        requestedIntent?: string | null;
        routedIntent?: string | null;
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
        ingressSource?: string | null;
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
      actionDeskWorkflowKpi: ActionDeskWorkflowKpiReport;
      consultationBookingProof: ConsultationBookingProofReport;
    };
    assert.equal(report.statuses.hostedDirectLiveProofStatus, "pass");
    assert.equal(report.statuses.caseWikiRoutingContextStatus, "pass");
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
    assert.equal(report.caseWikiRoutingContext.status, "pass");
    assert.equal(report.caseWikiRoutingContext.validated, true);
    assert.equal(report.caseWikiRoutingContext.observed, true);
    assert.equal(report.caseWikiRoutingContext.contextSource, "case_wiki");
    assert.equal(report.caseWikiRoutingContext.ingressSource, "preserved_input_case_wiki");
    assert.equal(report.caseWikiRoutingContext.focusId, "question:passport-scan");
    assert.equal(report.caseWikiRoutingContext.blocker, "Need passport scan");
    assert.equal(report.caseWikiRoutingContext.nextAction, "Request passport scan");
    assert.equal(report.caseWikiRoutingContext.route, "live-agent");
    assert.equal(report.caseWikiRoutingContext.mode, "deterministic");
    assert.equal(report.caseWikiRoutingContext.requestedIntent, "conversation");
    assert.equal(report.caseWikiRoutingContext.routedIntent, "conversation");
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
    assert.equal(report.caseWikiGatewayHydration.ingressSource, "gateway_hydrated_case_wiki");
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
    assert.equal(report.navigatorVisaFlows.totalFlows, 4);
    assert.equal(report.navigatorVisaFlows.succeededFlows, 4);
    assert.equal(report.navigatorVisaFlows.successRate, 1);
    assert.equal(report.navigatorVisaFlows.persistentSessionCount, 4);
    assert.equal(report.navigatorVisaFlows.replayBundleCount, 4);
    assert.equal(report.navigatorVisaFlows.verifiedCount, 4);
    assert.equal(report.navigatorVisaFlows.staleRecoveryObservedCount, 4);
    assert.equal(report.navigatorVisaFlows.healedRecoveryObservedCount, 4);
    assert.equal(report.navigatorVisaFlows.resumedCheckpointCount, 4);
    assert.equal(report.navigatorVisaFlows.checkpointReadyClearedCount, 4);
    assert.deepEqual(report.navigatorVisaFlows.scenarioNames, ["booking", "reminder", "handoff", "escalation"]);
    assert.equal(
      report.navigatorVisaFlows.summary,
      "4/4 visa flows passed; persistent=4; verified=4; staleRecovery=4; resumed=4.",
    );
    assert.equal(report.consultationBookingProof.status, "proof_ready");
    assert.equal(report.consultationBookingProof.stagedReady, true);
    assert.equal(report.consultationBookingProof.proofReady, true);
    assert.equal(report.consultationBookingProof.repoOwnedWorkflow?.personaPresent, true);
    assert.equal(report.consultationBookingProof.repoOwnedWorkflow?.recipePresent, true);
    assert.equal(report.consultationBookingProof.repoOwnedWorkflow?.playbookHasApprovalBoundary, true);
    assert.equal(report.consultationBookingProof.repoOwnedWorkflow?.playbookHasSuccessMetrics, true);
    assert.equal(report.consultationBookingProof.repoOwnedWorkflow?.bookingScenarioObserved, true);
    assert.equal(report.consultationBookingProof.repoOwnedWorkflow?.stagedReminderContextObserved, true);
    assert.deepEqual(report.consultationBookingProof.repoOwnedWorkflow?.scenarioNames, [
      "booking",
      "reminder",
      "handoff",
      "escalation",
    ]);
    assert.equal(report.consultationBookingProof.calendarConnector?.calendarSkillPresent, true);
    assert.equal(report.consultationBookingProof.calendarConnector?.calendarSkillHasApprovalBoundary, true);
    assert.equal(report.consultationBookingProof.calendarConnector?.managedSkillSamplePresent, true);
    assert.equal(report.consultationBookingProof.calendarConnector?.signingInputSamplePresent, true);
    assert.deepEqual(report.consultationBookingProof.calendarConnector?.managedSkillPermissions, [
      "ui.execute",
      "operator.actions",
    ]);
    assert.equal(report.consultationBookingProof.calendarConnector?.connectorProofObserved, true);
    assert.equal(report.consultationBookingProof.calendarConnector?.writebackObserved, false);
    assert.equal(report.consultationBookingProof.calendarConnector?.approvedBookingArtifactObserved, true);
    assertSamePath(
      report.consultationBookingProof.calendarConnector?.approvedBookingArtifactPath ?? "",
      approvedBookingArtifactPath,
      "report.consultationBookingProof.calendarConnector.approvedBookingArtifactPath",
    );
    assert.equal(report.consultationBookingProof.nextGaps?.length ?? 0, 0);
    assert.equal(report.actionDeskWorkflowKpi.product, "AI Action Desk for immigration teams");
    assert.equal(report.actionDeskWorkflowKpi.status, "pilot_ready");
    assert.equal(report.actionDeskWorkflowKpi.summary?.totalWorkflows, 4);
    assert.equal(report.actionDeskWorkflowKpi.summary?.proofReadyWorkflows, 4);
    assert.equal(report.actionDeskWorkflowKpi.summary?.needsConnectorCount, 0);
    assert.equal(report.actionDeskWorkflowKpi.summary?.needsEvidenceCount, 0);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.leadQualificationProofReady, true);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.consultationBookingProofReady, true);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.consultationBookingProofStatus, "proof_ready");
    assert.equal(report.actionDeskWorkflowKpi.metrics?.consultationBookingStagedReady, true);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.consultationBookingCalendarWritebackObserved, false);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.consultationBookingApprovedArtifactObserved, true);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.consultationBookingScenarioObserved, true);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.missingDocumentFollowUpProofReady, true);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.crmHandoffProofReady, true);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.navigatorVisaFlowSuccessRate, 1);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.navigatorVisaVerifiedCount, 4);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.caseWikiAdoptionRate, 0.952381);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.operatorMinutesSaved?.observed, false);
    assert.equal(report.actionDeskWorkflowKpi.metrics?.operatorMinutesSaved?.status, "needs_pilot_baseline");
    assert.equal(report.actionDeskWorkflowKpi.metrics?.operatorMinutesSaved?.baselineRequired, true);
    assert.equal(findActionDeskWorkflow(report.actionDeskWorkflowKpi, "lead_qualification")?.status, "proof_ready");
    assert.equal(findActionDeskWorkflow(report.actionDeskWorkflowKpi, "consultation_booking")?.status, "proof_ready");
    assert.equal(
      findActionDeskWorkflow(report.actionDeskWorkflowKpi, "missing_document_follow_up")?.status,
      "proof_ready",
    );
    assert.equal(findActionDeskWorkflow(report.actionDeskWorkflowKpi, "crm_handoff")?.status, "proof_ready");
    assert.ok(!report.actionDeskWorkflowKpi.pilotGaps?.includes("calendar_booking_connector_proof"));

    const manifest = JSON.parse(readFileSync(outputManifestJsonPath, "utf8")) as {
      criticalEvidenceStatuses: {
        hostedDirectLiveProofStatus?: string;
        caseWikiRoutingContextStatus?: string;
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
      caseWikiRoutingContext: {
        status?: string;
        validated?: boolean;
        observed?: boolean;
        contextSource?: string | null;
        ingressSource?: string | null;
        focusId?: string | null;
        blocker?: string | null;
        nextAction?: string | null;
        route?: string | null;
        mode?: string | null;
        requestedIntent?: string | null;
        routedIntent?: string | null;
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
        ingressSource?: string | null;
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
      actionDeskWorkflowKpi: ActionDeskWorkflowKpiManifest;
      consultationBookingProof: ConsultationBookingProofManifest;
    };
    assert.equal(manifest.criticalEvidenceStatuses.hostedDirectLiveProofStatus, "pass");
    assert.equal(manifest.criticalEvidenceStatuses.caseWikiRoutingContextStatus, "pass");
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
    assert.equal(manifest.caseWikiRoutingContext.status, "pass");
    assert.equal(manifest.caseWikiRoutingContext.validated, true);
    assert.equal(manifest.caseWikiRoutingContext.observed, true);
    assert.equal(manifest.caseWikiRoutingContext.contextSource, "case_wiki");
    assert.equal(manifest.caseWikiRoutingContext.ingressSource, "preserved_input_case_wiki");
    assert.equal(manifest.caseWikiRoutingContext.focusId, "question:passport-scan");
    assert.equal(manifest.caseWikiRoutingContext.blocker, "Need passport scan");
    assert.equal(manifest.caseWikiRoutingContext.nextAction, "Request passport scan");
    assert.equal(manifest.caseWikiRoutingContext.route, "live-agent");
    assert.equal(manifest.caseWikiRoutingContext.mode, "deterministic");
    assert.equal(manifest.caseWikiRoutingContext.requestedIntent, "conversation");
    assert.equal(manifest.caseWikiRoutingContext.routedIntent, "conversation");
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
    assert.equal(manifest.caseWikiGatewayHydration.ingressSource, "gateway_hydrated_case_wiki");
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
    assert.equal(manifest.navigatorVisaFlows.totalFlows, 4);
    assert.equal(manifest.navigatorVisaFlows.succeededFlows, 4);
    assert.equal(manifest.navigatorVisaFlows.successRate, 1);
    assert.equal(manifest.navigatorVisaFlows.persistentSessionCount, 4);
    assert.equal(manifest.navigatorVisaFlows.replayBundleCount, 4);
    assert.equal(manifest.navigatorVisaFlows.verifiedCount, 4);
    assert.equal(manifest.navigatorVisaFlows.staleRecoveryObservedCount, 4);
    assert.equal(manifest.navigatorVisaFlows.healedRecoveryObservedCount, 4);
    assert.equal(manifest.navigatorVisaFlows.resumedCheckpointCount, 4);
    assert.equal(manifest.navigatorVisaFlows.checkpointReadyClearedCount, 4);
    assert.deepEqual(manifest.navigatorVisaFlows.scenarioNames, ["booking", "reminder", "handoff", "escalation"]);
    assert.equal(
      manifest.navigatorVisaFlows.summary,
      "4/4 visa flows passed; persistent=4; verified=4; staleRecovery=4; resumed=4.",
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
    assert.equal(
      manifest.artifacts.find((entry) => entry.id === "release.actionDeskKpiReportJson")?.present,
      true,
    );
    assert.equal(
      manifest.artifacts.find((entry) => entry.id === "release.actionDeskKpiReportMarkdown")?.present,
      true,
    );
    assert.equal(
      manifest.artifacts.find((entry) => entry.id === "demo.consultationBookingApproved")?.present,
      true,
    );
    assert.equal(
      manifest.artifacts.find((entry) => entry.id === "release.consultationBookingProofJson")?.present,
      true,
    );
    assert.equal(
      manifest.artifacts.find((entry) => entry.id === "release.consultationBookingProofMarkdown")?.present,
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
    assert.equal(manifest.actionDeskWorkflowKpi.status, "pilot_ready");
    assert.equal(manifest.actionDeskWorkflowKpi.totalWorkflows, 4);
    assert.equal(manifest.actionDeskWorkflowKpi.proofReadyWorkflows, 4);
    assert.equal(manifest.actionDeskWorkflowKpi.needsConnectorCount, 0);
    assert.equal(manifest.actionDeskWorkflowKpi.needsEvidenceCount, 0);
    assert.equal(manifest.actionDeskWorkflowKpi.leadQualificationProofReady, true);
    assert.equal(manifest.actionDeskWorkflowKpi.consultationBookingProofReady, true);
    assert.equal(manifest.actionDeskWorkflowKpi.consultationBookingProofStatus, "proof_ready");
    assert.equal(manifest.actionDeskWorkflowKpi.consultationBookingStagedReady, true);
    assert.equal(manifest.actionDeskWorkflowKpi.consultationBookingCalendarWritebackObserved, false);
    assert.equal(manifest.actionDeskWorkflowKpi.consultationBookingApprovedArtifactObserved, true);
    assert.equal(manifest.actionDeskWorkflowKpi.consultationBookingScenarioObserved, true);
    assert.equal(manifest.actionDeskWorkflowKpi.missingDocumentFollowUpProofReady, true);
    assert.equal(manifest.actionDeskWorkflowKpi.crmHandoffProofReady, true);
    assert.equal(manifest.actionDeskWorkflowKpi.navigatorVisaFlowSuccessRate, 1);
    assert.equal(manifest.actionDeskWorkflowKpi.caseWikiAdoptionRate, 0.952381);
    assert.equal(manifest.actionDeskWorkflowKpi.operatorMinutesSavedStatus, "needs_pilot_baseline");
    assert.ok(!manifest.actionDeskWorkflowKpi.pilotGaps?.includes("calendar_booking_connector_proof"));
    assert.equal(manifest.consultationBookingProof.status, "proof_ready");
    assert.equal(manifest.consultationBookingProof.stagedReady, true);
    assert.equal(manifest.consultationBookingProof.proofReady, true);
    assert.equal(manifest.consultationBookingProof.bookingScenarioObserved, true);
    assert.equal(manifest.consultationBookingProof.stagedReminderContextObserved, true);
    assert.equal(manifest.consultationBookingProof.calendarSkillPresent, true);
    assert.equal(manifest.consultationBookingProof.managedSkillSamplePresent, true);
    assert.equal(manifest.consultationBookingProof.connectorProofObserved, true);
    assert.equal(manifest.consultationBookingProof.calendarWritebackObserved, false);
    assert.equal(manifest.consultationBookingProof.approvedBookingArtifactObserved, true);
    assert.equal(manifest.consultationBookingProof.nextGaps?.length ?? 0, 0);

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
          routingIngressSource?: string | null;
          gatewayHydrationIngressSource?: string | null;
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
    assert.equal(runtimeProof.lanes?.caseWiki?.routingIngressSource, "preserved_input_case_wiki");
    assert.equal(runtimeProof.lanes?.caseWiki?.gatewayHydrationIngressSource, "gateway_hydrated_case_wiki");
    assert.equal(runtimeProof.lanes?.caseWiki?.blocker, "Need passport scan");
    assert.equal(runtimeProof.lanes?.caseWiki?.nextAction, "Request passport scan");
    assert.equal(runtimeProof.lanes?.caseWiki?.caseWikiRate, 0.952381);
    assert.equal(runtimeProof.lanes?.navigator?.status, "pass");
    assert.equal(runtimeProof.lanes?.navigator?.totalFlows, 4);
    assert.equal(runtimeProof.lanes?.navigator?.succeededFlows, 4);
    assert.equal(runtimeProof.lanes?.navigator?.successRate, 1);
    assert.deepEqual(runtimeProof.lanes?.navigator?.scenarioNames, ["booking", "reminder", "handoff", "escalation"]);
    assert.deepEqual(runtimeProof.blockers, []);

    const actionDeskKpi = JSON.parse(readFileSync(outputActionDeskKpiJsonPath, "utf8")) as ActionDeskWorkflowKpiReport;
    assert.equal(actionDeskKpi.product, "AI Action Desk for immigration teams");
    assert.equal(actionDeskKpi.status, "pilot_ready");
    assert.equal(actionDeskKpi.summary?.totalWorkflows, 4);
    assert.equal(actionDeskKpi.summary?.proofReadyWorkflows, 4);
    assert.equal(actionDeskKpi.summary?.needsConnectorCount, 0);
    assert.equal(actionDeskKpi.metrics?.operatorMinutesSaved?.status, "needs_pilot_baseline");
    assert.equal(actionDeskKpi.metrics?.consultationBookingProofReady, true);
    assert.equal(actionDeskKpi.metrics?.consultationBookingProofStatus, "proof_ready");
    assert.equal(actionDeskKpi.metrics?.consultationBookingApprovedArtifactObserved, true);
    assert.equal(findActionDeskWorkflow(actionDeskKpi, "consultation_booking")?.status, "proof_ready");
    assert.ok(!actionDeskKpi.pilotGaps?.includes("calendar_booking_connector_proof"));

    const consultationBookingProof = JSON.parse(
      readFileSync(outputConsultationBookingProofJsonPath, "utf8"),
    ) as ConsultationBookingProofReport;
    assert.equal(consultationBookingProof.status, "proof_ready");
    assert.equal(consultationBookingProof.stagedReady, true);
    assert.equal(consultationBookingProof.proofReady, true);
    assert.equal(consultationBookingProof.repoOwnedWorkflow?.bookingScenarioObserved, true);
    assert.equal(consultationBookingProof.calendarConnector?.connectorProofObserved, true);
    assert.equal(consultationBookingProof.calendarConnector?.writebackObserved, false);
    assert.equal(consultationBookingProof.calendarConnector?.approvedBookingArtifactObserved, true);
    assertSamePath(
      consultationBookingProof.calendarConnector?.approvedBookingArtifactPath ?? "",
      approvedBookingArtifactPath,
      "consultationBookingProof.calendarConnector.approvedBookingArtifactPath",
    );
    assert.equal(consultationBookingProof.nextGaps?.length ?? 0, 0);

    const reportMarkdown = readFileSync(outputMarkdownPath, "utf8");
    assert.match(reportMarkdown, /## Hosted Direct-Live Proof Snapshot/);
    assert.match(reportMarkdown, /- generatedAt: /);
    assert.match(reportMarkdown, /- generatedAtIsIso: True/i);
    assert.match(reportMarkdown, /- freshnessStatus: pass/);
    assert.match(reportMarkdown, /- firstAudioMs: 640/);
    assert.match(reportMarkdown, /- firstOutputMs: 410/);
    assert.match(reportMarkdown, /- runtimeEvidenceExpectedSignatureStatus: signed/);
    assert.match(reportMarkdown, /- caseWikiExpectedSignatureSource: runtime_diagnostics/);
    assert.match(reportMarkdown, /## Case Wiki Routing Context Snapshot/);
    assert.match(reportMarkdown, /- ingressSource: preserved_input_case_wiki/);
    assert.match(reportMarkdown, /## Case Wiki Gateway Hydration Snapshot/);
    assert.match(reportMarkdown, /- sessionId: session-hydration-123/);
    assert.match(reportMarkdown, /- ingressSource: gateway_hydrated_case_wiki/);
    assert.match(reportMarkdown, /## Case Wiki Context Adoption Snapshot/);
    assert.match(reportMarkdown, /- observedCount: 21/);
    assert.match(reportMarkdown, /## UI Ref Healing Snapshot/);
    assert.match(reportMarkdown, /- healedRefTargets: email, submit_primary/);
    assert.match(reportMarkdown, /## Browser Worker Recovery Snapshot/);
    assert.match(reportMarkdown, /- resumedCheckpointCount: 1/);
    assert.match(reportMarkdown, /## Navigator Visa Flows Snapshot/);
    assert.match(reportMarkdown, /- totalFlows: 4/);
    assert.match(reportMarkdown, /- scenarioNames: booking, reminder, handoff, escalation/);
    assert.match(reportMarkdown, /## Consultation Booking Proof/);
    assert.match(reportMarkdown, /- status: proof_ready/);
    assert.match(reportMarkdown, /- calendarWritebackObserved: False/i);
    assert.match(reportMarkdown, /- approvedBookingArtifactObserved: True/i);
    assert.match(reportMarkdown, /## Action Desk Workflow KPI/);
    assert.match(reportMarkdown, /- proofReadyWorkflows: 4\/4/);

    const manifestMarkdown = readFileSync(outputManifestMarkdownPath, "utf8");
    const runtimeProofMarkdown = readFileSync(outputRuntimeProofMarkdownPath, "utf8");
    const actionDeskKpiMarkdown = readFileSync(outputActionDeskKpiMarkdownPath, "utf8");
    const consultationBookingProofMarkdown = readFileSync(outputConsultationBookingProofMarkdownPath, "utf8");
    assert.match(runtimeProofMarkdown, /# Runtime Proof Report/);
    assert.match(runtimeProofMarkdown, /- Overall status: pass/);
    assert.match(runtimeProofMarkdown, /\| direct_live \| pass \|/);
    assert.match(runtimeProofMarkdown, /\| case_wiki \| pass \|/);
    assert.match(runtimeProofMarkdown, /\| navigator \| pass \|/);
    assert.match(runtimeProofMarkdown, /## Direct Live Proof/);
    assert.match(runtimeProofMarkdown, /- firstAudioMs: 640/);
    assert.match(runtimeProofMarkdown, /## Case Wiki Proof/);
    assert.match(runtimeProofMarkdown, /- contextSource: case_wiki/);
    assert.match(runtimeProofMarkdown, /- routingIngressSource: preserved_input_case_wiki/);
    assert.match(runtimeProofMarkdown, /- gatewayHydrationIngressSource: gateway_hydrated_case_wiki/);
    assert.match(runtimeProofMarkdown, /## Navigator Proof/);
    assert.match(runtimeProofMarkdown, /- totalFlows: 4/);
    assert.match(runtimeProofMarkdown, /## Blockers/);
    assert.match(manifestMarkdown, /## Action Desk Workflow KPI/);
    assert.match(manifestMarkdown, /\| proofReadyWorkflows \| 4 \|/);
    assert.match(manifestMarkdown, /## Consultation Booking Proof/);
    assert.match(manifestMarkdown, /\| status \| proof_ready \|/);
    assert.match(actionDeskKpiMarkdown, /# Action Desk Workflow KPI Report/);
    assert.match(actionDeskKpiMarkdown, /\| consultation_booking \| proof_ready \| consultationBookingProof \|/);
    assert.match(actionDeskKpiMarkdown, /\| consultationBookingProofStatus \| proof_ready \|/);
    assert.match(actionDeskKpiMarkdown, /\| operatorMinutesSaved \| needs_pilot_baseline \|/);
    assert.match(consultationBookingProofMarkdown, /# Consultation Booking Proof Report/);
    assert.match(consultationBookingProofMarkdown, /- Status: proof_ready/);
    assert.match(consultationBookingProofMarkdown, /## Calendar Connector/);
    assert.match(consultationBookingProofMarkdown, /\| approvedBookingArtifactObserved \| True \|/);
    assert.match(runtimeProofMarkdown, /- none/);
    assert.match(manifestMarkdown, /## Hosted Direct-Live Proof/);
    assert.match(manifestMarkdown, /## Runtime Proof Report/);
    assert.match(manifestMarkdown, /\| status \| pass \|/);
    assert.match(manifestMarkdown, /\| freshnessStatus \| pass \|/);
    assert.match(manifestMarkdown, /\| firstAudioMs \| 640 \|/);
    assert.match(manifestMarkdown, /\| firstOutputMs \| 410 \|/);
    assert.match(manifestMarkdown, /\| runtimeEvidenceExpectedSignatureStatus \| signed \|/);
    assert.match(manifestMarkdown, /\| caseWikiExpectedSignatureSource \| runtime_diagnostics \|/);
    assert.match(manifestMarkdown, /## Case Wiki Routing Context/);
    assert.match(manifestMarkdown, /\| ingressSource \| preserved_input_case_wiki \|/);
    assert.match(manifestMarkdown, /## Case Wiki Gateway Hydration/);
    assert.match(manifestMarkdown, /\| sessionId \| session-hydration-123 \|/);
    assert.match(manifestMarkdown, /\| ingressSource \| gateway_hydrated_case_wiki \|/);
    assert.match(manifestMarkdown, /## Case Wiki Context Adoption/);
    assert.match(manifestMarkdown, /\| observedCount \| 21 \|/);
    assert.match(manifestMarkdown, /## UI Ref Healing/);
    assert.match(manifestMarkdown, /\| healedRefTargets \| email, submit_primary \|/);
    assert.match(manifestMarkdown, /## Browser Worker Recovery/);
    assert.match(manifestMarkdown, /\| resumedCheckpointCount \| 1 \|/);
    assert.match(manifestMarkdown, /\| navigatorVisaFlows \| pass \|/);
    assert.match(manifestMarkdown, /## Navigator Visa Flows/);
    assert.match(manifestMarkdown, /\| totalFlows \| 4 \|/);
  },
);

test(
  "release evidence report surfaces case wiki runtime-surface ingress in report manifest and runtime proof",
  { skip: skipIfNoPowerShell },
  () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "release-evidence-report-runtime-surface-ingress-"));
    const badgeDetailsPath = join(tempRoot, "artifacts", "demo-e2e", "badge-details.json");
    const runtimeSurfaceSnapshotPath = join(
      tempRoot,
      "artifacts",
      "runtime",
      "runtime-surface-snapshot.json",
    );
    const outputJsonPath = join(tempRoot, "artifacts", "release-evidence", "report.json");
    const outputMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "report.md");
    const outputRuntimeProofJsonPath = join(
      tempRoot,
      "artifacts",
      "release-evidence",
      "runtime-proof-report.json",
    );
    const outputRuntimeProofMarkdownPath = join(
      tempRoot,
      "artifacts",
      "release-evidence",
      "runtime-proof-report.md",
    );
    const outputManifestJsonPath = join(tempRoot, "artifacts", "release-evidence", "manifest.json");
    const outputManifestMarkdownPath = join(
      tempRoot,
      "artifacts",
      "release-evidence",
      "manifest.md",
    );

    writeJson(badgeDetailsPath, {
      evidence: {
        caseWikiEvidenceSignature: {
          status: "pass",
          validated: true,
          totalArtifacts: 1,
          signedArtifacts: 1,
          unsignedArtifacts: 0,
          signatureStatus: "signed",
          signerId: "api-backend",
          signedAt: "2026-04-18T10:00:00.000Z",
          signedAtIsIso: true,
          signaturePresent: true,
          caseId: "case-runtime-surface-123",
          sessionId: "session-runtime-surface-123",
          nextAction: "Request passport scan",
          sourceRefsCount: 1,
        },
        caseWikiCompliance: createPassingCaseWikiComplianceEvidence("signed"),
        caseWikiRoutingContext: {
          status: "pass",
          validated: true,
          observed: true,
          contextSource: "case_wiki",
          ingressSource: "preserved_input_case_wiki",
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
          sessionId: "session-runtime-surface-123",
          noteEventId: "event-case-wiki-note-runtime-surface-123",
          questionId: "question:operator-note:event-case-wiki-note-runtime-surface-123",
          questionMatched: true,
          noteSourceRefSeen: true,
          questionSuggestedNextStep: "Request passport scan",
          contextSource: "case_wiki",
          ingressSource: "gateway_hydrated_case_wiki",
          focusId: "question:passport-scan",
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
          observedCount: 8,
          caseWikiObservedCount: 8,
          inputOnlyObservedCount: 0,
          unknownObservedCount: 0,
          caseWikiRate: 1,
        },
      },
    });

    writeJson(runtimeSurfaceSnapshotPath, {
      source: "repo_owned_runtime_surface_snapshot",
      readiness: {
        source: "repo_owned_runtime_surface_readiness",
        summary: {
          workflow: {
            caseWikiIngress: {
              observed: true,
              updatedAt: "2026-04-18T10:05:00.000Z",
              contextSource: "case_wiki",
              ingressSource: "gateway_hydrated_case_wiki",
              focusId: "question:passport-scan",
              blocker: "Need passport scan",
              nextAction: "Request passport scan",
              route: "live-agent",
            },
          },
        },
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
      source: {
        runtimeSurfaceSnapshotPath?: string;
        runtimeSurfaceSnapshotPresent?: boolean;
        runtimeSurfaceSnapshotParsed?: boolean;
      };
      statuses: {
        caseWikiRuntimeSurfaceIngressStatus?: string;
      };
      caseWikiRuntimeSurfaceIngress: {
        status?: string;
        observed?: boolean;
        updatedAt?: string | null;
        contextSource?: string | null;
        ingressSource?: string | null;
        focusId?: string | null;
        blocker?: string | null;
        nextAction?: string | null;
        route?: string | null;
        summary?: string | null;
      };
    };
    assertSamePath(
      report.source.runtimeSurfaceSnapshotPath ?? "",
      runtimeSurfaceSnapshotPath,
      "report.source.runtimeSurfaceSnapshotPath",
    );
    assert.equal(report.source.runtimeSurfaceSnapshotPresent, true);
    assert.equal(report.source.runtimeSurfaceSnapshotParsed, true);
    assert.equal(report.statuses.caseWikiRuntimeSurfaceIngressStatus, "pass");
    assert.equal(report.caseWikiRuntimeSurfaceIngress.status, "pass");
    assert.equal(report.caseWikiRuntimeSurfaceIngress.observed, true);
    assert.equal(report.caseWikiRuntimeSurfaceIngress.updatedAt, "2026-04-18T10:05:00.000Z");
    assert.equal(report.caseWikiRuntimeSurfaceIngress.contextSource, "case_wiki");
    assert.equal(report.caseWikiRuntimeSurfaceIngress.ingressSource, "gateway_hydrated_case_wiki");
    assert.equal(report.caseWikiRuntimeSurfaceIngress.focusId, "question:passport-scan");
    assert.equal(report.caseWikiRuntimeSurfaceIngress.blocker, "Need passport scan");
    assert.equal(report.caseWikiRuntimeSurfaceIngress.nextAction, "Request passport scan");
    assert.equal(report.caseWikiRuntimeSurfaceIngress.route, "live-agent");
    assert.match(
      report.caseWikiRuntimeSurfaceIngress.summary ?? "",
      /ingress_source=gateway_hydrated_case_wiki/,
    );

    const manifest = JSON.parse(readFileSync(outputManifestJsonPath, "utf8")) as {
      source: {
        runtimeSurfaceSnapshotPath?: string;
      };
      criticalEvidenceStatuses: {
        caseWikiRuntimeSurfaceIngressStatus?: string;
      };
      caseWikiRuntimeSurfaceIngress: {
        status?: string;
        observed?: boolean;
        updatedAt?: string | null;
        contextSource?: string | null;
        ingressSource?: string | null;
        focusId?: string | null;
        route?: string | null;
        summary?: string | null;
      };
    };
    assertSamePath(
      manifest.source.runtimeSurfaceSnapshotPath ?? "",
      runtimeSurfaceSnapshotPath,
      "manifest.source.runtimeSurfaceSnapshotPath",
    );
    assert.equal(manifest.criticalEvidenceStatuses.caseWikiRuntimeSurfaceIngressStatus, "pass");
    assert.equal(manifest.caseWikiRuntimeSurfaceIngress.status, "pass");
    assert.equal(manifest.caseWikiRuntimeSurfaceIngress.observed, true);
    assert.equal(manifest.caseWikiRuntimeSurfaceIngress.updatedAt, "2026-04-18T10:05:00.000Z");
    assert.equal(manifest.caseWikiRuntimeSurfaceIngress.contextSource, "case_wiki");
    assert.equal(manifest.caseWikiRuntimeSurfaceIngress.ingressSource, "gateway_hydrated_case_wiki");
    assert.equal(manifest.caseWikiRuntimeSurfaceIngress.focusId, "question:passport-scan");
    assert.equal(manifest.caseWikiRuntimeSurfaceIngress.route, "live-agent");
    assert.match(manifest.caseWikiRuntimeSurfaceIngress.summary ?? "", /context_source=case_wiki/);

    const runtimeProof = JSON.parse(readFileSync(outputRuntimeProofJsonPath, "utf8")) as {
      source: {
        runtimeSurfaceSnapshotPath?: string;
      };
      lanes: {
        caseWiki?: {
          runtimeSurfaceIngressStatus?: string;
          runtimeSurfaceContextSource?: string | null;
          runtimeSurfaceIngressSource?: string | null;
          runtimeSurfaceFocusId?: string | null;
          runtimeSurfaceRoute?: string | null;
          summary?: string | null;
        };
      };
    };
    assertSamePath(
      runtimeProof.source.runtimeSurfaceSnapshotPath ?? "",
      runtimeSurfaceSnapshotPath,
      "runtimeProof.source.runtimeSurfaceSnapshotPath",
    );
    assert.equal(runtimeProof.lanes.caseWiki?.runtimeSurfaceIngressStatus, "pass");
    assert.equal(runtimeProof.lanes.caseWiki?.runtimeSurfaceContextSource, "case_wiki");
    assert.equal(runtimeProof.lanes.caseWiki?.runtimeSurfaceIngressSource, "gateway_hydrated_case_wiki");
    assert.equal(runtimeProof.lanes.caseWiki?.runtimeSurfaceFocusId, "question:passport-scan");
    assert.equal(runtimeProof.lanes.caseWiki?.runtimeSurfaceRoute, "live-agent");
    assert.match(runtimeProof.lanes.caseWiki?.summary ?? "", /runtime_surface_ingress=gateway_hydrated_case_wiki/);

    const reportMarkdown = readFileSync(outputMarkdownPath, "utf8");
    assert.match(reportMarkdown, /\| caseWikiRuntimeSurfaceIngress \| pass \|/);
    assert.match(reportMarkdown, /## Case Wiki Runtime Surface Ingress Snapshot/);
    assert.match(reportMarkdown, /- ingressSource: gateway_hydrated_case_wiki/);

    const runtimeProofMarkdown = readFileSync(outputRuntimeProofMarkdownPath, "utf8");
    assert.match(runtimeProofMarkdown, /- Runtime surface snapshot path: /);
    assert.match(runtimeProofMarkdown, /- runtimeSurfaceIngressStatus: pass/);
    assert.match(runtimeProofMarkdown, /- runtimeSurfaceIngressSource: gateway_hydrated_case_wiki/);

    const manifestMarkdown = readFileSync(outputManifestMarkdownPath, "utf8");
    assert.match(manifestMarkdown, /\| caseWikiRuntimeSurfaceIngress \| pass \|/);
    assert.match(manifestMarkdown, /## Case Wiki Runtime Surface Ingress/);
    assert.match(manifestMarkdown, /\| ingressSource \| gateway_hydrated_case_wiki \|/);
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
        summary?: string | null;
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
    assert.match(report.caseWikiCompliance.summary ?? "", /signing=signed/);

    const manifest = JSON.parse(readFileSync(outputManifestJsonPath, "utf8")) as {
      criticalEvidenceStatuses: { caseWikiEvidenceSignatureStatus?: string };
      caseWikiEvidenceSignature: {
        source?: string | null;
        status?: string;
        signatureStatus?: string | null;
        signedArtifacts?: number;
        unsignedArtifacts?: number;
      };
      caseWikiCompliance: {
        summary?: string | null;
      };
    };
    assert.equal(manifest.criticalEvidenceStatuses.caseWikiEvidenceSignatureStatus, "pass");
    assert.equal(manifest.caseWikiEvidenceSignature.source, "hosted_direct_live_proof");
    assert.equal(manifest.caseWikiEvidenceSignature.status, "pass");
    assert.equal(manifest.caseWikiEvidenceSignature.signatureStatus, "signed");
    assert.equal(manifest.caseWikiEvidenceSignature.signedArtifacts, 1);
    assert.equal(manifest.caseWikiEvidenceSignature.unsignedArtifacts, 0);
    assert.match(manifest.caseWikiCompliance.summary ?? "", /signing=signed/);

    const reportMarkdown = readFileSync(outputMarkdownPath, "utf8");
    assert.match(reportMarkdown, /\| caseWikiEvidenceSignature \| pass \|/);
    assert.match(reportMarkdown, /- source: hosted_direct_live_proof/);
    assert.match(reportMarkdown, /- signatureStatus: signed/);
    assert.match(reportMarkdown, /- summary: .*signing=signed/);

    const manifestMarkdown = readFileSync(outputManifestMarkdownPath, "utf8");
    assert.match(manifestMarkdown, /\| caseWikiEvidenceSignature \| pass \|/);
    assert.match(manifestMarkdown, /\| source \| hosted_direct_live_proof \|/);
    assert.match(manifestMarkdown, /\| signatureStatus \| signed \|/);
    assert.match(manifestMarkdown, /\| summary \| .*signing=signed \|/);
  },
);

test(
  "release evidence report path-equality assertion strategy survives Windows 8.3 short-path mismatch (exploratory PBT)",
  () => {
    // Bug condition exploration test (Property 1 from design.md).
    //
    // GOAL: Surface counterexamples that demonstrate the textual `assert.equal`
    // strategy rejects same-file paths whose only difference is Windows 8.3
    // short-name vs long-name spelling. The NEW strategy (canonicalize both
    // sides via fs.realpathSync, then compare) accepts them as equal.
    //
    // EXPECTED OUTCOME on Windows: at least one generated sample produces a
    //   distinct 8.3 short form, the OLD strategy's `assert.equal` throws
    //   AssertionError on that sample, and the NEW strategy (the
    //   `assertSamePath` helper) does NOT throw.
    //
    // EXPECTED OUTCOME on Linux: the body short-circuits (8.3 short-path
    //   aliasing does not exist on POSIX) and the test reports as passed.
    //
    // The NEW-strategy demonstration phase below calls `assertSamePath`
    // directly (introduced by task 3.1) so this PBT exercises the exact helper
    // used at the production-equivalent test call sites. The precondition
    // canonicalization uses `fs.realpathSync.native` on Windows because, on
    // Node 24+ Windows, plain `fs.realpathSync` does NOT collapse 8.3 short
    // forms (it returns the input unchanged); only the native variant does.
    // This mirrors `assertSamePath`'s platform pick.
    if (process.platform !== "win32") {
      return;
    }

    // Hand-rolled generator: produce N distinct temp-directory basenames.
    // Avoids adding `fast-check` as a dev dependency. Each sample is
    // exercised end-to-end (create real dir, compute 8.3 short form, compare).
    const sampleCount = 8;
    const basenames: string[] = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const suffix = `${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      // mkdtempSync appends 6 random chars to the prefix we pass; the prefix
      // we hand it is the basename + a trailing dash, which keeps the
      // generated directory readable and unique per sample.
      basenames.push(`shortpath-pbt-${suffix}-`);
    }

    const counterexamples: Array<{
      basename: string;
      shortForm: string;
      longForm: string;
      canonicalShort: string;
      canonicalLong: string;
      oldStrategyError: string;
    }> = [];

    let aliasingObservedAtLeastOnce = false;
    const createdDirs: string[] = [];

    try {
      for (const basename of basenames) {
        const longForm = mkdtempSync(join(tmpdir(), basename));
        createdDirs.push(longForm);

        // Use cmd's `for` token expansion (%~sA = short-path form) to ask
        // Windows itself for the 8.3 alias. The long path is double-quoted
        // inside the cmd argument so spaces / special chars are tolerated.
        const escapedLongForm = longForm.replace(/"/g, '""');
        const shortForm = execSync(
          `cmd /c for %A in ("${escapedLongForm}") do @echo %~sA`,
          { encoding: "utf8" },
        ).trim();

        if (shortForm === longForm) {
          // The filesystem did not produce a distinct 8.3 alias for this
          // sample. The bug condition cannot be exercised here. Warn once
          // (per test invocation) and move on - other samples may still
          // surface the alias.
          if (!aliasingObservedAtLeastOnce) {
            console.warn(
              `[shortpath-pbt] sample ${basename} did not yield a distinct 8.3 short form ` +
                `(short === long: ${longForm}); 8DOT3 may be disabled on this volume`,
            );
          }
          continue;
        }

        // Precondition: the two textual forms differ.
        assert.notEqual(shortForm, longForm, "expected 8.3 short form to differ from long form");

        // Both forms must canonicalize to the same physical entry.
        // We use `realpathSync.native` here (parallel to `assertSamePath`'s
        // platform pick) because on Node 24+ Windows, plain `realpathSync`
        // does NOT collapse 8.3 short forms - it returns the input unchanged.
        // This block is already inside the `process.platform === "win32"`
        // short-circuit at the top of the test body, so no new platform
        // branching is introduced.
        const canonicalShort = realpathSync.native(shortForm);
        const canonicalLong = realpathSync.native(longForm);
        assert.equal(
          canonicalShort,
          canonicalLong,
          `expected fs.realpathSync.native(short) === fs.realpathSync.native(long) for ${basename}`,
        );

        // Demonstrate the OLD strategy fails: textual assert.equal rejects
        // same-file paths that differ only in 8.3 spelling.
        let oldStrategyError: Error | null = null;
        try {
          assert.equal(shortForm, longForm);
        } catch (error) {
          oldStrategyError = error as Error;
        }
        assert.ok(
          oldStrategyError !== null,
          `OLD strategy (assert.equal) unexpectedly accepted distinct-spelling same-file paths for ${basename}`,
        );
        assert.equal(
          (oldStrategyError as Error & { code?: string }).code,
          "ERR_ASSERTION",
          `OLD strategy threw unexpected error type for ${basename}: ${(oldStrategyError as Error).message}`,
        );

        // Demonstrate the NEW strategy passes by calling `assertSamePath`
        // directly. This is the helper task 3.1 introduced, and it is the
        // exact operation the two affected production-equivalent tests now
        // use (task 3.2). Calling the helper here makes the PBT a stricter,
        // more durable proof of Property 1: the helper used at the call
        // sites does not throw for same-file pairs that differ only in
        // 8.3 short-name vs long-name spelling.
        let newStrategyError: Error | null = null;
        try {
          assertSamePath(shortForm, longForm, "shortpath-pbt-new-strategy");
        } catch (error) {
          newStrategyError = error as Error;
        }
        assert.equal(
          newStrategyError,
          null,
          `NEW strategy (assertSamePath) unexpectedly rejected same-file paths for ${basename}: ` +
            `${newStrategyError?.message ?? ""}`,
        );

        aliasingObservedAtLeastOnce = true;
        counterexamples.push({
          basename,
          shortForm,
          longForm,
          canonicalShort,
          canonicalLong,
          oldStrategyError: (oldStrategyError as Error).message,
        });
      }
    } finally {
      for (const dir of createdDirs) {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          // best-effort cleanup; do not mask test outcome
        }
      }
    }

    if (!aliasingObservedAtLeastOnce) {
      console.warn(
        `[shortpath-pbt] no sample out of ${sampleCount} produced a distinct 8.3 short form on this Windows host; ` +
          "the bug condition could not be exercised (8DOT3 likely disabled). The test is reporting as passed without " +
          "having validated the property. Re-run on a host with 8DOT3 enabled (default on the GitHub Actions windows-2025 image).",
      );
      return;
    }

    // Surface the counterexamples found so the bugfix workflow can document
    // the precise inputs that demonstrate the bug.
    console.warn(
      `[shortpath-pbt] surfaced ${counterexamples.length} counterexample(s) where ` +
        "OLD strategy (textual assert.equal) rejected same-file paths but NEW strategy (canonicalize+compare) accepted them",
    );
    for (const sample of counterexamples) {
      console.warn(
        `[shortpath-pbt] counterexample: short=${sample.shortForm} long=${sample.longForm} ` +
          `canonical=${sample.canonicalShort}`,
      );
    }
  },
);

test(
  "release evidence report path-equality preservation property (preservation PBT)",
  () => {
    // Property 2 from design.md: Preservation - Different-File Path Comparison
    // Still Fails; Linux And Non-Path Behavior Unchanged.
    //
    // GOAL: Capture, as property assertions over a hand-rolled input domain,
    // the observed Linux-UNFIXED behavior of path-equality assertions for
    // non-bug inputs. Specifically:
    //   - same-file pair (p, p):     assertSamePath does NOT throw
    //   - distinct-file pair (p1,p2): assertSamePath throws AssertionError
    //   - missing-file pair (m, p):   assertSamePath throws with a readable
    //                                 error whose message contains the label
    //
    // GATE: This block intentionally references `assertSamePath`, the helper
    // introduced by task 3.1. JavaScript's `typeof` operator is the single
    // operator that does NOT throw on an undeclared identifier; it returns
    // the string "undefined" instead. So the gate evaluates to `false`
    // before task 3.1 lands (and the block short-circuits cleanly), and
    // flips to `true` once the helper is in scope (and the property
    // assertions run). This satisfies the bugfix workflow's "preservation
    // tests authored before the fix" invariant while keeping the unit suite
    // green between task 2 and task 3.1.
    //
    // tsx (esbuild) strips types without type-checking, so the TS reference
    // to `assertSamePath` does not block the run before task 3.1.
    // @ts-ignore - assertSamePath is introduced by task 3.1; the gate below
    // is the deliberate short-circuit until then.
    const HAS_ASSERT_SAME_PATH = typeof assertSamePath === "function";
    if (!HAS_ASSERT_SAME_PATH) {
      console.warn(
        "[preservation-pbt] assertSamePath not yet introduced (task 3.1); " +
          "preservation block short-circuits and will activate after the helper lands",
      );
      return;
    }

    // Hand-rolled generator: produce N=8 pairs of distinct real files inside
    // a fresh temp dir. Avoids adding `fast-check` as a dev dependency.
    const sampleCount = 8;
    const tempDir = mkdtempSync(join(tmpdir(), "preservation-pbt-"));
    const pairs: Array<{ p1: string; p2: string }> = [];
    try {
      for (let index = 0; index < sampleCount; index += 1) {
        const p1 = join(tempDir, `pair-${index}-a.txt`);
        const p2 = join(tempDir, `pair-${index}-b.txt`);
        writeFileSync(p1, `preservation-pbt-content-a-${index}`);
        writeFileSync(p2, `preservation-pbt-content-b-${index}`);
        pairs.push({ p1, p2 });
      }

      // Same-file case: assertSamePath(p, p) does NOT throw, for both sides
      // of every generated pair.
      for (const { p1, p2 } of pairs) {
        for (const same of [p1, p2]) {
          let sameError: Error | null = null;
          try {
            // @ts-ignore - assertSamePath is introduced by task 3.1
            assertSamePath(same, same, "preservation-same");
          } catch (error) {
            sameError = error as Error;
          }
          assert.equal(
            sameError,
            null,
            `assertSamePath(p, p) unexpectedly threw for ${same}: ${sameError?.message ?? ""}`,
          );
        }
      }

      // Distinct-file case: for each pair (p1, p2) where p1 !== p2 after
      // fs.realpathSync, assertSamePath throws AssertionError.
      for (const { p1, p2 } of pairs) {
        // Sanity check on the generator: the two sides must canonicalize to
        // different entries, otherwise the property is vacuous for this
        // sample.
        assert.notEqual(
          realpathSync(p1),
          realpathSync(p2),
          `expected distinct canonical paths for generator pair (${p1}, ${p2})`,
        );

        let distinctError: Error | null = null;
        try {
          // @ts-ignore - assertSamePath is introduced by task 3.1
          assertSamePath(p1, p2, "preservation-distinct");
        } catch (error) {
          distinctError = error as Error;
        }
        assert.ok(
          distinctError !== null,
          `assertSamePath unexpectedly accepted distinct-file pair (${p1}, ${p2})`,
        );
        assert.equal(
          (distinctError as Error & { code?: string }).code,
          "ERR_ASSERTION",
          `assertSamePath threw unexpected error type for distinct-file pair: ` +
            `${(distinctError as Error).message}`,
        );
      }

      // Missing-file case: a generated (missing, present) pair where the
      // first path does not exist on disk. assertSamePath must throw with a
      // readable error whose message includes the label "preservation-missing".
      const missingPath = join(tempDir, "definitely-missing-preservation-pbt.txt");
      const presentPath = pairs[0].p1;
      let missingError: Error | null = null;
      try {
        // @ts-ignore - assertSamePath is introduced by task 3.1
        assertSamePath(missingPath, presentPath, "preservation-missing");
      } catch (error) {
        missingError = error as Error;
      }
      assert.ok(
        missingError !== null,
        "assertSamePath unexpectedly accepted a missing-file pair",
      );
      assert.match(
        (missingError as Error).message,
        /preservation-missing/,
        `assertSamePath did not surface label "preservation-missing" in error message: ` +
          `${(missingError as Error).message}`,
      );
    } finally {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup; do not mask test outcome
      }
    }
  },
);
