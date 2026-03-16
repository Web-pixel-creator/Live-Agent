import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("live negotiator keeps primary compose controls ahead of support dock chrome", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const liveIntentCardsIndex = htmlSource.indexOf('id="liveIntentCards"');
  const composeShellIndex = htmlSource.indexOf('class="live-compose-primary-shell"');
  const targetLanguageIndex = htmlSource.indexOf('id="targetLanguage"');
  const messageIndex = htmlSource.indexOf('id="message"');
  const sendButtonIndex = htmlSource.indexOf('id="sendBtn"');
  const dockIndex = htmlSource.indexOf('class="live-context-dock-shell"');
  const trayIndex = htmlSource.indexOf('id="liveContextTray"');

  assert.ok(liveIntentCardsIndex !== -1, "frontend html missing live intent cards");
  assert.ok(composeShellIndex !== -1, "frontend html missing primary compose shell");
  assert.ok(targetLanguageIndex !== -1, "frontend html missing target-language field");
  assert.ok(messageIndex !== -1, "frontend html missing primary message field");
  assert.ok(sendButtonIndex !== -1, "frontend html missing primary send button");
  assert.ok(dockIndex !== -1, "frontend html missing live support dock");
  assert.ok(trayIndex !== -1, "frontend html missing live support tray");

  assert.ok(liveIntentCardsIndex < composeShellIndex, "live mode switcher should lead into the primary compose shell");
  assert.ok(composeShellIndex < targetLanguageIndex, "primary compose shell should own the language picker");
  assert.ok(targetLanguageIndex < messageIndex, "language picker should appear before the message field");
  assert.ok(messageIndex < sendButtonIndex, "message field should appear before the primary CTA");
  assert.ok(sendButtonIndex < dockIndex, "support dock should not appear ahead of the primary compose CTA");
  assert.ok(dockIndex < trayIndex, "support tray should stay attached to the dock after the compose shell");

  assert.ok(
    htmlSource.includes("Voice and runtime stay ready in the support dock below."),
    "frontend html should frame voice/runtime as support chrome below the main request path",
  );
  assert.ok(
    stylesSource.includes(".live-compose-primary-shell {"),
    "frontend styles should define a dedicated primary compose shell",
  );
  assert.ok(
    appSource.includes("Open helpers below the main composer."),
    "frontend runtime should describe the support dock as a below-composer tool lane",
  );
  assert.ok(
    appSource.includes("Main compose stays here; tools open below."),
    "frontend runtime should preserve a task-first stage hint",
  );
  assert.ok(
    !htmlSource.includes("Support lanes stay above."),
    "frontend html should not claim that support lanes sit above the main composer anymore",
  );
  assert.ok(
    !appSource.includes("Keep helpers above the composer."),
    "frontend runtime should not describe the support dock as above the composer anymore",
  );
  assert.ok(
    readmeSource.includes("support dock directly below the main composer"),
    "README should document the below-composer support dock placement",
  );
  assert.ok(
    operatorGuideSource.includes("support dock directly below the main composer"),
    "operator guide should document the below-composer support dock placement",
  );
});
