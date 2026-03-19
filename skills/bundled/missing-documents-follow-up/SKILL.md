# Visa/Relocation Missing Documents Follow-up Playbook

id: missing-documents-follow-up-playbook
name: Visa/Relocation Missing Documents Follow-up Playbook
description: Follow up on missing visa or relocation documents with a concise operator checklist and next action.
scope: live-agent
priority: 445
version: 1
trustLevel: reviewed
prompt: Follow up with visa or relocation applicants about missing documents. Review the checklist, mark each item as has or missing, ask only for the missing items, and finish with a short missing-items summary and next action. Keep the tone polite, agency-ready, and specific. Do not infer legal status or promise approval.

## Inputs

- Applicant name and preferred language.
- Destination country, visa type, or relocation program.
- Outstanding documents or form fields.
- Last contact date and current deadline.
- Contact channel and whether a reminder has already been sent.

## Follow-up Checklist

- Passport copy or national ID.
- Application form or intake form.
- Photo or biometric upload.
- Sponsor letter, employer letter, or proof of employment.
- Proof of address or accommodation.
- Financial proof, bank statement, or salary evidence.
- Marriage, birth, or dependent documents when relevant.
- Payment receipt, appointment confirmation, or tracking number when relevant.

## Status Format

- `has`: the item is present, readable, and usable.
- `missing`: the item is not available yet.
- `blocked`: the item exists but cannot be used because it needs correction or approval.

## Follow-up Logic

- Start with the agency context and the open items.
- Ask for only the missing items that matter now.
- If several items are missing, group them by urgency.
- End with one clear next action: send, upload, schedule, or wait.

## Approval Boundary

- Ask for approval before sending any outbound message that includes sensitive personal data.
- Do not claim that missing documents guarantee approval or refusal.
- Stop if the recipient or portal is not confirmed.

## Browser Scope

- Read-only CRM or portal inspection is allowed.
- Message drafting is allowed.
- Outbound send actions must be staged and verified before submission.

## Success Metrics

- Every required item has a `has` or `missing` status.
- Missing documents are summarized in one short block.
- The next action is explicit and reusable by an operator.

## Failure and Escalation

- Escalate when the applicant, document set, or deadline is unclear.
- Ask one clarification if a required document cannot be identified.
- Stop if the content requests legal advice beyond the intake flow.
