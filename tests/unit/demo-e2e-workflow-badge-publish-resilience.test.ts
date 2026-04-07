import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e workflow keeps gh-pages badge publish best-effort", () => {
  const source = readFileSync(resolve(process.cwd(), ".github", "workflows", "demo-e2e.yml"), "utf8");

  assert.match(source, /- name: Publish Badge To gh-pages/);
  assert.match(source, /id:\s*publish_badge/);
  assert.match(source, /continue-on-error:\s*true/);
  assert.match(source, /steps\.publish_badge\.outcome/);
  assert.match(source, /Badge publish to gh-pages is best-effort/i);
});

test("demo-e2e workflow aligns CI policy with fallback-safe runtime profile", () => {
  const source = readFileSync(resolve(process.cwd(), ".github", "workflows", "demo-e2e.yml"), "utf8");

  assert.match(source, /DEMO_E2E_STORYTELLER_MEDIA_MODE:\s*simulated/);
  assert.match(source, /DEMO_E2E_ALLOW_UI_EXECUTOR_RUNTIME_FALLBACK:\s*"true"/);
  assert.match(source, /--allowedTranslationProviders fallback,gemini,google_translate/);
  assert.match(source, /--allowUiExecutorRuntimeFallback true/);
});
