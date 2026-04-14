import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

const directLiveProofScriptPath = resolve(process.cwd(), "scripts", "deploy-direct-live-proof.ps1");

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

function writeStubBrowserSmokeScript(args: {
  scriptPath: string;
  status: "pass" | "skipped";
  includeCaseWiki?: boolean;
  caseWikiSignatureStatus?: "signed" | "unsigned";
  caseWikiSignaturePresent?: boolean;
  runtimeDiagnosticsExpectedSignatureStatus?: "signed" | "unsigned";
  runtimeDiagnosticsEnabled?: boolean;
  runtimeDiagnosticsCanSign?: boolean;
  runtimeDiagnosticsKeyState?: "missing" | "loaded" | "invalid";
}) {
  const includeCaseWiki = args.includeCaseWiki ?? args.status === "pass";
  const caseWikiSignatureStatus = args.caseWikiSignatureStatus ?? "signed";
  const caseWikiSignaturePresent = args.caseWikiSignaturePresent ?? (caseWikiSignatureStatus === "signed");
  const runtimeDiagnosticsExpectedSignatureStatus =
    args.runtimeDiagnosticsExpectedSignatureStatus ?? caseWikiSignatureStatus;
  const runtimeDiagnosticsEnabled =
    args.runtimeDiagnosticsEnabled ?? (runtimeDiagnosticsExpectedSignatureStatus === "signed");
  const runtimeDiagnosticsCanSign =
    args.runtimeDiagnosticsCanSign ?? (runtimeDiagnosticsExpectedSignatureStatus === "signed");
  const runtimeDiagnosticsKeyState =
    args.runtimeDiagnosticsKeyState ?? (runtimeDiagnosticsExpectedSignatureStatus === "signed" ? "loaded" : "missing");
  const script = `
const args = process.argv.slice(2);
function readArg(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] ?? fallback) : fallback;
}
const frontendBaseUrl = readArg("--frontendBaseUrl", "https://example-frontend");
const apiBaseUrl = readArg("--apiBaseUrl", "https://example-api");
const sessionId = readArg("--sessionId", "requested-session");
const userId = readArg("--userId", "demo-e2e-user");
const outputPath = readArg("--output", "artifacts/deploy/direct-live-proof.json");
const screenshotPath = readArg("--screenshot", "artifacts/deploy/direct-live-proof.png");
const status = ${JSON.stringify(args.status)};
const payload = {
  generatedAt: "2026-04-09T00:00:00.000Z",
  status,
  reason: status === "skipped" ? "direct live unavailable in this runtime" : null,
  frontendBaseUrl,
  apiBaseUrl,
  requestedSessionId: sessionId,
  sessionId: status === "pass" ? "observed-session-1" : sessionId,
  userId,
  runtimeStatus: {
    preferredMode: "direct_live",
    activeMode: status === "pass" ? "direct_live" : "relay",
    provider: status === "pass" ? "gemini_live_api" : null,
    model: status === "pass" ? "gemini-live-2.5-flash-native-audio" : null,
    ephemeralTokensSupported: status === "pass",
  },
  runtimeDiagnostics: {
    observed: true,
    statusCode: 200,
    apiBackendEvidenceSigning: {
      enabled: ${runtimeDiagnosticsEnabled ? "true" : "false"},
      keyState: ${JSON.stringify(runtimeDiagnosticsKeyState)},
      keyLoaded: ${runtimeDiagnosticsKeyState === "loaded" ? "true" : "false"},
      canSign: ${runtimeDiagnosticsCanSign ? "true" : "false"},
      expectedSignatureStatus: ${JSON.stringify(runtimeDiagnosticsExpectedSignatureStatus)},
      signerId: "api-backend",
      algorithm: "ed25519-sha256",
      canonicalization: "json-stable-v1",
      publicKeyFingerprint: ${runtimeDiagnosticsKeyState === "loaded" ? JSON.stringify("sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb") : "null"}
    }
  },
  ui: {
    connectionStatus: status === "pass" ? "connected" : "disconnected",
    modeStatus: status === "pass" ? "voice • direct_live • direct_ready" : "voice • relay • fallback",
    sessionState: status === "pass" ? "waiting for request" : "fallback",
  },
  replay: {
    selectedSessionId: status === "pass" ? "observed-session-1" : sessionId,
    liveTransport: status === "pass"
      ? {
          activeMode: "direct_live",
          evidenceSource: "session_events",
          provider: "gemini_live_api",
          model: "gemini-live-2.5-flash-native-audio",
          bootstrapState: "prepared_direct",
          firstAudioMs: 640,
          firstAudioCapturedAt: "2026-04-09T00:00:01.000Z",
          firstOutputMs: 410,
          firstOutputCapturedAt: "2026-04-09T00:00:00.500Z",
          fallbackEventCount: 0,
        }
      : null,
  },
  caseWiki: ${includeCaseWiki ? `{
    selectedSessionId: status === "pass" ? "observed-session-1" : sessionId,
    observed: status === "pass",
    caseId: "case-123",
    sessionId: status === "pass" ? "observed-session-1" : sessionId,
    overviewStatus: "waiting_on_operator",
    focusKind: null,
    focusLabel: null,
    recommendedNextAction: "Resolve pending approval",
    sourceRefsCount: 0,
    evidenceSignature: {
      status: ${JSON.stringify(caseWikiSignatureStatus)},
      algorithm: "ed25519-sha256",
      canonicalization: "json-stable-v1",
      payloadHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      keyId: null,
      signerId: "api-backend",
      signedAt: "2026-04-09T00:00:00.000Z",
      signaturePresent: ${caseWikiSignaturePresent ? "true" : "false"}
    }
  }` : "null"},
  screenshotPath,
  summary: status === "pass" ? "direct_live observed via session_events" : "direct_live skipped",
  outputPath,
};
process.stdout.write(JSON.stringify(payload) + "\\n");
process.exit(status === "pass" || status === "skipped" ? 0 : 1);
`;

  writeFileSync(args.scriptPath, script, "utf8");
}

function runDirectLiveProof(args: {
  frontendUrl: string;
  apiUrl?: string;
  outputPath: string;
  markdownPath: string;
  browserSmokeScriptPath: string;
  sessionId?: string;
  failOnSkip?: boolean;
  requireCaseWikiEvidenceSignature?: boolean;
  expectedCaseWikiEvidenceSignatureStatus?: "signed" | "unsigned";
}): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const commandArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    directLiveProofScriptPath,
    "-FrontendPublicUrl",
    args.frontendUrl,
    "-SessionId",
    args.sessionId ?? "requested-session",
    "-OutputPath",
    args.outputPath,
    "-MarkdownOutputPath",
    args.markdownPath,
    "-BrowserSmokeScriptPath",
    args.browserSmokeScriptPath,
    "-TimeoutSec",
    "5",
  ];
  if (typeof args.apiUrl === "string") {
    commandArgs.splice(7, 0, "-ApiPublicUrl", args.apiUrl);
  }
  if (args.failOnSkip) {
    commandArgs.push("-FailOnSkip");
  }
  if (args.requireCaseWikiEvidenceSignature) {
    commandArgs.push("-RequireCaseWikiEvidenceSignature");
  }
  if (args.expectedCaseWikiEvidenceSignatureStatus) {
    commandArgs.push("-ExpectedCaseWikiEvidenceSignatureStatus", args.expectedCaseWikiEvidenceSignatureStatus);
  }

  return new Promise((resolveResult) => {
    const child = spawn(powershellBin!, commandArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolveResult({
        status: code,
        stdout,
        stderr,
      });
    });
  });
}

async function startConfigServer(args: { apiBaseUrl: string }): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    if (request.url === "/config.json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ runtime: { apiBaseUrl: args.apiBaseUrl } }));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("config server did not expose a TCP port");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

test(
  "deploy direct-live proof writes pass artifact from browser smoke summary",
  { skip: skipIfNoPowerShell },
  async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-direct-live-proof-pass-"));
    const outputPath = join(outputDir, "direct-live-proof.json");
    const markdownPath = join(outputDir, "direct-live-proof.md");
    const browserSmokeScriptPath = join(outputDir, "browser-smoke-pass.mjs");
    writeStubBrowserSmokeScript({ scriptPath: browserSmokeScriptPath, status: "pass" });

    const result = await runDirectLiveProof({
      frontendUrl: "https://live-agent-frontend-production.up.railway.app",
      apiUrl: "https://live-agent-api-production.up.railway.app",
      outputPath,
      markdownPath,
      browserSmokeScriptPath,
      sessionId: "requested-session",
    });

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /direct_live\.proof\.status: pass/);

    const summary = JSON.parse(readFileSync(outputPath, "utf8")) as {
      status?: string;
      apiPublicUrlSource?: string;
      sessionId?: string;
      requestedSessionId?: string;
      runtimeDiagnostics?: {
        apiBackendEvidenceSigning?: {
          expectedSignatureStatus?: string;
          keyState?: string;
        };
      };
      caseWikiEvidenceSignatureExpectation?: {
        expectedStatus?: string;
        source?: string;
      };
      replay?: {
        liveTransport?: {
          activeMode?: string;
          evidenceSource?: string;
          firstAudioMs?: number;
          firstOutputMs?: number;
          fallbackEventCount?: number;
        };
      };
      caseWiki?: { evidenceSignature?: { status?: string; signaturePresent?: boolean } };
    };

    assert.equal(summary.status, "pass");
    assert.equal(summary.apiPublicUrlSource, "explicit");
    assert.equal(summary.requestedSessionId, "requested-session");
    assert.equal(summary.sessionId, "observed-session-1");
    assert.equal(summary.replay?.liveTransport?.activeMode, "direct_live");
    assert.equal(summary.replay?.liveTransport?.evidenceSource, "session_events");
    assert.equal(summary.replay?.liveTransport?.firstAudioMs, 640);
    assert.equal(summary.replay?.liveTransport?.firstOutputMs, 410);
    assert.equal(summary.replay?.liveTransport?.fallbackEventCount, 0);
    assert.equal(summary.runtimeDiagnostics?.apiBackendEvidenceSigning?.expectedSignatureStatus, "signed");
    assert.equal(summary.runtimeDiagnostics?.apiBackendEvidenceSigning?.keyState, "loaded");
    assert.equal(summary.caseWikiEvidenceSignatureExpectation?.expectedStatus, "signed");
    assert.equal(summary.caseWikiEvidenceSignatureExpectation?.source, "runtime_diagnostics");
    assert.equal(summary.caseWiki?.evidenceSignature?.status, "signed");
    assert.equal(summary.caseWiki?.evidenceSignature?.signaturePresent, true);

    const markdown = readFileSync(markdownPath, "utf8");
    assert.match(markdown, /# Direct Live Proof/);
    assert.match(markdown, /Status: pass/);
    assert.match(markdown, /Replay Evidence Source: session_events/);
    assert.match(markdown, /Replay First Audio \(ms\): 640/);
    assert.match(markdown, /Replay Fallback Events: 0/);
    assert.match(markdown, /Runtime Evidence Expected Signature: signed/);
    assert.match(markdown, /Case Wiki Expected Signature Source: runtime_diagnostics/);
  },
);

test(
  "deploy direct-live proof allows skipped evidence by default",
  { skip: skipIfNoPowerShell },
  async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-direct-live-proof-skip-"));
    const outputPath = join(outputDir, "direct-live-proof.json");
    const markdownPath = join(outputDir, "direct-live-proof.md");
    const browserSmokeScriptPath = join(outputDir, "browser-smoke-skip.mjs");
    writeStubBrowserSmokeScript({ scriptPath: browserSmokeScriptPath, status: "skipped" });

    const result = await runDirectLiveProof({
      frontendUrl: "https://live-agent-frontend-production.up.railway.app",
      apiUrl: "https://live-agent-api-production.up.railway.app",
      outputPath,
      markdownPath,
      browserSmokeScriptPath,
      sessionId: "requested-session",
    });

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /direct_live\.proof\.status: skipped/);

    const summary = JSON.parse(readFileSync(outputPath, "utf8")) as {
      status?: string;
      reason?: string;
    };

    assert.equal(summary.status, "skipped");
    assert.match(summary.reason ?? "", /direct live unavailable/i);
  },
);

test(
  "deploy direct-live proof resolves api url from frontend config when explicit api url is omitted",
  { skip: skipIfNoPowerShell },
  async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-direct-live-proof-config-"));
    const outputPath = join(outputDir, "direct-live-proof.json");
    const markdownPath = join(outputDir, "direct-live-proof.md");
    const browserSmokeScriptPath = join(outputDir, "browser-smoke-config.mjs");
    writeStubBrowserSmokeScript({ scriptPath: browserSmokeScriptPath, status: "pass" });

    const configServer = await startConfigServer({
      apiBaseUrl: "https://frontend-config-api.example",
    });

    try {
      const result = await runDirectLiveProof({
        frontendUrl: configServer.baseUrl,
        outputPath,
        markdownPath,
        browserSmokeScriptPath,
        sessionId: "requested-session",
      });

      assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);

      const summary = JSON.parse(readFileSync(outputPath, "utf8")) as {
        status?: string;
        apiPublicUrl?: string;
        apiPublicUrlSource?: string;
      };

      assert.equal(summary.status, "pass");
      assert.equal(summary.apiPublicUrl, "https://frontend-config-api.example");
      assert.equal(summary.apiPublicUrlSource, "frontend_config");
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        configServer.server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }
          resolveClose();
        });
      });
    }
  },
);

test(
  "deploy direct-live proof auto-detects unsigned case wiki evidence posture from runtime diagnostics",
  { skip: skipIfNoPowerShell },
  async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-direct-live-proof-runtime-unsigned-"));
    const outputPath = join(outputDir, "direct-live-proof.json");
    const markdownPath = join(outputDir, "direct-live-proof.md");
    const browserSmokeScriptPath = join(outputDir, "browser-smoke-runtime-unsigned.mjs");
    writeStubBrowserSmokeScript({
      scriptPath: browserSmokeScriptPath,
      status: "pass",
      caseWikiSignatureStatus: "unsigned",
      caseWikiSignaturePresent: false,
      runtimeDiagnosticsExpectedSignatureStatus: "unsigned",
      runtimeDiagnosticsEnabled: false,
      runtimeDiagnosticsCanSign: false,
      runtimeDiagnosticsKeyState: "missing",
    });

    const result = await runDirectLiveProof({
      frontendUrl: "https://live-agent-frontend-production.up.railway.app",
      apiUrl: "https://live-agent-api-production.up.railway.app",
      outputPath,
      markdownPath,
      browserSmokeScriptPath,
      sessionId: "requested-session",
    });

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /direct_live\.proof\.runtime_evidence\.expected_signature_status: unsigned/);
    assert.match(result.stdout, /direct_live\.proof\.case_wiki\.expected_signature_source: runtime_diagnostics/);
  },
);

test(
  "deploy direct-live proof fails when runtime diagnostics expect signed case wiki evidence but runtime stays unsigned",
  { skip: skipIfNoPowerShell },
  async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-direct-live-proof-runtime-signed-mismatch-"));
    const outputPath = join(outputDir, "direct-live-proof.json");
    const markdownPath = join(outputDir, "direct-live-proof.md");
    const browserSmokeScriptPath = join(outputDir, "browser-smoke-runtime-signed-mismatch.mjs");
    writeStubBrowserSmokeScript({
      scriptPath: browserSmokeScriptPath,
      status: "pass",
      caseWikiSignatureStatus: "unsigned",
      caseWikiSignaturePresent: false,
      runtimeDiagnosticsExpectedSignatureStatus: "signed",
      runtimeDiagnosticsEnabled: true,
      runtimeDiagnosticsCanSign: true,
      runtimeDiagnosticsKeyState: "loaded",
    });

    const result = await runDirectLiveProof({
      frontendUrl: "https://live-agent-frontend-production.up.railway.app",
      apiUrl: "https://live-agent-api-production.up.railway.app",
      outputPath,
      markdownPath,
      browserSmokeScriptPath,
      sessionId: "requested-session",
    });

    assert.notEqual(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const summary = JSON.parse(readFileSync(outputPath, "utf8")) as {
      status?: string;
      reason?: string;
      caseWikiEvidenceSignatureExpectation?: {
        expectedStatus?: string;
        source?: string;
      };
    };
    assert.equal(summary.status, "fail");
    assert.equal(summary.caseWikiEvidenceSignatureExpectation?.expectedStatus, "signed");
    assert.equal(summary.caseWikiEvidenceSignatureExpectation?.source, "runtime_diagnostics");
    assert.match(summary.reason ?? "", /expected 'signed' but observed 'unsigned'/i);
  },
);

test(
  "deploy direct-live proof can require signed case wiki evidence signature",
  { skip: skipIfNoPowerShell },
  async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-direct-live-proof-signed-case-wiki-"));
    const outputPath = join(outputDir, "direct-live-proof.json");
    const markdownPath = join(outputDir, "direct-live-proof.md");
    const browserSmokeScriptPath = join(outputDir, "browser-smoke-signed-case-wiki.mjs");
    writeStubBrowserSmokeScript({
      scriptPath: browserSmokeScriptPath,
      status: "pass",
      caseWikiSignatureStatus: "signed",
      caseWikiSignaturePresent: true,
    });

    const result = await runDirectLiveProof({
      frontendUrl: "https://live-agent-frontend-production.up.railway.app",
      apiUrl: "https://live-agent-api-production.up.railway.app",
      outputPath,
      markdownPath,
      browserSmokeScriptPath,
      sessionId: "requested-session",
      requireCaseWikiEvidenceSignature: true,
    });

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /direct_live\.proof\.case_wiki\.signature_status: signed/);
  },
);

test(
  "deploy direct-live proof lets explicit signature expectation override runtime diagnostics",
  { skip: skipIfNoPowerShell },
  async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-direct-live-proof-explicit-override-"));
    const outputPath = join(outputDir, "direct-live-proof.json");
    const markdownPath = join(outputDir, "direct-live-proof.md");
    const browserSmokeScriptPath = join(outputDir, "browser-smoke-explicit-override.mjs");
    writeStubBrowserSmokeScript({
      scriptPath: browserSmokeScriptPath,
      status: "pass",
      caseWikiSignatureStatus: "signed",
      caseWikiSignaturePresent: true,
      runtimeDiagnosticsExpectedSignatureStatus: "unsigned",
      runtimeDiagnosticsEnabled: false,
      runtimeDiagnosticsCanSign: false,
      runtimeDiagnosticsKeyState: "missing",
    });

    const result = await runDirectLiveProof({
      frontendUrl: "https://live-agent-frontend-production.up.railway.app",
      apiUrl: "https://live-agent-api-production.up.railway.app",
      outputPath,
      markdownPath,
      browserSmokeScriptPath,
      sessionId: "requested-session",
      expectedCaseWikiEvidenceSignatureStatus: "signed",
    });

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const summary = JSON.parse(readFileSync(outputPath, "utf8")) as {
      caseWikiEvidenceSignatureExpectation?: {
        expectedStatus?: string;
        source?: string;
      };
    };
    assert.equal(summary.caseWikiEvidenceSignatureExpectation?.expectedStatus, "signed");
    assert.equal(summary.caseWikiEvidenceSignatureExpectation?.source, "explicit");
  },
);

test(
  "deploy direct-live proof fails when signed case wiki evidence signature is required but runtime stays unsigned",
  { skip: skipIfNoPowerShell },
  async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-direct-live-proof-unsigned-case-wiki-"));
    const outputPath = join(outputDir, "direct-live-proof.json");
    const markdownPath = join(outputDir, "direct-live-proof.md");
    const browserSmokeScriptPath = join(outputDir, "browser-smoke-unsigned-case-wiki.mjs");
    writeStubBrowserSmokeScript({
      scriptPath: browserSmokeScriptPath,
      status: "pass",
      caseWikiSignatureStatus: "unsigned",
      caseWikiSignaturePresent: false,
    });

    const result = await runDirectLiveProof({
      frontendUrl: "https://live-agent-frontend-production.up.railway.app",
      apiUrl: "https://live-agent-api-production.up.railway.app",
      outputPath,
      markdownPath,
      browserSmokeScriptPath,
      sessionId: "requested-session",
      requireCaseWikiEvidenceSignature: true,
      expectedCaseWikiEvidenceSignatureStatus: "signed",
    });

    assert.notEqual(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const summary = JSON.parse(readFileSync(outputPath, "utf8")) as {
      status?: string;
      reason?: string;
      summary?: string;
    };
    assert.equal(summary.status, "fail");
    assert.match(summary.reason ?? "", /expected 'signed' but observed 'unsigned'/i);
    assert.match(summary.summary ?? "", /expected 'signed' but observed 'unsigned'/i);
  },
);
