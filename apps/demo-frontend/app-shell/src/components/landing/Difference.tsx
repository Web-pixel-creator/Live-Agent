import { Check, Minus, MessagesSquare, MousePointer2, ShieldCheck } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { Lozenge } from "./Lozenge";

/**
 * Difference — comparison table polished for the DESIGN_2 system.
 *
 * Polish pass:
 *  - Section padding bumped to py-28 md:py-40 (matches Workflow rhythm).
 *  - Header columns gain category icons (chat / cursor / shield) so the
 *    table reads at a glance without depending on copy alone.
 *  - Active "AI Action Desk" column header carries a slow hairline-sweep
 *    on its top edge — the only subtle motion cue, lavender, low-key.
 *  - Row dividers stay dotted/hairline; check/minus glyphs unchanged so
 *    nothing jumps in contrast.
 */
const rows = [
  { label: "Answers questions",         chat: true,  browser: false, desk: true },
  { label: "Executes browser actions",  chat: false, browser: true,  desk: true },
  { label: "Approval boundaries",       chat: false, browser: false, desk: true },
  { label: "Verified summaries",        chat: false, browser: false, desk: true },
  { label: "Clean CRM handoff",         chat: false, browser: false, desk: true },
  { label: "Operator-visible state",    chat: false, browser: false, desk: true },
];

const Cell = ({ on, accent = false }: { on: boolean; accent?: boolean }) =>
  on ? (
    <Check
      className={`h-3.5 w-3.5 mx-auto ${accent ? "text-primary" : "text-muted-foreground/90"}`}
      strokeWidth={2.25}
    />
  ) : (
    <Minus className="h-3 w-3 text-muted-foreground/90 mx-auto" strokeWidth={1.75} />
  );

const ColIcon = ({
  Icon,
  active = false,
}: {
  Icon: typeof MessagesSquare;
  active?: boolean;
}) => (
  <Icon
    className={`h-3 w-3 ${active ? "text-primary" : "text-muted-foreground/90"}`}
    strokeWidth={1.75}
  />
);

export const Difference = () => (
  <section id="difference" className="py-28 md:py-40 relative section-veil">
    <div className="container-narrow">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse-glow" />
            <span>s · 03 / 04 · why us</span>
          </div>
          <h2 className="mt-7 font-serif font-light text-4xl md:text-6xl leading-[1.08] tracking-tight">
            <span className="text-foreground">More useful than a </span>
            <span className="italic text-gradient-primary">chatbot alone.</span>
          </h2>
          <p className="mt-7 text-[15px] md:text-[17px] text-foreground/80 max-w-2xl leading-[1.7] font-light">
            Chat tools stop at answers. Browser bots stop at clicks. AI Action Desk combines case
            progress, approval boundaries, and verified handoff in one workspace.
          </p>
        </div>
        <div className="flex lg:flex-col items-start lg:items-end gap-2.5">
          <Lozenge tone="primary">comparison · 06 rows</Lozenge>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/90">
            policy · v1.04
          </span>
        </div>
      </div>

      <GlassCard variant="solid" radius={8}>
        {/* Header row — icons paired with column labels */}
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1.1fr] font-mono text-[10.5px] uppercase tracking-[0.2em] border-b border-primary/15">
          <div className="px-6 py-5 text-muted-foreground/90">capability</div>
          <div className="px-6 py-5 flex items-center justify-center gap-2 text-muted-foreground/90">
            <ColIcon Icon={MessagesSquare} />
            <span>chatbot</span>
          </div>
          <div className="px-6 py-5 flex items-center justify-center gap-2 text-muted-foreground/90">
            <ColIcon Icon={MousePointer2} />
            <span>browser bot</span>
          </div>
          <div className="relative px-6 py-5 flex items-center justify-center gap-2 bg-primary/[0.08] border-l border-primary/25">
            {/* Animated hairline highlight at the top edge of the active column */}
            <span className="absolute top-0 left-0 right-0 h-px animate-hairline-sweep" aria-hidden />
            <ColIcon Icon={ShieldCheck} active />
            <span className="text-primary tracking-[0.2em]">ai action desk</span>
          </div>
        </div>

        {/* Body rows */}
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`grid grid-cols-[1.6fr_1fr_1fr_1.1fr] items-center text-[14px] md:text-[14.5px] transition-colors duration-200 hover:bg-primary/[0.03] ${
              i !== rows.length - 1 ? "border-b border-dashed border-primary/15" : ""
            }`}
          >
            <div className="px-6 py-4 text-foreground font-light">
              <span className="font-mono text-[10.5px] text-muted-foreground/90 mr-3">
                {String(i + 1).padStart(2, "0")}
              </span>
              {r.label}
            </div>
            <div className="px-6 py-4"><Cell on={r.chat} /></div>
            <div className="px-6 py-4"><Cell on={r.browser} /></div>
            <div className="px-6 py-4 bg-primary/[0.08] border-l border-primary/25 h-full flex items-center justify-center">
              <Cell on={r.desk} accent />
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  </section>
);
