export type UiExecutorGroundingContext = {
  domSnapshot?: string | null;
  accessibilityTree?: string | null;
  markHints?: string[] | null;
};

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.toLowerCase() : "";
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

export function resolveGroundingObservation(
  target: string,
  context: UiExecutorGroundingContext | undefined,
): string | null {
  if (!context) {
    return null;
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

  return null;
}
