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
Use `Mark complete` on the first four setup steps, then `Mark ready for pilot test`.
The shell should show `Setup progress`, `Saved setup state`, and
`Ready for pilot test`; this state is saved only in the browser-local pilot
workspace.
Next use `Test call/message panel`: compare `Sample inbound` to
`Expected extracted fields`, complete the `Pass/fail checklist` with
`Mark check passed`, then click `Record test passed`. The shell should show
`Test call passed`; `Reset test call` clears only the browser-local dry-run
state.

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
13. `Setup progress`
14. `Saved setup state`
15. `Mark complete`
16. `Mark ready for pilot test`
17. `Ready for pilot test`
18. `Test call/message panel`
19. `Sample inbound`
20. `Expected extracted fields`
21. `Pass/fail checklist`
22. `Record test passed`
23. `Test call passed`
24. `Open day-one setup`
25. `Pilot metrics`
26. `Open metrics tracker`
27. `Outreach list filters`
28. `Column settings`
29. `Filtered outreach list`
30. `Open intake evidence`
31. `Transcript + evidence`
32. `Saved intake evidence`
33. `Pilot execution checklist`
34. `Pass test call/message`
35. `Needs test call passed`
36. `Prepare first manual batch`
37. `Pilot checklist progress`
38. `Dry run required`
39. `Manual launch blocked`
40. `Open launch packet`
41. `Pilot launch packet`
42. `Launch packet preview`
43. `First manual contact checklist`
44. `Pilot launch packet readiness rail`
45. `First manual contact packet`
46. `Manual contact copy preview`
47. `Launch packet guardrails`
48. `Launch packet support details`
49. `Open Preview / Test message`
50. `Launch readiness`
51. `Copy launch packet`
52. `Manual activity log`
53. `Last manual action`
54. `Copy activity log`
55. `local_services_manual_activity_log`
56. `No external side effects`
57. `Open discovery prep`
57. `Discovery call prep`
53. `Questions to ask`
54. `Pilot success criteria`
55. `Copy discovery call prep`
56. `Open day-one setup`
57. `Day-one setup brief`
58. `Business profile lock`
59. `Setup tasks`
60. `Test call plan`
61. `Copy day-one setup brief`
62. `Open daily log`
63. `Pilot daily log`
64. `Daily capture fields`
65. `Daily operating loop`
66. `Copy pilot daily log`
67. `Open week-one review`
68. `Pilot week-one review`
69. `Continue / stop decision`
70. `Copy week-one review`
71. `Week-one owner decision state`
72. `Record continue`
73. `Record pause`
74. `Record stop`
75. `weekOneOwnerDecisionByProspectKey`
76. `Open evidence pack`
77. `Pilot evidence pack`
78. `Week-two evidence pack`
79. `Week-one owner decision`
80. `week_one_owner_decision_to_evidence_pack`
81. `Copy evidence pack`
82. `Open recording checklist`
83. `Open pilot runbook`

Say:

`This makes the product sales-ready as well: we can explain the offer, show the 7-minute setup path, review business profile, knowledge sources, behavior, test call readiness, prove the saved intake transcript and evidence link, then filter the outreach list by service or status, choose visible scorecard columns, show the 14-day manual pilot checklist, open the first manual contact launch packet, copy the browser-local manual activity log, prepare the discovery call brief, turn that into the day-one setup brief, capture the daily operating-loop note, prepare the week-one continue/stop review, record the week-one owner decision locally in weekOneOwnerDecisionByProspectKey, assemble a redacted week-two evidence pack with week_one_owner_decision_to_evidence_pack, and open the recording checklist before copying reviewed setup, launch, activity, discovery, daily, review, evidence, or metrics notes manually. Nothing here activates phone, Telegram, WhatsApp, CRM, analytics, billing, outreach sends, calendar bookings, customer messages, or CRM writes.`

Use `docs/local-services-demo-recording-checklist.md` when recording the actual
walkthrough. It gives the shot list, required on-screen proof, and do-not-claim
rules for the first 90-second video.

Optional second click if the prospect is construction-adjacent: open
`Measurement visit booking` and point at the no-final-price approval rule.

### 85-90 seconds

Close with:

`The point is not a chatbot. The point is fewer missed requests, faster replies, and operator-approved dispatch.`
