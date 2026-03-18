# Internal Review Factory

This folder contains repo-usable internal review assets for contributors.
It is not a customer feature. It is the workflow we use before and after
implementation to keep product, engineering, QA, and release docs aligned.

## Workflow

Use the prompts in this order:

1. `product-rethink.prompt.md`
2. `engineering-review.prompt.md`
3. `qa-review.prompt.md`
4. `release-doc-update.prompt.md`

## When To Use

Use the factory when a change:

1. changes the buyer story or product wedge,
2. changes execution behavior or contracts,
3. adds or modifies QA-sensitive paths,
4. changes release-facing docs or evidence.

## Output Contract

Each prompt should produce:

1. a short verdict,
2. the main risk,
3. the recommended next action,
4. a checklist of follow-up items.

## Usage

1. Open the relevant prompt file.
2. Paste the prompt body into the model or reuse it as a review brief.
3. Record the verdict in the PR or task thread.
4. Run the validation script before merging prompt-pack changes.

## Validation

Run:

```powershell
node scripts/internal-review-factory-check.mjs
```

The script verifies:

1. the role is registered in `docs/worker-roles.md`,
2. the prompt pack files exist,
3. the prompt pack keeps the expected section shape.
