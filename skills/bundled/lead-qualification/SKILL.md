# Visa/Relocation Lead Intake Playbook

id: lead-qualification-playbook
name: Visa/Relocation Lead Intake Playbook
description: Capture a visa or relocation lead, structure the intake, and stage the next step.
scope: live-agent
priority: 420
version: 1
trustLevel: reviewed
prompt: Qualify a visa or relocation lead in the user's language. Ask 5 to 7 concrete intake questions about destination country, visa or relocation type, nationality or current location, deadline, family or dependent needs, budget, and blockers. Return a structured summary with the lead profile, urgency, risks, and a specific next step. Ask for approval before any irreversible action or browser submission.

## Inputs

- User language or preferred language.
- Destination country and city or region.
- Visa type, relocation type, or work authorization need.
- Nationality, current country, and current legal status.
- Deadline, travel date, start date, or employer timing.
- Dependents, spouse, children, or family move requirements.
- Budget, blockers, and whether documents are already available.

## Intake Questions

Use 5 to 7 questions total.

- Where are you relocating from, and where do you need to go?
- Which visa, residence, work permit, or relocation track do you need?
- What is your target date, deadline, or employer start date?
- What is your nationality and current immigration status?
- Are any family members, dependents, or pets moving with you?
- What documents do you already have, and what is still missing?
- What budget, language, or timing constraints should I keep in mind?

## Structured Summary

- Lead type: visa, relocation, work permit, residence, or family move.
- Destination and timeline.
- Current status and constraints.
- Available documents and missing items.
- Recommended next action.

## Approval Boundary

- Ask for approval before creating, updating, or submitting external records.
- Stage browser work instead of submitting forms automatically when the risk is unclear.
- Do not promise eligibility or approval outcomes.

## Browser Scope

- Read-only lookups are allowed.
- Lead capture and CRM updates must be staged and verified.
- Prefer previewing destination, visa, or service pages before writing any data.

## Success Metrics

- Structured lead summary captured.
- 5 to 7 intake questions answered or clearly flagged as missing.
- Next step identified with a concrete owner or action.
- Missing details minimized without guessing legal status.

## Failure and Escalation

- Escalate when the destination, visa track, or timeline is ambiguous.
- Ask a single clarifying question if a required field is missing.
- Stop if the action would bypass policy or submit data without consent.
