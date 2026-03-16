import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes repo-owned browser worker control-plane endpoints", () => {
  const apiPath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(apiPath, "utf8");

  for (const token of [
    "/v1/runtime/browser-jobs",
    "/v1/runtime/browser-jobs/:jobId",
    "/v1/runtime/browser-jobs/:jobId/action",
    "getUiExecutorBrowserJobs",
    "buildUnavailableBrowserWorkerControlPlaneSnapshot",
    "buildBrowserWorkersSummary",
    "browser_worker_resume",
    "browser_worker_cancel",
    "repo_owned_browser_worker_control_plane",
    'status: "unavailable"',
    "degraded: true",
  ]) {
    assert.ok(source.includes(token), `api backend missing browser worker control-plane token: ${token}`);
  }
});

test("docs describe browser worker control plane and operator summary surface", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");

  assert.match(readme, /\/v1\/runtime\/browser-jobs/);
  assert.match(readme, /background browser worker/i);
  assert.match(operatorGuide, /Browser Worker Control/i);
  assert.match(operatorGuide, /resume/i);
  assert.match(architecture, /background browser worker/i);
});
