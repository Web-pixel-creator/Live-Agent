# Infrastructure Starter

Infrastructure is intentionally lightweight in this scaffold.

## Target Deployment

1. Cloud Run:
   - `realtime-gateway`
   - `api-backend`
   - optional custom orchestrator runtime
2. Vertex AI Agent Engine:
   - ADK orchestration runtime
3. Firestore:
   - sessions/events/runs/traces/approvals
4. Cloud Storage:
   - media artifacts with signed URL access
5. Cloud Monitoring + Cloud Logging:
   - latency/error dashboards and alerts

## Next Infra Steps

1. Add IaC templates (Terraform or Deployment Manager).
2. Add CI/CD with environment promotion (dev/staging/prod).
3. Add production hardening for private ingress, VPC, and per-secret IAM scope.

## Baseline Artifacts Included

1. `infra/gcp/bootstrap.ps1`
   - Enables required APIs.
   - Creates service accounts.
   - Applies baseline IAM roles.
   - Creates core secrets in Secret Manager.
2. `infra/firestore/firestore.indexes.json`
   - Composite indexes for sessions/events/runs/logs/assets.
   - Field overrides with TTL on `expireAt`.
3. `infra/firestore/apply.ps1`
   - Applies indexes and TTL policies using `gcloud`.
