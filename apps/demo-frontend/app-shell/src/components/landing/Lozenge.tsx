import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lozenge — small pill chip used for tags, time-range pills, and status
 * markers across the landing page. Mirrors DESIGN_2's 9999px radius +
 * tiny padding (px-2 py-1) and 9–10px mono uppercase label.
 *
 * Tones map to our brand:
 *   - default: muted hairline (neutral chip)
 *   - primary: lavender accent (active pill)
 *   - solid:   filled lavender (CTA-style)
 */
type Tone = "default" | "primary" | "solid";

interface LozengeProps {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

const tones: Record<Tone, string> = {
  default:
    "border border-primary/15 text-muted-foreground/90 hover:text-foreground hover:border-primary/30",
  primary:
    "border border-primary/35 text-primary bg-primary/[0.07]",
  solid:
    "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary",
};

export const Lozenge = ({
  tone = "default",
  children,
  icon,
  className,
}: LozengeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-200",
      tones[tone],
      className,
    )}
  >
    {icon}
    {children}
  </span>
);
