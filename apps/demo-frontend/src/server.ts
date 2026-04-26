import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");
const appShellDir = path.resolve(publicDir, "app-shell");
const artifactsDir = path.resolve(__dirname, "../../../artifacts");
const docsDir = path.resolve(__dirname, "../../../docs");
const legacyIndexPath = path.resolve(publicDir, "index.html");
const appShellIndexPath = path.resolve(appShellDir, "index.html");

const port = Number(process.env.PORT ?? process.env.FRONTEND_PORT ?? 3000);
const configuredWsUrl = (process.env.FRONTEND_WS_URL ?? "").trim();
const configuredApiBaseUrl = (process.env.FRONTEND_API_BASE_URL ?? "").trim();

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolveSafePath(baseDir: string, urlPath: string): string {
  const decoded = decodeURIComponent(urlPath);
  const normalized = decoded.replace(/\\/g, "/");
  const target = normalized === "/" ? "/index.html" : normalized;
  return path.resolve(baseDir, `.${target}`);
}

function isAppShellDocumentRoute(urlPath: string): boolean {
  return /^\/(app(?:\/.*)?|bundle(?:\/.*)?|evidence(?:\/.*)?)\/?$/.test(urlPath);
}

function isAppShellAssetRoute(urlPath: string): boolean {
  return urlPath === "/app-shell" || urlPath.startsWith("/app-shell/");
}

const debugArtifactCatalog = [
  {
    category: "release-evidence",
    label: "Release evidence report",
    description: "Unified release evidence summary for runtime, publish, and deploy proof lanes.",
    relativePath: "release-evidence/report.json",
  },
  {
    category: "release-evidence",
    label: "Release evidence manifest",
    description: "Release manifest with compact runtime ingress and proof references.",
    relativePath: "release-evidence/manifest.json",
  },
  {
    category: "release-evidence",
    label: "Runtime proof report",
    description: "Runtime-focused proof block used by release readiness and judge outputs.",
    relativePath: "release-evidence/runtime-proof-report.json",
  },
  {
    category: "release-evidence",
    label: "Action Desk KPI report",
    description: "Workflow KPI proof for lead qualification, booking, document follow-up, and CRM handoff readiness.",
    relativePath: "release-evidence/action-desk-kpi-report.json",
  },
  {
    category: "release-evidence",
    label: "Consultation booking proof",
    description: "Support-only proof posture for consultation booking playbook, staged fixture readiness, and calendar writeback gaps.",
    relativePath: "release-evidence/consultation-booking-proof.json",
  },
  {
    category: "release-evidence",
    label: "Submission refresh status",
    description: "Judge-facing refresh status for the current submission pack.",
    relativePath: "release-evidence/submission-refresh-status.json",
  },
  {
    category: "runtime",
    label: "Runtime surface snapshot",
    description: "Compact runtime surface snapshot used by first-scan diagnostics.",
    relativePath: "runtime/runtime-surface-snapshot.json",
  },
  {
    category: "runtime",
    label: "Runtime surface parity",
    description: "Parity snapshot for runtime surface contract drift checks.",
    relativePath: "runtime/runtime-surface-parity.json",
  },
  {
    category: "runtime",
    label: "Runtime surface doc drift",
    description: "Documentation drift artifact for runtime surface snapshots.",
    relativePath: "runtime/runtime-surface-doc-drift.json",
  },
  {
    category: "demo-e2e",
    label: "Demo summary",
    description: "Repo-owned end-to-end summary for the current demo run.",
    relativePath: "demo-e2e/summary.json",
  },
  {
    category: "demo-e2e",
    label: "Demo policy check",
    description: "Policy gate verdicts and KPI evidence for the demo lane.",
    relativePath: "demo-e2e/policy-check.json",
  },
  {
    category: "demo-e2e",
    label: "Navigator visa flows",
    description: "Browser-worker and replay evidence for visa flow reliability checks.",
    relativePath: "demo-e2e/navigator-visa-flows.json",
  },
  {
    category: "demo-e2e",
    label: "Consultation booking approved artifact",
    description: "Approval-safe booking artifact derived from the deterministic booking flow.",
    relativePath: "demo-e2e/consultation-booking-approved.json",
  },
  {
    category: "demo-e2e",
    label: "Direct live browser smoke",
    description: "Direct-live browser proof artifact from the demo lane.",
    relativePath: "demo-e2e/direct-live-browser-smoke.json",
  },
  {
    category: "demo-e2e",
    label: "Badge details",
    description: "Badge detail payload used by the public demo proof mirror.",
    relativePath: "demo-e2e/badge-details.json",
  },
] as const;

const workspaceDocAllowlist = [
  "local-services-pilot-offer.md",
  "local-services-demo-script.md",
  "local-services-outreach-list.md",
  "local-services-pilot-scorecard.md",
  "local-services-pilot-runbook.md",
  "local-services-outreach-execution-pack.md",
] as const;

function resolveDebugArtifactPath(requestPath: string): string | null {
  if (!requestPath.startsWith("/debug-artifacts/")) {
    return null;
  }
  const relative = requestPath.replace(/^\/debug-artifacts\//, "");
  if (!relative || relative.includes("..") || !/\.jsonl?$/i.test(relative)) {
    return null;
  }
  const isAllowed = debugArtifactCatalog.some((entry) => entry.relativePath === relative);
  if (!isAllowed) {
    return null;
  }
  return path.resolve(artifactsDir, relative);
}

function resolveWorkspaceDocPath(requestPath: string): string | null {
  if (!requestPath.startsWith("/workspace-docs/")) {
    return null;
  }
  const relative = requestPath.replace(/^\/workspace-docs\//, "");
  if (!relative || relative.includes("..") || !/\.md$/i.test(relative)) {
    return null;
  }
  const isAllowed = workspaceDocAllowlist.includes(relative as (typeof workspaceDocAllowlist)[number]);
  if (!isAllowed) {
    return null;
  }
  return path.resolve(docsDir, relative);
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url?.startsWith("/?"))) {
    const query = req.url.length > 1 ? req.url.slice(1) : "";
    res.statusCode = 302;
    res.setHeader("Location", `/app${query}`);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/config.json") {
    res.statusCode = 200;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: "demo-frontend",
        runtime: {
          wsUrl: configuredWsUrl.length > 0 ? configuredWsUrl : null,
          apiBaseUrl: configuredApiBaseUrl.length > 0 ? configuredApiBaseUrl : null,
        },
      }),
    );
    return;
  }

  if (req.method === "GET" && req.url === "/healthz") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, service: "demo-frontend" }));
    return;
  }

  if (req.method === "GET" && req.url === "/debug-artifacts/index.json") {
    const items = await Promise.all(
      debugArtifactCatalog.map(async (entry) => {
        const fullPath = path.resolve(artifactsDir, entry.relativePath);
        if (!existsSync(fullPath)) {
          return null;
        }
        const fileStat = await stat(fullPath);
        return {
          ...entry,
          size: fileStat.size,
          updatedAt: fileStat.mtime.toISOString(),
          url: `/debug-artifacts/${entry.relativePath}`,
        };
      }),
    );
    res.statusCode = 200;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, items: items.filter((item) => item !== null) }));
    return;
  }

  const requestPath = req.url?.split("?")[0] ?? "/";
  let filePath: string;
  let allowFallbackIndex = true;

  if (isAppShellDocumentRoute(requestPath) && existsSync(appShellIndexPath)) {
    filePath = appShellIndexPath;
    allowFallbackIndex = false;
  } else if ((requestPath === "/legacy" || requestPath === "/legacy/") && existsSync(legacyIndexPath)) {
    filePath = legacyIndexPath;
    allowFallbackIndex = false;
  } else if (isAppShellAssetRoute(requestPath)) {
    const assetPath = requestPath === "/app-shell" ? "/app-shell/index.html" : requestPath;
    filePath = resolveSafePath(publicDir, assetPath);
    allowFallbackIndex = false;
  } else if (requestPath.startsWith("/debug-artifacts/")) {
    const debugArtifactPath = resolveDebugArtifactPath(requestPath);
    if (!debugArtifactPath) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    filePath = debugArtifactPath;
    allowFallbackIndex = false;
  } else if (requestPath.startsWith("/workspace-docs/")) {
    const workspaceDocPath = resolveWorkspaceDocPath(requestPath);
    if (!workspaceDocPath) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    filePath = workspaceDocPath;
    allowFallbackIndex = false;
  } else {
    filePath = resolveSafePath(publicDir, requestPath);
  }

  if (!filePath.startsWith(publicDir) && !filePath.startsWith(artifactsDir) && !filePath.startsWith(docsDir)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    if (!allowFallbackIndex) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    filePath = legacyIndexPath;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypes[ext] ?? "application/octet-stream");
    createReadStream(filePath).pipe(res);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`[demo-frontend] listening on :${port}`);
  console.log(`[demo-frontend] open http://localhost:${port}/app`);
});
