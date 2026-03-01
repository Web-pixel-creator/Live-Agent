# Managed Skill Signing Example

## Purpose

End-to-end flow for publishing a managed skill with plugin permissions and HMAC signature verification (`hmac-sha256`).

## Prerequisites

1. API backend is running (`http://localhost:8081` by default).
2. Register trusted signing keys in API backend:

```bash
export SKILL_PLUGIN_SIGNING_KEYS_JSON='{"demo-key":"replace-with-strong-secret"}'
```

PowerShell:

```powershell
$env:SKILL_PLUGIN_SIGNING_KEYS_JSON='{"demo-key":"replace-with-strong-secret"}'
```

## 1) Prepare signing input

Sample input file:

`skills/workspace/calendar-assistant/managed-skill-signing-input.sample.json`

Important: signature is computed from **canonical payload hash** that includes:

1. `skillId`
2. `name`
3. `prompt`
4. `scope`
5. `trustLevel`
6. `publisher`
7. `checksum`
8. `permissions`

Do not sign only `permissions`, otherwise API will return `API_SKILL_PLUGIN_SIGNATURE_INVALID`.

## 2) Generate signature with helper script

```bash
npm run skills:plugin:sign -- \
  --input skills/workspace/calendar-assistant/managed-skill-signing-input.sample.json \
  --secret replace-with-strong-secret \
  --output artifacts/skills/calendar-managed-demo-signature.json
```

PowerShell:

```powershell
npm run skills:plugin:sign -- `
  --input skills/workspace/calendar-assistant/managed-skill-signing-input.sample.json `
  --secret replace-with-strong-secret `
  --output artifacts/skills/calendar-managed-demo-signature.json
```

Output contains:

1. `payloadSha256`
2. `signature`
3. `pluginManifest` with `permissions` + `signing` payload

## 3) Upsert managed skill

Use template:

`skills/workspace/calendar-assistant/managed-skill-upsert.sample.json`

Replace `pluginManifest.signing.signature` with generated signature.

```bash
curl -X POST "http://localhost:8081/v1/skills/registry" \
  -H "content-type: application/json" \
  -H "x-operator-role: admin" \
  -d @skills/workspace/calendar-assistant/managed-skill-upsert.sample.json
```

## 4) Verify detail + updates history

```bash
curl "http://localhost:8081/v1/skills/registry/calendar-managed-demo" -H "x-operator-role: operator"
curl "http://localhost:8081/v1/skills/registry/calendar-managed-demo/updates" -H "x-operator-role: operator"
```

Expected success:

1. `data.skill.pluginManifest.signing.status = "verified"`
2. `data.skill.pluginManifest.signing.payloadSha256` is populated
3. Operator summary (`GET /v1/operator/summary`) includes `skillsRegistryLifecycle` evidence

## Common Errors

1. `API_SKILL_PLUGIN_SIGNATURE_REQUIRED`: signature required but missing.
2. `API_SKILL_PLUGIN_SIGNATURE_INVALID`: signature does not match canonical payload hash.
3. `API_SKILL_PLUGIN_PERMISSION_INVALID`: permission is outside allowlist.
4. `API_SKILL_PLUGIN_SIGNING_KEY_NOT_FOUND`: `keyId` is not in `SKILL_PLUGIN_SIGNING_KEYS_JSON`.
5. `API_SKILL_REGISTRY_VERSION_CONFLICT`: stale `version` on update.
