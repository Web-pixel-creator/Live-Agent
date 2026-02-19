# ADR-001: Media Storage Baseline for MVP

- Status: Accepted
- Date: 2026-02-19
- Owners: Platform Team

## Context

Creative Storyteller and UI Navigator produce media artifacts (images, videos, screenshots, audio) that are too large for Firestore documents. MVP needs reliable storage, controlled access, and retention support.

## Decision

1. Firestore stores media metadata and references only.
2. Binary media is stored in a dedicated Google Cloud Storage bucket from MVP day one.
3. Access to media is issued via short-lived signed URLs.
4. Raw and intermediate media retention is policy-based with lifecycle rules.

## Consequences

Positive:

1. Scales for large media artifacts.
2. Clear separation between transactional metadata and binary assets.
3. Simplifies retention and access control.

Tradeoffs:

1. Adds one extra service dependency and signed URL workflow.
2. Requires explicit media GC/lifecycle configuration.

## Implementation Notes

1. Add `story_assets` and `ui_traces` docs with `gs://` object refs.
2. Bucket naming: `mla-media-{env}-{region}`.
3. Signed URL TTL default: 15 minutes.
4. Lifecycle:
   - raw/intermediate objects: 7 days
   - approved final assets: 30 days (or policy override)

