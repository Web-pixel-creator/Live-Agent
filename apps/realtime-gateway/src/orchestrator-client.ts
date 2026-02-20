import type { OrchestratorRequest, OrchestratorResponse } from "@mla/contracts";

type OrchestratorClientOptions = {
  timeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
};

class NonRetriableRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetriableRequestError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readErrorDetails(response: Response): Promise<string> {
  try {
    const details = await response.text();
    return details.slice(0, 300);
  } catch {
    return "";
  }
}

function shouldRetryStatus(statusCode: number): boolean {
  return statusCode >= 500 || statusCode === 429;
}

export async function sendToOrchestrator(
  orchestratorUrl: string,
  request: OrchestratorRequest,
  options: OrchestratorClientOptions,
): Promise<OrchestratorResponse> {
  let lastError: Error | null = null;
  const totalAttempts = options.maxRetries + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(orchestratorUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (response.ok) {
        return (await response.json()) as OrchestratorResponse;
      }

      const details = await readErrorDetails(response);
      const retriable = shouldRetryStatus(response.status) && attempt < options.maxRetries;
      if (!retriable) {
        throw new NonRetriableRequestError(
          details.length > 0
            ? `orchestrator request failed: ${response.status} ${details}`
            : `orchestrator request failed: ${response.status}`,
        );
      }
      lastError = new Error(
        details.length > 0
          ? `orchestrator request failed: ${response.status} ${details}`
          : `orchestrator request failed: ${response.status}`,
      );
    } catch (error) {
      if (error instanceof NonRetriableRequestError) {
        throw error;
      }
      const isAbortError = error instanceof Error && error.name === "AbortError";
      const retriable = attempt < options.maxRetries;
      if (!retriable) {
        if (isAbortError) {
          throw new Error(`orchestrator request timed out after ${options.timeoutMs}ms`);
        }
        throw error instanceof Error ? error : new Error("orchestrator request failed");
      }
      lastError = isAbortError
        ? new Error(`orchestrator request timed out after ${options.timeoutMs}ms`)
        : error instanceof Error
          ? error
          : new Error("orchestrator request failed");
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < options.maxRetries) {
      await sleep(options.retryBackoffMs * (attempt + 1));
    }
  }

  throw lastError ?? new Error("orchestrator request failed");
}
