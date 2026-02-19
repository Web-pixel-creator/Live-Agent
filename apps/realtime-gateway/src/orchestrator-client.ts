import type { OrchestratorRequest, OrchestratorResponse } from "@mla/contracts";

export async function sendToOrchestrator(
  orchestratorUrl: string,
  request: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  const response = await fetch(orchestratorUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      details = "";
    }
    throw new Error(
      details.length > 0
        ? `orchestrator request failed: ${response.status} ${details.slice(0, 300)}`
        : `orchestrator request failed: ${response.status}`,
    );
  }

  return (await response.json()) as OrchestratorResponse;
}
