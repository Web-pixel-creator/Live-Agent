# Product Master Plan

This document is the durable product and implementation plan for the platform.
It is intended to be the single place to revisit when product scope, technical
priorities, or rollout order become unclear.

Companion execution backlog:

- `docs/product-backlog.md`

## North Star

Build and sell one clear product:

`AI Action Desk`

An agent that can talk to users, translate, understand requests, safely act in
web systems, ask for approval when risk is present, and leave auditable proof of
what happened.

This repo should not drift toward "general AI platform for everything". The
product wedge is:

1. live multilingual interaction,
2. browser and workflow execution,
3. approvals and auditability,
4. vertical playbooks for service teams.

## Target Customer

Primary wedge:

1. cross-border service businesses,
2. travel and concierge sales,
3. relocation and visa agencies,
4. medical tourism and clinic intake,
5. admissions and education consultancies.

Why this wedge:

1. many repetitive requests,
2. multilingual workflows,
3. expensive lost leads,
4. legacy browser-based systems,
5. high value in faster response and safer task execution.

## Product Shape

The product should be explained as one system:

1. `Live Agent` is the customer-facing conversation layer.
2. `UI Navigator` is the execution layer that performs work in systems.
3. `Approval and Audit` is the business trust layer.
4. `Simulation Lab` is the internal training and scenario layer.

`Creative Storyteller` should remain in the product, but it should evolve into a
`Simulation Lab` role instead of being treated as the primary commercial wedge.

## What Stays In Focus

Keep these five modules as the product center:

1. `Live Desk`
   - user intake,
   - translation,
   - negotiation,
   - guided conversation,
   - handoff into downstream work.

2. `Action Runner`
   - browser and system execution,
   - resumable jobs,
   - verified outcomes,
   - replay artifacts.

3. `Approval and Audit`
   - human-in-the-loop control,
   - action trace,
   - operator review,
   - compliance-friendly evidence.

4. `Vertical Playbooks`
   - productized workflows for specific industries and roles.

5. `Simulation Lab`
   - synthetic customer scenarios,
   - negotiation rehearsal,
   - onboarding practice,
   - support training,
   - pre-release scenario testing.

## What Leaves Center Stage

These areas stay in the repo but should not be the main commercial message:

1. storyteller as a standalone creative toy,
2. grounded research as a standalone main product,
3. generic "multi-agent platform for all industries".

## External Patterns To Adopt

### From gstack

Adopt:

1. role-based workflow instead of one generic agent,
2. readiness gates before execution,
3. persistent browser daemon and stable refs,
4. QA loop with re-verification,
5. source-driven docs where possible,
6. multi-tier evals.

Do not adopt:

1. developer-only slash-command UX as the customer product,
2. internal workflow language as public product messaging.

### From OpenAI CUA sample app

Adopt:

1. isolated run workspaces,
2. replay bundles,
3. operator-readable artifacts,
4. scenario manifests for computer-use tasks.

### From promptfoo

Adopt:

1. prompt and agent eval matrices,
2. red-team suites,
3. model comparison by workflow,
4. CI-grade quality gates for prompts and agents.

### From deer-flow

Adopt:

1. skills plus memory plus subagent discipline,
2. long-running task mindset,
3. sandbox-aware execution.

### From agency-agents

Adopt:

1. productized roles,
2. playbooks that map to recognizable jobs,
3. better role packaging for go-to-market.

### From MiroFish

Adopt:

1. scenario sandbox thinking,
2. simulation as a differentiator,
3. stronger narrative packaging.

Do not adopt:

1. "predict anything" product positioning,
2. simulation as the main revenue wedge.

### From nanochat and autoresearch

Adopt:

1. one target metric at a time,
2. fixed-budget experimental loops,
3. keep or discard decisions,
4. nightly improvement runs.

### From OpenClaw and OpenJarvis

Adopt:

1. assistant-first product framing,
2. cost and latency awareness,
3. personal and channel-aware future packaging.

Do not adopt now:

1. a full consumer local-first pivot,
2. a personal assistant strategy as the primary market wedge.

## Technical Blueprint

The next version of the platform should be built around four layers.

### Layer A: Action Runtime

Goal:

Create a reliable, replayable, approval-aware task execution layer.

Primary repo targets:

1. `apps/ui-executor/src/index.ts`
2. `apps/ui-executor/src/browser-jobs.ts`
3. `apps/ui-executor/src/grounding.ts`
4. `apps/ui-executor/src/sandbox-policy.ts`
5. `agents/ui-navigator-agent/src/index.ts`

Required additions:

1. persistent browser session support,
2. stable element refs plus stale-ref detection,
3. post-action verification step,
4. replay bundle generation,
5. explicit execution modes:
   - code-first browser execution,
   - model-assisted fallback,
6. better error classes for:
   - not grounded,
   - stale ref,
   - unsafe action,
   - verification failed,
   - approval required.

Definition of done:

Every browser task produces:

1. plan,
2. step trace,
3. verification result,
4. approval state,
5. replay artifact.

### Layer B: Role Graph

Goal:

Turn the platform from one broad assistant into a staged execution system.

Primary repo targets:

1. `agents/orchestrator/src/orchestrate.ts`
2. `agents/orchestrator/src/router.ts`
3. `agents/orchestrator/src/assistive-router.ts`
4. `agents/orchestrator/src/workflow-store.ts`
5. `shared/skills`

Required roles:

1. `Intake Agent`
2. `Planner Agent`
3. `Safety Agent`
4. `Runner Agent`
5. `Verifier Agent`
6. `Reporter Agent`

Definition of done:

Every important run has:

1. a current role,
2. a current stage,
3. a visible escalation reason,
4. a visible approval boundary,
5. a visible verification result.

### Layer C: Eval Plane

Goal:

Make the product measurable, comparable, and releasable.

Primary repo targets:

1. `tests/unit`
2. `scripts/demo-e2e.ps1`
3. `scripts/demo-e2e-policy-check.mjs`
4. `scripts/release-readiness.ps1`
5. new eval config folder for prompt and agent testing

Required additions:

1. promptfoo configs for:
   - translation,
   - negotiation,
   - research,
   - UI safety,
   - approval correctness,
2. red-team suites for:
   - prompt injection,
   - data exfiltration,
   - destructive requests,
   - unsafe browser actions,
3. model comparison by workflow,
4. nightly keep-or-discard tuning loop.

Definition of done:

Release quality is not accepted on build and unit tests alone. A release must
meet workflow quality thresholds.

### Layer D: Simulation Lab

Goal:

Transform the storyteller lane into a business-facing training and rehearsal
system.

Primary repo targets:

1. `agents/storyteller-agent/src/index.ts`
2. `agents/storyteller-agent/src/media-jobs.ts`
3. `agents/storyteller-agent/src/story-cache.ts`
4. `tests/unit/storyteller-*`

Required additions:

1. sales rehearsal scenarios,
2. support rehearsal scenarios,
3. onboarding simulations,
4. negotiation drills,
5. synthetic multilingual customer dialogues.

Definition of done:

The storyteller lane can generate useful operational simulations instead of
being framed only as a creative media lane.

## Product Requirements For 2026 Revenue

To aim at meaningful revenue, the product should ship three clear business
playbooks first.

### Playbook 1: Lead Qualification

Flow:

1. user message or call arrives,
2. live agent responds in the right language,
3. captures structured intent and urgency,
4. creates or updates the lead in a system,
5. asks for operator approval only if needed.

### Playbook 2: Appointment or Consultation Booking

Flow:

1. user asks for time or availability,
2. agent clarifies language and constraints,
3. agent proposes options,
4. agent books or stages the appointment,
5. operator gets evidence and can override.

### Playbook 3: Document or Form Collection

Flow:

1. agent requests the required information,
2. agent tracks what is missing,
3. agent fills or stages browser forms,
4. agent asks for approval before sensitive submission,
5. agent verifies final success.

## Backlog

### P0 - Commercial Wedge

These are mandatory before broad expansion.

1. Rewrite product narrative around `AI Action Desk`.
2. Choose one first market segment.
3. Productize three vertical playbooks.
4. Make `Live + Actions + Approval` the core demo path.
5. Keep storyteller in product, but reposition it as `Simulation Lab`.

### P0 - Runtime Reliability

1. Add persistent browser runtime in `ui-executor`.
2. Add stable refs and stale-ref validation.
3. Add explicit verification after every meaningful UI action.
4. Emit replay artifacts for every browser job.
5. Add stage-aware failure codes and recovery actions.

### P0 - Quality Gates

1. Add promptfoo evaluation configs.
2. Add red-team scenarios for UI and prompt safety.
3. Add workflow quality thresholds to release readiness.
4. Add provider comparison runs for critical workflows.

### P1 - Role Graph

1. Refactor orchestrator state around explicit roles and stages.
2. Expose stage state in operator summary.
3. Add reporter summaries that are user-safe and operator-safe.
4. Improve skill and persona packaging for playbooks.

### P1 - Simulation Lab

1. Add support and sales rehearsal packs.
2. Add multilingual synthetic scenario generation.
3. Add evaluation hooks that compare playbook variants.
4. Reuse simulation output to improve prompts and workflows.

### P1 - Internal Factory

1. Add internal CEO review prompt.
2. Add internal engineering review prompt.
3. Add internal design review prompt.
4. Add internal QA regression loop.
5. Add automatic doc-drift checks for release-impacting changes.

### P2 - Expansion

1. Channel-specific assistants for more entry points.
2. Local-first or privacy-first runtime profile improvements.
3. Broader marketplace for managed skills and partner plugins.
4. More expressive simulation and training surfaces.

## 90-Day Rollout

### Days 1-30

1. lock market wedge,
2. lock product language,
3. ship three playbooks,
4. implement persistent browser runtime,
5. implement ref and verification system.

### Days 31-60

1. implement role graph,
2. implement promptfoo plus red-team plane,
3. upgrade operator surfaces to stage-aware execution,
4. convert storyteller into simulation-first mode.

### Days 61-90

1. run pilot customers,
2. measure real completion and savings,
3. tighten pricing,
4. publish case studies,
5. ship v1 for one market instead of a generic platform.

## Metrics

If these metrics are not tracked, the product is not yet serious:

1. task completion rate,
2. approval precision,
3. manual takeover rate,
4. time to first meaningful action,
5. lead response speed,
6. browser task verification success rate,
7. translation usefulness,
8. negotiation correctness,
9. operator time saved,
10. replay-debug time reduction.

## What Not To Do

Do not spend the next cycle on:

1. training your own foundation model,
2. rewriting the stack in a new language,
3. building a generic "super agent for everything",
4. expanding into many industries at once,
5. treating storyteller as the main revenue wedge,
6. shipping features without evals and verification.

## Immediate Next Decisions

When revisiting this document, answer these first:

1. What is the one market segment we are serving first?
2. What are the three primary playbooks for that segment?
3. Is the current sprint improving `Live`, `Action Runner`, `Approval`, or `Simulation Lab`?
4. Does the work improve measurable task success or just add surface area?
5. Does the change move the product toward `AI Action Desk`, or away from it?

## Revision Rule

This document should be updated whenever one of these changes:

1. primary target market,
2. main product wedge,
3. playbook set,
4. runtime execution model,
5. release quality bar.
