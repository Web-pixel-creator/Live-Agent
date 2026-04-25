# Getting Started In 7 Minutes

This path is for a first operator, evaluator, or design partner who needs to
understand the product quickly.

The target product is:

`AI Action Desk for immigration teams`

## Hosted Or Local Entry

Open the Action Desk:

```text
http://localhost:3000/app?demo=visa-intake
```

Or open `http://localhost:3000/app` and click `Start 7-minute demo`.

The demo posture uses the existing `VS-2841` immigration case and keeps the
primary app shell intact.

## Seven-Minute Path

1. Review the case header: client, owner, SLA, visa type, and country.
2. Use the `Playbook templates` strip if you want to branch into one workflow lane directly:
   `Visa lead qualification`, `Missing-document follow-up`, `Consultation booking prep`, or `CRM handoff summary`.
   Each card previews `Outcome`, `Approval`, `Evidence`, and `Deliverable`.
   Selecting a card opens the inline detail panel with `Sample input`, `Approval policy`,
   `Evidence output`, and `CRM fields`.
   The same panel also exposes `Payload preview`, `Surface path`, and `Copy payload`.
   Use `Open export drawer` for the integration-ready view: the CRM lane opens
   `CRM payload drawer`, the consultation lane opens `Consultation handoff
   drawer`, and both offer `Human-readable` and `JSON` modes before the
   canonical `Case Vault` or `Presentation bundle` jump.
3. Read `Case Outcome Summary`.
4. Confirm the lead is qualified.
5. Check the missing-document count and requested documents.
6. Check consultation readiness.
7. Open `Review approval` to inspect the protected follow-up.
8. Open `Evidence bundle` or `Presentation bundle` for proof.

## Expected Outcome

By the end, the operator should see:

1. lead qualification is visible,
2. missing documents are visible,
3. consultation path is ready,
4. CRM handoff is prepared in the console,
5. human approval is required before external follow-up,
6. evidence is available without opening raw runtime artifacts first.

## Product Boundary

The demo does not provide legal advice, final eligibility decisions, or
autonomous filing. It demonstrates intake, document chase, booking prep, CRM
handoff, approval, and evidence for an immigration operations team.

## Validation

For changes to this path:

```bash
npm run test:unit
npm run build
```
