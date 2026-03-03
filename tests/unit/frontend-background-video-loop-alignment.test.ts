import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend keeps background video loop smoothing aligned across html, runtime, and styles", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredHtmlTokens = [
    'id="backgroundVideo"',
    'class="background-video"',
    'class="background-video-fade"',
    'preload="metadata"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing background video token: ${token}`);
  }

  const requiredAppTokens = [
    "BG_VIDEO_LOOP_BLEND_SECONDS",
    "BG_VIDEO_LOOP_TRANSITION_CLASS",
    "backgroundVideo: document.getElementById(\"backgroundVideo\")",
    "function initBackgroundVideoLoopBlend()",
    "document.body.classList.add(BG_VIDEO_LOOP_TRANSITION_CLASS);",
    "initBackgroundVideoLoopBlend();",
  ];
  for (const token of requiredAppTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing background video token: ${token}`);
  }

  const requiredStylesTokens = [
    "--bg-video-opacity:",
    "--bg-video-transition-opacity:",
    ".background-video {",
    ".background-video-fade {",
    "body.bg-video-loop-transition .background-video {",
    "body.bg-video-loop-transition .background-video-fade {",
    "@media (prefers-reduced-motion: reduce)",
  ];
  for (const token of requiredStylesTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing background video token: ${token}`);
  }
});
