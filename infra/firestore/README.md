# Firestore Baseline (Schemas, Indexes, TTL)

This folder defines the Day-1 Firestore baseline for:

1. Collections:
   - `sessions`
   - `events`
   - `agent_runs`
   - `negotiation_logs`
   - `story_assets`
2. Composite indexes required by query paths.
3. TTL configuration on `expireAt` for retention control.

## Files

- `firestore.indexes.json` - composite indexes + field overrides with TTL.
- `firestore.rules` - deny-by-default client rules (server uses IAM).
- `apply.ps1` - optional helper script to apply indexes and TTL with `gcloud`.

## Apply With gcloud

```powershell
pwsh ./infra/firestore/apply.ps1 -ProjectId "<your-project-id>"
```

Optional:

- `-Database "(default)"` (default)

## Retention Defaults (from runtime env)

- `FIRESTORE_EVENT_RETENTION_DAYS=14`
- `FIRESTORE_SESSION_RETENTION_DAYS=90`
- `FIRESTORE_RUN_RETENTION_DAYS=30`
- `FIRESTORE_NEGOTIATION_RETENTION_DAYS=365`
- `FIRESTORE_STORY_ASSET_RETENTION_DAYS=30`

The orchestrator writes `expireAt` values based on these settings.
