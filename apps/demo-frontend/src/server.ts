import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const port = Number(process.env.PORT ?? process.env.FRONTEND_PORT ?? 3000);
const configuredWsUrl = (process.env.FRONTEND_WS_URL ?? "").trim();
const configuredApiBaseUrl = (process.env.FRONTEND_API_BASE_URL ?? "").trim();

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function resolveSafePath(urlPath: string): string {
  const decoded = decodeURIComponent(urlPath);
  const normalized = decoded.replace(/\\/g, "/");
  const target = normalized === "/" ? "/index.html" : normalized;
  return path.resolve(publicDir, `.${target}`);
}

const server = createServer(async (req, res) => {
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

  const requestPath = req.url?.split("?")[0] ?? "/";
  const absolutePath = resolveSafePath(requestPath);

  if (!absolutePath.startsWith(publicDir)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  let filePath = absolutePath;
  if (!existsSync(filePath)) {
    filePath = path.join(publicDir, "index.html");
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
  console.log(`[demo-frontend] open http://localhost:${port}`);
});
