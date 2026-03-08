import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getSkillsCatalogSnapshot, getSkillsRuntimeCatalogSnapshot } from "../../shared/skills/src/index.js";

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

test("skills catalog loads repo-owned personas and recipes with readiness overlay", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "mla-skills-catalog-"));
  try {
    await mkdir(join(rootDir, "configs"), { recursive: true });
    await mkdir(join(rootDir, "skills", "workspace", "calendar-assistant"), { recursive: true });
    await writeJson(join(rootDir, "configs", "skills.catalog.json"), {
      version: 3,
      updatedAt: "2026-03-06T00:00:00.000Z",
      personas: [
        {
          id: "calendar-operator",
          name: "Calendar Operator",
          description: "Drive calendar automation demos.",
          agentIds: ["live-agent"],
          recommendedSkillIds: ["calendar-assistant"],
          defaultRecipeId: "calendar-demo",
        },
      ],
      recipes: [
        {
          id: "calendar-demo",
          personaId: "calendar-operator",
          name: "Calendar Demo",
          description: "Run a scheduling demo.",
          agentId: "live-agent",
          intent: "conversation",
          promptTemplate: "Schedule a meeting with two fallback options.",
          recommendedSkillIds: ["calendar-assistant", "calendar-managed-demo"],
        },
      ],
    });
    await writeFile(
      join(rootDir, "skills", "workspace", "calendar-assistant", "SKILL.md"),
      [
        "# Calendar Assistant",
        "id: calendar-assistant",
        "scope: live-agent",
        "prompt: Prefer scheduling clarity and offer two concrete slots.",
      ].join("\n"),
      "utf8",
    );
    await writeJson(join(rootDir, "skills", "workspace", "calendar-assistant", "managed-skill-upsert.sample.json"), {
      skillId: "calendar-managed-demo",
      name: "Calendar Managed Demo",
      prompt: "Validate managed-skill lifecycle.",
    });

    const snapshot = await getSkillsCatalogSnapshot({
      cwd: rootDir,
      agentId: "live-agent",
      activeSkillIds: ["calendar-assistant"],
      env: {},
    });

    assert.equal(snapshot.version, 3);
    assert.equal(snapshot.source, "path");
    assert.equal(snapshot.personas.length, 1);
    assert.equal(snapshot.recipes.length, 1);
    assert.deepEqual(snapshot.personas[0]?.availableSkillIds, ["calendar-assistant"]);
    assert.deepEqual(snapshot.personas[0]?.missingSkillIds, []);
    assert.equal(snapshot.personas[0]?.ready, true);
    assert.deepEqual(snapshot.recipes[0]?.missingSkillIds, ["calendar-managed-demo"]);
    assert.equal(snapshot.recipes[0]?.ready, false);
    assert.deepEqual(snapshot.personas[0]?.repoKnownSkillIds, ["calendar-assistant"]);
    assert.deepEqual(snapshot.recipes[0]?.repoKnownSkillIds, ["calendar-assistant", "calendar-managed-demo"]);
    assert.deepEqual(snapshot.repoKnownSkillIds, ["calendar-assistant", "calendar-managed-demo"]);
    assert.equal(snapshot.warnings.length, 0);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("skills runtime catalog snapshot overlays active workspace skills onto recommendations", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "mla-skills-runtime-catalog-"));
  try {
    await mkdir(join(rootDir, "configs"), { recursive: true });
    await mkdir(join(rootDir, "skills", "workspace", "calendar-assistant"), { recursive: true });
    await writeJson(join(rootDir, "configs", "skills.catalog.json"), {
      version: 1,
      personas: [
        {
          id: "calendar-operator",
          name: "Calendar Operator",
          description: "Drive calendar automation demos.",
          agentIds: ["live-agent"],
          recommendedSkillIds: ["calendar-assistant"],
          defaultRecipeId: "calendar-demo",
        },
      ],
      recipes: [
        {
          id: "calendar-demo",
          personaId: "calendar-operator",
          name: "Calendar Demo",
          description: "Run a scheduling demo.",
          agentId: "live-agent",
          intent: "conversation",
          promptTemplate: "Schedule a meeting with two fallback options.",
          recommendedSkillIds: ["calendar-assistant"],
        },
      ],
    });
    await writeFile(
      join(rootDir, "skills", "workspace", "calendar-assistant", "SKILL.md"),
      [
        "# Calendar Assistant",
        "id: calendar-assistant",
        "scope: live-agent",
        "trustLevel: reviewed",
        "prompt: Prefer scheduling clarity and offer two concrete slots.",
      ].join("\n"),
      "utf8",
    );

    const snapshot = await getSkillsRuntimeCatalogSnapshot({
      agentId: "live-agent",
      cwd: rootDir,
      env: {
        SKILLS_RUNTIME_ENABLED: "true",
        SKILLS_WORKSPACE_DIR: "skills/workspace",
        SKILLS_BUNDLED_DIR: "skills/bundled",
        SKILLS_SOURCE_PRECEDENCE: "workspace",
        SKILLS_ALLOWED_SOURCES: "workspace",
        SKILLS_CATALOG_PATH: "configs/skills.catalog.json",
      },
    });

    assert.equal(snapshot.runtime.activeSkills.length, 1);
    assert.equal(snapshot.runtime.activeSkills[0]?.id, "calendar-assistant");
    assert.equal(snapshot.catalog.personas[0]?.ready, true);
    assert.equal(snapshot.catalog.recipes[0]?.ready, true);
    assert.deepEqual(snapshot.catalog.activeSkillIds, ["calendar-assistant"]);
    assert.equal(snapshot.runtimeSummary.activeCount, 1);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("skills catalog returns invalid status and warning for malformed env json", async () => {
  const snapshot = await getSkillsCatalogSnapshot({
    env: {
      SKILLS_CATALOG_JSON: "{invalid",
    },
  });

  assert.equal(snapshot.source, "invalid");
  assert.equal(snapshot.personas.length, 0);
  assert.equal(snapshot.recipes.length, 0);
  assert.ok(snapshot.warnings.some((item) => item.includes("SKILLS_CATALOG_JSON")));
});

test("skills catalog warns when personas or recipes reference unknown repo-owned skill ids", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "mla-skills-catalog-warning-"));
  try {
    await mkdir(join(rootDir, "configs"), { recursive: true });
    await mkdir(join(rootDir, "skills", "workspace", "calendar-assistant"), { recursive: true });
    await writeJson(join(rootDir, "configs", "skills.catalog.json"), {
      version: 1,
      personas: [
        {
          id: "calendar-operator",
          name: "Calendar Operator",
          description: "Drive calendar automation demos.",
          agentIds: ["live-agent"],
          recommendedSkillIds: ["calendar-assistant", "missing-skill"],
          defaultRecipeId: "calendar-demo",
        },
      ],
      recipes: [
        {
          id: "calendar-demo",
          personaId: "calendar-operator",
          name: "Calendar Demo",
          description: "Run a scheduling demo.",
          agentId: "live-agent",
          intent: "conversation",
          promptTemplate: "Schedule a meeting with two fallback options.",
          recommendedSkillIds: ["missing-skill"],
        },
      ],
    });
    await writeFile(
      join(rootDir, "skills", "workspace", "calendar-assistant", "SKILL.md"),
      [
        "# Calendar Assistant",
        "id: calendar-assistant",
        "scope: live-agent",
        "prompt: Prefer scheduling clarity and offer two concrete slots.",
      ].join("\n"),
      "utf8",
    );

    const snapshot = await getSkillsCatalogSnapshot({
      cwd: rootDir,
      agentId: "live-agent",
      env: {},
    });

    assert.deepEqual(snapshot.personas[0]?.repoUnknownSkillIds, ["missing-skill"]);
    assert.deepEqual(snapshot.recipes[0]?.repoUnknownSkillIds, ["missing-skill"]);
    assert.ok(snapshot.warnings.some((item) => item.includes("Persona calendar-operator recommends unknown repo-owned skill ids: missing-skill.")));
    assert.ok(snapshot.warnings.some((item) => item.includes("Recipe calendar-demo recommends unknown repo-owned skill ids: missing-skill.")));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("skills catalog convergence follows configured workspace and bundled skill directories", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "mla-skills-catalog-custom-roots-"));
  try {
    const workspaceDir = join("custom-skills", "workspace");
    const bundledDir = join("custom-skills", "bundled");
    await mkdir(join(rootDir, workspaceDir, "calendar-assistant"), { recursive: true });
    await mkdir(join(rootDir, "configs"), { recursive: true });
    await writeJson(join(rootDir, "configs", "skills.catalog.json"), {
      version: 1,
      personas: [
        {
          id: "calendar-operator",
          name: "Calendar Operator",
          description: "Drive calendar automation demos.",
          agentIds: ["live-agent"],
          recommendedSkillIds: ["calendar-assistant", "calendar-managed-demo"],
          defaultRecipeId: "calendar-demo",
        },
      ],
      recipes: [
        {
          id: "calendar-demo",
          personaId: "calendar-operator",
          name: "Calendar Demo",
          description: "Run a scheduling demo.",
          agentId: "live-agent",
          intent: "conversation",
          promptTemplate: "Schedule a meeting with two fallback options.",
          recommendedSkillIds: ["calendar-managed-demo"],
        },
      ],
    });
    await writeFile(
      join(rootDir, workspaceDir, "calendar-assistant", "SKILL.md"),
      [
        "# Calendar Assistant",
        "id: calendar-assistant",
        "scope: live-agent",
        "prompt: Prefer scheduling clarity and offer two concrete slots.",
      ].join("\n"),
      "utf8",
    );
    await writeJson(join(rootDir, workspaceDir, "calendar-assistant", "managed-skill-upsert.sample.json"), {
      skillId: "calendar-managed-demo",
      name: "Calendar Managed Demo",
      prompt: "Validate managed-skill lifecycle.",
    });

    const snapshot = await getSkillsCatalogSnapshot({
      cwd: rootDir,
      agentId: "live-agent",
      env: {
        SKILLS_WORKSPACE_DIR: workspaceDir.replace(/\\/g, "/"),
        SKILLS_BUNDLED_DIR: bundledDir.replace(/\\/g, "/"),
      },
    });

    assert.deepEqual(snapshot.repoKnownSkillIds, ["calendar-assistant", "calendar-managed-demo"]);
    assert.equal(snapshot.warnings.length, 0);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
