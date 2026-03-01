import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

type PaletteItem = {
  name: string;
  value: string;
  sourceToken?: string;
  sourceLiteral?: string;
};

type PaletteGroup = {
  title: string;
  items: PaletteItem[];
};

type PaletteManifest = {
  schemaVersion: string;
  source: string;
  groups: PaletteGroup[];
};

function extractRootVariables(stylesSource: string): Map<string, string> {
  const rootMatch = stylesSource.match(/:root\s*{([\s\S]*?)}/);
  assert.ok(rootMatch, "styles.css must include a :root block");
  const vars = new Map<string, string>();
  const varRegex = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match: RegExpExecArray | null;
  while ((match = varRegex.exec(rootMatch[1])) !== null) {
    vars.set(match[1], match[2].trim().toLowerCase());
  }
  return vars;
}

test("theme palette manifest stays aligned with styles.css source of truth", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const manifestPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "theme-colors.json");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PaletteManifest;
  const rootVars = extractRootVariables(stylesSource);

  assert.equal(manifest.schemaVersion, "1.0");
  assert.equal(manifest.source, "apps/demo-frontend/public/styles.css");

  const requiredGroups = [
    "Primary Theme Colors",
    "Secondary & Accent Colors",
    "UI Component Colors",
    "Utility & Form Colors",
    "Status & Feedback Colors",
  ];
  const groupTitles = manifest.groups.map((group) => group.title);
  for (const title of requiredGroups) {
    assert.ok(groupTitles.includes(title), `theme palette missing group: ${title}`);
  }

  for (const group of manifest.groups) {
    assert.ok(group.items.length > 0, `theme palette group has no items: ${group.title}`);
    for (const item of group.items) {
      assert.ok(item.name.length > 0, `theme palette item name must be non-empty in ${group.title}`);
      assert.ok(item.value.length > 0, `theme palette item value must be non-empty in ${group.title}`);
      const normalizedValue = item.value.toLowerCase();
      if (item.sourceToken) {
        const sourceValue = rootVars.get(item.sourceToken);
        assert.ok(sourceValue, `styles.css missing source token: ${item.sourceToken}`);
        assert.equal(
          normalizedValue,
          sourceValue,
          `theme palette value mismatch for ${item.name} (${item.sourceToken})`,
        );
      } else if (item.sourceLiteral) {
        assert.ok(
          stylesSource.includes(item.sourceLiteral),
          `styles.css missing source literal for ${item.name}: ${item.sourceLiteral}`,
        );
      } else {
        assert.fail(`theme palette item must include sourceToken or sourceLiteral: ${item.name}`);
      }
    }
  }
});

test("docs expose theme palette and grouped color breakdown", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const docsPath = resolve(process.cwd(), "docs", "design-theme-colors.md");
  const readme = readFileSync(readmePath, "utf8");
  const docs = readFileSync(docsPath, "utf8");

  assert.ok(
    readme.includes("Design Theme Colors: `docs/design-theme-colors.md`"),
    "README documentation index missing theme colors link",
  );

  const requiredDocsTokens = [
    "apps/demo-frontend/public/styles.css",
    "apps/demo-frontend/public/theme-colors.json",
    "## Primary Theme Colors",
    "## Secondary & Accent Colors",
    "## UI Component Colors",
    "## Utility & Form Colors",
    "## Status & Feedback Colors",
  ];
  for (const token of requiredDocsTokens) {
    assert.ok(docs.includes(token), `theme colors doc missing token: ${token}`);
  }
});
