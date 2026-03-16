import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("storyteller desktop prerun compose brief stays quieter and prompt-first", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const tailStylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "storyteller-runtime-tail.css");
  const scriptPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const styles = readFileSync(stylesPath, "utf8");
  const tailStyles = readFileSync(tailStylesPath, "utf8");
  const script = readFileSync(scriptPath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const operatorGuide = readFileSync(operatorGuidePath, "utf8");

  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-overview-chip {\n    display: none;"),
    "frontend styles missing Story Studio desktop hidden redundant compose eyebrow",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-head {\n    gap: 5px 16px;\n    padding-bottom: 6px;"),
    "frontend styles missing Story Studio desktop tighter compose-head handoff",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-field .field-heading {\n    grid-template-columns: max-content minmax(0, 1fr);\n    align-items: baseline;\n    gap: 4px 10px;"),
    "frontend styles missing Story Studio desktop inline prompt header row",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions {\n    padding-top: 8px;\n    gap: 8px 12px;"),
    "frontend styles missing Story Studio desktop tighter prerun CTA handoff",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions > #storyComposerSubmitBtn {\n    min-width: 188px;\n    min-height: 40px;\n    padding: 0 18px;"),
    "frontend styles missing Story Studio desktop shorter primary prerun CTA",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-secondary-actions > #storyComposerTemplateBtn {\n    min-height: 30px;\n    padding: 0 10px;\n    font-size: 0.69rem;"),
    "frontend styles missing Story Studio desktop compact utility action button",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-copy h3,\n  .layout.is-story-focused .story-shell-top .story-compose-copy h3 {\n    max-width: 20ch !important;\n    font-size: clamp(1.36rem, 1.22rem + 0.34vw, 1.62rem) !important;"),
    "frontend tail stylesheet missing Story Studio stepped compose-heading hierarchy",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-status,\n  .layout.is-story-focused .story-shell-top .story-compose-status {\n    max-width: 272px !important;\n    gap: 5px !important;\n    padding: 10px 12px !important;"),
    "frontend tail stylesheet missing Story Studio quieter compose-status rail",
  );
  assert.ok(
    tailStyles.includes(
      ".layout.is-story-focused .story-shell-top.is-prerun #storyComposeStatus,\n  .layout.is-story-focused .story-shell-top #storyComposeStatus {\n    min-width: 0 !important;\n    max-width: 13ch !important;\n    white-space: normal !important;\n    overflow-wrap: anywhere !important;\n    font-size: 0.625rem !important;",
    ),
    "frontend tail stylesheet missing Story Studio localized compose-status wrap guard",
  );

  assert.ok(script.includes("function resolveStoryDesktopComposeIntro("), "frontend script missing Story Studio compact compose intro helper");
  assert.ok(script.includes("function resolveStoryDesktopPromptHint("), "frontend script missing Story Studio compact prompt hint helper");
  assert.ok(script.includes("function resolveStoryDesktopPromptLabel("), "frontend script missing Story Studio compact prompt label helper");
  assert.ok(script.includes("function resolveStoryDesktopPromptPreviewPrefix("), "frontend script missing Story Studio compact prompt preview helper");
  assert.ok(script.includes("function resolveStoryDesktopPromptCount("), "frontend script missing Story Studio compact prompt count helper");
  assert.ok(script.includes("function resolveStoryDesktopComposeBadge(mode, fallback = \"\") {"), "frontend script missing Story Studio compact compose badge helper");
  assert.ok(script.includes("function syncStoryActionButtonMeta("), "frontend script missing Story Studio compact button accessibility helper");
  assert.ok(
    script.includes('button.setAttribute("aria-label", normalizedFullLabel);'),
    "frontend script missing Story Studio full-label accessibility handoff",
  );
  assert.ok(script.includes('return isRu ? "Черновик" : "Draft";'), "frontend script missing Story Studio quieter desktop draft action label");
  assert.ok(script.includes('return isRu ? "Диалог" : "Live";'), "frontend script missing Story Studio quieter desktop live action label");
  assert.ok(
    script.includes('return isRu ? "Кадр · движение · VO." : "Hero frame · motion · VO.";'),
    "frontend script missing Story Studio shorter desktop compose status cue",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions {\n    width: max-content !important;\n    max-width: 100% !important;\n    grid-template-columns: max-content max-content !important;\n    justify-content: start !important;\n    gap: 7px 10px !important;\n    padding-top: 6px !important;"),
    "frontend tail stylesheet missing Story Studio content-hugging desktop CTA cluster",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-secondary-actions {\n    display: inline-flex !important;\n    width: max-content !important;\n    flex-wrap: nowrap !important;\n    align-items: center !important;"),
    "frontend tail stylesheet missing Story Studio quieter desktop utility rail",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-status,\n  .layout.is-story-focused .story-shell-top .story-compose-status {\n    display: inline-grid !important;\n    width: max-content !important;\n    min-width: 0 !important;\n    max-width: 214px !important;"),
    "frontend tail stylesheet missing Story Studio quieter desktop support-line status rail",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-meta,\n  .layout.is-story-focused .story-shell-top .story-compose-meta {\n    display: grid !important;\n    grid-template-columns: minmax(0, 1fr) auto !important;\n    align-items: center !important;"),
    "frontend tail stylesheet missing Story Studio desktop prompt footer ledger",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-count,\n  .layout.is-story-focused .story-shell-top .story-compose-count {\n    justify-self: end !important;\n    min-height: 24px !important;\n    padding: 0 10px !important;"),
    "frontend tail stylesheet missing Story Studio desktop prompt count pill",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-field textarea,\n  .layout.is-story-focused .story-shell-top .story-compose-field textarea {\n    min-height: 182px !important;\n    padding: 15px 18px 17px !important;\n    border-radius: 16px !important;"),
    "frontend tail stylesheet missing Story Studio calmer desktop prompt editor field",
  );

  const docsLine =
    "On desktop the prerun compose brief now drops the redundant eyebrow, shortens the support and status lines, and compacts idle utility actions so the prompt canvas reads first.";
  assert.ok(readme.includes(docsLine), "README missing Story Studio quieter prerun brief note");
  assert.ok(operatorGuide.includes(docsLine), "operator guide missing Story Studio quieter prerun brief note");
  const docsHierarchyLine =
    "That same desktop Storyteller pass now also steps the inner brief heading down beneath `Story Studio`, softens the compose status rail, and stacks tray controls into one clean editor column with aligned select chevrons so the three brief drawers stop opening into cramped split forms.";
  assert.ok(readme.includes(docsHierarchyLine), "README missing Story Studio heading hierarchy and tray-form note");
  assert.ok(operatorGuide.includes(docsHierarchyLine), "operator guide missing Story Studio heading hierarchy and tray-form note");
  const docsStatusWrapLine =
    "That same desktop compose-status rail now also stays inside the brief header for longer localized copy, so the support line wraps cleanly instead of pushing past the compose shell.";
  assert.ok(readme.includes(docsStatusWrapLine), "README missing Story Studio compose-status wrap note");
  assert.ok(operatorGuide.includes(docsStatusWrapLine), "operator guide missing Story Studio compose-status wrap note");
  const docsStatusUtilityLine =
    "That same desktop prerun header now also compresses the mode badge and support cue into a quieter side note, while the draft/live actions hug their content as a small utility rail instead of stretching into a second control band.";
  assert.ok(readme.includes(docsStatusUtilityLine), "README missing Story Studio quieter status and utility rail note");
  assert.ok(operatorGuide.includes(docsStatusUtilityLine), "operator guide missing Story Studio quieter status and utility rail note");
  const docsPromptEditorLine =
    "That same desktop Storyteller pass now also turns the prompt lane into a calmer writing editor before and after `Generate`: the prompt label and footer text shorten, the preview/count row becomes a quiet ledger, and the textarea sits in a softer paper field instead of a heavier form box.";
  assert.ok(readme.includes(docsPromptEditorLine), "README missing Story Studio quieter prompt editor note");
  assert.ok(operatorGuide.includes(docsPromptEditorLine), "operator guide missing Story Studio quieter prompt editor note");
});
