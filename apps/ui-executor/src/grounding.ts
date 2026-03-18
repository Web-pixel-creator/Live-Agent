export type UiGroundingRefKind =
  | "field"
  | "button"
  | "submit"
  | "table"
  | "dialog"
  | "heading"
  | "generic";

export type UiGroundingRefRecord = {
  id: string;
  selector: string;
  kind: UiGroundingRefKind;
  label: string | null;
  aliases: string[];
};

export type UiGroundingRefMap = Record<string, UiGroundingRefRecord>;

export type UiExecutorGroundingContext = {
  domSnapshot?: string | null;
  accessibilityTree?: string | null;
  markHints?: string[] | null;
  refMap?: UiGroundingRefMap | null;
};

export type UiGroundingTargetResolution = {
  target: string;
  selector: string | null;
  mode: "css" | "field" | "submit" | "ref" | "raw";
  refId: string | null;
  status: "resolved" | "missing_ref" | "missing_selector";
};

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
}

function normalizeRefKind(value: unknown): UiGroundingRefKind {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "field" || normalized === "input" || normalized === "textbox" || normalized === "text") {
    return "field";
  }
  if (normalized === "button" || normalized === "cta") {
    return "button";
  }
  if (normalized === "submit") {
    return "submit";
  }
  if (normalized === "table" || normalized === "grid" || normalized === "list") {
    return "table";
  }
  if (normalized === "dialog" || normalized === "modal") {
    return "dialog";
  }
  if (normalized === "heading" || normalized === "title") {
    return "heading";
  }
  return "generic";
}

function normalizeGroundingRefRecord(id: string, value: unknown): UiGroundingRefRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const normalizedId = id.trim().toLowerCase();
  const selector =
    typeof raw.selector === "string"
      ? raw.selector.trim()
      : typeof raw.css === "string"
        ? raw.css.trim()
        : typeof raw.target === "string"
          ? raw.target.trim()
          : "";
  if (normalizedId.length === 0 || selector.length === 0) {
    return null;
  }
  const aliases = normalizeStringArray(raw.aliases);
  const label =
    typeof raw.label === "string"
      ? raw.label.trim()
      : typeof raw.name === "string"
        ? raw.name.trim()
        : typeof raw.description === "string"
          ? raw.description.trim()
          : "";
  if (label.length > 0) {
    aliases.unshift(label);
  }
  return {
    id: normalizedId,
    selector,
    kind: normalizeRefKind(raw.kind ?? raw.type ?? raw.role),
    label: label.length > 0 ? label : null,
    aliases: Array.from(new Set(aliases.map((item) => item.trim()).filter((item) => item.length > 0))),
  };
}

export function normalizeGroundingRefMap(value: unknown): UiGroundingRefMap {
  if (!value || typeof value !== "object") {
    return {};
  }
  const result: UiGroundingRefMap = {};
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }
      const raw = item as Record<string, unknown>;
      const id =
        typeof raw.id === "string"
          ? raw.id
          : typeof raw.key === "string"
            ? raw.key
            : typeof raw.refId === "string"
              ? raw.refId
              : "";
      const normalized = normalizeGroundingRefRecord(id, raw);
      if (normalized) {
        result[normalized.id] = normalized;
      }
    }
    return result;
  }
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeGroundingRefRecord(id, entry);
    if (normalized) {
      result[normalized.id] = normalized;
    }
  }
  return result;
}

export function listGroundingRefIds(refMap: UiGroundingRefMap | null | undefined): string[] {
  if (!refMap) {
    return [];
  }
  return Object.keys(refMap).sort();
}

function hasButtonGrounding(context: UiExecutorGroundingContext): boolean {
  const dom = normalizeText(context.domSnapshot);
  const a11y = normalizeText(context.accessibilityTree);
  const hints = (context.markHints ?? []).map((item) => normalizeText(item));
  return (
    dom.includes("<button") ||
    dom.includes('role="button"') ||
    a11y.includes("button[") ||
    a11y.includes("button[name=") ||
    hints.some((item) => item.includes("button"))
  );
}

function hasSubmitGrounding(context: UiExecutorGroundingContext): boolean {
  const dom = normalizeText(context.domSnapshot);
  const a11y = normalizeText(context.accessibilityTree);
  const hints = (context.markHints ?? []).map((item) => normalizeText(item));
  return (
    dom.includes('type="submit"') ||
    dom.includes("type='submit'") ||
    a11y.includes("button[name=submit") ||
    hints.some((item) => item.includes("submit"))
  );
}

function hasTableGrounding(context: UiExecutorGroundingContext): boolean {
  const dom = normalizeText(context.domSnapshot);
  const a11y = normalizeText(context.accessibilityTree);
  const hints = (context.markHints ?? []).map((item) => normalizeText(item));
  return (
    dom.includes("<table") ||
    dom.includes('role="table"') ||
    dom.includes('role="grid"') ||
    a11y.includes("table[") ||
    a11y.includes("grid[") ||
    hints.some((item) => item.includes("table") || item.includes("grid"))
  );
}

function hasDialogGrounding(context: UiExecutorGroundingContext): boolean {
  const dom = normalizeText(context.domSnapshot);
  const a11y = normalizeText(context.accessibilityTree);
  const hints = (context.markHints ?? []).map((item) => normalizeText(item));
  return (
    dom.includes("<dialog") ||
    dom.includes('role="dialog"') ||
    dom.includes('aria-modal="true"') ||
    a11y.includes("dialog[") ||
    hints.some((item) => item.includes("dialog") || item.includes("modal"))
  );
}

function hasHeadingGrounding(context: UiExecutorGroundingContext): boolean {
  const dom = normalizeText(context.domSnapshot);
  const a11y = normalizeText(context.accessibilityTree);
  const hints = (context.markHints ?? []).map((item) => normalizeText(item));
  return (
    dom.includes("<h1") ||
    dom.includes("<h2") ||
    dom.includes('role="heading"') ||
    a11y.includes("heading[") ||
    hints.some((item) => item.includes("heading") || item.includes("title"))
  );
}

function tokenExists(context: UiExecutorGroundingContext, token: string): boolean {
  const normalizedToken = token.trim().toLowerCase();
  if (normalizedToken.length === 0) {
    return false;
  }
  const dom = normalizeText(context.domSnapshot);
  const a11y = normalizeText(context.accessibilityTree);
  const hints = (context.markHints ?? []).map((item) => normalizeText(item));
  return (
    dom.includes(`id="${normalizedToken}"`) ||
    dom.includes(`id='${normalizedToken}'`) ||
    dom.includes(`name="${normalizedToken}"`) ||
    dom.includes(`name='${normalizedToken}'`) ||
    a11y.includes(normalizedToken) ||
    hints.some((item) => item.includes(normalizedToken))
  );
}

function selectorMatchesContext(selector: string, context: UiExecutorGroundingContext): boolean {
  const normalizedSelector = selector.trim().toLowerCase();
  if (normalizedSelector.length === 0) {
    return false;
  }

  const idMatches = Array.from(normalizedSelector.matchAll(/#([a-z0-9_-]+)/g)).map((match) => match[1]);
  for (const id of idMatches) {
    if (id && tokenExists(context, id)) {
      return true;
    }
  }

  const nameMatches = Array.from(
    normalizedSelector.matchAll(/\[name=(?:'|")?([a-z0-9_-]+)(?:'|")?\]/g),
  ).map((match) => match[1]);
  for (const name of nameMatches) {
    if (name && tokenExists(context, name)) {
      return true;
    }
  }

  if (
    normalizedSelector.includes("button") ||
    normalizedSelector.includes('[role="button"]') ||
    normalizedSelector.includes("[role='button']")
  ) {
    return hasButtonGrounding(context);
  }

  if (
    normalizedSelector.includes('input[type="submit"]') ||
    normalizedSelector.includes("input[type='submit']") ||
    normalizedSelector.includes('button[type="submit"]') ||
    normalizedSelector.includes("button[type='submit']")
  ) {
    return hasSubmitGrounding(context);
  }

  if (
    normalizedSelector.includes("table") ||
    normalizedSelector.includes('[role="table"]') ||
    normalizedSelector.includes('[role="grid"]')
  ) {
    return hasTableGrounding(context);
  }

  if (
    normalizedSelector.includes("dialog") ||
    normalizedSelector.includes('[role="dialog"]') ||
    normalizedSelector.includes('[aria-modal="true"]')
  ) {
    return hasDialogGrounding(context);
  }

  if (
    normalizedSelector.includes("h1") ||
    normalizedSelector.includes("h2") ||
    normalizedSelector.includes('[role="heading"]')
  ) {
    return hasHeadingGrounding(context);
  }

  return false;
}

function refAliasesMatchContext(ref: UiGroundingRefRecord, context: UiExecutorGroundingContext): boolean {
  return ref.aliases.some((alias) => tokenExists(context, alias));
}

function refKindMatchesContext(ref: UiGroundingRefRecord, context: UiExecutorGroundingContext): boolean {
  switch (ref.kind) {
    case "field":
      return tokenExists(context, ref.id) || selectorMatchesContext(ref.selector, context);
    case "button":
      return hasButtonGrounding(context) || selectorMatchesContext(ref.selector, context);
    case "submit":
      return hasSubmitGrounding(context) || selectorMatchesContext(ref.selector, context);
    case "table":
      return hasTableGrounding(context) || selectorMatchesContext(ref.selector, context);
    case "dialog":
      return hasDialogGrounding(context) || selectorMatchesContext(ref.selector, context);
    case "heading":
      return hasHeadingGrounding(context) || selectorMatchesContext(ref.selector, context);
    default:
      return selectorMatchesContext(ref.selector, context);
  }
}

export function resolveGroundingTarget(
  target: string,
  context: UiExecutorGroundingContext | undefined,
): UiGroundingTargetResolution {
  const normalizedTarget = target.trim();
  if (normalizedTarget.startsWith("ref:")) {
    const refId = normalizedTarget.slice("ref:".length).trim().toLowerCase();
    const ref = refId.length > 0 ? context?.refMap?.[refId] : null;
    return {
      target: normalizedTarget,
      selector: ref?.selector ?? null,
      mode: "ref",
      refId: ref?.id ?? (refId.length > 0 ? refId : null),
      status: ref?.selector ? "resolved" : refId.length > 0 ? "missing_ref" : "missing_selector",
    };
  }

  if (normalizedTarget.startsWith("field:")) {
    const field = normalizedTarget.slice("field:".length).trim();
    return {
      target: normalizedTarget,
      selector: field.length > 0 ? `[name="${field}"],#${field}` : null,
      mode: "field",
      refId: null,
      status: field.length > 0 ? "resolved" : "missing_selector",
    };
  }

  if (normalizedTarget === "button:submit") {
    return {
      target: normalizedTarget,
      selector: 'button[type="submit"],input[type="submit"]',
      mode: "submit",
      refId: null,
      status: "resolved",
    };
  }

  if (normalizedTarget.startsWith("css:")) {
    const selector = normalizedTarget.slice(4).trim();
    return {
      target: normalizedTarget,
      selector: selector.length > 0 ? selector : null,
      mode: "css",
      refId: null,
      status: selector.length > 0 ? "resolved" : "missing_selector",
    };
  }

  return {
    target: normalizedTarget,
    selector: normalizedTarget.length > 0 ? normalizedTarget : null,
    mode: "raw",
    refId: null,
    status: normalizedTarget.length > 0 ? "resolved" : "missing_selector",
  };
}

export function resolveGroundingObservation(
  target: string,
  context: UiExecutorGroundingContext | undefined,
): string | null {
  if (!context) {
    return null;
  }

  const resolved = resolveGroundingTarget(target, context);
  if (resolved.mode === "ref") {
    const ref = resolved.refId ? context.refMap?.[resolved.refId] : null;
    if (!ref) {
      return null;
    }
    return selectorMatchesContext(ref.selector, context) ||
      refAliasesMatchContext(ref, context) ||
      refKindMatchesContext(ref, context)
      ? `grounding-confirmed ref:${ref.id}`
      : null;
  }

  if (target === "button:submit") {
    return hasSubmitGrounding(context) || hasButtonGrounding(context)
      ? "grounding-confirmed submit control"
      : null;
  }

  if (target.startsWith("field:")) {
    const field = target.slice("field:".length).trim().toLowerCase();
    return tokenExists(context, field) ? `grounding-confirmed field:${field}` : null;
  }

  const normalizedTarget = target.trim().toLowerCase();
  const selector =
    normalizedTarget.startsWith("css:") ? normalizedTarget.slice(4).trim() : normalizedTarget;

  const looksLikeCssSelector =
    normalizedTarget.startsWith("css:") ||
    selector.startsWith("#") ||
    selector.startsWith("[") ||
    selector.includes("#") ||
    selector.includes("[name=");

  if (!looksLikeCssSelector) {
    return null;
  }

  const idMatches = Array.from(selector.matchAll(/#([a-z0-9_-]+)/g)).map((match) => match[1]);
  for (const id of idMatches) {
    if (id && tokenExists(context, id)) {
      return `grounding-confirmed css:#${id}`;
    }
  }

  const nameMatches = Array.from(selector.matchAll(/\[name=(?:'|")?([a-z0-9_-]+)(?:'|")?\]/g)).map((match) => match[1]);
  for (const name of nameMatches) {
    if (name && tokenExists(context, name)) {
      return `grounding-confirmed css:[name=${name}]`;
    }
  }

  if (
    selector.includes("button") ||
    selector.includes('[role="button"]') ||
    selector.includes("[role='button']")
  ) {
    return hasButtonGrounding(context) ? "grounding-confirmed button selector" : null;
  }

  if (
    selector.includes('input[type="submit"]') ||
    selector.includes("input[type='submit']") ||
    selector.includes('button[type="submit"]') ||
    selector.includes("button[type='submit']")
  ) {
    return hasSubmitGrounding(context) ? "grounding-confirmed submit selector" : null;
  }

  if (
    selector.includes("table") ||
    selector.includes('[role="table"]') ||
    selector.includes('[role="grid"]')
  ) {
    return hasTableGrounding(context) ? "grounding-confirmed table selector" : null;
  }

  return null;
}
