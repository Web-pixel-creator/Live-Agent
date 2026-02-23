# Assistive LLM Router (T-222)

The orchestrator now supports an optional assistive classifier that can override the incoming intent before routing.

## Why

1. Handle ambiguous user input when the client keeps `intent=conversation`.
2. Preserve reproducibility with deterministic fallback when confidence is low.
3. Keep challenge demo safe: feature-flagged, bounded timeout, explicit confidence gate.

## Behavior

1. Deterministic router is always available (`routeIntent`).
2. Assistive router runs only when `ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED=true`.
3. Eligible intents default to `conversation,translation,negotiation`.
4. Gemini classifier proposes `{ intent, confidence, reason }`.
5. If `confidence < ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE`, routing falls back to deterministic route.
6. Response payload includes routing diagnostics in `payload.output.routing`.

## Configuration

1. `ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED` - enable/disable feature.
2. `ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL` - classifier model (default `gemini-3-flash`).
3. `ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY` - optional dedicated key (falls back to `GEMINI_API_KEY`).
4. `ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL` - API base URL (default Gemini v1beta endpoint).
5. `ORCHESTRATOR_ASSISTIVE_ROUTER_TIMEOUT_MS` - classifier timeout budget.
6. `ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE` - confidence gate (0..1).
7. `ORCHESTRATOR_ASSISTIVE_ROUTER_ALLOW_INTENTS` - comma-separated request intents where assistive mode is allowed.

## Failure Policy

1. Missing key, timeout, transport error, or invalid classifier output -> deterministic fallback.
2. Low confidence -> deterministic fallback with diagnostic mode `assistive_fallback`.
3. No runtime hard failure is propagated to the user from the classifier path.

## KPI Gate Alignment

1. Demo summary exposes routing diagnostics from orchestrator output:
   - `assistiveRouterDiagnosticsValidated`
   - `assistiveRouterMode`
2. `demo:e2e:policy` and `release-readiness` enforce:
   - diagnostics must be present and valid
   - mode must be one of `deterministic|assistive_override|assistive_match|assistive_fallback`
