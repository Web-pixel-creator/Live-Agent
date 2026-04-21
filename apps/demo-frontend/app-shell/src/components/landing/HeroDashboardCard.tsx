import { Copy, Maximize2, Calendar, Clock } from "lucide-react";
import { MiniSparkline } from "./MiniSparkline";

/**
 * HeroDashboardCard — the glassy "preview" card on the right of the hero,
 * mirroring the Neuform Financial Insights composition (header row with
 * lozenge buttons, big serif metric, sparkline, footer KPI strip) but
 * remapped to our visa-operator domain and lavender brand palette.
 *
 * Material follows the DESIGN_2 spec: gradient border shell (hairline
 * lavender frame) wrapping a glass surface with subtle blur. All hover
 * affordances are quiet text/color shifts — no glow, no transform.
 */
const sparkPoints = [
  12, 14, 13, 16, 18, 17, 19, 22, 21, 24, 23, 26, 28, 27, 30, 32, 31, 34, 36, 35,
  38, 40, 39, 42, 44, 43, 46, 48, 47, 50,
];

const kpiRow = [
  { k: "intake", v: "284", d: "+12" },
  { k: "approved", v: "176", d: "+08" },
  { k: "review", v: "62", d: "−03" },
  { k: "blocked", v: "04", d: "00" },
];

export const HeroDashboardCard = () => {
  return (
    <div
      className="p-[1px] rounded-[6px] animate-fade-up"
      style={{
        background:
          "linear-gradient(180deg, hsl(252 90% 76% / 0.45), hsl(252 90% 76% / 0.06))",
        animationDelay: "0.32s",
      }}
    >
      <div
        className="rounded-[6px] overflow-hidden"
        style={{
          background: "hsl(240 24% 6% / 0.78)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {/* Header bar — chip + action buttons (ref: Copy link / Expand) */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/90">
            <span className="inline-block h-1 w-1 rounded-full bg-primary" />
            <span>case · vs-2841</span>
            <span className="text-muted-foreground/90">·</span>
            <span className="text-primary/70">live</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="flex items-center gap-1 rounded-[4px] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/90 hover:text-foreground border border-primary/15 hover:border-primary/30 transition-colors duration-200"
            >
              <Copy className="h-2.5 w-2.5" strokeWidth={1.5} />
              copy
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-[4px] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
            >
              <Maximize2 className="h-2.5 w-2.5 animate-icon-breathe" strokeWidth={1.75} />
              expand
            </button>
          </div>
        </div>

        {/* Metric block */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/90">
                approval median · 30d
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-serif font-light text-5xl tracking-tight text-foreground/95 leading-none">
                  12.4
                </span>
                <span className="font-mono text-xs text-primary/80">sec</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tint-mint-fg))]/80">
                  ▲ 06%
                </span>
              </div>
            </div>
            {/* Time-range pills */}
            <div className="hidden sm:flex items-center gap-1">
              {["1D", "7D", "30D", "ALL"].map((r, i) => (
                <button
                  key={r}
                  className={`rounded-[4px] px-2 py-1 font-mono text-[9px] tracking-[0.1em] transition-colors duration-150 ${
                    i === 2
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground/90 hover:text-foreground border border-transparent"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Sparkline */}
          <div className="mt-4">
            <MiniSparkline points={sparkPoints} height={72} />
          </div>

          {/* X-axis tickers */}
          <div className="mt-1.5 flex justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/90">
            <span>03·22</span>
            <span>03·29</span>
            <span>04·05</span>
            <span>04·12</span>
            <span>04·21</span>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 border-t border-primary/10">
          {kpiRow.map((m, i) => (
            <div
              key={m.k}
              className={`px-4 py-3 ${
                i < kpiRow.length - 1 ? "border-r border-primary/10" : ""
              }`}
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/90">
                {m.k}
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-mono text-sm text-foreground/95">{m.v}</span>
                <span
                  className={`font-mono text-[9px] tracking-tight ${
                    m.d.startsWith("+")
                      ? "text-[hsl(var(--tint-mint-fg))]/85"
                      : m.d.startsWith("−")
                        ? "text-[hsl(var(--tint-rose-fg))]/85"
                        : "text-muted-foreground/90"
                  }`}
                >
                  {m.d}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer meta */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-primary/10 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/90">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" strokeWidth={1.5} />
              04·21·26
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5 animate-icon-breathe" strokeWidth={1.5} />
              09:41 utc
            </span>
          </div>
          <span className="text-primary/70">policy · v1.04</span>
        </div>
      </div>
    </div>
  );
};
