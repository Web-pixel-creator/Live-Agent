import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Sparkles } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { Lozenge } from "./Lozenge";

/**
 * CTA — final card, polished.
 *
 * Polish pass:
 *  - Padding stretched to px-10 py-16 md:px-20 md:py-24 for editorial air.
 *  - KPI strip now spans md:grid-cols-4 with extra column gap and indices
 *    moved into a separate mono prefix line so values can breathe.
 *  - Booking lozenge gains a faint breathing pulse on its calendar icon.
 *  - A small Sparkles glyph next to the meta strip signals "live" without
 *    relying on the existing pulsing dot alone.
 */
export const CTA = () => (
  <section className="py-28 md:py-40 relative section-veil">
    <div className="container-narrow">
      <GlassCard variant="default" radius={8}>
        <div className="relative px-10 py-16 md:px-20 md:py-24">
          {/* Top meta strip */}
          <div className="flex items-center justify-between mb-12 gap-4 flex-wrap">
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse-glow" />
              <span>fin · 04 / 04 · book a demo</span>
              <Sparkles className="h-3 w-3 text-primary animate-icon-breathe" strokeWidth={1.5} />
            </div>
            <Lozenge
              tone="primary"
              icon={
                <Calendar
                  className="h-2.5 w-2.5 animate-icon-breathe"
                  strokeWidth={1.75}
                />
              }
            >
              20 min · live
            </Lozenge>
          </div>

          <h2 className="font-serif font-light text-4xl md:text-6xl leading-[1.08] tracking-tight max-w-3xl">
            <span className="text-foreground">Ready to move cases </span>
            <span className="italic text-gradient-primary">forward?</span>
          </h2>
          <p className="mt-7 text-[15px] md:text-[17px] text-foreground/80 max-w-xl leading-[1.7] font-light">
            See the live workflow on a real visa case in 20 minutes. No setup required —
            we'll spin up an isolated workspace before the call.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 group rounded-[6px] h-11 px-6 font-medium tracking-normal"
            >
              Book a demo
              <ArrowRight
                className="ml-1.5 h-4 w-4 group-hover:translate-x-0.5 transition-smooth"
                strokeWidth={2}
              />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-foreground hover:bg-secondary/60 rounded-[6px] h-11 px-5 font-light border border-primary/15"
            >
              Read the docs
            </Button>
          </div>

          {/* Footer KPI strip */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-y-5 md:gap-x-8 border-t border-primary/15 pt-7">
            {[
              { k: "operators",        v: "08" },
              { k: "live cases",       v: "VS-2841" },
              { k: "approval median",  v: "12.4s" },
              { k: "uptime · 30d",     v: "99.97%" },
            ].map((m, i) => (
              <div
                key={m.k}
                className={i > 0 ? "md:pl-8 md:border-l md:border-primary/15" : ""}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/90">
                  {String(i).padStart(2, "0")} · {m.k}
                </div>
                <div className="mt-2 font-mono text-[15px] text-primary">{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  </section>
);
