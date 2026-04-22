import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("legacy demo frontend is framed as a compatibility dashboard with a path back to /app", () => {
  const legacyHtmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const legacyRuntimePath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const localDevelopmentPath = resolve(process.cwd(), "docs", "local-development.md");

  const legacyHtml = readFileSync(legacyHtmlPath, "utf8");
  const legacyRuntime = readFileSync(legacyRuntimePath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const localDevelopment = readFileSync(localDevelopmentPath, "utf8");

  const requiredHtmlTokens = [
    "<title>AI Action Desk Legacy Dashboard</title>",
    'id="heroTitle" data-i18n="hero.title">AI Action Desk Legacy Dashboard</h1>',
    'id="openAppLink" class="button-muted hero-open-app-link" href="/app">Open Action Desk</a>',
    "The primary Action Desk workspace now lives at /app. Keep /legacy for compatibility fallback only.",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(legacyHtml.includes(token), `legacy html missing compatibility token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'title: "AI Action Desk Legacy Dashboard"',
    'subtitle: "Compatibility dashboard for runtime-safe checks, evidence review, and older walkthroughs."',
    'note: "The primary Action Desk workspace now lives at /app. Keep /legacy for compatibility fallback only."',
    'cta: "Open Action Desk"',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(legacyRuntime.includes(token), `legacy runtime missing compatibility token: ${token}`);
  }

  assert.ok(readme.includes("`/legacy` only as a compatibility"));
  assert.ok(localDevelopment.includes("`http://localhost:3000/legacy` keeps the legacy compatibility dashboard"));
});
