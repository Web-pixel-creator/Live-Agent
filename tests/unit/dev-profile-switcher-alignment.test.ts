import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("dev profile switcher stays aligned across package, script, and local docs", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scriptSource = readFileSync(resolve(process.cwd(), "scripts", "set-dev-profile.ps1"), "utf8");
  const docsSource = readFileSync(resolve(process.cwd(), "docs", "local-development.md"), "utf8");

  assert.equal(
    packageJson.scripts?.["profile:dev:cheap"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/set-dev-profile.ps1 -Profile cheap-dev",
  );
  assert.equal(
    packageJson.scripts?.["profile:dev:full-demo"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/set-dev-profile.ps1 -Profile full-demo",
  );

  for (const token of [
    '[ValidateSet("cheap-dev", "full-demo")]',
    '"REASONING_MODEL_ID" = "gemini-3.1-flash-lite-preview"',
    '"STORYTELLER_PLANNER_MODEL" = "gemini-3.1-flash-lite-preview"',
    '"STORYTELLER_MEDIA_MODE" = "fallback"',
    '"UI_NAVIGATOR_PLANNER_MODEL" = "gemini-3.1-flash-lite-preview"',
    '"STORYTELLER_USE_GEMINI_PLANNER" = "false"',
    '"UI_NAVIGATOR_USE_GEMINI_PLANNER" = "false"',
    '"REASONING_MODEL_ID" = "gemini-3.1-pro-preview"',
    '"STORYTELLER_PLANNER_MODEL" = "gemini-3.1-pro-preview"',
    '"STORYTELLER_MEDIA_MODE" = "default"',
    '"UI_NAVIGATOR_PLANNER_MODEL" = "gemini-3.1-pro-preview"',
    '"STORYTELLER_USE_GEMINI_PLANNER" = "true"',
    '"UI_NAVIGATOR_USE_GEMINI_PLANNER" = "true"',
  ]) {
    assert.ok(scriptSource.includes(token), `set-dev-profile.ps1 missing token: ${token}`);
  }

  for (const token of [
    "npm run profile:dev:cheap",
    "npm run profile:dev:full-demo",
    "STORYTELLER_MEDIA_MODE=fallback",
    "gemini-3.1-flash-lite-preview",
    "STORYTELLER_USE_GEMINI_PLANNER=false",
    "UI_NAVIGATOR_USE_GEMINI_PLANNER=false",
    "STORYTELLER_USE_GEMINI_PLANNER=true",
    "UI_NAVIGATOR_USE_GEMINI_PLANNER=true",
  ]) {
    assert.ok(docsSource.includes(token), `docs/local-development.md missing token: ${token}`);
  }
});
