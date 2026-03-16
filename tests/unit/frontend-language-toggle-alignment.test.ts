import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires persisted ru/en language toggle across html, runtime, and css", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredHtmlTokens = [
    'id="languageModeSelect"',
    'data-i18n="hero.title"',
    'data-i18n="tabs.liveNegotiator"',
    "&#1056;&#1091;&#1089;&#1089;&#1082;&#1080;&#1081;",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing language-toggle token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "LANGUAGE_STORAGE_KEY",
    "normalizeLanguageMode",
    "readStoredLanguageMode",
    "applyLanguageMode",
    "document.documentElement.lang = normalizedMode;",
    "mla.demoFrontend.languageMode",
    "UI_LANGUAGE_COPY",
    "data-i18n",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing language-toggle token: ${token}`);
  }

  const requiredStylesTokens = [".hero-toolbar", ".hero-language-control", ".hero-language-select"];
  for (const token of requiredStylesTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing language-toggle token: ${token}`);
  }
});
