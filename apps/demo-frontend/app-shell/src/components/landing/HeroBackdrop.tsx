import { useEffect, useState } from "react";
import { HeroTerrain } from "./HeroTerrain";
import { useMotionPaused } from "@/hooks/useMotionPaused";

/**
 * HeroBackdrop — full-bleed, fixed WebGL backdrop for the entire landing
 * page. Mirrors the reference pattern (`<canvas class="fixed inset-0
 * z-[-1] pointer-events-none">`): the dot-matrix field lives behind ALL
 * sections, not just the hero, so scrolling reveals the same meditative
 * field beneath every block.
 *
 * Layers (back → front):
 *   1. Solid page bg (var(--background))
 *   2. Radial lavender wash + 45° spatial-rhythm grid (DOM fallback,
 *      always on — also acts as the poster while WebGL warms up and as
 *      the only visual on mobile / no-WebGL).
 *   3. WebGL dot-matrix terrain (desktop + reduced-motion respected).
 *   4. Top + bottom vignette so section content stays legible.
 */
export const HeroBackdrop = () => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [paused] = useMotionPaused();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqMobile = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setReducedMotion(mq.matches);
      setIsMobile(mqMobile.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    mqMobile.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      mqMobile.removeEventListener("change", sync);
    };
  }, []);

  const freeze = reducedMotion || paused;

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0"
    >
      {/* Solid page bg so the canvas alpha never bleeds through to white */}
      <div className="absolute inset-0 bg-background" />

      {/* DOM poster — radial wash + 45° rhythm grid. Always rendered so
          we have a guaranteed fallback if WebGL fails or on mobile. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 35%, hsl(252 70% 30% / 0.35), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(45deg, hsl(252 90% 76% / 0.4) 1px, transparent 1px), linear-gradient(-45deg, hsl(252 90% 76% / 0.4) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)",
        }}
      />

      {/* WebGL dot-matrix field — desktop only, respects reduced-motion */}
      {!isMobile && (
        <div className="absolute inset-0">
          <HeroTerrain reducedMotion={freeze} />
        </div>
      )}

      {/* Bottom vignette so footer / CTA copy stays readable */}
      <div
        className="absolute inset-x-0 bottom-0 h-64"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, hsl(240 24% 6% / 0.85) 100%)",
        }}
      />
    </div>
  );
};
