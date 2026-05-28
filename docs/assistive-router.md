# Assistive LLM Router (T-222)

The orchestrator now supports an optional assistive classifier that can override the incoming intent before routing, plus a repo-owned workflow control-plane override for deterministic drills and hot reload.

## Why

1. Handle ambiguous user input when the client keeps `intent=conversation`.
2. Preserve reproducibility with deterministic fallback when confidence is low.
3. Keep challenge demo safe: feature-flagged, bounded timeout, explicit confidence gate.
4. Make workflow-store degradation drills executable without ad hoc env edits.

## Behavior

1. Deterministic router is always available (`routeIntent`).
2. Assistive router runs only when `ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED=true` or an equivalent workflow/control-plane override enables it.
3. Eligible intents default to `conversation,translation,negotiation,research`.
4. Provider-aware assistive classification supports `gemini_api`, `openai`, `anthropic`, `deepseek`, and watchlist `moonshot`; Gemini remains the judged-default router.
5. OpenAI-compatible adapters (`openai`, `deepseek`, `moonshot`) use repo-owned `/chat/completions` JSON classification, Anthropic uses `/messages`, and Gemini keeps `generateContent`.
6. If `confidence < ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE`, routing falls back to deterministic route.
7. Response payload includes routing diagnostics in `payload.output.routing`, including `provider`, `defaultProvider`, `defaultModel`, `selectionReason`, `budgetPolicy`, `promptCaching`, `watchlistEnabled`, and context hints such as `contextSource`, `contextIngressSource`, `contextFocusId`, `contextBlocker`, and `contextNextAction`.
8. Workflow-store runtime exposes `usingLastKnownGood`, `lastError`, and `controlPlaneOverride` state via orchestrator runtime status.
9. When compiled Case Wiki memory is present, the assistive classifier prompt consumes the Case Wiki summary, default focus, blocker, next action, and routing lane before the raw user text so routing stays aligned with the active case. Routing diagnostics also preserve whether that snapshot came from `preserved_input_case_wiki` or `gateway_hydrated_case_wiki`, so release evidence can prove the ingress path instead of inferring it from session shape.
10. Case Wiki cost guard runs before assistive classification when `workspacePack.costSummary` is present. Within-budget cases keep the normal router path, soft-limit cases skip the assistive classifier and request `short_context`, and hard-limit cases can pause at an approval gate before route execution.

## Configuration

1. Repo-owned baseline lives in [configs/orchestrator.workflow.json](../configs/orchestrator.workflow.json).
2. `ORCHESTRATOR_WORKFLOW_CONFIG_PATH` points to an alternate workflow JSON file.
3. `ORCHESTRATOR_WORKFLOW_CONFIG_JSON` injects the same workflow JSON inline.
4. `ORCHESTRATOR_WORKFLOW_REFRESH_MS` controls hot-reload cadence.
5. `ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED` overrides file/default enablement.
6. `ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER` selects the active reasoning adapter (`gemini_api`, `openai`, `anthropic`, `deepseek`, `moonshot`).
7. `ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL` overrides classifier model (default `gemini-3.1-flash-lite-preview`, `gpt-5.4`, `claude-4`, `deepseek-v3.1`, or `kimi-k2.5` depending on provider).
8. `ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY` overrides file/default key; provider-specific fallbacks use `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, or `MOONSHOT_API_KEY`.
9. `ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL` overrides API base URL.
10. `ORCHESTRATOR_ASSISTIVE_ROUTER_TIMEOUT_MS` overrides classifier timeout budget.
11. `ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE` overrides confidence gate (0..1).
12. `ORCHESTRATOR_ASSISTIVE_ROUTER_ALLOW_INTENTS` overrides eligible request intents.
13. `ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY` exposes routing posture (`judged_default`, `long_context_operator`, `cost_sensitive_batch`, `watchlist_experimental`) to operator/runtime evidence.
14. `ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING` exposes routing cache posture (`none`, `provider_default`, `provider_prompt_cache`, `watchlist_only`).
15. `ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED` must be `true` before `moonshot` is allowed to execute; otherwise routing stays deterministic with reason `assistive_router_watchlist_disabled`.
16. `ORCHESTRATOR_COST_GUARD_ENABLED` enables the Case Wiki cost guard.
17. `ORCHESTRATOR_COST_GUARD_MAX_CASE_USD` sets the hard priced-case ceiling when `costSummary.pricingConfigured=true`.
18. `ORCHESTRATOR_COST_GUARD_MAX_CASE_TOKENS` sets the hard total-token ceiling even when pricing is not configured.
19. `ORCHESTRATOR_COST_GUARD_DEGRADE_AT_RATIO` sets the soft-limit ratio that switches to deterministic routing plus `short_context`.
20. `ORCHESTRATOR_COST_GUARD_REQUIRE_APPROVAL` pauses hard-limit cases for operator approval instead of merely degrading context.

## Control-Plane Overrides

1. `GET /workflow/config` returns the effective workflow config plus store status.
2. `POST /workflow/control-plane-override` accepts either `rawJson`, `workflow`, or `clear=true`.
3. Operator-facing proxy routes `GET /v1/runtime/workflow-config` and `POST /v1/runtime/workflow-control-plane-override` expose the same contract through `api-backend` for console/audit use.
4. The proxy returns redacted snapshots: `assistiveRouter.apiKey` is never surfaced to the UI or operator audit trail, and the contract reports only `apiKeyConfigured` plus safe posture fields (`provider`, `model`, `budgetPolicy`, `promptCaching`, `watchlistEnabled`).
5. Control-plane overrides apply after env/file defaults and can explicitly clear `assistiveRouter.apiKey` with `null` for deterministic fallback drills.
6. Invalid control-plane JSON is intentional for the `last-known-good` drill: the store keeps serving the previous valid snapshot and surfaces the parse error in status.
7. API fault-profile execution uses the orchestrator control-plane route for workflow drills instead of mutating env state directly.

## Failure Policy

1. Missing key, timeout, transport error, or invalid classifier output -> deterministic fallback.
2. Low confidence -> deterministic fallback with diagnostic mode `assistive_fallback`.
3. Watchlist `moonshot` without `ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED=true` -> deterministic fallback with reason `assistive_router_watchlist_disabled`.
4. No runtime hard failure is propagated to the user from the classifier path.
5. If workflow reload fails after a valid snapshot was loaded, orchestrator keeps the last-known-good config and exposes that state via runtime diagnostics.
6. If a control-plane override is active, its status (`active`, `updatedAt`, `reason`) remains visible until cleared.
7. Cost guard hard-limit approvals emit `approvalReason=runtime_cost_budget_guard` and include `payload.output.runtimeBudgetGuard` plus routing diagnostics; they do not invoke the target route agent until approval is granted by the operator path.

## KPI Gate Alignment

1. Demo summary exposes routing diagnostics from orchestrator output:
   - `assistiveRouterDiagnosticsValidated`
   - `assistiveRouterMode`
   - `assistiveRouterProviderMetadataValidated`
   - `assistiveRouterProvider`
2. `demo:e2e:policy` and `release-readiness` enforce:
   - diagnostics must be present and valid
   - mode must be one of `deterministic|assistive_override|assistive_match|assistive_fallback`
   - provider metadata must be present and valid
