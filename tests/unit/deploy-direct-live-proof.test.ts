import assert from "node:assert/strict";
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
}) {
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
        }
      : null,
  },
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
  apiUrl: string;
  outputPath: string;
  markdownPath: string;
  browserSmokeScriptPath: string;
  sessionId?: string;
  failOnSkip?: boolean;
}): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const commandArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    directLiveProofScriptPath,
    "-FrontendPublicUrl",
    args.frontendUrl,
    "-ApiPublicUrl",
    args.apiUrl,
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
  if (args.failOnSkip) {
    commandArgs.push("-FailOnSkip");
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
      replay?: { liveTransport?: { activeMode?: string; evidenceSource?: string } };
    };

    assert.equal(summary.status, "pass");
    assert.equal(summary.apiPublicUrlSource, "explicit");
    assert.equal(summary.requestedSessionId, "requested-session");
    assert.equal(summary.sessionId, "observed-session-1");
    assert.equal(summary.replay?.liveTransport?.activeMode, "direct_live");
    assert.equal(summary.replay?.liveTransport?.evidenceSource, "session_events");

    const markdown = readFileSync(markdownPath, "utf8");
    assert.match(markdown, /# Direct Live Proof/);
    assert.match(markdown, /Status: pass/);
    assert.match(markdown, /Replay Evidence Source: session_events/);
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
