import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const productionSmokeScriptPath = resolve(process.cwd(), "scripts", "deploy-production-smoke.ps1");
const trackedBadgePath = resolve(process.cwd(), "public", "demo-e2e", "badge.json");
const trackedBadgeDetailsPath = resolve(process.cwd(), "public", "demo-e2e", "badge-details.json");

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

async function withMockRailwayDeployment(
  run: (urls: { gatewayUrl: string; frontendUrl: string }) => Promise<void>,
): Promise<void> {
  const badge = JSON.parse(readFileSync(trackedBadgePath, "utf8")) as Record<string, unknown>;
  const details = JSON.parse(readFileSync(trackedBadgeDetailsPath, "utf8")) as Record<string, unknown>;

  let frontendUrl = "";
  let gatewayUrl = "";

  const gatewayServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const sendJson = (payload: Record<string, unknown>) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
    };

    if (req.url === "/" || req.url === "") {
      sendJson({
        ok: true,
        service: "realtime-gateway",
        runtime: {
          state: "ready",
          ready: true,
          draining: false,
        },
        routes: {
          health: "/healthz",
          metrics: "/metrics",
        },
        uiUrl: frontendUrl,
        publicUrl: gatewayUrl,
      });
      return;
    }
    if (req.url === "/demo-e2e/badge.json") {
      sendJson(badge);
      return;
    }
    if (req.url === "/demo-e2e/badge-details.json") {
      sendJson(details);
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  const frontendServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/healthz") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, service: "demo-frontend" }));
      return;
    }
    if (req.url === "/" || req.url === "") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        "<!doctype html><html><head><title>Multimodal Agent Dashboard</title></head><body><main>" +
          "<section>AI Action Desk</section><section>Case Workspace</section><section>Operator Console</section><section>Session Boundary</section>" +
          "</main></body></html>",
      );
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolveListen) => frontendServer.listen(0, "127.0.0.1", () => resolveListen()));
  const frontendAddress = frontendServer.address();
  if (!frontendAddress || typeof frontendAddress === "string") {
    throw new Error("Mock frontend server address is unavailable.");
  }
  frontendUrl = `http://127.0.0.1:${frontendAddress.port}`;

  await new Promise<void>((resolveListen) => gatewayServer.listen(0, "127.0.0.1", () => resolveListen()));
  const gatewayAddress = gatewayServer.address();
  if (!gatewayAddress || typeof gatewayAddress === "string") {
    throw new Error("Mock gateway server address is unavailable.");
  }
  gatewayUrl = `http://127.0.0.1:${gatewayAddress.port}`;

  try {
    await run({ gatewayUrl, frontendUrl });
  } finally {
    await new Promise<void>((resolveClose) => gatewayServer.close(() => resolveClose()));
    await new Promise<void>((resolveClose) => frontendServer.close(() => resolveClose()));
  }
}

function runProductionSmoke(args: {
  gatewayUrl: string;
  frontendUrl: string;
  outputPath: string;
  markdownPath: string;
}): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const commandArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    productionSmokeScriptPath,
    "-GatewayPublicUrl",
    args.gatewayUrl,
    "-FrontendPublicUrl",
    args.frontendUrl,
    "-OutputPath",
    args.outputPath,
    "-MarkdownOutputPath",
    args.markdownPath,
    "-TimeoutSec",
    "5",
  ];

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
  "deploy production smoke passes against a mock Railway gateway/frontend pair",
  { skip: skipIfNoPowerShell },
  async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-production-smoke-"));
    const outputPath = join(outputDir, "production-smoke.json");
    const markdownPath = join(outputDir, "production-smoke.md");

    await withMockRailwayDeployment(async ({ gatewayUrl, frontendUrl }) => {
      const result = await runProductionSmoke({
        gatewayUrl,
        frontendUrl,
        outputPath,
        markdownPath,
      });

      assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
      assert.match(result.stdout, /production\.smoke\.status: pass/);

      const summary = JSON.parse(readFileSync(outputPath, "utf8")) as {
        status?: string;
        gateway?: { uiUrl?: string; runtimeState?: string };
        frontend?: {
          healthOk?: boolean;
          title?: string;
          markers?: {
            aiActionDesk?: boolean;
            caseWorkspace?: boolean;
            operatorConsole?: boolean;
            sessionBoundary?: boolean;
          };
        };
        badge?: { helperValidated?: boolean };
      };

      assert.equal(summary.status, "pass");
      assert.equal(summary.gateway?.runtimeState, "ready");
      assert.equal(summary.gateway?.uiUrl, frontendUrl);
      assert.equal(summary.frontend?.healthOk, true);
      assert.equal(summary.frontend?.title, "Multimodal Agent Dashboard");
      assert.equal(summary.frontend?.markers?.aiActionDesk, true);
      assert.equal(summary.frontend?.markers?.caseWorkspace, true);
      assert.equal(summary.frontend?.markers?.operatorConsole, true);
      assert.equal(summary.frontend?.markers?.sessionBoundary, true);
      assert.equal(summary.badge?.helperValidated, true);

      const markdown = readFileSync(markdownPath, "utf8");
      assert.match(markdown, /# Production Smoke/);
      assert.match(markdown, /Status: pass/);
    });
  },
);
