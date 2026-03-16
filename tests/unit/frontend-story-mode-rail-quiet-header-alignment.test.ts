import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("storyteller desktop mode rail steps back into a quieter header", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const storytellerTailStylesPath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "public",
    "storyteller-runtime-tail.css",
  );
  const scriptPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const styles = readFileSync(stylesPath, "utf8");
  const storytellerTailStyles = readFileSync(storytellerTailStylesPath, "utf8");
  const script = readFileSync(scriptPath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const operatorGuide = readFileSync(operatorGuidePath, "utf8");

  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-rail {\n    gap: 6px 9px;\n    padding: 4px 0;"),
    "frontend styles missing Story Studio desktop quieter scenario rail spacing",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card:not(.is-active) {\n    min-height: 0;\n    padding: 0 2px;\n    border: 0;\n    background: transparent;"),
    "frontend styles missing Story Studio desktop text-like inactive scenario pills",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card.is-active {\n    gap: 2px 8px;\n    padding: 8px 10px;\n    border-radius: 12px;"),
    "frontend styles missing Story Studio desktop quieter active scenario card",
  );
  assert.ok(
    storytellerTailStyles.includes(
      ".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card.is-active {\n    grid-template-columns: max-content minmax(0, 1fr) !important;\n    align-items: start !important;\n    gap: 1px 8px !important;\n    padding: 7px 10px !important;\n    border-radius: 11px !important;",
    ),
    "storyteller tail styles missing Story Studio desktop quieter final active mode marker",
  );
  assert.ok(
    storytellerTailStyles.includes(
      ".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card.is-active .story-mode-kicker {\n    grid-column: 1 !important;\n    grid-row: 1 / span 2 !important;\n    align-self: start !important;\n    min-height: 20px !important;",
    ),
    "storyteller tail styles missing Story Studio desktop compact active mode marker pill",
  );
  assert.ok(
    storytellerTailStyles.includes(
      ".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card.is-active .story-mode-hint {\n    grid-column: 2 !important;\n    max-width: 21ch !important;\n    font-size: 0.625rem !important;\n    line-height: 1.18 !important;",
    ),
    "storyteller tail styles missing Story Studio desktop shorter active mode support cue",
  );
  assert.ok(
    storytellerTailStyles.includes(
      ".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card:not(.is-active) .story-mode-title {\n    font-size: 0.65625rem !important;\n    letter-spacing: 0.018em !important;",
    ),
    "storyteller tail styles missing Story Studio desktop quieter inactive mode labels",
  );
  assert.ok(
    storytellerTailStyles.includes(
      ".layout.is-story-focused .story-shell-top.is-prerun .story-signal-value {\n    max-width: 11ch !important;\n    font-size: 0.625rem !important;\n    line-height: 1.16 !important;",
    ),
    "storyteller tail styles missing Story Studio desktop tighter cue values",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-strip {\n    gap: 0;\n    padding: 2px 0 0 11px;"),
    "frontend styles missing Story Studio desktop quieter cue strip spacing",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-value {\n    max-width: 13ch;\n    font-size: 0.66rem;\n    line-height: 1.2;"),
    "frontend styles missing Story Studio desktop quieter cue value compaction",
  );
  assert.ok(
    script.includes("function resolveStoryDesktopQuietModeTitle(mode, fallbackTitle = \"\") {"),
    "frontend script missing Story Studio desktop quiet mode-title helper",
  );
  assert.ok(
    script.includes("button.setAttribute(\"aria-label\", `${modeConfig.railTitle}. ${modeConfig.railHint}`);"),
    "frontend script missing Story Studio full-label accessibility handoff for mode rail",
  );
  assert.ok(
    script.includes("el.storySignalLeadValue.title = characterFocus;"),
    "frontend script missing Story Studio full tooltip handoff for lead cue",
  );

  const docsLine =
    "On desktop the scenario rail now recedes into one compact active mode plus quieter text-like alternates, so switching modes no longer competes with the writing canvas.";
  const followupDocsLine =
    "That same desktop scenario lockup now uses a smaller active marker and a shorter support cue, so the featured mode reads like part of the brief header instead of a second hero card.";
  const cuesDocsLine =
    "That same desktop brief header now also trims inactive mode labels and tightens cue values with full tooltip context, so the top cluster stays readable without turning into another control row.";
  assert.ok(readme.includes(docsLine), "README missing Story Studio quieter scenario rail note");
  assert.ok(operatorGuide.includes(docsLine), "operator guide missing Story Studio quieter scenario rail note");
  assert.ok(readme.includes(followupDocsLine), "README missing Story Studio compact mode marker note");
  assert.ok(operatorGuide.includes(followupDocsLine), "operator guide missing Story Studio compact mode marker note");
  assert.ok(readme.includes(cuesDocsLine), "README missing Story Studio tighter cue-strip note");
  assert.ok(operatorGuide.includes(cuesDocsLine), "operator guide missing Story Studio tighter cue-strip note");
});
