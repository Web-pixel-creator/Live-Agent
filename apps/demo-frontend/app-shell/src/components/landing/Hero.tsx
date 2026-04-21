import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Star } from "lucide-react";
import { HeroDashboardCard } from "./HeroDashboardCard";

/**
 * Hero — financial-dashboard composition (ref: Neuform Financial Insights
 * Platform), remapped to lavender brand palette.
 *
 * Layout:
 *  - Two-column grid on lg+: serif headline + CTAs on the left,
 *    glassy dashboard preview card (HeroDashboardCard) on the right.
 *    Stacks vertically on smaller screens.
 *  - Background field (HeroBackdrop) stays full-bleed behind everything.
 *  - All chrome uses the gradient-border-shell technique: hairline
 *    lavender frame around a dark glass surface (no hover bloom).
 *
 * Voice: operator-grade — small mono labels, serif metric typography,
 * lozenge buttons. Hover affordances stay quiet (text/color only),
 * matching DESIGN_2 motion spec.
 */
export const Hero = () => {
  return (
    <section className="relative flex flex-col justify-center overflow-hidden">
      {/* Background lives in <HeroBackdrop /> at page root */}

      <div className="container-narrow relative z-10 pt-20 pb-24">
        {/* Top instrument bar — gradient shell, static (no hover bloom). */}
        <div
          className="p-[1px] rounded-[4px] mb-12 animate-fade-up"
          style={{
            background:
              "linear-gradient(180deg, hsl(252 90% 76% / 0.35), hsl(252 90% 76% / 0.05))",
          }}
        >
          <div
            className="flex items-center justify-between rounded-[4px] px-4 py-2.5"
            style={{
              background: "hsl(240 24% 6% / 0.82)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
              <span>system / live</span>
            </div>
            <div className="hidden sm:flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/90">
              <span>lat 51.5° · lon 0.1°</span>
              <span className="text-primary">v.04.21</span>
            </div>
          </div>
        </div>

        {/* Two-column dashboard composition */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
          {/* LEFT — copy block */}
          <div className="lg:col-span-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary animate-fade-up">
              structural · operator-safe ai workspace
            </div>

            <h1
              className="mt-8 font-serif font-light text-5xl sm:text-6xl lg:text-[5rem] leading-[1.05] tracking-tight animate-fade-up"
              style={{ animationDelay: "0.08s", letterSpacing: "-0.025em" }}
            >
              <span className="text-foreground">Move every visa case </span>
              <span className="italic text-gradient-primary">forward, safely.</span>
            </h1>

            <p
              className="mt-7 max-w-xl text-[15px] md:text-[17px] text-foreground/85 leading-[1.7] font-light animate-fade-up"
              style={{ animationDelay: "0.16s" }}
            >
              One workspace from intake to handoff — orchestrate every visa
              decision with approval boundaries the human always sees.
            </p>

            <div
              className="mt-9 flex flex-col sm:flex-row items-start sm:items-center gap-3 animate-fade-up"
              style={{ animationDelay: "0.24s" }}
            >
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 group rounded-[6px] h-11 px-6 font-medium tracking-normal">
                Initialize workspace
                <ArrowRight
                  className="ml-1.5 h-4 w-4 group-hover:translate-x-0.5 transition-smooth animate-icon-drift"
                  strokeWidth={2}
                />
              </Button>
              <Button
                variant="ghost"
                className="text-foreground hover:bg-secondary/60 group rounded-[6px] h-11 px-5 font-light border border-primary/15"
              >
                <Play className="mr-1.5 h-3 w-3 fill-current animate-icon-breathe" strokeWidth={1.75} />
                Watch the live workflow
              </Button>
            </div>

            <div
              className="mt-7 flex items-center gap-3 animate-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="flex items-center gap-0.5 text-primary/80">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-3 w-3 fill-current animate-icon-breathe"
                    strokeWidth={0}
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/90">
                4.9/5 · operator consensus
              </span>
            </div>
          </div>

          {/* RIGHT — glassy dashboard preview */}
          <div className="lg:col-span-5">
            <HeroDashboardCard />
          </div>
        </div>
      </div>
    </section>
  );
};
