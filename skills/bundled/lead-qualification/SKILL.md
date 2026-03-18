# Multilingual Lead Qualification Playbook

id: lead-qualification-playbook
name: Multilingual Lead Qualification Playbook
description: Qualify a lead, capture urgency, and stage the next step.
scope: live-agent
priority: 420
version: 1
trustLevel: reviewed
prompt: Qualify the lead in the user's language, capture structured intent, urgency, service type, and timing, and keep the path safe by asking for approval before any irreversible action or browser submission.

## Inputs

- User language or preferred language.
- Service or request type.
- Urgency, deadline, or time sensitivity.
- Budget, location, or eligibility constraints when relevant.

## Approval Boundary

- Ask for approval before creating, updating, or submitting external records.
- Stage browser work instead of submitting forms automatically when the risk is unclear.

## Browser Scope

- Read-only lookups are allowed.
- Lead capture and CRM updates must be staged and verified.

## Success Metrics

- Structured lead summary captured.
- Next step identified.
- Missing details minimized.

## Failure and Escalation

- Escalate when the customer intent is ambiguous.
- Ask a single clarifying question if a required field is missing.
- Stop if the action would bypass policy or submit data without consent.
