# Contributing

Thanks for contributing to `Live-Agent`.

## Prerequisites

1. Node.js `24.x`
2. npm `10+`
3. PowerShell `7+` (scripts use `.ps1`)

## Local Setup

```bash
npm install
```

Run baseline services (separate terminals):

```bash
npm run dev:orchestrator
npm run dev:api
npm run dev:gateway
npm run dev:ui-executor
npm run dev:frontend
```

Optional local realtime mock (no cloud keys):

```bash
npm run dev:live-mock
```

## Quality Gates

Before opening a PR, run:

```bash
npm run test:unit
npm run build
```

For full demo/release gate:

```bash
npm run verify:release
```

Strict final gate (zero retry usage in demo policy):

```bash
npm run verify:release:strict
```

## Pull Requests

1. Keep changes scoped to one concern.
2. Update docs when behavior/contracts change (`README.md`, `docs/*`, `.kiro/specs/*`).
3. Add or update tests for every behavior change.
4. Preserve protocol and error contracts in `docs/ws-protocol.md`.

## Commit Style

Use clear imperative messages, for example:

- `add managed skill signing validation`
- `refactor strict workflow evidence source`

## Security Notes

1. Never commit secrets/tokens.
2. Use `.env.example` as the source of env variable names.
3. Prefer local-first/mock flows for development without production credentials.
