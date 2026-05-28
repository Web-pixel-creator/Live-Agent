# hello-friend Parity Audit

This document records the current parity status between the imported
`hello-friend` design shell and the repo-owned app shell in
`apps/demo-frontend/app-shell`.

The goal is not byte-for-byte sameness. The goal is:

1. keep the primary product IA and layout aligned `1:1`
2. keep repo-owned runtime, compliance, and evidence depth working on top of
   that shell
3. make every intentional divergence explicit

## Primary Route Parity

Route parity status:

1. `/app` -> matches the `hello-friend` primary `Live Desk` shell
2. `/app/console` -> matches the `hello-friend` approval-first `Operator Console`
3. `/app/simulation` -> matches the `hello-friend` `Simulation Lab`
4. `/app/nodes` -> matches the `hello-friend` `Device Nodes`
5. `/bundle/:id` -> matches the `hello-friend` judge-facing bundle surface
6. `/evidence/:id` -> matches the `hello-friend` evidence viewer surface

Primary sidebar routing also matches `hello-friend`:

1. `Live activity` -> `/app`
2. `Connections` -> `/app/nodes`
3. `Action queue` -> `/app/console`
4. `Safety rules` -> `/app/simulation`
5. `Health check` -> `/app/nodes`

## Intentional Divergences

These differences are deliberate and should stay documented:

1. `/` redirects to `/app`
   - `hello-friend` used `/` as the landing route
   - this repo uses `/app` as the primary product shell and keeps `/` as a
     redirect for clarity

2. `WorkspaceRuntimeProvider` wraps the app shell
   - needed to hydrate repo-owned runtime, governance, queue, node, replay, and
     evidence data

3. `/app/console/runtime` exists only in this repo
   - it is a secondary/internal support route
   - it keeps `Case Wiki`, `Session Boundary`, `Session Ops`, and runtime
     diagnostics out of the main approval-first console layout

4. runtime-aware helper libraries exist only in this repo
   - they bind the imported shell to repo-owned APIs, replay, governance, and
     evidence lanes

## Files Present Only In This Repo

Extra pages:

1. `apps/demo-frontend/app-shell/src/pages/ConsoleRuntime.tsx`

Extra workspace support components:

1. `apps/demo-frontend/app-shell/src/components/workspace/CaseWikiPanel.tsx`
2. `apps/demo-frontend/app-shell/src/components/workspace/SessionBoundaryPanel.tsx`
3. `apps/demo-frontend/app-shell/src/components/workspace/SessionOpsPanel.tsx`
4. `apps/demo-frontend/app-shell/src/components/workspace/RuntimeDiagnosticsPanels.tsx`

These are acceptable only because they live outside the primary `hello-friend`
console flow.

## Current Verdict

The app shell is in parity where it matters:

1. primary IA
2. primary routes
3. primary sidebar behavior
4. operator-first console layout
5. bundle and evidence surfaces

The remaining differences are repo-owned runtime integrations and one internal
support route, not shell drift.
