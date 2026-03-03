export type RuntimeEnvironment = "dev" | "staging" | "prod";

export type RuntimeProfileName = "standard" | "local-first";

export type RuntimeProfileState = {
  service: string;
  environment: RuntimeEnvironment;
  profile: RuntimeProfileName;
  localFirst: boolean;
  blocked: boolean;
  blockReason: string | null;
  appliedDefaults: string[];
  disabledFeatures: string[];
};

type RuntimeProfileOptions = {
  service: string;
  env?: NodeJS.ProcessEnv;
  applyDefaults?: boolean;
};

const LOCAL_FIRST_DEFAULTS: ReadonlyArray<readonly [string, string]> = [
  ["FIRESTORE_ENABLED", "false"],
  ["LIVE_API_ENABLED", "false"],
  ["LIVE_API_AUTO_SETUP", "false"],
  ["LIVE_AGENT_USE_GEMINI_CHAT", "false"],
  ["STORYTELLER_USE_GEMINI_PLANNER", "false"],
  ["UI_NAVIGATOR_USE_GEMINI_PLANNER", "false"],
  ["STORYTELLER_MEDIA_MODE", "simulated"],
  ["UI_NAVIGATOR_EXECUTOR_MODE", "simulated"],
  ["UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE", "true"],
];

const LOCAL_FIRST_DISABLED_FEATURES: string[] = [
  "Firestore persistence adapters",
  "Live API upstream bridge",
  "Gemini remote planner calls (live/story/ui)",
  "Remote UI executor requirement (forced simulated mode)",
];

function toLowerTrimmed(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseBool(value: string | undefined): boolean {
  const normalized = toLowerTrimmed(value);
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeEnvironment(value: string | undefined): RuntimeEnvironment {
  const normalized = toLowerTrimmed(value);
  if (normalized === "prod" || normalized === "production") {
    return "prod";
  }
  if (normalized === "stage" || normalized === "staging") {
    return "staging";
  }
  return "dev";
}

function normalizeProfile(value: string | undefined, localFirstFlag: boolean): RuntimeProfileName {
  if (localFirstFlag) {
    return "local-first";
  }
  const normalized = toLowerTrimmed(value);
  if (normalized === "local" || normalized === "local-first" || normalized === "local_first") {
    return "local-first";
  }
  return "standard";
}

function applyLocalFirstDefaults(env: NodeJS.ProcessEnv): string[] {
  const appliedDefaults: string[] = [];
  for (const [name, value] of LOCAL_FIRST_DEFAULTS) {
    const existing = env[name];
    if (typeof existing === "string" && existing.trim().length > 0) {
      continue;
    }
    env[name] = value;
    appliedDefaults.push(name);
  }
  return appliedDefaults;
}

export function resolveRuntimeProfile(options: RuntimeProfileOptions): RuntimeProfileState {
  const env = options.env ?? process.env;
  const environment = normalizeEnvironment(env.APP_ENV ?? env.RUNTIME_ENV ?? env.NODE_ENV);
  const profile = normalizeProfile(env.RUNTIME_PROFILE, parseBool(env.LOCAL_FIRST_PROFILE));
  const localFirst = profile === "local-first";
  const applyDefaults = options.applyDefaults === true;

  let blocked = false;
  let blockReason: string | null = null;
  const appliedDefaults: string[] = [];

  if (localFirst && environment !== "dev") {
    blocked = true;
    blockReason =
      "LOCAL_FIRST profile is allowed only in dev environment. Use APP_ENV=dev or disable local-first.";
  }

  if (!blocked && localFirst && applyDefaults) {
    appliedDefaults.push(...applyLocalFirstDefaults(env));
  }

  return {
    service: options.service,
    environment,
    profile,
    localFirst,
    blocked,
    blockReason,
    appliedDefaults,
    disabledFeatures: localFirst ? [...LOCAL_FIRST_DISABLED_FEATURES] : [],
  };
}

export function applyRuntimeProfile(service: string, env: NodeJS.ProcessEnv = process.env): RuntimeProfileState {
  const state = resolveRuntimeProfile({
    service,
    env,
    applyDefaults: true,
  });
  if (state.blocked) {
    throw new Error(`[${service}] ${state.blockReason ?? "runtime profile is blocked"}`);
  }
  return state;
}
