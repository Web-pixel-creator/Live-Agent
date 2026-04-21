import { Eye, AudioLines, MessageSquare, MousePointerClick } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { Lozenge } from "./Lozenge";

/**
 * Capabilities — financial-dashboard hero tile + supporting lane,
 * remapped to lavender. The Act tile carries a hairline-framed glass
 * surface with a serif headline metric ("Act."), while See/Hear/Speak
 * stack as a thin sidebar of dense rows with mono labels — same rhythm
 * as the KPI strip in HeroDashboardCard.
 */
const supporting = [
  { icon: Eye, title: "See", desc: "Image, video, and screen inputs feed the case context in real time.", tag: "vision" },
  { icon: AudioLines, title: "Hear", desc: "Live audio with multilingual transcription and interruption handling.", tag: "audio" },
  { icon: MessageSquare, title: "Speak", desc: "Realtime conversation with negotiation, translation, and grounded research.", tag: "voice" },
];

export const Capabilities = () => (
<section id="capabilities" className="py-28 md:py-40 relative section-veil">
    <div className="container-narrow">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse-glow" />
            <span>s · 02 / 04 · capabilities</span>
          </div>
          <h2 className="mt-7 font-serif font-light text-4xl md:text-6xl leading-[1.08] tracking-tight">
            <span className="text-foreground">See, hear, speak, </span>
            <span className="italic text-gradient-primary">act.</span>
          </h2>
          <p className="mt-7 text-[15px] md:text-[17px] text-foreground/80 max-w-2xl leading-[1.7] font-light">
            Three senses feed the workspace. One capability changes the outcome —
            UI Navigator <em className="not-italic text-primary">acts</em>, with approvals and replay evidence.
          </p>
        </div>
        <div className="flex lg:flex-col items-start lg:items-end gap-2.5">
          <Lozenge tone="primary">04 channels</Lozenge>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/90">
            uptime · 99.97%
          </span>
        </div>
      </div>

      {/* Asymmetric grid: Act = hero metric tile, supporting = sidebar */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        {/* Hero tile — Act */}
        <GlassCard variant="default" radius={8}>
          <div className="relative px-10 py-10 md:px-12 md:py-12">
            <div className="flex items-center justify-between">
              <Lozenge
                tone="primary"
                icon={
                  <MousePointerClick
                    className="h-2.5 w-2.5 animate-icon-breathe"
                    strokeWidth={2}
                  />
                }
              >
                differentiator
              </Lozenge>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/90">
                03 / 04
              </span>
            </div>

            <div className="mt-12 font-serif font-light text-6xl md:text-7xl leading-none tracking-tight text-foreground">
              Act<span className="text-primary">.</span>
            </div>

            <p className="mt-7 max-w-md text-[15px] md:text-[16px] text-foreground/80 leading-[1.7] font-light">
              UI Navigator executes safe browser actions with explicit approval boundaries
              and full replay evidence. Other agents stop at chat — this one closes the loop.
            </p>

            {/* Mini KPI strip */}
            <div className="mt-12 grid grid-cols-3 border-t border-primary/15 pt-6 gap-px">
              {[
                { k: "approvals", v: "100%" },
                { k: "replay", v: "deterministic" },
                { k: "stack", v: "gemini · gcp" },
              ].map((m, i) => (
                <div key={m.k} className={i > 0 ? "pl-6 border-l border-primary/15" : ""}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/90">
                    {m.k}
                  </div>
                  <div className="mt-2 font-mono text-[13px] text-primary">{m.v}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Supporting lane */}
        <div className="grid grid-rows-3 gap-5">
          {supporting.map(({ icon: Icon, title, desc, tag }, i) => (
            <GlassCard key={title} variant="subtle" radius={6} className="group">
              <div className="px-6 py-6 transition-colors duration-200 hover:bg-primary/[0.025]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-[6px] border border-primary/25 flex items-center justify-center bg-primary/[0.08]">
                      <Icon
                        className="h-3.5 w-3.5 text-primary animate-icon-breathe"
                        strokeWidth={1.5}
                        style={{ animationDelay: `${i * 0.5}s` }}
                      />
                    </div>
                    <span className="font-serif text-xl tracking-tight text-foreground">{title}</span>
                  </div>
                  <Lozenge>{`0${i + 1} · ${tag}`}</Lozenge>
                </div>
                <p className="mt-3.5 text-[14px] text-foreground/75 leading-[1.65] font-light">
                  {desc}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  </section>
);
