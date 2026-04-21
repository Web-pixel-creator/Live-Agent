import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * IntroOverlay — lightweight, auto-playing landing intro.
 *
 * Plays once on mount: the page bg + dot-matrix backdrop are already
 * visible behind it; this overlay just adds a brief curtain that
 * darkens slightly, reveals a single eyebrow + serif line, then fades
 * out and pulses a "scroll" hint at the bottom of the viewport.
 *
 * Skipped entirely on prefers-reduced-motion or after a previous visit
 * (sessionStorage), and dismissable on click / scroll / Esc.
 */
export const IntroOverlay = () => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = sessionStorage.getItem("intro:seen");
    if (reduced || seen) return;
    setVisible(true);
    sessionStorage.setItem("intro:seen", "1");

    const auto = window.setTimeout(() => dismiss(), 2600);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    const onScroll = () => dismiss();
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("touchmove", onScroll, { passive: true });
    return () => {
      window.clearTimeout(auto);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("touchmove", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    setExiting(true);
    window.setTimeout(() => setVisible(false), 700);
  };

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center cursor-pointer transition-opacity duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse 70% 55% at 50% 50%, hsl(248 30% 8% / 0.55), hsl(240 24% 6% / 0.92))",
        backdropFilter: "blur(1px)",
      }}
    >
      <div className="text-center px-6">
        <div
          className="font-mono text-[11px] uppercase tracking-[0.32em] text-primary/80 animate-fade-up"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary mr-2 align-middle animate-pulse-glow" />
          system / initializing
        </div>
        <h2
          className="mt-6 font-serif font-light text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-tight text-foreground/95 animate-fade-up"
          style={{ animationDelay: "0.18s", letterSpacing: "-0.02em" }}
        >
          Operator <span className="italic text-gradient-primary">workspace</span> online.
        </h2>
        <p
          className="mt-5 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/90 animate-fade-up"
          style={{ animationDelay: "0.32s" }}
        >
          calibrating field · lat 51.5° · lon 0.1°
        </p>
      </div>

      <div
        className="absolute bottom-10 flex flex-col items-center gap-2 animate-fade-up"
        style={{ animationDelay: "0.5s" }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary/70">
          scroll to enter
        </span>
        <ChevronDown
          className="h-4 w-4 text-primary/80 animate-icon-breathe"
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
};
