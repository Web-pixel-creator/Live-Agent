import { Pause, Play } from "lucide-react";
import { useMotionPaused } from "@/hooks/useMotionPaused";

/**
 * MotionToggle — small pill, fixed bottom-right, lets the operator
 * pause / resume the WebGL backdrop animation. Colors stay on brand
 * (lavender on deep navy), no extra motion of its own. State is
 * persisted via the useMotionPaused store and honored by HeroTerrain.
 */
export const MotionToggle = () => {
  const [paused, setPaused] = useMotionPaused();

  return (
    <button
      type="button"
      onClick={() => setPaused(!paused)}
      aria-pressed={paused}
      aria-label={paused ? "Resume backdrop animation" : "Pause backdrop animation"}
      className="fixed bottom-5 right-5 z-40 group flex items-center gap-2 rounded-[4px] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80 hover:text-primary transition-colors duration-200"
      style={{
        background: "hsl(240 24% 6% / 0.85)",
        border: "1px solid hsl(252 90% 76% / 0.25)",
        backdropFilter: "blur(6px)",
      }}
    >
      {paused ? (
        <Play className="h-3 w-3 fill-current" strokeWidth={1.75} />
      ) : (
        <Pause className="h-3 w-3 fill-current" strokeWidth={1.75} />
      )}
      <span>{paused ? "motion / paused" : "motion / live"}</span>
    </button>
  );
};
