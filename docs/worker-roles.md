# Worker Roles

This document is the repo-native split of the product backlog into subagent-like
roles. It keeps the P0, P1, and P2 queue actionable without requiring a single
generalist agent to carry the whole plan.

## P0 Roles

### Playbook Architect

Owns:

- `P0.7 Vertical Playbooks`
- bundled `SKILL.md` playbooks
- `configs/skills.catalog.json` persona and recipe wiring

Deliverables:

- lead qualification playbook
- consultation booking playbook
- document collection playbook
- catalog readiness overlay for the new playbooks

### Eval Plane Engineer

Owns:

- `P0.8 Promptfoo Eval Plane`
- `configs/evals/*`
- eval runner scripts
- package.json eval commands

Deliverables:

- translation eval suite
- negotiation eval suite
- research eval suite
- UI safety eval suite
- release gate entry point for workflow quality regressions

### Red Team Guardian

Owns:

- `P0.9 Red-Team Bundle`
- adversarial eval configs
- safety-focused scoring rules

Deliverables:

- secret-extraction tests
- destructive-action tests
- approval-bypass tests
- prompt-injection tests

## P1 Roles

### Simulation Lab Curator

Owns:

- storyteller scenario expansion
- rehearsal prompts
- synthetic support and sales flows

Deliverables:

- sales rehearsal packs
- booking rehearsal packs
- document collection rehearsal packs

### Operator Review Steward

Owns:

- stage-aware operator summaries
- doc drift checks
- internal review prompts

Deliverables:

- operator-friendly summaries
- internal QA/review templates
- better evidence handoff

### Internal Review Factory Lead

Owns:

- `P1.4 Internal Review Factory`
- `docs/internal-review-factory/`
- `scripts/internal-review-factory-check.mjs`

Deliverables:

- product rethink prompt pack
- engineering review prompt pack
- QA review prompt pack
- release doc update prompt pack
- repo-native validation script for the prompt pack

## P2 Roles

### Expansion Planner

Owns:

- channel expansion
- partner skill packaging
- local-first runtime exploration

Deliverables:

- channel adapters
- managed skill bundles
- privacy and cost posture experiments
