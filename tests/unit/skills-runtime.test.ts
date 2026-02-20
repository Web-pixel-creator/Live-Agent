import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getSkillsRuntimeSnapshot, renderSkillsPrompt } from "../../shared/skills/src/index.js";

async function writeSkill(params: {
  rootDir: string;
  source: "workspace" | "bundled";
  folder: string;
  body: string;
}): Promise<void> {
  const skillDir = join(params.rootDir, "skills", params.source, params.folder);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), params.body, "utf8");
}

test("skills runtime applies source precedence workspace > bundled > managed", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "mla-skills-precedence-"));
  try {
    await writeSkill({
      rootDir,
      source: "workspace",
      folder: "negotiation",
      body: [
        "# Workspace Negotiation Skill",
        "id: negotiation-directive",
        "scope: live-agent",
        "priority: 500",
        "prompt: Use concise negotiation language and keep hard constraints visible.",
      ].join("\n"),
    });
    await writeSkill({
      rootDir,
      source: "bundled",
      folder: "negotiation",
      body: [
        "# Bundled Negotiation Skill",
        "id: negotiation-directive",
        "scope: live-agent",
        "priority: 300",
        "prompt: Bundled fallback negotiation prompt.",
      ].join("\n"),
    });

    const env: NodeJS.ProcessEnv = {
      SKILLS_RUNTIME_ENABLED: "true",
      SKILLS_WORKSPACE_DIR: "skills/workspace",
      SKILLS_BUNDLED_DIR: "skills/bundled",
      SKILLS_SOURCE_PRECEDENCE: "workspace,bundled,managed",
      SKILLS_ALLOWED_SOURCES: "workspace,bundled,managed",
      SKILLS_MANAGED_INDEX_JSON: JSON.stringify([
        {
          id: "negotiation-directive",
          scope: "live-agent",
          prompt: "Managed prompt should be shadowed by workspace source.",
          priority: 100,
        },
      ]),
    };

    const snapshot = await getSkillsRuntimeSnapshot({
      agentId: "live-agent",
      env,
      cwd: rootDir,
    });

    assert.equal(snapshot.enabled, true);
    assert.equal(snapshot.activeSkills.length, 1);
    assert.equal(snapshot.activeSkills[0]?.id, "negotiation-directive");
    assert.equal(snapshot.activeSkills[0]?.source, "workspace");
    assert.ok(
      snapshot.skippedSkills.some(
        (item) => item.id === "negotiation-directive" && item.reason === "shadowed_by_precedence",
      ),
    );

    const prompt = renderSkillsPrompt(snapshot);
    assert.ok(prompt && prompt.includes("concise negotiation language"));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("skills runtime enforces scope and policy gating", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "mla-skills-gating-"));
  try {
    await writeSkill({
      rootDir,
      source: "workspace",
      folder: "story-only",
      body: [
        "# Story Skill",
        "id: story-only-skill",
        "scope: storyteller-agent",
        "prompt: Story-only instructions.",
      ].join("\n"),
    });
    await writeSkill({
      rootDir,
      source: "workspace",
      folder: "live-blocked",
      body: [
        "# Live Blocked Skill",
        "id: live-blocked-skill",
        "scope: live-agent",
        "prompt: Should be blocked by policy disable list.",
      ].join("\n"),
    });

    const env: NodeJS.ProcessEnv = {
      SKILLS_RUNTIME_ENABLED: "true",
      SKILLS_WORKSPACE_DIR: "skills/workspace",
      SKILLS_BUNDLED_DIR: "skills/bundled",
      SKILLS_SOURCE_PRECEDENCE: "workspace,bundled,managed",
      SKILLS_ALLOWED_SOURCES: "workspace,bundled,managed",
      SKILLS_DISABLED_IDS: "live-blocked-skill",
    };

    const snapshot = await getSkillsRuntimeSnapshot({
      agentId: "live-agent",
      env,
      cwd: rootDir,
    });

    assert.equal(snapshot.activeSkills.length, 0);
    assert.ok(
      snapshot.skippedSkills.some(
        (item) => item.id === "story-only-skill" && item.reason === "scope_excluded",
      ),
    );
    assert.ok(
      snapshot.skippedSkills.some(
        (item) => item.id === "live-blocked-skill" && item.reason === "disabled_by_policy",
      ),
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
