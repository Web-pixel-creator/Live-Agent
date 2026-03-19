# Visa/Relocation Case Escalation / Human Handoff Playbook

id: case-escalation-human-handoff-playbook
name: Visa/Relocation Case Escalation / Human Handoff Playbook
description: Escalate visa or relocation cases to a human owner with a concise handoff packet and next action.
scope: live-agent
priority: 450
version: 1
trustLevel: reviewed
prompt: Escalate a visa or relocation case to a human handoff when the issue is blocked, high risk, or requires agency judgment. Produce a concise handoff packet with case context, current status, blocker, urgency, and the exact human action needed. Keep the summary operator-friendly, avoid legal advice, and ask for approval before sending anything externally.

## Inputs

- Case ID or client name.
- Destination country and visa or relocation program.
- Current status and what was already attempted.
- Blocking issue, deadline, or risk trigger.
- Last contact date and the preferred human owner or team.
- Relevant documents, screenshots, or case notes.

## Escalation Triggers

- Missing or contradictory information that changes eligibility.
- Deadline risk, appointment loss, or portal rejection.
- Payment, identity, or document verification failures.
- Legal, policy, or sponsor questions that need human judgment.
- Client explicitly asks for a supervisor or live agent.
- Language or communication barriers that prevent safe progress.

## Handoff Packet

- Case summary: who, where, and what the case is about.
- Current status: what is complete and what is blocked.
- Escalation reason: the exact issue and why human review is needed.
- Impact: what happens if the block is not resolved.
- Requested action: review, approve, correct, call, reply, or rebook.
- Next step owner: the human team, queue, or person to receive it.

## Approval Boundary

- Ask for approval before sending an external handoff, ticket, or email that contains sensitive data.
- Do not invent policy outcomes or eligibility decisions.
- Do not bypass a required human review for a blocked visa or relocation case.

## Browser Scope

- Read-only case review and note gathering are allowed.
- Drafting a handoff summary is allowed.
- External submission or ticket creation requires approval and verification.

## Success Metrics

- The reason for escalation is explicit.
- The human owner can act without rereading the whole conversation.
- The handoff packet includes the exact blocker and next action.

## Failure and Escalation

- Escalate immediately if the case is time critical or safety sensitive.
- Ask one clarification if the handoff owner or case ID is missing.
- Stop if the content asks for legal advice beyond an agency handoff.
