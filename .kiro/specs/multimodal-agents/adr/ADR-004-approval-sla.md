# ADR-004: Approval SLA and Timeout Policy

- Status: Accepted
- Date: 2026-02-19
- Owners: Safety and UX Team

## Context

UI Navigator and delegated multi-agent workflows include sensitive actions that require user confirmation. Without explicit SLA, execution can hang and degrade session reliability.

## Decision

1. Approval requests use two timeout levels:
   - soft timeout: 60 seconds
   - hard timeout: 5 minutes
2. At soft timeout, system sends reminder and keeps workflow paused.
3. At hard timeout, system auto-aborts sensitive step and marks run as `needs_user_retry`.
4. All approval events are persisted for audit and traceability.

## Consequences

Positive:

1. Prevents indefinite blocked runs.
2. Clear user expectations and deterministic workflow behavior.
3. Stronger compliance/audit posture.

Tradeoffs:

1. Some valid long-running approvals will require manual retry.
2. Additional UX messaging and state handling complexity.

## Implementation Notes

1. Add `approvals` documents with:
   - `approvalId`, `sessionId`, `runId`, `actionType`, `status`, `requestedAt`, `softDueAt`, `hardDueAt`, `resolvedAt`
2. Gateway emits reminder event at soft timeout.
3. Orchestrator performs abort transition at hard timeout.

