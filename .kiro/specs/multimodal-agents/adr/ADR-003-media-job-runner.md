# ADR-003: Long-Running Media Job Runner

- Status: Accepted
- Date: 2026-02-19
- Owners: Story Platform Team

## Context

Imagen/Veo generation can exceed synchronous request budgets. Blocking user-facing request handlers increases timeout risk and degrades realtime UX.

## Decision

1. Introduce asynchronous media job execution in M2 (not deferred beyond M2).
2. Story generation requests create `media_jobs` records and enqueue background work.
3. Worker runtime executes media jobs and reports progress/final status through Firestore events.
4. Frontend receives placeholder/pending timeline entries until assets are ready.

## Consequences

Positive:

1. Eliminates long-tail API timeouts from synchronous flows.
2. Allows retries/backoff and per-model quota handling.
3. Keeps interactive storytelling responsive.

Tradeoffs:

1. Adds queue/worker operational complexity.
2. Requires idempotency and dedupe logic for retries.

## Implementation Notes

1. `media_jobs` schema fields:
   - `jobId`, `sessionId`, `runId`, `type`, `status`, `attempt`, `errorCode`, `createdAt`, `updatedAt`
2. Suggested runtime:
   - Cloud Run worker service + scheduler/queue trigger
3. Retry policy:
   - exponential backoff, max 3 attempts by default

