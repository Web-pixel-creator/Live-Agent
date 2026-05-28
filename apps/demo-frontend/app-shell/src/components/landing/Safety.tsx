import { ShieldCheck, Eye, ScrollText, UserRoundCheck, Lock } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { Lozenge } from "./Lozenge";

/**
 * Safety — sticky-headline + glass list, polished.
 *
 * Polish pass:
 *  - Section padding extended to py-28 md:py-40.
 *  - Sticky column gains a small lavender Lock icon next to the eyebrow
 *    so the safety theme reads instantly.
 *  - Each guarantee row's icon chip now breathes with .animate-icon-breathe
 *    (staggered delay) — keeps the page alive under the dot-matrix backdrop.
 *  - Row padding lifted to py-6 px-7 for additional whitespace.
 *  - Hover stays quiet (text-color shift only).
 */
const items = [
  {
    icon: ShieldCheck,
    title: "Approval before sensitive actions",
    desc: "Sensitive steps pause for explicit operator approval — never silent execution.",
    tag: "guard",
  },
  {
    icon: Eye,
    title: "Visible result summaries",
    desc: "Every completed path ends with a verified summary the operator can scan in seconds.",
    tag: "audit",
  },
  {
    icon: ScrollText,
    title: "Replay evidence",
    desc: "Deterministic demo and workflow fixtures, with full action traces for audit.",
    tag: "trace",
  },
  {
    icon: UserRoundCheck,
    title: "Explicit human handoff",
    desc: "When a case should leave automation, the routing is visible — not hidden.",
    tag: "human",
  },
];

export const Safety = () => (
  <section id="safety" className="py-28 md:py-40 relative section-veil">
    <div className="container-narrow">
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-20">
        {/* Sticky headline column */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse-glow" />
            <span>s · 04 / 04 · safety</span>
            <Lock className="h-3 w-3 text-primary animate-icon-breathe" strokeWidth={1.75} />
          </div>
          <h2 className="mt-7 font-serif font-light text-4xl md:text-5xl leading-[1.08] tracking-tight">
            <span className="text-foreground">Built to stay </span>
            <span className="italic text-gradient-primary">operator-safe.</span>
          </h2>
          <p className="mt-7 text-[15px] md:text-[17px] text-foreground/80 leading-[1.7] font-light">
            For teams that still need human control over sensitive actions. Approval boundaries
            stay visible. The operator always sees the next step.
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
            <Lozenge tone="primary">soc-2 · ready</Lozenge>
            <Lozenge>gdpr</Lozenge>
            <Lozenge>iso 27001</Lozenge>
          </div>
        </div>

        {/* Guarantee list */}
        <div className="space-y-4">
          {items.map(({ icon: Icon, title, desc, tag }, i) => (
            <GlassCard key={title} variant="subtle" radius={6}>
              <div className="px-7 py-6 flex gap-5 transition-colors duration-200 hover:bg-primary/[0.025]">
                <div className="shrink-0 h-11 w-11 rounded-[6px] border border-primary/25 bg-primary/[0.08] flex items-center justify-center">
                  <Icon
                    className="h-4 w-4 text-primary animate-icon-breathe"
                    strokeWidth={1.5}
                    style={{ animationDelay: `${i * 0.45}s` }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/90">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-serif text-xl tracking-tight text-foreground">{title}</span>
                    </div>
                    <Lozenge>{tag}</Lozenge>
                  </div>
                  <p className="mt-2.5 text-[14px] md:text-[14.5px] text-foreground/75 leading-[1.65] font-light">
                    {desc}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  </section>
);
