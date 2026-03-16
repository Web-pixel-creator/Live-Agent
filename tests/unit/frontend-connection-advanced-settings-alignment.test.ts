import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend keeps connection advanced session settings grouped under details", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const requiredHtmlTokens = [
    'id="connectionAdvancedSection"',
    'class="advanced-settings advanced-connection-settings"',
    'data-i18n="live.connection.advancedTitle"',
    'id="wsUrl"',
    'id="sessionId"',
    'id="userId"',
    'class="meta-row meta-row-status meta-row-status-connection-advanced"',
    'id="targetLanguage"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing connection-advanced token: ${token}`);
  }

  const wsUrlPosition = htmlSource.indexOf('id="wsUrl"');
  const advancedSectionPosition = htmlSource.indexOf('id="connectionAdvancedSection"');
  const sessionIdPosition = htmlSource.indexOf('id="sessionId"');
  assert.ok(
    wsUrlPosition > -1 && advancedSectionPosition > -1 && sessionIdPosition > -1,
    "connection fields should exist in html",
  );
  assert.ok(
    wsUrlPosition > advancedSectionPosition && sessionIdPosition > advancedSectionPosition,
    "connection identity and gateway fields should stay grouped inside advanced section",
  );

  const requiredStyleTokens = [
    ".connection-url-field {",
    ".advanced-connection-settings {",
    ".connection-advanced-grid {",
    ".meta-row-status-connection-advanced {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing connection-advanced token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Advanced Session Settings"),
    "README missing connection advanced settings note",
  );
});
