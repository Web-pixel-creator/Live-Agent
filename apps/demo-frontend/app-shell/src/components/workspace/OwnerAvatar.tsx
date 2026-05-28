import { Bot } from "lucide-react";

// Curated palette of dual-tone gradients tied to our tint tokens.
// Deterministic by name → same person always gets the same colour.
const GRADIENTS: { from: string; to: string }[] = [
  { from: "hsl(var(--tint-violet))", to: "hsl(var(--tint-rose))" },
  { from: "hsl(var(--tint-mint))", to: "hsl(var(--tint-violet))" },
  { from: "hsl(var(--tint-amber))", to: "hsl(var(--tint-rose))" },
  { from: "hsl(var(--tint-violet))", to: "hsl(var(--tint-mint))" },
  { from: "hsl(var(--tint-rose))", to: "hsl(var(--tint-amber))" },
  { from: "hsl(var(--tint-amber))", to: "hsl(var(--tint-mint))" },
];

function hashIndex(name: string, mod: number) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % mod;
}

function initials(name: string) {
  const parts = name.replace(/\./g, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface OwnerAvatarProps {
  name: string;
  size?: number;
  /**
   * Marks this avatar as belonging to the current operator. Adds a soft
   * lavender ring + tiny corner dot so "my" cases visually stand out in
   * dense lists even when the "Mine only" filter is off.
   */
  mine?: boolean;
}

export function OwnerAvatar({ name, size = 20, mine = false }: OwnerAvatarProps) {
  // Bot avatar for automated owners.
  if (name === "Auto") {
    return (
      <span
        aria-label="Automated"
        className="inline-flex items-center justify-center rounded-full bg-secondary/60 text-muted-foreground shrink-0 ring-1 ring-inset ring-border"
        style={{ width: size, height: size }}
      >
        <Bot className="h-2.5 w-2.5" strokeWidth={2} />
      </span>
    );
  }

  const g = GRADIENTS[hashIndex(name, GRADIENTS.length)];
  const dotSize = Math.max(6, Math.round(size * 0.34));

  return (
    <span
      aria-label={mine ? `${name} (you)` : name}
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className={
          mine
            ? "inline-flex items-center justify-center rounded-full text-[9px] font-semibold tracking-tight text-background w-full h-full ring-2 ring-offset-1 ring-offset-background"
            : "inline-flex items-center justify-center rounded-full text-[9px] font-semibold tracking-tight text-background w-full h-full ring-1 ring-inset ring-background/10"
        }
        style={{
          backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})`,
          ...(mine
            ? ({ "--tw-ring-color": "hsl(var(--primary) / 0.7)" } as React.CSSProperties)
            : {}),
        }}
      >
        {initials(name)}
      </span>
      {mine && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-primary ring-2 ring-background"
          style={{ width: dotSize, height: dotSize }}
        />
      )}
    </span>
  );
}
