import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("storyteller desktop trays keep readable shelf summaries and full-width editor drawers", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const tailStylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "storyteller-runtime-tail.css");
  const indexPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const styles = readFileSync(stylesPath, "utf8");
  const tailStyles = readFileSync(tailStylesPath, "utf8");
  const indexHtml = readFileSync(indexPath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const operatorGuide = readFileSync(operatorGuidePath, "utf8");

  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray[open] {\n    grid-column: 1 / -1;"),
    "frontend styles missing Story Studio desktop full-width tray drawer override",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray:not([open]) > summary {\n    position: relative;\n    grid-template-columns: minmax(0, 1fr);\n    align-content: start;\n    gap: 8px;\n    min-height: 88px;"),
    "frontend styles missing Story Studio desktop two-tier collapsed tray summary layout",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray[open] > summary {\n    grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr);"),
    "frontend styles missing Story Studio desktop tray header split layout",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell #storyCraftTray[open] .story-tray-body,\n  .layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell #storyMediaTray[open] .story-tray-body {\n    grid-template-columns: minmax(0, 1.18fr) minmax(300px, 0.82fr);"),
    "frontend styles missing Story Studio desktop wide dual-column craft/media drawers",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell #storyDirectionTray[open] .story-tray-body {\n    grid-template-columns: minmax(260px, 0.44fr) minmax(0, 1fr);"),
    "frontend styles missing Story Studio desktop split editorial notes drawer",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray[open] :is(input, select, textarea) {\n    width: 100%;\n    min-width: 0;\n    box-sizing: border-box;"),
    "frontend styles missing Story Studio desktop full-width tray field controls",
  );
  assert.ok(
    indexHtml.includes('href="/storyteller-runtime-tail.css?v=20260316"'),
    "frontend HTML missing late Story Studio tray override stylesheet",
  );
  assert.ok(
    tailStyles.includes(".story-tray-grid:has(.story-tray[open]) .story-tray:not([open]) > summary {\n    grid-template-columns: minmax(116px, max-content) minmax(0, 1fr);"),
    "late desktop tray styles missing compact sibling tray summary layout",
  );
  assert.ok(
    tailStyles.includes(".story-tray-grid:has(.story-tray[open]) .story-tray:not([open]) .story-tray-hint {\n    display: none;"),
    "late desktop tray styles missing quieter sibling tray hint suppression",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell #storyCraftTray[open] .story-tray-body,\n  .layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell #storyMediaTray[open] .story-tray-body,\n  .layout.is-story-focused .story-shell-top .story-compose-shell #storyCraftTray[open] .story-tray-body,\n  .layout.is-story-focused .story-shell-top .story-compose-shell #storyMediaTray[open] .story-tray-body {\n    grid-template-columns: minmax(0, 780px) !important;"),
    "late desktop tray styles missing stacked craft/media editor column",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray[open] .story-tray-section-grid,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray[open] .story-tray-section-grid {\n    grid-template-columns: minmax(0, 1fr) !important;"),
    "late desktop tray styles missing one-column open tray field stacking",
  );
  assert.ok(
    tailStyles.includes("/* 2026-03-14 Pass - quieter desktop storyteller tray shelf ledger */"),
    "late desktop tray styles missing quieter Story Studio tray-shelf ledger pass comment",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray:not([open]) > summary,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray:not([open]) > summary {\n    gap: 6px !important;\n    min-height: 88px !important;"),
    "late desktop tray styles missing quieter collapsed tray summary height",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray:not([open]) .story-tray-hint,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray:not([open]) .story-tray-hint {\n    display: none !important;"),
    "late desktop tray styles missing calmer collapsed tray hint suppression",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray[open] .field:has(select)::after,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray[open] .field:has(select)::after {\n    content: \"\";"),
    "late desktop tray styles missing aligned select chevron overlay",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray[open] .story-tray-summary,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray[open] .story-tray-summary {\n    display: none !important;"),
    "late desktop tray styles missing hidden open-tray summary strip",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray[open] .select-shell,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray[open] .select-shell {\n    display: block !important;\n    width: 100% !important;\n    min-width: 0 !important;"),
    "late desktop tray styles missing full-width open-tray select shell",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray[open] .select-menu,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray[open] .select-menu {\n    left: 0 !important;\n    right: auto !important;\n    width: 100% !important;\n    min-width: 100% !important;"),
    "late desktop tray styles missing trigger-width open-tray select menu",
  );
  assert.ok(
    tailStyles.includes("#storyDirectionTray[open] .story-tray-body {\n    grid-template-columns: minmax(0, 1fr);"),
    "late desktop tray styles missing single-column editorial drawer override",
  );
  assert.ok(
    tailStyles.includes("#storyDirectionTray[open] .story-tray-note-card {\n    display: grid;\n    grid-template-columns: auto minmax(0, 1fr);"),
    "late desktop tray styles missing compact editorial note band layout",
  );

  const docsLine =
    "On desktop those compose trays now keep a readable two-tier closed shelf and open into full-width editor drawers, so summaries stay scannable and the form controls stop collapsing into narrow one-column cards.";
  assert.ok(readme.includes(docsLine), "README missing Story Studio tray drawer usability note");
  assert.ok(operatorGuide.includes(docsLine), "operator guide missing Story Studio tray drawer usability note");
  const docsPassLine =
    "That same desktop tray pass now also quiets sibling drawers while one is open and turns `Editorial notes` into a cleaner full-width editor lane, so the open state reads like one focused form instead of a broken row of tiny cards.";
  assert.ok(readme.includes(docsPassLine), "README missing Story Studio tray open-state cleanup note");
  assert.ok(operatorGuide.includes(docsPassLine), "operator guide missing Story Studio tray open-state cleanup note");
  const docsLedgerLine =
    "That same desktop tray shelf now also reads more like a quiet reference ledger in collapsed state: helper hints drop away, card chrome softens, and only title plus concise summary/meta stay visible until a drawer is opened.";
  assert.ok(readme.includes(docsLedgerLine), "README missing Story Studio quieter collapsed tray ledger note");
  assert.ok(operatorGuide.includes(docsLedgerLine), "operator guide missing Story Studio quieter collapsed tray ledger note");
  const docsEditorContractLine =
    "That same desktop tray editor now also drops the redundant open-summary strip and keeps Storyteller dropdowns pinned to their trigger width, so the open drawer reads like one clean editor column instead of a floating mix of summary pills and form controls.";
  assert.ok(readme.includes(docsEditorContractLine), "README missing Story Studio tray editor contract note");
  assert.ok(operatorGuide.includes(docsEditorContractLine), "operator guide missing Story Studio tray editor contract note");
});
