import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-none transition-smooth whitespace-nowrap",
  {
    variants: {
      tone: {
        violet: "bg-[hsl(var(--tint-violet)/0.14)] text-[hsl(var(--tint-violet-fg))] ring-1 ring-inset ring-[hsl(var(--tint-violet)/0.22)]",
        rose: "bg-[hsl(var(--tint-rose)/0.14)] text-[hsl(var(--tint-rose-fg))] ring-1 ring-inset ring-[hsl(var(--tint-rose)/0.22)]",
        amber: "bg-[hsl(var(--tint-amber)/0.14)] text-[hsl(var(--tint-amber-fg))] ring-1 ring-inset ring-[hsl(var(--tint-amber)/0.22)]",
        mint: "bg-[hsl(var(--tint-mint)/0.14)] text-[hsl(var(--tint-mint-fg))] ring-1 ring-inset ring-[hsl(var(--tint-mint)/0.22)]",
        slate: "bg-[hsl(var(--tint-slate)/0.12)] text-[hsl(var(--tint-slate-fg))] ring-1 ring-inset ring-[hsl(var(--tint-slate)/0.20)]",
      },
      size: {
        sm: "h-5 px-2 text-[10px]",
        md: "h-6 px-2.5 text-[11px]",
      },
    },
    defaultVariants: {
      tone: "slate",
      size: "md",
    },
  }
);

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  dot?: boolean;
}

export const Pill = ({
  tone,
  size,
  dot,
  className,
  children,
  ...props
}: PillProps) => (
  <span className={cn(pillVariants({ tone, size }), className)} {...props}>
    {dot && (
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: `hsl(var(--tint-${tone}-fg))`,
        }}
      />
    )}
    {children}
  </span>
);
