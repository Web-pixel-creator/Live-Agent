# Visa Operator Walkthrough

This walkthrough is the operator script for the current commercial wedge.

Use it when you want a stable product demo for visa or relocation agencies without improvising each step live.

## Goal

Show one complete case lifecycle:

1. intake,
2. booking,
3. document follow-up,
4. consultation reminder,
5. CRM handoff,
6. case escalation to a human.

## Where To Run It

Frontend:

- local: `http://localhost:3000`
- hosted: `https://live-agent-frontend-production.up.railway.app`

Main tab:

- `Live Negotiator`

## Pre-Flight

Before the walkthrough:

1. open `Live Negotiator`,
2. open the `Voice` tray,
3. confirm `Connection` is `connected`,
4. return to the main first fold,
5. keep the result rail visible on the right.

If the rail shows `The connection to the live runtime was lost`, reconnect before running the next preset.

## Walkthrough Order

### Step 1. Reset

Click:

- `Start Over`

Say:

- `I'm starting from a clean seeded case so the operator flow is repeatable.`

### Step 2. Intake Draft

Click:

- `Start New Visa Case`

Wait for:

- the live lane to send the task,
- the workflow lane to open the UI task path.

Say:

- `The agent is taking the incoming relocation lead and preparing the first structured draft.`

### Step 3. Intake Result

Click:

- `See Intake Summary`

Point at:

- the approval boundary,
- the result summary,
- the operator handoff note.

Say:

- `The agent can prepare the action path, but the protected step still stays under approval.`

### Step 4. Missing Documents

Click:

- `Request Missing Documents`

Then:

- `See Follow-up Summary`

Point at:

- missing document state,
- follow-up summary,
- the handoff note.

Say:

- `Now the same case moves into the document chase stage without losing context.`

### Step 5. Consultation Reminder

Click:

- `Prepare Consultation Reminder`

Then:

- `See Reminder Summary`

Point at:

- booked slot,
- reminder details,
- preparation items.

Say:

- `The platform also keeps the consultation on track instead of relying on manual reminders.`

### Step 6. CRM Update

Click:

- `Prepare CRM Update`

Then:

- `See CRM Summary`

Point at:

- writeback payload,
- CRM owner,
- next operator step.

Say:

- `At this point the agent is no longer just talking. It is preparing the actual system update and the handoff packet.`

### Step 7. Case Escalation

Click:

- `Escalate to Specialist`

Then:

- `See Escalation Summary`

Point at:

- `Case escalation snapshot`,
- `Escalation reason`,
- `Human owner`,
- `Execution status`,
- `Copy operator summary`.

Say:

- `This is the final proof that the product also knows when to stop automating and hand the case to the right human owner.`

### Step 8. Copy Summary

Click:

- `Copy operator summary`

Say:

- `The operator can now paste a clean handoff summary into CRM, Slack, or email without rewriting the case manually.`

## Recommended Talk Track

Keep the talk track short:

1. `A client arrives with a visa or relocation request.`
2. `The agent qualifies the lead and prepares a structured action path.`
3. `It follows up on missing documents and keeps the consultation warm.`
4. `It prepares the CRM update.`
5. `And when needed, it escalates the case to the right human with a verified handoff summary.`

## If Something Goes Wrong

### Lost runtime connection

Do this:

1. open `Voice`,
2. click `Connect`,
3. return to the first fold,
4. rerun the current preset.

### Wrong result card stays visible

Do this:

1. click `Start Over`,
2. rerun only the preset you want to show,
3. wait for `orchestrator_completed` before speaking to the result.

### CTA cluster is crowded for the audience

Do this:

1. explain only the current preset,
2. avoid reading every button,
3. use the result rail as the main visual anchor.

## Best Finish

The strongest stopping point is:

1. `See Escalation Summary`
2. point at `Case escalation snapshot`
3. click `Copy operator summary`

That ending shows:

1. the product did real work,
2. it respected the approval boundary,
3. it left the human operator with a clean next step.
