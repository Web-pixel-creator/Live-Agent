# Local Services 90-Second Demo Script

## Goal

Show one complete operator-safe flow in under 90 seconds.

The viewer should understand:

1. the assistant answers first
2. the operator stays in control of risky actions
3. the output is a usable dispatch payload, not just a chat transcript

## Route

Open:

`/app?demo=local-services-dispatch&service=ac-repair-dispatch&recording=90s`

Use the `90s recording` header toggle if you opened the normal route first.
The recording posture shows `90-second recording mode` and `Recording path`,
then hides outreach tables and scorecard controls during recording.

For the setup-first walkthrough, open:

`/app?demo=local-services-dispatch&service=ac-repair-dispatch&setup=7min`

Use the `7-min setup` header toggle if you opened the normal route first. The
setup posture shows `7-minute setup wizard` and `Setup path`, exposes
`Open setup checklist`, `Open day-one setup`, and `Copy setup brief`, then hides
outreach tables and scorecard controls until setup mode is exited.

## 90-Second Script

### 0-10 seconds

Show the first fold and say:

`This is an AI dispatcher for local service companies. It answers first, but booking and dispatch remain operator-approved.`

Point out the four visible lanes: AC repair, plumbing, cleaning, and measurement
visit booking. Say that materials and final pricing are not automated in P0.

### 10-25 seconds

Open the `AC repair dispatch` card and point at:

1. `Outcome`
2. `Approval`
3. `Evidence`
4. `Deliverable`

Say:

`The product promise is simple: every inbound request becomes a structured job card with approval, evidence, and a clear deliverable.`

### 25-40 seconds

Show:

1. `Phone intake`
2. `Pricing and slot inputs`
3. `Approval policy`

Say:

`The assistant collects district, urgency, schedule, and estimate inputs before anything is sent externally.`

### 40-55 seconds

Show `Telegram intake prototype`.

Say:

`If the customer moves from phone to Telegram, the request still lands in the same job-card contract instead of creating a second workflow.`

### 55-70 seconds

Show:

1. `Customer confirmation draft`
2. `Master/operator handoff`
3. `Dispatch payload preview`

Say:

`The operator gets a customer message, a master handoff, and the final payload preview before approval.`

### 70-85 seconds

Show `Pilot readiness`.

Point at:

1. `One-page offer`
2. `90-second demo script`
3. `Launch checklist`
4. `Agent setup / training state`
5. `Open setup checklist`
6. `Business profile`
7. `Knowledge sources`
8. `Agent behavior`
9. `Test call/message`
10. `Ready for test call/message`
11. `7-minute setup wizard`
12. `Setup path`
13. `Open day-one setup`
14. `Pilot metrics`
15. `Open metrics tracker`
16. `Outreach list filters`
17. `Column settings`
18. `Filtered outreach list`
16. `Open intake evidence`
17. `Transcript + evidence`
18. `Saved intake evidence`
19. `Pilot execution checklist`
20. `Prepare first manual batch`
21. `Open discovery prep`
22. `Discovery call prep`
23. `Questions to ask`
24. `Pilot success criteria`
25. `Copy discovery call prep`
26. `Open day-one setup`
27. `Day-one setup brief`
28. `Business profile lock`
29. `Setup tasks`
30. `Test call plan`
31. `Copy day-one setup brief`
32. `Open daily log`
33. `Pilot daily log`
34. `Daily capture fields`
35. `Daily operating loop`
36. `Copy pilot daily log`
37. `Open week-one review`
38. `Pilot week-one review`
39. `Continue / stop decision`
40. `Copy week-one review`
41. `Open evidence pack`
42. `Pilot evidence pack`
43. `Week-two evidence pack`
44. `Copy evidence pack`
45. `Open recording checklist`
46. `Open pilot runbook`

Say:

`This makes the product sales-ready as well: we can explain the offer, show the 7-minute setup path, review business profile, knowledge sources, behavior, test call readiness, prove the saved intake transcript and evidence link, then filter the outreach list by service or status, choose visible scorecard columns, show the 14-day manual pilot checklist, prepare the discovery call brief, turn that into the day-one setup brief, capture the daily operating-loop note, prepare the week-one continue/stop review, assemble a redacted week-two evidence pack, and open the recording checklist before copying reviewed setup, discovery, daily, review, evidence, or metrics notes manually. Nothing here activates phone, Telegram, WhatsApp, CRM, analytics, billing, outreach sends, calendar bookings, customer messages, or CRM writes.`

Use `docs/local-services-demo-recording-checklist.md` when recording the actual
walkthrough. It gives the shot list, required on-screen proof, and do-not-claim
rules for the first 90-second video.

Optional second click if the prospect is construction-adjacent: open
`Measurement visit booking` and point at the no-final-price approval rule.

### 85-90 seconds

Close with:

`The point is not a chatbot. The point is fewer missed requests, faster replies, and operator-approved dispatch.`
