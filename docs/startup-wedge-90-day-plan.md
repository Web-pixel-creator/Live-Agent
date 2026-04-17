# Startup Wedge 90-Day Plan

This document turns the current repo into one commercially narrow operating
plan.

Use it when product, founder, or engineering decisions start drifting back
toward a broad "multimodal agent platform" narrative.

Primary strategy documents:

1. `docs/product-master-plan.md`
2. `docs/product-backlog.md`

## One-Sentence Product

`AI Action Desk is an operator-safe intake and workflow runner for immigration teams that qualifies leads, books consultations, follows up on missing documents, and prepares CRM or human handoff actions with approval and audit trails.`

## Primary ICP

Start with one customer profile:

1. immigration firms,
2. visa agencies,
3. relocation teams with immigration-heavy intake,
4. teams with 3-30 operators,
5. teams losing time on repetitive lead qualification and follow-up.

Do not expand the primary ICP yet to:

1. medical tourism,
2. admissions,
3. generic concierge,
4. "all multilingual service businesses".

## Product Scope Now

Sell exactly three playbooks:

1. lead qualification,
2. consultation booking,
3. missing-document follow-up.

Support them with two closing actions:

1. CRM update preparation,
2. human escalation / handoff.

Everything else is secondary unless it clearly improves those five outcomes.

## Product Boundary

The product is an operations tool, not a legal advisor.

Allowed:

1. intake,
2. triage,
3. consultation scheduling,
4. document chase,
5. CRM updates,
6. operator-approved admin actions,
7. explicit human handoff.

Do not position or ship as:

1. legal advice,
2. final eligibility determination,
3. autonomous filing,
4. autonomous case strategy,
5. a replacement for a licensed professional.

## Keep, Freeze, Internal-Only

Keep as product center:

1. `Live Agent` for multilingual intake and follow-up,
2. `Case Wiki` as compiled case memory,
3. `UI Navigator` for narrow repeatable admin actions,
4. `Approval and Audit`,
5. `Operator Queue` and handoff surfaces.

Freeze as non-critical for the next 90 days:

1. new broad verticals,
2. provider-portfolio expansion beyond what current runtime proof requires,
3. safe self-improvement work,
4. broad research-assistant positioning,
5. new generic browser-agent claims.

Keep internal-only or secondary in messaging:

1. `Storyteller`,
2. `Simulation Lab`,
3. challenge-category framing,
4. multimodal depth for its own sake,
5. "multi-agent platform" language.

## Definition of Proof

The wedge is only validated when it improves at least one of these with real
usage evidence:

1. more leads moved to booked consultation,
2. fewer operator minutes per intake,
3. higher missing-document recovery rate,
4. faster clean CRM or human handoff.

Technical breadth without movement in those outcomes is not wedge proof.

## Kill Criteria

Do not move work into the current quarter critical path if:

1. it does not improve qualification, booking, document chase, or handoff,
2. it does not help the immigration ICP directly,
3. it does not reduce operator work,
4. a simpler version would solve the same buyer problem.

If those conditions fail, defer the work even if it is technically attractive.

## Do Not Build Now

Avoid these as current-quarter priorities:

1. a generic multimodal agent platform pitch,
2. new vertical product lines,
3. autonomous legal reasoning features,
4. broad browser automation for arbitrary sites,
5. self-improvement or model-portfolio work without workflow payoff,
6. voice/video richness as the headline product story.

## 90-Day Execution

### Days 1-14

Goal:

Confirm the wedge with real buyers and sharpen the product promise.

Required work:

1. talk to 10-15 immigration firms or visa agencies,
2. validate the costliest repetitive workflows,
3. collect exact wording buyers use for:
   - lead qualification,
   - booking,
   - missing-document chase,
   - CRM handoff,
4. confirm which systems they already use:
   - CRM,
   - email,
   - calendars,
   - spreadsheets,
   - browser portals.

Output:

1. one ICP memo,
2. one pains-ranked list,
3. one pricing hypothesis,
4. one no-go list of features that buyers do not care about now.

### Days 15-30

Goal:

Ship a concierge MVP for one narrow workflow loop.

Required work:

1. intake via web chat, email, or operator-led live flow,
2. structured lead summary,
3. operator approval before external action,
4. manual or semi-manual booking path,
5. first missing-document follow-up template,
6. clean CRM-ready or handoff-ready summary.

Output:

1. one end-to-end pilot flow,
2. one repeatable demo,
3. one operator handoff packet.

### Days 31-60

Goal:

Turn concierge behavior into a productized operator desk.

Required work:

1. shared inbox / active queue workflow,
2. playbook-specific case state,
3. stronger operator queue priorities,
4. deterministic handoff and CRM update payloads,
5. better evidence, audit, and export posture,
6. narrow UI automation for one or two repeatable admin tasks.

Output:

1. one productized intake flow,
2. one productized booking flow,
3. one productized document-chase flow.

### Days 61-90

Goal:

Prove one repeatable value metric with real usage.

Required work:

1. deploy with 1-3 design partners,
2. measure operator time saved,
3. measure booked consultations,
4. measure missing-document recovery,
5. measure how often human handoff is cleaner or faster.

Output:

1. one case-study-quality proof pack,
2. one wedge KPI dashboard,
3. one buyer-ready ROI story.

## First Metrics

Do not optimize for model vanity metrics first.

Primary metrics:

1. percentage of leads moved to booked consultation,
2. operator minutes saved per intake,
3. percentage of missing-document follow-ups completed,
4. time from first contact to clean handoff,
5. operator touches per case.

Secondary metrics:

1. approval rate,
2. export-ready compliance rate,
3. navigator success rate on narrow admin actions,
4. fallback rate from direct live to relay.

## Decision Filters

Use these filters before starting work:

1. Does this improve qualification, booking, document chase, CRM update, or handoff?
2. Does this help the primary ICP right now?
3. Does this shorten manual operator work?
4. Can this be shown in one clear buyer demo?
5. Would a simpler version solve the same problem?

If the answer is "no" to the first three questions, defer it.

## Repo Translation

Translate the current repo into this operating model:

1. `Live Agent` -> intake and follow-up channel.
2. `Case Wiki` -> canonical case memory.
3. `UI Navigator` -> narrow admin action layer.
4. `Approval and Audit` -> trust and compliance layer.
5. `Simulation Lab` -> internal training and evaluation support.

This keeps the technical depth, but narrows the product the market actually
sees.
