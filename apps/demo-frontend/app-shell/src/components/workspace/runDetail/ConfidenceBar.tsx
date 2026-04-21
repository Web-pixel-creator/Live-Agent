// Thin horizontal track with a tinted fill. Coupling bar colour to the
// outcome tone keeps fill and risk band reading as one unit, so operators
// don't have to cross-reference the pill above.
export const ConfidenceBar = ({
  value,
  tone,
}: {
  value: number;
  tone: "mint" | "amber" | "rose";
}) => (
  <div className="h-1 w-full overflow-hidden rounded-full bg-border/60">
    <div
      className="h-full rounded-full transition-all"
      style={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        backgroundColor: `hsl(var(--tint-${tone}-fg))`,
      }}
    />
  </div>
);
