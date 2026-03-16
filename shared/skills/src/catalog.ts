import { constants } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export type SkillCatalogSource = "path" | "env_json" | "missing" | "invalid";

export type SkillCatalogJudgeCategory = "live_agent" | "creative_storyteller" | "ui_navigator";

export type SkillCatalogPersona = {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
  recommendedSkillIds: string[];
  tags: string[];
  defaultIntent: string | null;
  defaultRecipeId: string | null;
};

export type SkillCatalogRecipe = {
  id: string;
  personaId: string | null;
  name: string;
  description: string;
  agentId: string | null;
  intent: string | null;
  promptTemplate: string;
  recommendedSkillIds: string[];
  tags: string[];
  judgeCategory: SkillCatalogJudgeCategory | null;
};

export type SkillCatalogResolvedPersona = SkillCatalogPersona & {
  availableSkillIds: string[];
  missingSkillIds: string[];
  repoKnownSkillIds: string[];
  repoUnknownSkillIds: string[];
  ready: boolean;
};

export type SkillCatalogResolvedRecipe = SkillCatalogRecipe & {
  availableSkillIds: string[];
  missingSkillIds: string[];
  repoKnownSkillIds: string[];
  repoUnknownSkillIds: string[];
  ready: boolean;
};

export type SkillsCatalogSnapshot = {
  version: number;
  updatedAt: string | null;
  source: SkillCatalogSource;
  configPath: string | null;
  agentId: string | null;
  activeSkillIds: string[];
  repoKnownSkillIds: string[];
  warnings: string[];
  personas: SkillCatalogResolvedPersona[];
  recipes: SkillCatalogResolvedRecipe[];
};

type SkillCatalogDocument = {
  version: number;
  updatedAt: string | null;
  personas: SkillCatalogPersona[];
  recipes: SkillCatalogRecipe[];
};

type SkillCatalogLoadResult = {
  source: SkillCatalogSource;
  configPath: string | null;
  warnings: string[];
  document: SkillCatalogDocument;
};

type RepoSkillReferenceSource = "workspace" | "bundled" | "managed_sample";

type RepoSkillReference = {
  id: string;
  source: RepoSkillReferenceSource;
  sourcePath: string;
};

const DEFAULT_SKILLS_CATALOG_PATH = "configs/skills.catalog.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = (toNonEmptyString(value) ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.length > 0 ? normalized : fallback;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeStringList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const lowered = trimmed.toLowerCase();
    if (seen.has(lowered)) {
      continue;
    }
    seen.add(lowered);
    normalized.push(lowered);
  }
  return normalized;
}

function normalizeAgentIds(value: unknown): string[] {
  return normalizeStringList(value).map((item) => normalizeId(item, "live-agent"));
}

function normalizeSkillIds(value: unknown): string[] {
  return normalizeStringList(value).map((item) => normalizeId(item, "skill"));
}

function normalizeJudgeCategory(value: unknown): SkillCatalogJudgeCategory | null {
  const normalized = toNonEmptyString(value)?.toLowerCase() ?? null;
  if (normalized === "live_agent" || normalized === "creative_storyteller" || normalized === "ui_navigator") {
    return normalized;
  }
  return null;
}

function normalizePersona(raw: unknown, index: number): SkillCatalogPersona | null {
  if (!isRecord(raw)) {
    return null;
  }
  const fallbackId = `persona-${index + 1}`;
  const id = normalizeId(raw.id, fallbackId);
  const name = toNonEmptyString(raw.name) ?? id;
  const description =
    toNonEmptyString(raw.description) ?? `${name} persona for curated skill discovery and judge demos.`;
  return {
    id,
    name,
    description,
    agentIds: normalizeAgentIds(raw.agentIds ?? raw.agents),
    recommendedSkillIds: normalizeSkillIds(raw.recommendedSkillIds ?? raw.skills),
    tags: normalizeStringList(raw.tags),
    defaultIntent: toNonEmptyString(raw.defaultIntent),
    defaultRecipeId: toNonEmptyString(raw.defaultRecipeId)
      ? normalizeId(raw.defaultRecipeId, `${id}-default-recipe`)
      : null,
  };
}

function normalizeRecipe(raw: unknown, index: number): SkillCatalogRecipe | null {
  if (!isRecord(raw)) {
    return null;
  }
  const fallbackId = `recipe-${index + 1}`;
  const id = normalizeId(raw.id, fallbackId);
  const name = toNonEmptyString(raw.name) ?? id;
  const description =
    toNonEmptyString(raw.description) ?? `${name} recipe for judge-facing multimodal demo execution.`;
  return {
    id,
    personaId: toNonEmptyString(raw.personaId) ? normalizeId(raw.personaId, "persona") : null,
    name,
    description,
    agentId: toNonEmptyString(raw.agentId) ? normalizeId(raw.agentId, "live-agent") : null,
    intent: toNonEmptyString(raw.intent),
    promptTemplate:
      toNonEmptyString(raw.promptTemplate) ??
      toNonEmptyString(raw.prompt) ??
      description,
    recommendedSkillIds: normalizeSkillIds(raw.recommendedSkillIds ?? raw.skills),
    tags: normalizeStringList(raw.tags),
    judgeCategory: normalizeJudgeCategory(raw.judgeCategory),
  };
}

function buildEmptyCatalog(): SkillCatalogDocument {
  return {
    version: 1,
    updatedAt: null,
    personas: [],
    recipes: [],
  };
}

function normalizeCatalogDocument(raw: unknown): SkillCatalogDocument {
  if (!isRecord(raw)) {
    return buildEmptyCatalog();
  }
  const personasRaw = Array.isArray(raw.personas) ? raw.personas : [];
  const recipesRaw = Array.isArray(raw.recipes) ? raw.recipes : [];
  return {
    version: parsePositiveInt(raw.version, 1),
    updatedAt: toNonEmptyString(raw.updatedAt),
    personas: personasRaw
      .map((item, index) => normalizePersona(item, index))
      .filter((item): item is SkillCatalogPersona => item !== null),
    recipes: recipesRaw
      .map((item, index) => normalizeRecipe(item, index))
      .filter((item): item is SkillCatalogRecipe => item !== null),
  };
}

function buildAgentAliasSet(agentId: string): Set<string> {
  const normalized = normalizeId(agentId, "live-agent");
  const aliases = new Set<string>([
    normalized,
    normalized.replace(/-agent$/, ""),
  ]);
  if (normalized === "live-agent") {
    aliases.add("live");
  }
  if (normalized === "storyteller-agent") {
    aliases.add("story");
    aliases.add("storyteller");
  }
  if (normalized === "ui-navigator-agent") {
    aliases.add("ui");
    aliases.add("ui-navigator");
    aliases.add("ui_task");
  }
  return aliases;
}

function matchesAgent(agentIds: string[], requestedAgentId: string | null): boolean {
  if (!requestedAgentId || agentIds.length === 0) {
    return true;
  }
  const aliases = buildAgentAliasSet(requestedAgentId);
  return agentIds.some((item) => aliases.has(item));
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function extractSkillIdFromMarkdown(content: string, fallbackId: string): string {
  const lines = content.split(/\r?\n/);
  for (const line of lines.slice(0, 120)) {
    const parsed = line.match(/^id\s*:\s*(.+)$/i);
    if (!parsed || !parsed[1]) {
      continue;
    }
    return normalizeId(parsed[1], fallbackId);
  }
  return normalizeId(fallbackId, fallbackId);
}

async function loadRepoSkillsFromDirectory(params: {
  cwd: string;
  source: Extract<RepoSkillReferenceSource, "workspace" | "bundled">;
  rootDir: string;
}): Promise<RepoSkillReference[]> {
  const rootPath = resolve(params.cwd, params.rootDir);
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const references: RepoSkillReference[] = [];
  const rootSkillPath = join(rootPath, "SKILL.md");
  if (await pathExists(rootSkillPath)) {
    const content = await readFile(rootSkillPath, "utf8");
    references.push({
      id: extractSkillIdFromMarkdown(content, params.source),
      source: params.source,
      sourcePath: rootSkillPath,
    });
  }

  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillPath = join(rootPath, entry.name, "SKILL.md");
    if (!(await pathExists(skillPath))) {
      continue;
    }
    const content = await readFile(skillPath, "utf8");
    references.push({
      id: extractSkillIdFromMarkdown(content, entry.name),
      source: params.source,
      sourcePath: skillPath,
    });
  }

  return references;
}

async function loadManagedSkillSampleReferences(params: {
  cwd: string;
  roots: string[];
}): Promise<RepoSkillReference[]> {
  const candidateFileNames = ["managed-skill-upsert.sample.json", "managed-skill-signing-input.sample.json"];
  const references: RepoSkillReference[] = [];

  for (const rootDir of params.roots) {
    const rootPath = resolve(params.cwd, rootDir);
    if (!(await pathExists(rootPath))) {
      continue;
    }
    const entries = await readdir(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      for (const fileName of candidateFileNames) {
        const samplePath = join(rootPath, entry.name, fileName);
        if (!(await pathExists(samplePath))) {
          continue;
        }
        try {
          const parsed = JSON.parse(await readFile(samplePath, "utf8")) as unknown;
          const rawSkillId =
            isRecord(parsed) && (toNonEmptyString(parsed.skillId) ?? toNonEmptyString(parsed.id));
          if (!rawSkillId) {
            continue;
          }
          references.push({
            id: normalizeId(rawSkillId, entry.name),
            source: "managed_sample",
            sourcePath: samplePath,
          });
          break;
        } catch {
          continue;
        }
      }
    }
  }

  return references;
}

async function loadRepoSkillReferences(params: {
  cwd: string;
  env: NodeJS.ProcessEnv;
}): Promise<RepoSkillReference[]> {
  const workspaceDir = toNonEmptyString(params.env.SKILLS_WORKSPACE_DIR) ?? "skills/workspace";
  const bundledDir = toNonEmptyString(params.env.SKILLS_BUNDLED_DIR) ?? "skills/bundled";
  const references = [
    ...(await loadRepoSkillsFromDirectory({
      cwd: params.cwd,
      source: "workspace",
      rootDir: workspaceDir,
    })),
    ...(await loadRepoSkillsFromDirectory({
      cwd: params.cwd,
      source: "bundled",
      rootDir: bundledDir,
    })),
    ...(await loadManagedSkillSampleReferences({
      cwd: params.cwd,
      roots: Array.from(new Set([workspaceDir, bundledDir])),
    })),
  ];

  const deduped = new Map<string, RepoSkillReference>();
  for (const reference of references) {
    const key = `${reference.id}::${reference.sourcePath}`;
    if (!deduped.has(key)) {
      deduped.set(key, reference);
    }
  }
  return Array.from(deduped.values());
}

async function loadCatalogDocument(params: {
  env: NodeJS.ProcessEnv;
  cwd: string;
}): Promise<SkillCatalogLoadResult> {
  const warnings: string[] = [];
  const envJson = toNonEmptyString(params.env.SKILLS_CATALOG_JSON);
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson) as unknown;
      return {
        source: "env_json",
        configPath: null,
        warnings,
        document: normalizeCatalogDocument(parsed),
      };
    } catch {
      return {
        source: "invalid",
        configPath: null,
        warnings: ["SKILLS_CATALOG_JSON is not valid JSON; using empty catalog."],
        document: buildEmptyCatalog(),
      };
    }
  }

  const configuredPath = toNonEmptyString(params.env.SKILLS_CATALOG_PATH) ?? DEFAULT_SKILLS_CATALOG_PATH;
  const absolutePath = resolve(params.cwd, configuredPath);
  try {
    const raw = await readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return {
      source: "path",
      configPath: configuredPath,
      warnings,
      document: normalizeCatalogDocument(parsed),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const isMissing = /ENOENT/i.test(message);
    return {
      source: isMissing ? "missing" : "invalid",
      configPath: configuredPath,
      warnings: [
        isMissing
          ? `Skills catalog file not found at ${configuredPath}; using empty catalog.`
          : `Skills catalog file at ${configuredPath} could not be parsed; using empty catalog.`,
      ],
      document: buildEmptyCatalog(),
    };
  }
}

function resolveMissingSkillIds(recommendedSkillIds: string[], activeSkillIds: Set<string>): string[] {
  return recommendedSkillIds.filter((item) => !activeSkillIds.has(item));
}

export async function getSkillsCatalogSnapshot(params?: {
  agentId?: string;
  activeSkillIds?: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): Promise<SkillsCatalogSnapshot> {
  const env = params?.env ?? process.env;
  const cwd = params?.cwd ?? process.cwd();
  const requestedAgentId = toNonEmptyString(params?.agentId) ? normalizeId(params?.agentId, "live-agent") : null;
  const loadResult = await loadCatalogDocument({ env, cwd });
  const warnings = [...loadResult.warnings];
  const repoSkillReferences = await loadRepoSkillReferences({ cwd, env });
  const repoKnownSkillIds = new Set(repoSkillReferences.map((item) => item.id));
  const recipeIds = new Set(loadResult.document.recipes.map((recipe) => recipe.id));
  const personaIds = new Set(loadResult.document.personas.map((persona) => persona.id));
  const activeSkillIds = new Set((params?.activeSkillIds ?? []).map((item) => normalizeId(item, "skill")));
  const personaIdCounts = new Map<string, number>();
  const recipeIdCounts = new Map<string, number>();

  for (const persona of loadResult.document.personas) {
    personaIdCounts.set(persona.id, (personaIdCounts.get(persona.id) ?? 0) + 1);
  }
  for (const recipe of loadResult.document.recipes) {
    recipeIdCounts.set(recipe.id, (recipeIdCounts.get(recipe.id) ?? 0) + 1);
  }

  for (const [personaId, count] of personaIdCounts.entries()) {
    if (count > 1) {
      warnings.push(`Persona ${personaId} is duplicated ${count} times in the skills catalog.`);
    }
  }
  for (const [recipeId, count] of recipeIdCounts.entries()) {
    if (count > 1) {
      warnings.push(`Recipe ${recipeId} is duplicated ${count} times in the skills catalog.`);
    }
  }

  for (const persona of loadResult.document.personas) {
    if (persona.defaultRecipeId && !recipeIds.has(persona.defaultRecipeId)) {
      warnings.push(`Persona ${persona.id} references missing defaultRecipeId ${persona.defaultRecipeId}.`);
    }
    const defaultRecipe =
      persona.defaultRecipeId
        ? loadResult.document.recipes.find((recipe) => recipe.id === persona.defaultRecipeId) ?? null
        : null;
    if (defaultRecipe?.personaId && defaultRecipe.personaId !== persona.id) {
      warnings.push(
        `Persona ${persona.id} references defaultRecipeId ${persona.defaultRecipeId}, but recipe belongs to ${defaultRecipe.personaId}.`,
      );
    }
  }
  for (const recipe of loadResult.document.recipes) {
    if (recipe.personaId && !personaIds.has(recipe.personaId)) {
      warnings.push(`Recipe ${recipe.id} references missing personaId ${recipe.personaId}.`);
    }
  }

  const personas = loadResult.document.personas
    .filter((persona) => matchesAgent(persona.agentIds, requestedAgentId))
    .map<SkillCatalogResolvedPersona>((persona) => {
      const missingSkillIds = resolveMissingSkillIds(persona.recommendedSkillIds, activeSkillIds);
      const repoKnownRecommendedSkillIds = persona.recommendedSkillIds.filter((item) => repoKnownSkillIds.has(item));
      const repoUnknownSkillIds = persona.recommendedSkillIds.filter((item) => !repoKnownSkillIds.has(item));
      return {
        ...persona,
        availableSkillIds: persona.recommendedSkillIds.filter((item) => activeSkillIds.has(item)),
        missingSkillIds,
        repoKnownSkillIds: repoKnownRecommendedSkillIds,
        repoUnknownSkillIds,
        ready: missingSkillIds.length === 0,
      };
    });

  const recipes = loadResult.document.recipes
    .filter((recipe) => matchesAgent(recipe.agentId ? [recipe.agentId] : [], requestedAgentId))
    .map<SkillCatalogResolvedRecipe>((recipe) => {
      const missingSkillIds = resolveMissingSkillIds(recipe.recommendedSkillIds, activeSkillIds);
      const repoKnownRecommendedSkillIds = recipe.recommendedSkillIds.filter((item) => repoKnownSkillIds.has(item));
      const repoUnknownSkillIds = recipe.recommendedSkillIds.filter((item) => !repoKnownSkillIds.has(item));
      return {
        ...recipe,
        availableSkillIds: recipe.recommendedSkillIds.filter((item) => activeSkillIds.has(item)),
        missingSkillIds,
        repoKnownSkillIds: repoKnownRecommendedSkillIds,
        repoUnknownSkillIds,
        ready: missingSkillIds.length === 0,
      };
    });

  for (const persona of personas) {
    if (persona.repoUnknownSkillIds.length > 0) {
      warnings.push(
        `Persona ${persona.id} recommends unknown repo-owned skill ids: ${persona.repoUnknownSkillIds.join(", ")}.`,
      );
    }
  }
  for (const recipe of recipes) {
    if (recipe.repoUnknownSkillIds.length > 0) {
      warnings.push(
        `Recipe ${recipe.id} recommends unknown repo-owned skill ids: ${recipe.repoUnknownSkillIds.join(", ")}.`,
      );
    }
  }

  return {
    version: loadResult.document.version,
    updatedAt: loadResult.document.updatedAt,
    source: loadResult.source,
    configPath: loadResult.configPath,
    agentId: requestedAgentId,
    activeSkillIds: Array.from(activeSkillIds).sort((left, right) => left.localeCompare(right)),
    repoKnownSkillIds: Array.from(repoKnownSkillIds).sort((left, right) => left.localeCompare(right)),
    warnings: Array.from(new Set(warnings)),
    personas,
    recipes,
  };
}
