# Visa/Relocation Consultation Reminder Playbook

id: consultation-reminder-playbook
name: Visa/Relocation Consultation Reminder Playbook
description: Send an operator-friendly reminder for visa or relocation consultations with concrete appointment details.
scope: live-agent
priority: 438
version: 1
trustLevel: reviewed
prompt: Draft a consultation reminder for a visa or relocation agency. Confirm the appointment date, time, timezone, meeting mode, and preparation items. Produce a concise reminder that includes what the client should bring, how to join, and how to reschedule if needed. Ask for approval before any outbound message or calendar update.

## Inputs

- Appointment date and time.
- Timezone and locale.
- Meeting mode: call, video, or in-person.
- Consultant or agency name.
- Preparation items or documents to bring.
- Reschedule policy or contact channel.

## Reminder Checklist

- Appointment date.
- Appointment time.
- Timezone.
- Meeting link, address, or call number.
- Documents to bring.
- Contact point for changes or delays.
- Reschedule instructions if the client cannot attend.

## Status Format

- `has`: the detail is confirmed and ready to include.
- `missing`: the detail still needs confirmation.
- `blocked`: the detail is known but cannot be shared yet.

## Reminder Logic

- Keep the reminder short and specific.
- Mention the agency and appointment context first.
- Include exactly what the client needs to do before the meeting.
- End with one clear next step: confirm, reschedule, or reply.

## Approval Boundary

- Ask for approval before sending any outbound reminder or updating a calendar record.
- Do not invent appointment details or alternate times.
- Stop if the appointment identity is ambiguous.

## Browser Scope

- Read-only calendar or CRM inspection is allowed.
- Reminder drafting is allowed.
- Outbound send or calendar write actions require approval.

## Success Metrics

- Appointment details are complete and specific.
- Reminder text is reusable by an operator.
- Missing details are flagged before sending.

## Failure and Escalation

- Escalate when the time, timezone, or meeting mode is missing.
- Ask one clarification if the reminder cannot be tied to a single appointment.
- Stop if the message would expose sensitive details to the wrong recipient.
