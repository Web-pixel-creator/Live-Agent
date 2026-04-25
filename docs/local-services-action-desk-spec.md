# Local Services Action Desk Spec

Status: canonical expansion spec for the next commercial wedge.

Last reviewed: 2026-04-25.

## Decision

Build one clear product for the next market test:

`AI Dispatcher for local service businesses`

The product answers calls and messages, qualifies the request, estimates or
prepares pricing, schedules the next step, and hands a complete operator-ready
job card to the business.

Do not build separate products for plumbing, HVAC, cleaning, restaurants,
hotels, dentistry, and immigration at the same time. The repo can show multiple
demo paths, but the commercial story must stay narrow.

## Positioning

Primary local-market message:

`AI dispatcher for service companies in Tashkent. It answers requests 24/7,
collects the details, prepares a price or dispatch card, books a slot, and sends
the operator a ready-to-use handoff.`

## Product Shape

The product is not a generic agent platform. It is a front-office automation
layer for appointment-heavy service teams:

1. inbound phone, Telegram, WhatsApp, website chat, or form,
2. structured intake,
3. needs assessment,
4. estimate or quote preparation,
5. appointment or dispatch scheduling,
6. customer confirmation,
7. operator review,
8. evidence, transcript, and replay.

The existing `AI Action Desk for immigration teams` remains the trust and
compliance proof. The local-services wedge is the simpler commercial package for
fast pilots.

## Target ICP

Best first customers:

1. Tashkent service companies with 5-30 staff or masters.
2. Businesses that already get leads from phone, Telegram, Instagram, 2GIS,
   Google Maps, or paid ads.
3. Teams that miss calls because masters are on site or admins are busy.
4. Companies that already use a repeatable pricing model or at least a stable
   estimate process.
5. Owners who can make a buying decision without a long enterprise cycle.

Avoid first:

1. solo masters with no stable process,
2. restaurants that only want marketplace demand from Yandex or aggregators,
3. hotels with PMS/payment complexity,
4. medical or dental practices until compliance and privacy packaging are ready,
5. construction-material suppliers until the dispatch product is proven,
6. companies that cannot answer what a qualified lead is worth.

## Vertical Scope

### P0 Commercial Wedge

`Local Services Dispatch`

Include:

1. HVAC / AC repair and service,
2. plumbing,
3. electrical,
4. cleaning.

These are one product because the workflow is the same:

1. identify service type,
2. collect address and district,
3. understand urgency,
4. collect photos or issue description,
5. estimate range or quote inputs,
6. schedule a slot or handoff,
7. notify operator or master.

### P1 Demo Expansion

`Restaurant Reservation`

Restaurants are useful for demos because the story is easy to understand:

1. date,
2. time,
3. party size,
4. guest name,
5. phone number,
6. table area or seating preference,
7. event or occasion,
8. confirmation.

Restaurants should not become the first commercial focus until the local
services dispatcher has at least 3-5 serious pilot conversations.

### P2 Later

1. hotels,
2. dental clinics,
3. construction-material quote and delivery desks,
4. immigration and relocation as premium trust-heavy workflows,
5. marketplace or partner templates.

Construction materials are adjacent, but not P0. They are usually a commerce
and logistics workflow, not a field-service dispatch workflow. The intake must
handle product category, quantity, measurements, stock availability, delivery
address, unloading constraints, payment, and substitution rules. That can become
a later `quote and delivery desk`, but it should not dilute the first
local-services dispatcher demo.

## Market Evidence

Tashkent and Uzbekistan already show local demand signals:

1. Restaurants are a large and growing market. The National Statistics
   Committee reported 26,390 catering enterprises in Uzbekistan as of
   2026-01-01, 237.6 trillion UZS in 2025 turnover, and 14.7% annual growth.
2. Yandex Go is testing restaurant table booking in Tashkent, with the
   `Where to go` section covering more than 1,400 restaurants and cafes across
   Tashkent and other Uzbek cities.
3. Local plumbing and electrical providers already sell speed, 24/7 response,
   district coverage, photo upload, and online request forms.
4. Local cleaning providers already sell instant requests, price calculation,
   square-meter based pricing, Telegram/WhatsApp intake, and flexible
   appointment scheduling.

Sources:

1. National Statistics Committee:
   https://stat.uz/en/press-center/news-of-committee/66456-zbekistonda-kafe-va-restoranlar-2025-jilda-ancha-savdo-ildi-3
2. Afisha / Yandex Go restaurant booking:
   https://www.afisha.uz/ru/gorod/2026/02/13/yandex
3. Santexizmat:
   https://santexizmat.uz/
4. Master24:
   https://master24.uz/
5. Central Cleaning:
   https://central-cleaning.uz/
6. Service-Pro:
   https://service-pro.uz/
7. Sharq Cleaning:
   https://sharqcleaning.uz/

## Competitor Patterns

### Newo.ai

What to learn:

1. Sell the pain first: missed calls, lost revenue, always-on front desk.
2. Make setup feel instant: website or Google Maps input, AI generated in about
   3 minutes.
3. Package by vertical pages: restaurants, cleaning, home services, dental,
   hospitality.
4. Show call demos by use case, not generic model claims.
5. Offer dashboard proof: recordings, transcripts, detected intent, bookings,
   revenue.
6. Keep integrations simple in the message: CRM, calendars, booking tools,
   payment systems, POS, Zapier/Make.
7. Use a clear entry price and free trial.

What not to copy:

1. too many verticals in the first screen,
2. broad "12 agents in one" messaging for our early product,
3. revenue claims unless we can prove them with local pilots.

Sources:

1. https://newo.ai/
2. https://newo.ai/cleaning-ai-receptionist/
3. https://newo.ai/hvac-plumbing-ai-receptionist/
4. https://newo.ai/restaurant/
5. https://newo.ai/pricing/

### Home Services Competitors

Wrench Dispatch pattern:

1. lead with trade-specific pain,
2. show concrete lost revenue from missed calls,
3. handle emergency triage,
4. disclose after-hours rates,
5. book into Google Calendar, Jobber, or Housecall Pro,
6. send SMS confirmations and review requests.

Source:

1. https://www.wrenchdispatch.com/

Goodcall pattern:

1. launch in minutes,
2. connect knowledge sources and business tools,
3. automate appointments,
4. show analytics around intent, outcomes, call duration, and automation rate.

Source:

1. https://www.goodcall.com/
2. https://www.goodcall.com/pricing/

Smith.ai pattern:

1. blend AI with human fallback,
2. price by usage and plan,
3. qualify leads with custom criteria,
4. send call summaries to CRM, email, Slack, or Teams,
5. make live-agent escalation a trust feature.

Source:

1. https://smith.ai/pricing/ai-receptionist

### Cleaning Competitors

Newo cleaning pattern:

1. needs assessment,
2. address, home size, square footage, service type, preferred date,
3. recurring cleaning setup,
4. same-day and commercial inquiries,
5. quote generation and SMS/email delivery,
6. CRM/scheduling integrations such as Housecall Pro, ZenMaid, or Jobber.

Hyperleap pattern:

1. website, WhatsApp, Instagram, and Facebook channels,
2. Calendly or Cal.com booking,
3. instant quotes based on square footage, rooms, service type, and rate
   structure,
4. service area checks,
5. special requests such as pets, allergies, eco-friendly products.

Ilna pattern:

1. phone plus WhatsApp/SMS,
2. one-time, deep-clean, commercial, and recurring appointments,
3. service packages, pricing, and service area memory.

Sources:

1. https://newo.ai/cleaning-ai-receptionist/
2. https://www.hyperleap.ai/agents/cleaning
3. https://www.ilna.ai/cleaning-services-ai
4. https://www.estimatty.com/

### Restaurant Competitors

Mesa pattern:

1. no hardware,
2. forward the restaurant phone,
3. capture reservation requests on the cheaper plan,
4. full reservations and floor-plan management on the higher plan,
5. simple $40/$80 per month public pricing.

Maple pattern:

1. lost revenue calculator,
2. two-minute phone forwarding setup,
3. menu and policy customization,
4. OpenTable / SevenRooms / custom booking integrations,
5. dashboard for bookings and revenue.

Slang AI pattern:

1. restaurant-only language,
2. 30-minute setup promise,
3. OpenTable, SevenRooms, Tripleseat, Yelp integrations,
4. VIP routing, group cross-sell, staff alerts, CSAT metrics.

Sources:

1. https://www.mesacall.com/
2. https://www.callmaple.ai/
3. https://www.slang.ai/

### No-Code Voice Platform Competitors

Synthflow pattern:

1. no-code call-flow builder,
2. inbound and outbound calls,
3. templates,
4. CRM and ERP integrations,
5. sentiment and human handoff,
6. security posture such as HIPAA/GDPR.

Source:

1. https://synthflow.ai/

## Differentiation

The market already has many AI receptionists. We should not compete by saying
"we answer calls too." The product must compete on:

1. operator-ready job cards,
2. approval before risky actions,
3. evidence, transcript, and replay,
4. local Telegram-first workflow for Tashkent,
5. multilingual RU/UZ/EN intake,
6. vertical playbooks that can be shown in seven minutes,
7. safe handoff to a human rather than pretending everything should be fully
   autonomous.

Positioning contrast:

1. generic AI receptionist: answers the phone,
2. Live-Agent Action Desk: turns the request into an approved, auditable job
   handoff.

## Seven-Minute Demo Contract

A first-time viewer must understand the product in seven minutes.

### Minute 0-1: Entry

Open:

```text
/app?demo=local-services-dispatch
```

Visible first screen:

1. `AI Dispatcher for Local Services`,
2. three demo cards: `AC repair`, `Plumbing emergency`, `Cleaning quote`,
3. one CTA: `Start 7-minute demo`.

### Minute 1-3: Intake

Show a simulated customer request:

1. service type,
2. district,
3. address,
4. phone,
5. problem description,
6. photo/evidence placeholder,
7. urgency,
8. preferred time.

### Minute 3-5: Operator Job Card

Show one structured job card:

1. issue summary,
2. urgency level,
3. service area check,
4. estimate range or pricing inputs,
5. recommended master/team type,
6. slot recommendation,
7. customer confirmation draft,
8. internal dispatch note.

### Minute 5-6: Approval

Show a protected action:

1. send customer confirmation,
2. notify master/operator,
3. create CRM/job payload.

The action should require review in the demo.

### Minute 6-7: Evidence

Show:

1. transcript summary,
2. job payload,
3. evidence link,
4. operator handoff export,
5. replay/proof surface.

## P0 Demo Paths

### Local Services Dispatch

URL:

```text
/app?demo=local-services-dispatch
```

Playbooks:

1. `AC repair dispatch`
2. `Plumbing emergency`
3. `Cleaning quote and booking`

Required fields:

1. `customer_name`
2. `phone`
3. `service_type`
4. `district`
5. `address`
6. `urgency`
7. `problem_summary`
8. `photos_requested`
9. `preferred_time`
10. `estimate_inputs`
11. `operator_owner`
12. `handoff_status`

### Cleaning Quote and Booking

Required fields:

1. `property_type`
2. `service_type`
3. `area_sqm`
4. `rooms`
5. `bathrooms`
6. `windows`
7. `after_renovation`
8. `pets_or_children`
9. `supplies_needed`
10. `preferred_date`
11. `recurring_frequency`
12. `estimate_range`

### Restaurant Reservation

URL:

```text
/app?demo=restaurant-reservation
```

Keep this as P1 demo until local services gets real pilot signal.

Required fields:

1. `guest_name`
2. `phone`
3. `date`
4. `time`
5. `party_size`
6. `seating_preference`
7. `occasion`
8. `special_requests`
9. `deposit_policy`
10. `confirmation_status`

## UX Rules

The main `/app` surface should not become a builder or admin console. It should
show the outcome immediately:

1. what request came in,
2. what the AI understood,
3. what is missing,
4. what the operator can approve,
5. what will be sent to the customer or master,
6. where the evidence lives.

No first-screen runtime jargon:

1. no model routing,
2. no agent graph,
3. no raw JSON unless opened intentionally,
4. no provider setup,
5. no judge artifacts.

Support surfaces can keep the depth:

1. `/app/console`,
2. `/bundle/:id`,
3. `/evidence/:id`,
4. Case Vault,
5. replay artifacts.

## Integration Roadmap

P0 local pilot:

1. Telegram intake,
2. website form / chat widget,
3. Google Calendar or simple internal slot table,
4. operator copy/export payload,
5. SMS/Telegram customer confirmation draft.

P1:

1. WhatsApp Business,
2. CRM table in Airtable, Notion, Google Sheets, or HubSpot,
3. 2GIS / Google Maps service area enrichment,
4. payment/deposit link for restaurants or large service calls.

P2:

1. Jobber / Housecall Pro equivalent if targeting Europe or US,
2. custom CRM connectors,
3. outbound follow-up and review requests,
4. multi-location routing.

## Pricing Hypothesis For Tashkent

Pilot:

1. first 3-5 businesses,
2. 14 days free,
3. manual white-glove setup,
4. owner/operator feedback every 2-3 days.

Paid local target:

1. small service company: 500k-1.5m UZS/month,
2. larger company: 2m-4m UZS/month,
3. add usage pricing only after voice/call volume is measured.

Buying trigger:

1. at least 10-20 qualified inbound requests per month,
2. at least 3-5 missed or delayed requests per week,
3. average job value high enough that one saved job pays for the product.

## Implementation Plan

### P0 - Clean Product Spec And Demo

1. Keep this spec as the canonical local-services plan.
2. Link it from `README.md` and `docs/product-master-plan.md`.
3. Add `/app?demo=local-services-dispatch`.
4. Add three cards: `AC repair dispatch`, `Plumbing emergency`, `Cleaning quote
   and booking`.
5. Each card must show `Outcome`, `Approval`, `Evidence`, and `Deliverable`.
6. Each card must open a detail panel with sample input, approval policy,
   evidence output, CRM/job fields, payload preview, and export drawer.

### P1 - Operator-Ready Payloads

1. Add structured payload builders for local services.
2. Add `Dispatch payload drawer`.
3. Add `Customer confirmation drawer`.
4. Add `Master/operator handoff drawer`.
5. Keep `Human-readable` and `JSON` modes.

### P2 - Telegram-First Pilot

1. Add Telegram intake prototype.
2. Convert a Telegram message into the same job-card payload.
3. Produce customer confirmation draft.
4. Produce operator/master handoff draft.
5. Save transcript and evidence link.

### P3 - Real Pilot Kit

1. Create a one-page offer for Tashkent service companies.
2. Create a 90-second screen recording.
3. Prepare a 10-company outreach list.
4. Track pilot metrics:
   - inbound requests,
   - missed-call recovery,
   - response time,
   - bookings,
   - manual operator edits,
   - customer no-show or cancellation.

## What To Remove From The Critical Path

Do not spend the next product cycle on:

1. hotels,
2. dental practices,
3. construction-material commerce flows,
4. marketplace,
5. autonomous field-service dispatch without human review,
6. payment automation,
7. broad model-provider comparison,
8. generic "agent platform" messaging,
9. new challenge/judge surfaces,
10. public claims of revenue lift before local pilot evidence.

These can exist as future notes, but they should not appear in the primary demo
or primary sales story.

## Acceptance Criteria

The project is on track when:

1. a business owner understands the product from `/app` in seven minutes,
2. local services has one complete demo path,
3. cleaning is included as a service workflow, not a separate product,
4. restaurants are available as a secondary demo only,
5. every playbook ends in an operator-ready payload,
6. every risky external action is approval-gated,
7. every demo path has evidence/replay,
8. docs point to one source of truth instead of scattered strategy notes.

## Validation

For source or shell changes:

```bash
npm run test:unit
npm run build
```

For release-impacting changes:

```bash
npm run verify:release
```
