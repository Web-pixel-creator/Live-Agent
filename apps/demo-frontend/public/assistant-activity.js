export function resolveAssistantActivityStatus(input) {
  const snapshot = input && typeof input === "object" ? input : {};
  const connectionStatus =
    typeof snapshot.connectionStatus === "string" ? snapshot.connectionStatus.trim().toLowerCase() : "disconnected";
  const isStreaming = snapshot.isStreaming === true;
  const isSpeaking = snapshot.isSpeaking === true;

  if (connectionStatus !== "connected") {
    if (connectionStatus === "connecting") {
      return { text: "waiting_connection", variant: "neutral" };
    }
    if (connectionStatus === "error") {
      return { text: "connection_error", variant: "fail" };
    }
    return { text: "disconnected", variant: "fail" };
  }

  if (isSpeaking) {
    return { text: "speaking", variant: "ok" };
  }

  if (isStreaming) {
    return { text: "streaming", variant: "ok" };
  }

  return { text: "idle", variant: "neutral" };
}
