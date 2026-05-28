# External Adoption Priorities

This document records which external projects are worth adopting into the
repo-owned `AI Action Desk` roadmap and which ones are not on the current
critical path.

Use this document together with `AGENTS.md`, `README.md`, and
`docs/product-master-plan.md`.

## Decision Filter

Adopt an external project only if it does at least one of the following:

1. improves qualification, booking, document chase, or CRM handoff
2. reduces operator manual work or debugging time
3. strengthens repo-owned evidence, replay, compliance, or safe execution
4. fits the current architecture without turning the product into a general AI
   platform

If it fails that filter, keep it out of the current critical path.

## Adopt Now

### Euphony

Source:

- <https://github.com/openai/euphony>

Why it matters:

1. it already visualizes Harmony conversations and Codex session JSONL in the
   browser
2. it supports local files, public URLs, metadata inspection, filtering, and
   reusable web components
3. it fits our need for internal replay, judge artifact, and evidence
   inspection better than building another raw-log viewer from scratch

Recommended use here:

1. add an internal replay / evidence debug viewer
2. use it for `session replay`, `judge artifacts`, and structured export
   inspection
3. keep it as an internal support surface, not a customer-facing wedge feature

### Rowboat Ideas

Source:

- <https://github.com/rowboatlabs/rowboat>

Why it matters:

1. it keeps memory as local, inspectable plain Markdown with backlinks
2. it treats accumulated context as a durable knowledge graph instead of
   transient retrieval
3. that maps cleanly to our `Case Wiki` moat

Recommended use here:

1. project `Case Wiki` into an inspectable `Case Vault`
2. keep case memory editable, inspectable, and handoff-friendly
3. use the idea, not the whole product

## Later Infrastructure Spikes

### CubeSandbox

Source:

- <https://github.com/TencentCloud/CubeSandbox>

Why it matters:

1. it is built for instant, concurrent, secure sandboxing for AI agents
2. it emphasizes hardware-level isolation, high density, and E2B compatibility
3. it is relevant to our future `ui-executor` / browser-worker safety layer

Recommended use here:

1. evaluate it as an optional sandbox backend for untrusted code and browser
   execution
2. keep it out of the immediate product shell work
3. treat it as a backend spike, not a UI feature

### MiniMax-M2.7

Source:

- <https://huggingface.co/MiniMaxAI/MiniMax-M2.7>

Why it matters:

1. it is a strong large model with tool-calling and engineering benchmark
   claims
2. it could be relevant for batch replay, eval, or simulation workloads

Why it is not primary now:

1. it is too heavy for the current live wedge
2. it does not solve our immediate product-shaping or runtime-debugging gaps
3. model-portfolio expansion is currently frozen unless it directly improves
   the immigration wedge

Recommended use here:

1. optional later backend for `Simulation Lab` or offline evaluation
2. not for the main live operator path

## Methodology Only

### agents-md

Source:

- <https://github.com/TheRealSeanDonahoe/agents-md>

Why it matters:

1. it provides direct anti-fabrication, anti-fluff, and verification-first
   operating discipline
2. it is useful as a behavioral overlay for coding agents

Recommended use here:

1. fold the useful rules into our repo-owned `AGENTS.md`
2. do not treat it as a runtime dependency

### Andrej Karpathy Skills

Source:

- local reference in `andrej-karpathy-skills-main`

Why it matters:

1. it reinforces think-before-coding, simplicity-first, surgical changes, and
   goal-driven execution
2. it helps reduce unnecessary complexity in repo changes

Recommended use here:

1. keep it as methodology only
2. use it to shape implementation style, not product scope

### obra/superpowers

Source:

- <https://github.com/obra/superpowers>

Why it matters:

1. it is a strong software-development methodology for coding agents
2. it is useful for planning, task decomposition, and verification discipline

Recommended use here:

1. borrow engineering workflow ideas
2. do not import it as a product feature or as a reason to broaden scope

## Not On Critical Path

### OpenMythos

Source:

- <https://github.com/kyegomez/OpenMythos>

Why it is out of scope now:

1. it is a theoretical reconstruction and research-heavy project
2. it does not directly strengthen the current immigration wedge
3. it would increase conceptual breadth without improving operator outcomes

Recommended use here:

1. none for the current roadmap

## Recommended Execution Order

1. finish `hello-friend` parity and keep the primary shell clean
2. add an internal `Euphony`-style replay / evidence viewer
3. define a `Case Wiki` to `Case Vault` projection inspired by `Rowboat`
4. spike `CubeSandbox` only when secure execution becomes the next real blocker
