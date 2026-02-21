# Local-First Runtime Profile

## Purpose

`local-first` is a non-production profile for offline/local iteration without cloud dependencies.

## Activation

Set either:

- `LOCAL_FIRST_PROFILE=true`
- or `RUNTIME_PROFILE=local-first`

Environment selector:

- `APP_ENV=dev|staging|prod` (default is `dev`)

## Guardrails

- `local-first` is allowed only when `APP_ENV=dev`.
- Startup is blocked in `staging` and `prod` if `local-first` is enabled.

## Auto Defaults (when local-first is active)

- `FIRESTORE_ENABLED=false`
- `LIVE_API_ENABLED=false`
- `LIVE_API_AUTO_SETUP=false`
- `LIVE_AGENT_USE_GEMINI_CHAT=false`
- `STORYTELLER_USE_GEMINI_PLANNER=false`
- `UI_NAVIGATOR_USE_GEMINI_PLANNER=false`
- `STORYTELLER_MEDIA_MODE=simulated`
- `UI_NAVIGATOR_EXECUTOR_MODE=simulated`
- `UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE=true`

## Profile Matrix

| APP_ENV | Profile | Result |
| --- | --- | --- |
| `dev` | `standard` | Allowed |
| `dev` | `local-first` | Allowed + defaults applied |
| `staging` | `standard` | Allowed |
| `staging` | `local-first` | Blocked on startup |
| `prod` | `standard` | Allowed |
| `prod` | `local-first` | Blocked on startup |

## Smoke Validation

```powershell
npm run profile:smoke
```

## Optional: Live API Echo Mock (for realtime UI without cloud keys)

Run local mock service:

```powershell
npm run dev:live-mock
```

Use gateway with mock upstream:

- `LIVE_API_ENABLED=true`
- `LIVE_API_PROTOCOL=gemini`
- `LIVE_API_WS_URL=ws://localhost:8091/live`

This allows frontend/gateway testing of `connected`, `live.output`, `live.interrupted`, and turn-complete flows without Gemini quota usage.
