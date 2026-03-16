import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("storyteller fallback pack exposes downloadable image URLs for live fal edits", () => {
  const fallbackPackPath = resolve(
    process.cwd(),
    "agents",
    "storyteller-agent",
    "fallback",
    "story-fallback-pack.json",
  );
  const fallbackPack = JSON.parse(readFileSync(fallbackPackPath, "utf8")) as {
    scenarios?: Array<{ id?: string; images?: string[] }>;
  };

  const scenarios = Array.isArray(fallbackPack.scenarios) ? fallbackPack.scenarios : [];
  assert.ok(scenarios.length > 0);

  for (const scenario of scenarios) {
    const images = Array.isArray(scenario.images) ? scenario.images : [];
    assert.ok(images.length > 0, `fallback scenario ${scenario.id ?? "unknown"} has no images`);
    for (const imageRef of images) {
      assert.match(
        imageRef,
        /^https:\/\/placehold\.co\/1024x1024\/png\?text=/i,
        `fallback image ref must be downloadable for live fal edits: ${imageRef}`,
      );
    }
  }
});
