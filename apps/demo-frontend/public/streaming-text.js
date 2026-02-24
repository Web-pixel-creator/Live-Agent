export function prepareAssistantStreamChunk(currentText, incomingText) {
  if (typeof incomingText !== "string" || incomingText.length === 0) {
    return "";
  }

  let normalized = incomingText.replace(/\r\n/g, "\n");
  const current = typeof currentText === "string" ? currentText : "";

  if (current.length === 0) {
    return normalized.trimStart();
  }

  if (current.endsWith("\n")) {
    normalized = normalized.replace(/^[ \t]+/, "");
  }

  if (current.endsWith(" ") && normalized.startsWith(" ")) {
    normalized = normalized.replace(/^ +/, " ");
  }

  if (current.endsWith("\n\n")) {
    normalized = normalized.replace(/^\n+/, "\n");
  }

  return normalized;
}

export function resolveAssistantFinalizeDelay(chunk, idleDelayMs, punctuationDelayMs) {
  const fallbackIdleMs = Number.isFinite(idleDelayMs) && idleDelayMs > 0 ? Math.floor(idleDelayMs) : 500;
  const fallbackPunctuationMs =
    Number.isFinite(punctuationDelayMs) && punctuationDelayMs > 0
      ? Math.min(fallbackIdleMs, Math.floor(punctuationDelayMs))
      : Math.min(fallbackIdleMs, 160);

  if (typeof chunk !== "string" || chunk.length === 0) {
    return fallbackIdleMs;
  }

  const trimmed = chunk.trimEnd();
  if (trimmed.length === 0) {
    return fallbackIdleMs;
  }

  if (/\n{2,}\s*$/.test(chunk)) {
    return fallbackPunctuationMs;
  }

  if (/[.!?]["')\]]*$/.test(trimmed)) {
    return fallbackPunctuationMs;
  }

  return fallbackIdleMs;
}
