import {
  Inbox,
  CalendarCheck,
  FileSearch,
  BellRing,
  Database,
  UserRoundCog,
} from "lucide-react";
import { GlassCard } from "./GlassCard";
import { Lozenge } from "./Lozenge";

/**
 * Workflow — six-stage case lifecycle in the DESIGN_2 dashboard idiom.
 *
 * Polish pass:
 *  - Each step now has a dedicated lavender-chip icon, breathing very
 *    quietly via .animate-icon-breathe (4.2s cycle, ≤4% amplitude).
 *  - Vertical rhythm widened to py-28 md:py-40 for section air, with the
 *    grid gap bumped from 3 → 5 so cards no longer feel pressed together.
 *  - Card padding stretched to 7/6 for editorial whitespace.
 *  - Hover affordances stay quiet: text-color shift only, no glow,
 *    no transform.
 */
const steps = [
  { n: "01", icon: Inbox,         title: "Lead intake",          desc: "Structure the inbound inquiry into a qualified case in seconds.",        kpi: "median 8s" },
  { n: "02", icon: CalendarCheck, title: "Consultation booking", desc: "Hold the booking alive without back-and-forth scheduling threads.",      kpi: "auto-confirm" },
  { n: "03", icon: FileSearch,    title: "Document follow-up",   desc: "Chase the missing passport scan, photo, or form — politely, on time.",   kpi: "multi-channel" },
  { n: "04", icon: BellRing,      title: "Reminder",             desc: "Multilingual nudges before the consultation so no slot is wasted.",      kpi: "16 langs" },
  { n: "05", icon: Database,      title: "CRM handoff",          desc: "Prepare the verified update and write it to your system of record.",     kpi: "verified" },
  { n: "06", icon: UserRoundCog,  title: "Escalation",           desc: "Route the hard cases to the right human owner with full context.",      kpi: "human · always" },
];

export const Workflow = () => (
  <section id="workflow" className="py-28 md:py-40 relative section-veil">
    <div className="container-narrow">
      {/* Section meta header — extra room above grid */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse-glow" />
            <span>s · 01 / 04 · the lifecycle</span>
          </div>
          <h2 className="mt-7 font-serif font-light text-4xl md:text-6xl leading-[1.08] tracking-tight">
            <span className="text-foreground">One workspace for the </span>
            <span className="italic text-gradient-primary">full case lifecycle.</span>
          </h2>
          <p className="mt-7 text-[15px] md:text-[17px] text-foreground/80 max-w-2xl leading-[1.7] font-light">
            Most teams stop at chat. AI Action Desk keeps a single case moving — through every step
            the operator would otherwise own by hand.
          </p>
        </div>
        <div className="flex lg:flex-col items-start lg:items-end gap-2.5">
          <Lozenge tone="primary">live · 6 stages</Lozenge>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/90">
            updated · 04·21·26
          </span>
        </div>
      </div>

      {/* Stepped grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {steps.map(({ n, icon: Icon, title, desc, kpi }, i) => (
          <GlassCard key={n} variant="subtle" radius={6} className="group">
            <div className="px-7 py-7 transition-colors duration-200 hover:bg-primary/[0.025]">
              {/* Top meta row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Icon chip */}
                  <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-primary/25 bg-primary/[0.08]">
                    <Icon
                      className="h-3.5 w-3.5 text-primary animate-icon-breathe"
                      strokeWidth={1.5}
                      style={{ animationDelay: `${i * 0.35}s` }}
                    />
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-primary">
                    {n}
                  </span>
                  <span className="h-px w-6 bg-primary/40" />
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/90">
                    step {String(i + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                  </span>
                </div>
                <Lozenge>{kpi}</Lozenge>
              </div>

              <div className="mt-6 font-serif font-light text-[1.7rem] md:text-[1.85rem] leading-[1.15] tracking-tight text-foreground">
                {title}
              </div>
              <p className="mt-3.5 text-[14px] md:text-[14.5px] text-foreground/75 leading-[1.65] font-light">
                {desc}
              </p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Footer link */}
      <div className="mt-12 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.22em]">
        <span className="text-muted-foreground/90">view the full lifecycle map</span>
        <button className="text-primary hover:text-primary border-b border-primary/40 hover:border-primary pb-px transition-colors duration-200">
          open atlas →
        </button>
      </div>
    </div>
  </section>
);
