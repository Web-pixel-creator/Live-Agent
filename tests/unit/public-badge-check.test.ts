import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const publicBadgeCheckScriptPath = resolve(process.cwd(), "scripts", "public-badge-check.ps1");
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

function runPublicBadgeCheck(args: {
  badgeEndpoint: string;
  detailsEndpoint: string;
}): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const commandArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    publicBadgeCheckScriptPath,
    "-BadgeEndpoint",
    args.badgeEndpoint,
    "-DetailsEndpoint",
    args.detailsEndpoint,
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

async function withMockBadgeServer(
  badgePayload: Record<string, unknown>,
  detailsPayload: Record<string, unknown>,
  run: (endpoints: { badgeEndpoint: string; detailsEndpoint: string }) => Promise<void>,
): Promise<void> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const sendJson = (payload: Record<string, unknown>) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
    };

    if (req.url === "/demo-e2e/badge.json") {
      sendJson(badgePayload);
      return;
    }
    if (req.url === "/demo-e2e/badge-details.json") {
      sendJson(detailsPayload);
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", () => resolveListen()));
  const address = server.address();
  try {
    if (!address || typeof address === "string") {
      throw new Error("Mock server address is unavailable.");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    await run({
      badgeEndpoint: `${baseUrl}/demo-e2e/badge.json`,
      detailsEndpoint: `${baseUrl}/demo-e2e/badge-details.json`,
    });
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
}

test(
  "public-badge-check passes when tracked badge details include valid plugin marketplace and provider usage evidence",
  { skip: skipIfNoPowerShell },
  async () => {
    const badge = JSON.parse(readFileSync(trackedBadgePath, "utf8")) as Record<string, unknown>;
    const details = JSON.parse(readFileSync(trackedBadgeDetailsPath, "utf8")) as Record<string, unknown>;

    await withMockBadgeServer(badge, details, async ({ badgeEndpoint, detailsEndpoint }) => {
      const result = await runPublicBadgeCheck({ badgeEndpoint, detailsEndpoint });
      assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
      assert.match(result.stdout, /Public badge endpoint is valid\./);
      assert.match(result.stdout, /Device-node-updates status \(badge evidence\): pass/);
      assert.match(result.stdout, /Provider-usage status \(badge evidence\): pass/);
    });
  },
);

test(
  "public-badge-check fails when plugin marketplace latest timestamp evidence is not ISO-validated",
  { skip: skipIfNoPowerShell },
  async () => {
    const badge = JSON.parse(readFileSync(trackedBadgePath, "utf8")) as Record<string, unknown>;
    const details = JSON.parse(readFileSync(trackedBadgeDetailsPath, "utf8")) as Record<string, unknown>;
    const failingDetails = JSON.parse(JSON.stringify(details)) as Record<string, unknown>;

    const evidence = failingDetails.evidence as Record<string, unknown>;
    const pluginMarketplace = evidence.pluginMarketplace as Record<string, unknown>;
    const latest = pluginMarketplace.latest as Record<string, unknown>;
    latest.seenAtIsIso = false;

    await withMockBadgeServer(badge, failingDetails, async ({ badgeEndpoint, detailsEndpoint }) => {
      const result = await runPublicBadgeCheck({ badgeEndpoint, detailsEndpoint });
      assert.equal(result.status, 1, `${result.stderr}\n${result.stdout}`);
      const output = `${result.stderr}\n${result.stdout}`;
      assert.match(
        output,
        /pluginMarketplace must be validated with observed status,\s*totals\/lifecycle\/conflicts\/sign\s*ing consistency,\s*permission bounds,\s*and latest plugin\/signing\/ISO fields\./,
      );
    });
  },
);

test(
  "public-badge-check fails when provider usage validation is false",
  { skip: skipIfNoPowerShell },
  async () => {
    const badge = JSON.parse(readFileSync(trackedBadgePath, "utf8")) as Record<string, unknown>;
    const details = JSON.parse(readFileSync(trackedBadgeDetailsPath, "utf8")) as Record<string, unknown>;
    const failingDetails = JSON.parse(JSON.stringify(details)) as Record<string, unknown>;

    const providerUsage = failingDetails.providerUsage as Record<string, unknown>;
    providerUsage.validated = false;

    await withMockBadgeServer(badge, failingDetails, async ({ badgeEndpoint, detailsEndpoint }) => {
      const result = await runPublicBadgeCheck({ badgeEndpoint, detailsEndpoint });
      assert.equal(result.status, 1, `${result.stderr}\n${result.stdout}`);
      const output = `${result.stderr}\n${result.stdout}`;
      assert.match(output, /providerUsage must be validated with entries>=1 and activeSecondaryProviders>=0\./);
    });
  },
);
