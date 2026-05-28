import { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * GlassCard — the gradient-border-shell primitive used across every
 * landing section, derived from DESIGN_2's "Gradient border shell"
 * material spec. A 1px outer wrapper carries a subtle lavender→fade
 * vertical gradient (the "premium edge"); the inner panel carries the
 * real glass surface (deep navy at 0.78α + backdrop-blur).
 *
 * Variants:
 *   - default: standard hairline frame (used for content cards)
 *   - subtle:  lower-opacity frame for secondary surfaces
 *   - solid:   inner panel uses card token, no blur (for tables / dense data)
 *
 * Radius defaults to 6px to match DESIGN_2 (radius scale: 4/6/8/12).
 */
type Variant = "default" | "subtle" | "solid";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  radius?: 4 | 6 | 8 | 12;
  innerClassName?: string;
  children: ReactNode;
}

const shellGradient: Record<Variant, string> = {
  default:
    "linear-gradient(180deg, hsl(252 90% 76% / 0.45), hsl(252 90% 76% / 0.05))",
  subtle:
    "linear-gradient(180deg, hsl(252 90% 76% / 0.22), hsl(252 90% 76% / 0.03))",
  solid:
    "linear-gradient(180deg, hsl(252 90% 76% / 0.35), hsl(252 90% 76% / 0.05))",
};

const innerBg: Record<Variant, string> = {
  default: "hsl(240 24% 6% / 0.78)",
  subtle: "hsl(240 24% 6% / 0.6)",
  solid: "hsl(240 24% 7% / 0.95)",
};

export const GlassCard = ({
  variant = "default",
  radius = 6,
  innerClassName,
  className,
  children,
  ...rest
}: GlassCardProps) => {
  const r = `${radius}px`;
  const useBlur = variant !== "solid";
  return (
    <div
      className={cn("p-[1px]", className)}
      style={{ background: shellGradient[variant], borderRadius: r }}
      {...rest}
    >
      <div
        className={cn("h-full w-full overflow-hidden", innerClassName)}
        style={{
          borderRadius: `calc(${r} - 1px)`,
          background: innerBg[variant],
          backdropFilter: useBlur ? "blur(8px)" : undefined,
          WebkitBackdropFilter: useBlur ? "blur(8px)" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};
