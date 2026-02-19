import type { OrchestratorIntent } from "@mla/contracts";

export type AgentRoute = "live-agent" | "storyteller-agent" | "ui-navigator-agent";

export function routeIntent(intent: OrchestratorIntent): AgentRoute {
  switch (intent) {
    case "conversation":
    case "translation":
    case "negotiation":
      return "live-agent";
    case "story":
      return "storyteller-agent";
    case "ui_task":
      return "ui-navigator-agent";
    default:
      return "live-agent";
  }
}

