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

test(
  "release evidence report surfaces hosted direct-live proof in report and manifest",
  { skip: skipIfNoPowerShell },
  () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "release-evidence-report-hosted-proof-"));
    const badgeDetailsPath = join(tempRoot, "artifacts", "demo-e2e", "badge-details.json");
    const directLiveProofPath = join(tempRoot, "artifacts", "deploy", "direct-live-proof.json");
    const outputJsonPath = join(tempRoot, "artifacts", "release-evidence", "report.json");
    const outputMarkdownPath = join(tempRoot, "artifacts", "release-evidence", "report.md");
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
      },
      providerUsage: {
        status: "pass",
        validated: true,
        activeSecondaryProviders: 0,
        entries: [],
      },
    });

    writeJson(directLiveProofPath, {
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
      statuses: { hostedDirectLiveProofStatus?: string };
      hostedDirectLiveProof: {
        observed?: boolean;
        apiPublicUrlSource?: string;
        firstAudioMs?: number | null;
        firstOutputMs?: number | null;
        replayEvidenceSource?: string | null;
        caseWikiSignatureStatus?: string | null;
        latencyObserved?: boolean;
      };
    };
    assert.equal(report.statuses.hostedDirectLiveProofStatus, "pass");
    assert.equal(report.hostedDirectLiveProof.observed, true);
    assert.equal(report.hostedDirectLiveProof.apiPublicUrlSource, "frontend_config");
    assert.equal(report.hostedDirectLiveProof.replayEvidenceSource, "session_events");
    assert.equal(report.hostedDirectLiveProof.firstAudioMs, 640);
    assert.equal(report.hostedDirectLiveProof.firstOutputMs, 410);
    assert.equal(report.hostedDirectLiveProof.caseWikiSignatureStatus, "signed");
    assert.equal(report.hostedDirectLiveProof.latencyObserved, true);

    const manifest = JSON.parse(readFileSync(outputManifestJsonPath, "utf8")) as {
      criticalEvidenceStatuses: { hostedDirectLiveProofStatus?: string };
      hostedDirectLiveProof: {
        observed?: boolean;
        replayEvidenceSource?: string | null;
        firstAudioMs?: number | null;
        firstOutputMs?: number | null;
        caseWikiSignatureStatus?: string | null;
        latencyObserved?: boolean;
      };
      artifacts: Array<{ id?: string; present?: boolean }>;
    };
    assert.equal(manifest.criticalEvidenceStatuses.hostedDirectLiveProofStatus, "pass");
    assert.equal(manifest.hostedDirectLiveProof.observed, true);
    assert.equal(manifest.hostedDirectLiveProof.replayEvidenceSource, "session_events");
    assert.equal(manifest.hostedDirectLiveProof.firstAudioMs, 640);
    assert.equal(manifest.hostedDirectLiveProof.firstOutputMs, 410);
    assert.equal(manifest.hostedDirectLiveProof.caseWikiSignatureStatus, "signed");
    assert.equal(manifest.hostedDirectLiveProof.latencyObserved, true);
    assert.equal(
      manifest.artifacts.find((entry) => entry.id === "deploy.directLiveProofJson")?.present,
      true,
    );

    const reportMarkdown = readFileSync(outputMarkdownPath, "utf8");
    assert.match(reportMarkdown, /## Hosted Direct-Live Proof Snapshot/);
    assert.match(reportMarkdown, /- firstAudioMs: 640/);
    assert.match(reportMarkdown, /- firstOutputMs: 410/);

    const manifestMarkdown = readFileSync(outputManifestMarkdownPath, "utf8");
    assert.match(manifestMarkdown, /## Hosted Direct-Live Proof/);
    assert.match(manifestMarkdown, /\| firstAudioMs \| 640 \|/);
    assert.match(manifestMarkdown, /\| firstOutputMs \| 410 \|/);
  },
);
