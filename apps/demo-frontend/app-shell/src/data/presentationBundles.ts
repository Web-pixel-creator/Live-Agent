// Presentation Bundle — a read-only, single-case narrative artifact generated
// from a live Action Desk workspace case. Used to show a judge / demo audience
// *one* real case end-to-end (signal → decide → approve → resolve), with the
// counterfactual ("what would have happened without us") spelled out.
//
// This file is authored by hand for curated demo cases. It does NOT mirror
// `workspaceCases` 1:1 — it pulls the underlying case by `caseRef` and layers
// narrative fields (headline verdict, pull-quote, evidence annotations,
// counterfactual metrics) that only make sense in the public demo context.

export type BundleTimelinePhase = "intake" | "detection" | "resolution";

export interface BundleTimelineStep {
  /** Compact relative marker, e.g. "t+0s", "t+42s", "t+3m 14s". */
  marker: string;
  /** Stage phrase — matches StageIcon regex vocabulary. */
  stage: string;
  actor: "AI" | "Operator" | "Client" | "System";
  /** One-line note explaining what happened. Keep under ~80 chars. */
  note: string;
  /** Narrative phase. Steps that share a phase render under one divider.
   *  Optional — undefined steps fall under the previous phase, or "intake"
   *  if it is the first step. */
  phase?: BundleTimelinePhase;
}

export interface BundleEvidence {
  /** Short human title of the source (document, signal, external check). */
  title: string;
  /** Origin — "Document" | "Signal" | "External check" | "Node telemetry". */
  kind: "Document" | "Signal" | "External check" | "Node telemetry";
  /** One sentence: what it contributed to the decision. */
  contribution: string;
  /** Optional country code for CountryChip. */
  country?: string;
  /** Optional mono tag (document id, signal hash). */
  tag?: string;
}

export interface BundleCounterfactualRow {
  /** Metric name, e.g. "Time to first action". */
  label: string;
  /** Action Desk number. */
  withDesk: string;
  /** Baseline number (manual operator, no AI). */
  withoutDesk: string;
  /** "better" | "worse" | "neutral" — drives tint on the delta. */
  direction: "better" | "worse" | "neutral";
}

export interface PresentationBundle {
  /** Shareable bundle id — appears in URL and signature. */
  id: string;
  /** The underlying workspace case this bundle narrates. */
  caseRef: string;
  /** Deterministic policy hash mono-chip, displayed in hero + signature. */
  policyHash: string;
  /** Generation timestamp ISO — rendered in signature. */
  generatedAt: string;

  /** Short kicker above the hero title, e.g. "Case study · wire transfer risk". */
  kicker: string;
  /** Editorial hero title, split into two parts.
   *  `titleLead` is rendered in the default serif weight, `titleItalic` as
   *  italic lavender-gradient. Keep the emphasis phrase short (2–4 words)
   *  and the trailing punctuation OUT of the italic — the gradient should
   *  wrap a noun phrase, not a sentence terminator. */
  titleLead: string;
  titleItalic: string;
  /** One-line verdict rendered under the title in workspace mono tone. */
  verdict: string;
  /** Operator name responsible for the final approval. */
  operator: string;
  /** Total wall-clock from first signal to resolution, e.g. "4m 12s". */
  duration: string;
  /** Outcome tone for confidence bar and verdict pill. */
  outcomeTone: "mint" | "amber" | "rose";
  /** Final confidence 0–100. */
  confidence: number;
  /** Outcome label, e.g. "Approved · amount cap applied". */
  outcomeLabel: string;

  /** One-sentence serif lead under each section label. Tone should match the
   *  outcome (calm/relieved for approve, careful/principled for decline). */
  timelineLead: string;
  decisionLead: string;
  evidenceLead: string;
  counterfactualLead: string;

  /** 4–7 steps, in order. */
  timeline: BundleTimelineStep[];

  /** The decision block. */
  decision: {
    /** Headline question the AI was asked to answer. */
    question: string;
    /** One-paragraph plain-English summary of the reasoning. */
    summary: string;
    /** Policy name shown in the decision card. */
    policyName: string;
    /** Short policy description. */
    policyDescription: string;
    /** 2–4 bullets of "what changed" vs. a naive baseline. */
    changes: {
      kind: "added" | "changed" | "removed";
      label: string;
      detail?: string;
    }[];
  };

  /** Sources that shaped the decision. 3–5 items. */
  evidence: BundleEvidence[];

  /** Side-by-side metrics. 3–5 rows. */
  counterfactual: {
    /** Pull-quote rendered above the table, serif italic. */
    pullQuote: string;
    rows: BundleCounterfactualRow[];
  };
}

// ---- Curated demo bundle ----------------------------------------------------
// Anchored to VS-2841 (A. Petrov, EU Blue Card, document follow-up). Narrative
// recast as a judge-facing artifact: the AI detected a missing passport scan,
// drafted a bilingual reminder, and the operator approved it within seconds,
// saving a manual doc-gap audit. Numbers are illustrative but plausible.

export const presentationBundles: PresentationBundle[] = [
  {
    id: "BDL-2841-07A3",
    caseRef: "VS-2841",
    policyHash: "0x7a3f·bluecard·v12",
    generatedAt: "2026-06-26T18:04:00Z",

    kicker: "Live case · EU Blue Card · document gap",
    titleLead: "Closing a paperwork gap before the client",
    titleItalic: "noticed",
    verdict:
      "Autonomous draft, operator-approved in 6s, bilingual reminder sent before the SLA clock started burning.",
    operator: "Maya K.",
    duration: "4m 12s",
    outcomeTone: "mint",
    confidence: 94,
    outcomeLabel: "Approved · reminder sent",

    timelineLead:
      "Seven moments, one continuous trail. Every handoff between AI, operator and client is logged with the same grammar the desk uses live.",
    decisionLead:
      "The verdict in one breath, then the reasoning the operator co-signed — policy, confidence, and what actually changed in the case file.",
    evidenceLead:
      "Every claim above traces back to a source. None were hand-picked for this bundle — the desk indexed them as the case unfolded.",
    counterfactualLead:
      "Same case, same evidence — routed instead through the manual baseline. The numbers below are the gap the desk closes.",

    timeline: [
      {
        marker: "t+0s",
        stage: "Lead intake",
        actor: "AI",
        note: "Case VS-2841 ingested from NODE-BER-01 · applicant A. Petrov, DE.",
        phase: "intake",
      },
      {
        marker: "t+8s",
        stage: "Consultation booked",
        actor: "AI",
        note: "Slot reserved for 18 Apr 14:00 CET with the assigned advisor.",
        phase: "intake",
      },
      {
        marker: "t+1m 42s",
        stage: "Document intake",
        actor: "Client",
        note: "Employment contract uploaded (PDF, 1.2 MB, OCR clean).",
        phase: "intake",
      },
      {
        marker: "t+1m 43s",
        stage: "Document gap detected",
        actor: "AI",
        note: "Missing: passport scan, diploma apostille · required by Blue Card policy v12.",
        phase: "detection",
      },
      {
        marker: "t+3m 58s",
        stage: "Translation drafted",
        actor: "AI",
        note: "Bilingual EN→RU reminder drafted, PII-scrubbed, awaiting operator.",
        phase: "resolution",
      },
      {
        marker: "t+4m 06s",
        stage: "Approval",
        actor: "Operator",
        note: "Maya K. approved with one keystroke — no edits to the draft.",
        phase: "resolution",
      },
      {
        marker: "t+4m 12s",
        stage: "Resolved",
        actor: "System",
        note: "Reminder dispatched via email + SMS · CRM synced · audit sealed.",
        phase: "resolution",
      },
    ],

    decision: {
      question:
        "Should we remind A. Petrov about the missing passport scan now, or wait for the consultation?",
      summary:
        "The policy requires a passport scan before any Blue Card application can move to review. The client's consultation is 21 days out; waiting would collapse the whole SLA window onto the last 3 days. The AI drafted a plain-language reminder in Russian (client's locale) with a direct upload link and forwarded it for one-tap approval. No PII left the case. Confidence held at 94% across the reasoning chain.",
      policyName: "Blue Card v12 · document completeness",
      policyDescription:
        "When an applicant's intake has cleared but required documents are missing, send a bilingual reminder within 2 hours of detection unless the client has opted out of proactive messaging.",
      changes: [
        {
          kind: "added",
          label: "Bilingual reminder (EN → RU)",
          detail: "client locale inferred from case metadata, not UI",
        },
        {
          kind: "changed",
          label: "SLA window",
          detail: "burn from 72h → 2h·14m remaining, no breach risk",
        },
        {
          kind: "added",
          label: "Upload link with signed token",
          detail: "24h expiry, scoped to case VS-2841 only",
        },
      ],
    },

    evidence: [
      {
        title: "Employment contract",
        kind: "Document",
        contribution:
          "Confirmed employer, salary ≥ Blue Card threshold, contract duration > 12 months.",
        country: "DE",
        tag: "DOC-4417",
      },
      {
        title: "Missing: passport scan",
        kind: "Signal",
        contribution:
          "Triggered the document-gap detector · required by policy v12 before review.",
        tag: "SIG-gap-passport",
      },
      {
        title: "Client locale",
        kind: "Signal",
        contribution:
          "Case metadata (name, phone country, intake source) resolved locale as ru-DE.",
        country: "DE",
      },
      {
        title: "NODE-BER-01 telemetry",
        kind: "Node telemetry",
        contribution:
          "Intake node healthy at ingest · no replay doubts, no signal drift.",
        tag: "node·healthy",
      },
      {
        title: "BAMF policy feed",
        kind: "External check",
        contribution:
          "Blue Card document list synced 14 min before ingest · no rule drift.",
        tag: "ext·bamf·v12",
      },
    ],

    counterfactual: {
      pullQuote:
        "The best cases are the ones where the client never notices anything went wrong.",
      rows: [
        {
          label: "Time to first action",
          withDesk: "4m 12s",
          withoutDesk: "2h 40m",
          direction: "better",
        },
        {
          label: "Operator keystrokes",
          withDesk: "1",
          withoutDesk: "~140",
          direction: "better",
        },
        {
          label: "SLA window consumed",
          withDesk: "0.1%",
          withoutDesk: "3.7%",
          direction: "better",
        },
        {
          label: "Translation cost",
          withDesk: "bundled",
          withoutDesk: "€18 · outsourced",
          direction: "better",
        },
        {
          label: "PII surface area",
          withDesk: "in-case only",
          withoutDesk: "email thread + vendor",
          direction: "better",
        },
      ],
    },
  },
  // ---- Rejection bundle ---------------------------------------------------
  // Anchored to VS-3102 — an inbound Blue Card application that failed the
  // salary-threshold + employer-risk checks. The AI surfaced the reasons,
  // drafted a plain-language decline with appeal rights, and the operator
  // held the line. Rose tone across hero/confidence/counterfactual — the
  // value was in NOT sending a false-hope reply.
  {
    id: "BDL-3102-11B9",
    caseRef: "VS-3102",
    policyHash: "0x1b9e·bluecard·v12",
    generatedAt: "2026-07-02T09:47:00Z",

    kicker: "Live case · EU Blue Card · decline",
    titleLead: "Declining an application the operator",
    titleItalic: "would have second-guessed",
    verdict:
      "Threshold miss + employer flag, caught in under two minutes — decline drafted with appeal rights, sent after a one-second operator hold.",
    operator: "Daniil R.",
    duration: "1m 58s",
    outcomeTone: "rose",
    confidence: 88,
    outcomeLabel: "Declined · appeal rights enclosed",

    timelineLead:
      "Two minutes, two red flags, one held line. The trail below shows exactly when each signal arrived and who acknowledged it.",
    decisionLead:
      "A decline is the harder kind of decision — the reasoning has to survive an appeal, not just an audit. Here is what the operator co-signed.",
    evidenceLead:
      "Two independent sources, not one judgment call. Each row below is a check the desk had to clear before the decline could leave the building.",
    counterfactualLead:
      "The cost of declining manually is not in time — it is in the false-hope replies and inconsistent appeal language a tired operator sends instead.",

    timeline: [
      {
        marker: "t+0s",
        stage: "Lead intake",
        actor: "AI",
        note: "Case VS-3102 ingested from NODE-WAW-02 · applicant I. Sokolov, PL.",
        phase: "intake",
      },
      {
        marker: "t+6s",
        stage: "Salary check",
        actor: "AI",
        note: "Declared gross €49,800/yr · below Blue Card threshold €56,400 for 2026.",
        phase: "detection",
      },
      {
        marker: "t+14s",
        stage: "Employer risk flagged",
        actor: "AI",
        note: "Employer entity appears on BAMF provisional watch-list (added 11 Jun).",
        phase: "detection",
      },
      {
        marker: "t+42s",
        stage: "Decline drafted",
        actor: "AI",
        note: "Plain-language decline with statutory appeal window and case pointer.",
        phase: "resolution",
      },
      {
        marker: "t+1m 51s",
        stage: "Operator hold",
        actor: "Operator",
        note: "Daniil R. paused 1.2s, re-read the employer flag, approved decline.",
        phase: "resolution",
      },
      {
        marker: "t+1m 58s",
        stage: "Resolved",
        actor: "System",
        note: "Decline dispatched · appeal deadline timer started · audit sealed.",
        phase: "resolution",
      },
    ],

    decision: {
      question:
        "Should we accept this Blue Card application, reject it, or route to a human specialist?",
      summary:
        "Two independent red flags landed inside the same minute: the declared gross salary was 11.7% below the 2026 Blue Card threshold, and the sponsoring employer was added to a BAMF provisional watch-list three weeks before intake. Neither signal alone forces a decline, but their composition does under policy v12. The AI drafted a decline that cites both reasons plainly, encloses the statutory appeal window, and offers a pointer to the residence-permit fallback track. No edits from the operator.",
      policyName: "Blue Card v12 · threshold & sponsor integrity",
      policyDescription:
        "Reject applications that fall below the federal salary threshold OR are sponsored by a flagged entity. When both conditions hold, decline with full reasoning and a visible appeal path.",
      changes: [
        {
          kind: "added",
          label: "Statutory appeal window",
          detail: "30 days · deadline rendered in the client's locale",
        },
        {
          kind: "added",
          label: "Residence-permit fallback pointer",
          detail: "offers a non-Blue-Card track the client can still pursue",
        },
        {
          kind: "removed",
          label: "Consultation booking",
          detail: "auto-booked slot released · does not burn advisor capacity",
        },
        {
          kind: "changed",
          label: "Case state",
          detail: "active intake → closed-declined, retention 7y",
        },
      ],
    },

    evidence: [
      {
        title: "Declared salary",
        kind: "Document",
        contribution:
          "Employment offer states €49,800 gross — €6,600 below the 2026 threshold.",
        country: "PL",
        tag: "DOC-5521",
      },
      {
        title: "BAMF watch-list match",
        kind: "External check",
        contribution:
          "Employer VAT-ID matches a provisional watch-list entry added 11 Jun 2026.",
        tag: "ext·bamf·watch",
      },
      {
        title: "Policy threshold",
        kind: "Signal",
        contribution:
          "Blue Card federal threshold for 2026 resolved at €56,400 gross per year.",
        tag: "SIG-threshold-2026",
      },
      {
        title: "NODE-WAW-02 telemetry",
        kind: "Node telemetry",
        contribution:
          "Intake node healthy · OCR confidence 0.98 on the salary field, no ambiguity.",
        tag: "node·healthy",
      },
    ],

    counterfactual: {
      pullQuote:
        "The hardest cases are not the ones you approve — they are the ones you decline without leaving the client worse off.",
      rows: [
        {
          label: "Time to decision",
          withDesk: "1m 58s",
          withoutDesk: "~3 business days",
          direction: "better",
        },
        {
          label: "False-hope reply risk",
          withDesk: "0",
          withoutDesk: "moderate · tone drift typical",
          direction: "better",
        },
        {
          label: "Appeal rights surfaced",
          withDesk: "always",
          withoutDesk: "inconsistent · template-dependent",
          direction: "better",
        },
        {
          label: "Advisor capacity consumed",
          withDesk: "0 slots",
          withoutDesk: "1 consultation slot",
          direction: "better",
        },
        {
          label: "Operator cognitive load",
          withDesk: "1 re-read · 1.2s",
          withoutDesk: "cross-reference session",
          direction: "better",
        },
      ],
    },
  },
  // ---- Escalation bundle --------------------------------------------------
  // Anchored to VS-4710 — an inbound family-reunification case where the
  // ingested marriage certificate showed an apostille mismatch and the
  // sponsor's residence-permit feed was 9 days stale. The AI did NOT decide:
  // confidence dropped below the auto-route threshold and the case was
  // handed to a senior specialist with a structured brief. Amber tone — the
  // value here is the desk *not* pretending to know.
  {
    id: "BDL-4710-22C5",
    caseRef: "VS-4710",
    policyHash: "0x3c7d·family·v8",
    generatedAt: "2026-07-09T14:22:00Z",

    kicker: "Live case · family reunification · escalation",
    titleLead: "Stepping back when the evidence",
    titleItalic: "doesn't quite line up",
    verdict:
      "Apostille mismatch + stale sponsor feed dropped confidence to 61% — case routed to senior specialist with a structured brief, not a guess.",
    operator: "Lena F.",
    duration: "2m 47s",
    outcomeTone: "amber",
    confidence: 61,
    outcomeLabel: "Escalated · senior specialist",

    timelineLead:
      "Three minutes, two unresolved signals, one honest handoff. The trail below shows where the desk stopped reasoning and asked for a human.",
    decisionLead:
      "The hardest decision is the one not to decide. Here is the brief the AI wrote for the specialist — same shape as a verdict, different ending.",
    evidenceLead:
      "Two of these sources contradict each other in ways the desk cannot resolve from policy alone. That is why the case left autonomous routing.",
    counterfactualLead:
      "A manual operator would still have escalated this case — but four minutes later, with a thinner brief and no confidence trace attached.",

    timeline: [
      {
        marker: "t+0s",
        stage: "Lead intake",
        actor: "AI",
        note: "Case VS-4710 ingested from NODE-MUC-03 · sponsor M. Adler, DE.",
        phase: "intake",
      },
      {
        marker: "t+11s",
        stage: "Document intake",
        actor: "Client",
        note: "Marriage certificate uploaded (PDF, apostille page included).",
        phase: "intake",
      },
      {
        marker: "t+24s",
        stage: "Apostille mismatch detected",
        actor: "AI",
        note: "Issuing authority on cert (UA-2019) does not match Hague registry record.",
        phase: "detection",
      },
      {
        marker: "t+1m 02s",
        stage: "Sponsor feed stale",
        actor: "AI",
        note: "BAMF residence-permit feed last refreshed 9d ago · SLA is 72h.",
        phase: "detection",
      },
      {
        marker: "t+1m 38s",
        stage: "Confidence drop",
        actor: "AI",
        note: "Composite confidence fell to 61% · below auto-route threshold of 75%.",
        phase: "detection",
      },
      {
        marker: "t+2m 19s",
        stage: "Specialist brief drafted",
        actor: "AI",
        note: "Structured brief: open questions, evidence gaps, suggested next checks.",
        phase: "resolution",
      },
      {
        marker: "t+2m 47s",
        stage: "Escalated",
        actor: "System",
        note: "Routed to Lena F. (senior, family-reunification) · SLA clock paused.",
        phase: "resolution",
      },
    ],

    decision: {
      question:
        "Can we resolve this family reunification application from the evidence on hand, or does it need a human specialist?",
      summary:
        "Two signals undermined the autonomous path. First, the marriage certificate's apostille names an issuing authority (UA-2019) that does not appear in the current Hague registry — possibly a legitimate older issuance, possibly a forgery, not resolvable from document text alone. Second, the BAMF residence-permit feed for the sponsor was last refreshed nine days ago, well past its 72h freshness SLA, so the sponsor's current status cannot be confirmed in real time. Either signal alone might still allow a provisional draft; together they pulled composite confidence to 61%, below the 75% auto-route threshold. The AI declined to draft an outcome and instead produced a specialist brief listing open questions and the two checks that would unblock the case.",
      policyName: "Family v8 · evidence integrity & freshness",
      policyDescription:
        "When document authenticity OR external feed freshness fails, lower confidence by the configured margin. If composite confidence falls below 75%, escalate to a senior specialist with a structured brief — never auto-draft an outcome.",
      changes: [
        {
          kind: "added",
          label: "Specialist brief",
          detail: "open questions, evidence gaps, two suggested next checks",
        },
        {
          kind: "changed",
          label: "Confidence",
          detail: "94% baseline → 61% after apostille + feed-staleness penalties",
        },
        {
          kind: "added",
          label: "SLA clock pause",
          detail: "paused on escalation · resumes when specialist accepts case",
        },
        {
          kind: "removed",
          label: "Auto-drafted outcome",
          detail: "no approve/decline draft generated · desk does not guess",
        },
      ],
    },

    evidence: [
      {
        title: "Marriage certificate",
        kind: "Document",
        contribution:
          "Apostille names issuing authority UA-2019 · not present in current Hague registry.",
        country: "UA",
        tag: "DOC-7842",
      },
      {
        title: "Hague apostille registry",
        kind: "External check",
        contribution:
          "Authority code UA-2019 returns no match · could be pre-2020 issuance or forged.",
        tag: "ext·hague·v3",
      },
      {
        title: "BAMF sponsor feed",
        kind: "External check",
        contribution:
          "Sponsor residence-permit status feed last refreshed 9d ago · stale beyond 72h SLA.",
        country: "DE",
        tag: "ext·bamf·stale",
      },
      {
        title: "Confidence trace",
        kind: "Signal",
        contribution:
          "Composite dropped from 94% baseline to 61% · below 75% auto-route threshold.",
        tag: "SIG-conf-61",
      },
      {
        title: "NODE-MUC-03 telemetry",
        kind: "Node telemetry",
        contribution:
          "Intake node healthy · OCR confidence 0.96 on apostille block, no parse error.",
        tag: "node·healthy",
      },
    ],

    counterfactual: {
      pullQuote:
        "Knowing when to stop is harder than knowing how to continue — and far more valuable when a family is on the other side.",
      rows: [
        {
          label: "Time to specialist hands",
          withDesk: "2m 47s",
          withoutDesk: "~7 min",
          direction: "better",
        },
        {
          label: "Brief quality at handoff",
          withDesk: "structured · 2 next checks",
          withoutDesk: "free-text note",
          direction: "better",
        },
        {
          label: "Confidence trace attached",
          withDesk: "yes · auditable",
          withoutDesk: "no",
          direction: "better",
        },
        {
          label: "False-confidence risk",
          withDesk: "0",
          withoutDesk: "moderate · pressure to draft",
          direction: "better",
        },
        {
          label: "Specialist context-switch",
          withDesk: "1 read · brief in hand",
          withoutDesk: "re-intake from scratch",
          direction: "better",
        },
      ],
    },
  },
];

export function findBundle(id: string): PresentationBundle | undefined {
  return presentationBundles.find((b) => b.id === id);
}

/** The canonical bundle featured on /bundle (when no id in URL). */
export const FEATURED_BUNDLE_ID = "BDL-2841-07A3";

/** All demo bundles, in display order (for indexes, link lists). */
export const BUNDLE_INDEX = presentationBundles.map((b) => ({
  id: b.id,
  caseRef: b.caseRef,
  title: `${b.titleLead} ${b.titleItalic}`,
  titleLead: b.titleLead,
  titleItalic: b.titleItalic,
  kicker: b.kicker,
  verdict: b.verdict,
  outcomeTone: b.outcomeTone,
  outcomeLabel: b.outcomeLabel,
  confidence: b.confidence,
  duration: b.duration,
  generatedAt: b.generatedAt,
  operator: b.operator,
  policyHash: b.policyHash,
}));
