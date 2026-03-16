import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("storyteller live smoke command stays aligned with docs and runtime entrypoint", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scriptSource = readFileSync(resolve(process.cwd(), "scripts", "storyteller-live-media-smoke.mjs"), "utf8");
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const localDevelopment = readFileSync(resolve(process.cwd(), "docs", "local-development.md"), "utf8");

  assert.equal(
    packageJson.scripts?.["storyteller:smoke:live"],
    "node --import tsx ./scripts/storyteller-live-media-smoke.mjs",
  );
  assert.ok(scriptSource.includes('runStorytellerAgent('));
  assert.ok(scriptSource.includes("STORYTELLER_VIDEO_POLL_MS"));
  assert.ok(scriptSource.includes("STORYTELLER_VIDEO_MAX_WAIT_MS"));
  assert.ok(scriptSource.includes('resolve(process.cwd(), ".env")'));
  assert.ok(scriptSource.includes("imageEditRequested"));
  assert.ok(scriptSource.includes("artifacts/storyteller-live-media-smoke/latest.json"));
  assert.ok(readme.includes("npm run storyteller:smoke:live"));
  assert.ok(localDevelopment.includes("npm run storyteller:smoke:live"));
  assert.ok(localDevelopment.includes("artifacts/storyteller-live-media-smoke/latest.json"));
  assert.ok(localDevelopment.includes("Nano Banana"));
});
