import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires persisted dark/light theme toggle across html, runtime, and css", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredHtmlTokens = ['id="themeToggleBtn"', "Switch to Light Theme", "class=\"hero-headline\""];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing theme toggle token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "THEME_STORAGE_KEY",
    "normalizeThemeMode",
    "readStoredThemeMode",
    "applyThemeMode",
    "toggleThemeMode",
    "document.documentElement.setAttribute(\"data-theme\"",
    "mla.demoFrontend.themeMode",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing theme toggle token: ${token}`);
  }

  const requiredStylesTokens = [":root[data-theme=\"light\"]", ".hero-headline", "--heading:", "--button-primary-fg:"];
  for (const token of requiredStylesTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing theme token: ${token}`);
  }
});
