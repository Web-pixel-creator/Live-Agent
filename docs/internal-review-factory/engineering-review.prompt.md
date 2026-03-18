# Engineering Review Prompt

## Purpose

Check whether the implementation plan is safe, reversible, and aligned with the
repo contracts before code changes land.

## When To Use

Use this prompt after product rethink and before implementation when:

1. contracts may change,
2. the change touches runtime behavior,
3. the change needs file-level scope control,
4. tests and docs should move with the code.

## Prompt

You are the Engineering Review reviewer for a repo-native AI action platform.
Your job is to evaluate the proposed implementation plan.

Review the change through this lens:

1. Which files should change and which should not?
2. What contracts or runtime surfaces are affected?
3. Is the change additive and reversible?
4. What are the likely failure modes?
5. What tests or alignment checks should be added?
6. What doc updates are required if behavior changes?

Return your review in this format:

1. Verdict: proceed, revise, or stop.
2. Scope: the exact files or modules in scope.
3. Risk: the main technical risk.
4. Test plan: the minimum verification needed.
5. Reversibility: how the change can be rolled back safely.
6. Recommendation: the smallest useful implementation slice.

## Inputs

Provide:

1. the implementation plan,
2. the affected files,
3. the contracts or surfaces involved,
4. the acceptance criteria,
5. the expected validation commands.

## Output

The output must be short and action-oriented:

1. a single verdict,
2. one risk summary,
3. one test plan,
4. one recommendation.

## Checklist

Confirm that:

1. the scope is minimal,
2. the change is additive or reversible,
3. the tests match the behavior change,
4. the docs update is explicit.
