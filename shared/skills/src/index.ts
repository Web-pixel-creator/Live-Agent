import { constants } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export type SkillSource = "workspace" | "bundled" | "managed";

export type SkillTrustLevel = "untrusted" | "reviewed" | "trusted";

export type SkillSecurityMode = "off" | "warn" | "enforce";

export type SkillSecurityFindingSeverity = "low" | "medium" | "high";

export type SkillSecurityFinding = {
  ruleId: string;
  severity: SkillSecurityFindingSeverity;
  message: string;
};

export type SkillSecurityScanResult = {
  mode: SkillSecurityMode;
  findings: SkillSecurityFinding[];
  blocked: boolean;
};

export type ResolvedSkill = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  source: SkillSource;
  sourcePath: string | null;
  priority: number;
  scope: string[];
  version: number;
  updatedAt: string | null;
  publisher: string | null;
  checksum: string | null;
  trustLevel: SkillTrustLevel;
  securityScan: SkillSecurityScanResult;
};

export type SkillSkip = {
  id: string;
  source: SkillSource;
  reason:
    | "disabled_in_skill"
    | "disabled_by_policy"
    | "not_in_enabled_list"
    | "scope_excluded"
    | "shadowed_by_precedence"
    | "invalid_definition"
    | "security_scan_blocked"
    | "trust_gate_blocked";
};

export type SkillsRuntimeSnapshot = {
  enabled: boolean;
  agentId: string;
  sourcePrecedence: SkillSource[];
  allowedSources: SkillSource[];
  activeSkills: ResolvedSkill[];
  skippedSkills: SkillSkip[];
  securityMode: SkillSecurityMode;
  minTrustLevel: SkillTrustLevel;
  loadedAt: string;
};

export type SkillsRuntimeSummary = {
  enabled: boolean;
  agentId: string;
  sourcePrecedence: SkillSource[];
  allowedSources: SkillSource[];
  activeCount: number;
  activeSkills: Array<{
    id: string;
    source: SkillSource;
    priority: number;
    version: number;
    trustLevel: SkillTrustLevel;
  }>;
  skippedCount: number;
  securityMode: SkillSecurityMode;
  minTrustLevel: SkillTrustLevel;
  securityBlockedCount: number;
  trustBlockedCount: number;
  loadedAt: string;
};

type SkillCandidate = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  source: SkillSource;
  sourcePath: string | null;
  priority: number;
  scope: string[];
  version: number;
  updatedAt: string | null;
  publisher: string | null;
  checksum: string | null;
  enabled: boolean;
  trustLevel: SkillTrustLevel;
  scanText: string;
};

type RuntimeConfig = {
  enabled: boolean;
  sourcePrecedence: SkillSource[];
  allowedSources: Set<SkillSource>;
  workspaceDir: string;
  bundledDir: string;
  managedJson: string | null;
  managedUrl: string | null;
  managedAuthToken: string | null;
  managedTimeoutMs: number;
  enabledIds: Set<string> | null;
  disabledIds: Set<string>;
  securityMode: SkillSecurityMode;
  minTrustLevel: SkillTrustLevel;
};

const ALL_SOURCES: SkillSource[] = ["workspace", "bundled", "managed"];

const TRUST_RANK: Record<SkillTrustLevel, number> = {
  untrusted: 1,
  reviewed: 2,
  trusted: 3,
};

type SecurityRule = {
  id: string;
  severity: SkillSecurityFindingSeverity;
  message: string;
  patterns: RegExp[];
};

const SECURITY_RULES: SecurityRule[] = [
  {
    id: "destructive_shell",
    severity: "high",
    message: "Detected potentially destructive shell instructions.",
    patterns: [
      /\brm\s+-rf\b/i,
      /\bdel\s+\/f\s+\/q\b/i,
      /\bformat\s+[a-z]:/i,
      /\bremove-item\s+-recurse\s+-force\b/i,
      /\bshutdown\s+-s\b/i,
    ],
  },
  {
    id: "pipe_to_shell",
    severity: "high",
    message: "Detected remote script execution piped into shell.",
    patterns: [
      /\bcurl\b[^\n|]{0,200}\|\s*(sh|bash|pwsh|powershell)\b/i,
      /\bwget\b[^\n|]{0,200}\|\s*(sh|bash|pwsh|powershell)\b/i,
      /\biwr\b[^\n|]{0,200}\|\s*iex\b/i,
      /\binvoke-webrequest\b[^\n|]{0,200}\|\s*invoke-expression\b/i,
    ],
  },
  {
    id: "prompt_override",
    severity: "medium",
    message: "Detected prompt override instructions that may bypass policy.",
    patterns: [
      /\bignore\s+all\s+previous\s+instructions\b/i,
      /\boverride\s+system\s+prompt\b/i,
      /\bdisable\s+safety\b/i,
      /\bbypass\s+guardrails\b/i,
    ],
  },
  {
    id: "secret_exfiltration",
    severity: "high",
    message: "Detected instructions to extract or transmit secrets.",
    patterns: [
      /\bprint\s+all\s+environment\s+variables\b/i,
      /\bexport\s+all\s+secrets\b/i,
      /\bsend\s+api\s+keys?\s+to\b/i,
      /\bupload\s+credentials?\b/i,
    ],
  },
];

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

function toBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseSkillSource(value: string): SkillSource | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "workspace" || normalized === "bundled" || normalized === "managed") {
    return normalized;
  }
  return null;
}

function parseSkillSecurityMode(value: string | undefined): SkillSecurityMode {
  const normalized = toNonEmptyString(value)?.toLowerCase();
  if (normalized === "off" || normalized === "warn" || normalized === "enforce") {
    return normalized;
  }
  return "enforce";
}

function parseTrustLevel(value: string | undefined, fallback: SkillTrustLevel): SkillTrustLevel {
  const normalized = toNonEmptyString(value)?.toLowerCase();
  if (normalized === "trusted" || normalized === "reviewed" || normalized === "untrusted") {
    return normalized;
  }
  return fallback;
}

function defaultTrustLevelForSource(source: SkillSource): SkillTrustLevel {
  if (source === "bundled") {
    return "trusted";
  }
  if (source === "workspace") {
    return "reviewed";
  }
  return "reviewed";
}

function parseSourceList(value: string | undefined, fallback: SkillSource[]): SkillSource[] {
  const entries = parseCsv(value);
  if (entries.length === 0) {
    return fallback;
  }
  const deduped: SkillSource[] = [];
  const seen = new Set<SkillSource>();
  for (const entry of entries) {
    const parsed = parseSkillSource(entry);
    if (!parsed || seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    deduped.push(parsed);
  }
  return deduped.length > 0 ? deduped : fallback;
}

function normalizeSkillId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized.length > 0) {
    return normalized;
  }
  return fallback;
}

function parseIdList(value: string | undefined): Set<string> | null {
  const entries = parseCsv(value)
    .map((item) => normalizeSkillId(item, ""))
    .filter((item) => item.length > 0);
  if (entries.length === 0) {
    return null;
  }
  return new Set(entries);
}

function parseScope(value: unknown): string[] {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of parts) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim().toLowerCase();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function extractSection(content: string, sectionNames: string[]): string | null {
  const names = new Set(sectionNames.map((item) => item.trim().toLowerCase()));
  const lines = content.split(/\r?\n/);
  let collecting = false;
  const collected: string[] = [];
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading && heading[1]) {
      const headingName = heading[1].trim().toLowerCase();
      if (collecting) {
        break;
      }
      collecting = names.has(headingName);
      continue;
    }
    if (collecting) {
      collected.push(line);
    }
  }
  const section = collected.join("\n").trim();
  return section.length > 0 ? section : null;
}

function buildRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  const sourcePrecedence = parseSourceList(env.SKILLS_SOURCE_PRECEDENCE, ["workspace", "bundled", "managed"]);
  const allowedSources = new Set(parseSourceList(env.SKILLS_ALLOWED_SOURCES, sourcePrecedence));
  const enabledIds = parseIdList(env.SKILLS_ENABLED_IDS);
  const disabledIds = parseIdList(env.SKILLS_DISABLED_IDS) ?? new Set<string>();
  const securityMode = parseSkillSecurityMode(env.SKILLS_SECURITY_MODE);
  const minTrustLevel = parseTrustLevel(env.SKILLS_MIN_TRUST_LEVEL, "untrusted");

  return {
    enabled: toBooleanFlag(env.SKILLS_RUNTIME_ENABLED, true),
    sourcePrecedence,
    allowedSources,
    workspaceDir: toNonEmptyString(env.SKILLS_WORKSPACE_DIR) ?? "skills/workspace",
    bundledDir: toNonEmptyString(env.SKILLS_BUNDLED_DIR) ?? "skills/bundled",
    managedJson: toNonEmptyString(env.SKILLS_MANAGED_INDEX_JSON),
    managedUrl: toNonEmptyString(env.SKILLS_MANAGED_INDEX_URL),
    managedAuthToken: toNonEmptyString(env.SKILLS_MANAGED_INDEX_AUTH_TOKEN),
    managedTimeoutMs: parsePositiveInt(env.SKILLS_MANAGED_INDEX_TIMEOUT_MS, 2500),
    enabledIds,
    disabledIds,
    securityMode,
    minTrustLevel,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function parseSkillMarkdown(params: {
  source: SkillSource;
  sourcePath: string | null;
  fallbackId: string;
  content: string;
}): SkillCandidate | null {
  const lines = params.content.split(/\r?\n/);
  const heading = lines.find((line) => /^#\s+/.test(line));
  const meta: Record<string, string> = {};

  for (const line of lines.slice(0, 120)) {
    const parsed = line.match(/^([A-Za-z][A-Za-z0-9_-]{1,80})\s*:\s*(.+)$/);
    if (!parsed || !parsed[1] || !parsed[2]) {
      continue;
    }
    const key = parsed[1].trim().toLowerCase();
    if (key === "http" || key === "https") {
      continue;
    }
    meta[key] = parsed[2].trim();
  }

  const skillId = normalizeSkillId(meta.id ?? params.fallbackId, params.fallbackId);
  if (skillId.length === 0) {
    return null;
  }

  const title = toNonEmptyString(meta.name) ?? toNonEmptyString(heading?.replace(/^#\s+/, "")) ?? skillId;
  const description =
    toNonEmptyString(meta.description) ??
    toNonEmptyString(meta.summary) ??
    `${title} skill loaded from ${params.source}.`;
  const promptSection = extractSection(params.content, [
    "instructions",
    "prompt",
    "system prompt",
    "system instructions",
  ]);
  const prompt =
    toNonEmptyString(meta.prompt) ??
    promptSection ??
    description;
  const enabled = toBooleanFlag(meta.enabled, true);
  const scope = parseScope(toNonEmptyString(meta.scope) ?? toNonEmptyString(meta.agents));
  const sourceBasePriority = params.source === "workspace" ? 300 : params.source === "bundled" ? 200 : 100;
  const priority = parsePositiveInt(meta.priority, sourceBasePriority);
  const version = parsePositiveInt(meta.version, 1);
  const updatedAt = toNonEmptyString(meta.updatedat) ?? null;
  const publisher = toNonEmptyString(meta.publisher);
  const checksum = toNonEmptyString(meta.checksum);
  const trustLevel = parseTrustLevel(meta.trustlevel ?? meta.trust, defaultTrustLevelForSource(params.source));
  const scanText = [title, description, prompt, params.content].join("\n");

  return {
    id: skillId,
    name: title,
    description,
    prompt,
    source: params.source,
    sourcePath: params.sourcePath,
    priority,
    scope,
    version,
    updatedAt,
    publisher,
    checksum,
    enabled,
    trustLevel,
    scanText,
  };
}

async function loadSkillsFromDirectory(params: {
  source: Extract<SkillSource, "workspace" | "bundled">;
  rootPath: string;
}): Promise<SkillCandidate[]> {
  if (!(await pathExists(params.rootPath))) {
    return [];
  }

  const candidates: SkillCandidate[] = [];
  const rootSkillFile = join(params.rootPath, "SKILL.md");
  if (await pathExists(rootSkillFile)) {
    const content = await readFile(rootSkillFile, "utf8");
    const fallbackId = normalizeSkillId(basename(params.rootPath), "root-skill");
    const parsed = parseSkillMarkdown({
      source: params.source,
      sourcePath: rootSkillFile,
      fallbackId,
      content,
    });
    if (parsed) {
      candidates.push(parsed);
    }
  }

  const entries = await readdir(params.rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillPath = join(params.rootPath, entry.name, "SKILL.md");
    if (!(await pathExists(skillPath))) {
      continue;
    }
    const content = await readFile(skillPath, "utf8");
    const fallbackId = normalizeSkillId(entry.name, "skill");
    const parsed = parseSkillMarkdown({
      source: params.source,
      sourcePath: skillPath,
      fallbackId,
      content,
    });
    if (parsed) {
      candidates.push(parsed);
    }
  }

  return candidates;
}

function parseManagedSkillsFromUnknown(raw: unknown): SkillCandidate[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const candidates: SkillCandidate[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!isRecord(item)) {
      continue;
    }
    const rawId = toNonEmptyString(item.id) ?? `managed-${index + 1}`;
    const id = normalizeSkillId(rawId, `managed-${index + 1}`);
    const name = toNonEmptyString(item.name) ?? id;
    const description = toNonEmptyString(item.description) ?? `${name} managed skill`;
    const prompt = toNonEmptyString(item.prompt) ?? description;
    const enabled = item.enabled === undefined ? true : Boolean(item.enabled);
    const scope = parseScope(item.scope ?? item.agents);
    const priority = parsePositiveInt(item.priority, 100);
    const version = parsePositiveInt(item.version, 1);
    const updatedAt = toNonEmptyString(item.updatedAt);
    const publisher = toNonEmptyString(item.publisher);
    const checksum = toNonEmptyString(item.checksum);
    const trustLevel = parseTrustLevel(
      toNonEmptyString(item.trustLevel) ?? toNonEmptyString(item.trust) ?? undefined,
      defaultTrustLevelForSource("managed"),
    );
    const scanText = [name, description, prompt].join("\n");
    candidates.push({
      id,
      name,
      description,
      prompt,
      source: "managed",
      sourcePath: null,
      priority,
      scope,
      version,
      updatedAt,
      publisher,
      checksum,
      enabled,
      trustLevel,
      scanText,
    });
  }
  return candidates;
}

function parseManagedSkills(rawJson: string | null): SkillCandidate[] {
  if (!rawJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return parseManagedSkillsFromUnknown(parsed);
  } catch {
    return [];
  }
}

async function loadManagedSkillsFromUrl(params: {
  url: string;
  timeoutMs: number;
  authToken: string | null;
}): Promise<SkillCandidate[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const headers: Record<string, string> = {};
    if (params.authToken) {
      headers.Authorization = `Bearer ${params.authToken}`;
    }
    const response = await fetch(params.url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as unknown;
    if (isRecord(payload) && Array.isArray(payload.data)) {
      return parseManagedSkillsFromUnknown(payload.data);
    }
    return parseManagedSkillsFromUnknown(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function scanSkillCandidate(params: {
  candidate: SkillCandidate;
  mode: SkillSecurityMode;
}): SkillSecurityScanResult {
  if (params.mode === "off") {
    return {
      mode: params.mode,
      findings: [],
      blocked: false,
    };
  }

  const findings: SkillSecurityFinding[] = [];
  for (const rule of SECURITY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(params.candidate.scanText))) {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.message,
      });
    }
  }

  const hasHighSeverity = findings.some((finding) => finding.severity === "high");
  return {
    mode: params.mode,
    findings,
    blocked: params.mode === "enforce" && hasHighSeverity,
  };
}

function passesTrustGate(params: {
  candidate: SkillCandidate;
  minTrustLevel: SkillTrustLevel;
}): boolean {
  return TRUST_RANK[params.candidate.trustLevel] >= TRUST_RANK[params.minTrustLevel];
}

function isScopeMatch(skillScope: string[], agentId: string): boolean {
  if (skillScope.length === 0) {
    return true;
  }
  const normalizedAgentId = agentId.trim().toLowerCase();
  const aliases = new Set<string>([
    normalizedAgentId,
    normalizedAgentId.replace(/-agent$/, ""),
    normalizedAgentId.replace(/^agent-/, ""),
  ]);
  if (normalizedAgentId === "ui-navigator-agent") {
    aliases.add("ui");
    aliases.add("ui-navigator");
  }
  if (normalizedAgentId === "storyteller-agent") {
    aliases.add("storyteller");
    aliases.add("story");
  }
  if (normalizedAgentId === "live-agent") {
    aliases.add("live");
  }

  for (const scopeItem of skillScope) {
    const normalizedScope = scopeItem.trim().toLowerCase();
    if (normalizedScope === "*" || normalizedScope === "all") {
      return true;
    }
    if (aliases.has(normalizedScope)) {
      return true;
    }
  }
  return false;
}

async function loadSourceCandidates(params: {
  source: SkillSource;
  cwd: string;
  config: RuntimeConfig;
}): Promise<SkillCandidate[]> {
  switch (params.source) {
    case "workspace":
      return loadSkillsFromDirectory({
        source: "workspace",
        rootPath: resolve(params.cwd, params.config.workspaceDir),
      });
    case "bundled":
      return loadSkillsFromDirectory({
        source: "bundled",
        rootPath: resolve(params.cwd, params.config.bundledDir),
      });
    case "managed": {
      if (params.config.managedUrl) {
        const remoteSkills = await loadManagedSkillsFromUrl({
          url: params.config.managedUrl,
          timeoutMs: params.config.managedTimeoutMs,
          authToken: params.config.managedAuthToken,
        });
        if (remoteSkills) {
          return remoteSkills;
        }
      }
      return parseManagedSkills(params.config.managedJson);
    }
    default:
      return [];
  }
}

export async function getSkillsRuntimeSnapshot(params: {
  agentId: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): Promise<SkillsRuntimeSnapshot> {
  const env = params.env ?? process.env;
  const cwd = params.cwd ?? process.cwd();
  const config = buildRuntimeConfig(env);
  const loadedAt = new Date().toISOString();

  if (!config.enabled) {
    return {
      enabled: false,
      agentId: params.agentId,
      sourcePrecedence: config.sourcePrecedence,
      allowedSources: config.sourcePrecedence.filter((source) => config.allowedSources.has(source)),
      activeSkills: [],
      skippedSkills: [],
      securityMode: config.securityMode,
      minTrustLevel: config.minTrustLevel,
      loadedAt,
    };
  }

  const activeSkills: ResolvedSkill[] = [];
  const skippedSkills: SkillSkip[] = [];
  const seenIds = new Set<string>();

  for (const source of config.sourcePrecedence) {
    if (!config.allowedSources.has(source)) {
      continue;
    }
    let loaded: SkillCandidate[] = [];
    try {
      loaded = await loadSourceCandidates({
        source,
        cwd,
        config,
      });
    } catch {
      skippedSkills.push({
        id: `${source}-loader`,
        source,
        reason: "invalid_definition",
      });
      continue;
    }
    const ordered = loaded.sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.id.localeCompare(right.id);
    });

    for (const candidate of ordered) {
      if (seenIds.has(candidate.id)) {
        skippedSkills.push({
          id: candidate.id,
          source: candidate.source,
          reason: "shadowed_by_precedence",
        });
        continue;
      }
      seenIds.add(candidate.id);

      if (!candidate.enabled) {
        skippedSkills.push({
          id: candidate.id,
          source: candidate.source,
          reason: "disabled_in_skill",
        });
        continue;
      }

      if (config.enabledIds && !config.enabledIds.has(candidate.id)) {
        skippedSkills.push({
          id: candidate.id,
          source: candidate.source,
          reason: "not_in_enabled_list",
        });
        continue;
      }

      if (config.disabledIds.has(candidate.id)) {
        skippedSkills.push({
          id: candidate.id,
          source: candidate.source,
          reason: "disabled_by_policy",
        });
        continue;
      }

      if (!isScopeMatch(candidate.scope, params.agentId)) {
        skippedSkills.push({
          id: candidate.id,
          source: candidate.source,
          reason: "scope_excluded",
        });
        continue;
      }

      if (candidate.prompt.trim().length === 0) {
        skippedSkills.push({
          id: candidate.id,
          source: candidate.source,
          reason: "invalid_definition",
        });
        continue;
      }

      const securityScan = scanSkillCandidate({
        candidate,
        mode: config.securityMode,
      });
      if (securityScan.blocked) {
        skippedSkills.push({
          id: candidate.id,
          source: candidate.source,
          reason: "security_scan_blocked",
        });
        continue;
      }

      if (
        !passesTrustGate({
          candidate,
          minTrustLevel: config.minTrustLevel,
        })
      ) {
        skippedSkills.push({
          id: candidate.id,
          source: candidate.source,
          reason: "trust_gate_blocked",
        });
        continue;
      }

      activeSkills.push({
        id: candidate.id,
        name: candidate.name,
        description: candidate.description,
        prompt: candidate.prompt,
        source: candidate.source,
        sourcePath: candidate.sourcePath,
        priority: candidate.priority,
        scope: candidate.scope,
        version: candidate.version,
        updatedAt: candidate.updatedAt,
        publisher: candidate.publisher,
        checksum: candidate.checksum,
        trustLevel: candidate.trustLevel,
        securityScan,
      });
    }
  }

  return {
    enabled: true,
    agentId: params.agentId,
    sourcePrecedence: config.sourcePrecedence,
    allowedSources: config.sourcePrecedence.filter((source) => config.allowedSources.has(source)),
    activeSkills,
    skippedSkills,
    securityMode: config.securityMode,
    minTrustLevel: config.minTrustLevel,
    loadedAt,
  };
}

export function toSkillsRuntimeSummary(snapshot: SkillsRuntimeSnapshot): SkillsRuntimeSummary {
  const securityBlockedCount = snapshot.skippedSkills.filter((item) => item.reason === "security_scan_blocked").length;
  const trustBlockedCount = snapshot.skippedSkills.filter((item) => item.reason === "trust_gate_blocked").length;
  return {
    enabled: snapshot.enabled,
    agentId: snapshot.agentId,
    sourcePrecedence: snapshot.sourcePrecedence,
    allowedSources: snapshot.allowedSources,
    activeCount: snapshot.activeSkills.length,
    activeSkills: snapshot.activeSkills.map((skill) => ({
      id: skill.id,
      source: skill.source,
      priority: skill.priority,
      version: skill.version,
      trustLevel: skill.trustLevel,
    })),
    skippedCount: snapshot.skippedSkills.length,
    securityMode: snapshot.securityMode,
    minTrustLevel: snapshot.minTrustLevel,
    securityBlockedCount,
    trustBlockedCount,
    loadedAt: snapshot.loadedAt,
  };
}

export function renderSkillsPrompt(
  snapshot: SkillsRuntimeSnapshot,
  options?: {
    maxSkills?: number;
    maxChars?: number;
  },
): string | null {
  if (!snapshot.enabled || snapshot.activeSkills.length === 0) {
    return null;
  }

  const maxSkills = parsePositiveInt(options?.maxSkills, 4);
  const maxChars = parsePositiveInt(options?.maxChars, 1400);
  const sections: string[] = [];
  const selected = snapshot.activeSkills.slice(0, maxSkills);
  sections.push("Apply these skill directives in precedence order:");
  for (const skill of selected) {
    const compactPrompt = skill.prompt.replace(/\s+/g, " ").trim();
    const clipped = compactPrompt.length > 320 ? `${compactPrompt.slice(0, 317)}...` : compactPrompt;
    sections.push(`- [${skill.id} | ${skill.source}] ${clipped}`);
  }

  const combined = sections.join("\n");
  if (combined.length <= maxChars) {
    return combined;
  }
  return `${combined.slice(0, maxChars - 3)}...`;
}

if (process.argv[1]?.endsWith("index.ts")) {
  console.log("[skills] runtime module ready", {
    sources: ALL_SOURCES,
  });
}
