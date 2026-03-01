# Local Development

## Quick Start

```bash
npm install
```

Run services:

```bash
npm run dev:orchestrator
npm run dev:api
npm run dev:gateway
npm run dev:ui-executor
npm run dev:frontend
```

Frontend: `http://localhost:3000`

## Local-First Profile

Use local-first profile for offline development and lower cloud dependency risk:

1. `LOCAL_FIRST_PROFILE=true`
2. `APP_ENV=dev`

Detailed matrix and guardrails: `docs/local-first-profile.md`.

## Realtime Mock Mode

Start local live API echo mock:

```bash
npm run dev:live-mock
```

Gateway envs:

1. `LIVE_API_ENABLED=true`
2. `LIVE_API_PROTOCOL=gemini`
3. `LIVE_API_WS_URL=ws://localhost:8091/live`

## Validation Commands

1. Unit tests:

```bash
npm run test:unit
```

2. Build:

```bash
npm run build
```

3. Release gate:

```bash
npm run verify:release
```

4. Strict release gate:

```bash
npm run verify:release:strict
```
