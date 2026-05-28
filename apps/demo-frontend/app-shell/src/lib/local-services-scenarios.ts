import { z } from "zod";

export const LOCAL_SERVICES_SCENARIO_IDS = [
  "ac-repair-dispatch",
  "plumbing-emergency",
  "cleaning-quote-booking",
  "measurement-visit-booking",
] as const;

export const localServicesScenarioIdSchema = z.enum(LOCAL_SERVICES_SCENARIO_IDS);

export const localServicesScenarioFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "phone", "district", "slot", "price", "boolean", "media"]),
  required: z.boolean(),
});

export const localServicesScenarioSchema = z.object({
  id: localServicesScenarioIdSchema,
  lane: z.string().min(1),
  title: z.string().min(1),
  priority: z.enum(["P0", "P1"]),
  channel: z.enum(["phone", "telegram", "whatsapp", "web_form", "mixed"]),
  sampleInput: z.string().min(1),
  intakeFields: z.array(localServicesScenarioFieldSchema).min(1),
  validationRules: z.array(z.string().min(1)).min(1),
  operatorGate: z.object({
    requiresApproval: z.literal(true),
    blocks: z.array(z.string().min(1)).min(1),
  }),
  handoff: z.object({
    customerConfirmation: z.string().min(1),
    masterOrManagerHandoff: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
  }),
  outOfScope: z.array(z.string().min(1)).min(1),
});

export const localServicesScenarioListSchema = z
  .array(localServicesScenarioSchema)
  .length(LOCAL_SERVICES_SCENARIO_IDS.length);

export type LocalServicesScenario = z.infer<typeof localServicesScenarioSchema>;
export type LocalServicesScenarioId = z.infer<typeof localServicesScenarioIdSchema>;

export const DEFAULT_LOCAL_SERVICES_SCENARIOS: LocalServicesScenario[] = [
  {
    id: "ac-repair-dispatch",
    lane: "AC / HVAC",
    title: "AC repair dispatch",
    priority: "P0",
    channel: "mixed",
    sampleInput:
      "Customer reports an AC that stopped cooling in Yunusabad and asks for a same-day visit after 18:00.",
    intakeFields: [
      { key: "customer_phone", label: "Customer phone", type: "phone", required: true },
      { key: "district", label: "District", type: "district", required: true },
      { key: "issue_type", label: "Issue type", type: "text", required: true },
      { key: "preferred_slot", label: "Preferred slot", type: "slot", required: true },
      { key: "photo_or_video", label: "Photo or video", type: "media", required: false },
    ],
    validationRules: [
      "Confirm district before proposing a visit window.",
      "Ask for issue type before preparing estimate inputs.",
      "Request photo or video when the issue is noisy, leaking, or unclear.",
    ],
    operatorGate: {
      requiresApproval: true,
      blocks: ["technician_assignment", "customer_confirmation", "final_price"],
    },
    handoff: {
      customerConfirmation:
        "We received your AC repair request. An operator will confirm the technician and final time shortly.",
      masterOrManagerHandoff:
        "Same-day AC repair lead with district, issue type, preferred slot, and media request captured.",
      evidence: ["call_summary", "normalized_intake", "operator_approval_decision"],
    },
    outOfScope: ["payment_collection", "final_price_promise", "autonomous_dispatch"],
  },
  {
    id: "plumbing-emergency",
    lane: "Plumbing",
    title: "Plumbing emergency",
    priority: "P0",
    channel: "mixed",
    sampleInput:
      "Customer reports water under the sink in Chilanzar, says the leak is active, and needs urgent help.",
    intakeFields: [
      { key: "customer_phone", label: "Customer phone", type: "phone", required: true },
      { key: "district", label: "District", type: "district", required: true },
      { key: "active_leak", label: "Active leak", type: "boolean", required: true },
      { key: "access_note", label: "Access note", type: "text", required: true },
      { key: "rate_disclosure", label: "Rate disclosure", type: "price", required: true },
    ],
    validationRules: [
      "Ask whether water is still flowing before marking emergency.",
      "Capture access notes before preparing master handoff.",
      "Show after-hours or emergency rate disclosure before customer confirmation.",
    ],
    operatorGate: {
      requiresApproval: true,
      blocks: ["master_dispatch", "customer_confirmation", "after_hours_rate"],
    },
    handoff: {
      customerConfirmation:
        "Your plumbing request is marked urgent. Please close the water valve if safe. Our operator will confirm dispatch.",
      masterOrManagerHandoff:
        "Urgent plumbing lead with active leak status, address/access note, and safety guidance captured.",
      evidence: ["emergency_triage", "safety_guidance", "approval_status"],
    },
    outOfScope: ["autonomous_master_dispatch", "payment_collection", "guaranteed_arrival_without_approval"],
  },
  {
    id: "cleaning-quote-booking",
    lane: "Cleaning",
    title: "Cleaning quote and booking",
    priority: "P0",
    channel: "mixed",
    sampleInput:
      "Customer asks for after-renovation cleaning in Mirabad: 90 sqm, 3 rooms, 2 bathrooms, windows included.",
    intakeFields: [
      { key: "customer_phone", label: "Customer phone", type: "phone", required: true },
      { key: "district", label: "District", type: "district", required: true },
      { key: "area_sqm", label: "Area sqm", type: "text", required: true },
      { key: "service_type", label: "Service type", type: "text", required: true },
      { key: "preferred_date", label: "Preferred date", type: "slot", required: true },
    ],
    validationRules: [
      "Collect area and service type before estimate preparation.",
      "Separate after-renovation, standard, deep clean, and recurring requests.",
      "Require operator review before final quote or booking confirmation.",
    ],
    operatorGate: {
      requiresApproval: true,
      blocks: ["final_quote", "booking_confirmation", "team_assignment"],
    },
    handoff: {
      customerConfirmation:
        "We collected your cleaning request and will confirm the final price and available team shortly.",
      masterOrManagerHandoff:
        "Cleaning quote request with area, service type, add-ons, district, and preferred date captured.",
      evidence: ["needs_assessment", "estimate_inputs", "approved_quote_draft"],
    },
    outOfScope: ["autonomous_price_send", "payment_collection", "calendar_write_without_approval"],
  },
  {
    id: "measurement-visit-booking",
    lane: "Measurement visits",
    title: "Measurement visit booking",
    priority: "P0",
    channel: "mixed",
    sampleInput:
      "Customer wants windows and balcony glazing in Yashnabad, can send photos, and asks for a measurement visit this week.",
    intakeFields: [
      { key: "customer_phone", label: "Customer phone", type: "phone", required: true },
      { key: "district", label: "District", type: "district", required: true },
      { key: "scope", label: "Scope", type: "text", required: true },
      { key: "approx_quantity", label: "Approximate quantity", type: "text", required: false },
      { key: "photos", label: "Photos", type: "media", required: false },
    ],
    validationRules: [
      "Separate measurement visit from stock, delivery, or material-only questions.",
      "Ask for photos and approximate sizes before preparing a manager handoff.",
      "Do not promise final price, material availability, or installation date.",
    ],
    operatorGate: {
      requiresApproval: true,
      blocks: ["measurer_assignment", "customer_confirmation", "final_price", "stock_promise"],
    },
    handoff: {
      customerConfirmation:
        "We collected your measurement request. A manager will confirm the measurer visit and next step shortly.",
      masterOrManagerHandoff:
        "Measurement visit request with scope, district, address, photos/sizes, and preferred week captured.",
      evidence: ["scope_summary", "photo_request", "manager_approval_decision"],
    },
    outOfScope: ["material_stock", "delivery_automation", "payment_collection", "final_price_promise"],
  },
];

export function parseLocalServicesScenario(value: unknown): LocalServicesScenario {
  return localServicesScenarioSchema.parse(value);
}

export function parseLocalServicesScenarioList(value: unknown): LocalServicesScenario[] {
  return localServicesScenarioListSchema.parse(value);
}

export function normalizeLocalServicesScenarioOverrides(value: unknown): LocalServicesScenario[] {
  const parsed = z.array(localServicesScenarioSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function mergeLocalServicesScenarioOverrides(
  baseScenarios: LocalServicesScenario[],
  overrides: unknown,
): LocalServicesScenario[] {
  const overridesById = new Map(
    normalizeLocalServicesScenarioOverrides(overrides).map((scenario) => [scenario.id, scenario]),
  );
  return baseScenarios.map((scenario) => overridesById.get(scenario.id) ?? scenario);
}
