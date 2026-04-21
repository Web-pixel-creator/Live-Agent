// Shared frame: thin label strip on top + tag pill on the right. Keeps every
// artifact recognizable as part of the same evidence series.
//
// Background carries a subtle dot grid + radial vignette so the artifact area
// reads as a "capture surface" instead of a flat dark rectangle. Both layers
// are pure CSS (no raster), so they inherit the theme.
export function ArtifactFrame({
  label,
  tag,
  children,
}: {
  label: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-full aspect-[16/11] rounded-md ring-1 ring-inset ring-border/50 bg-background/40 overflow-hidden shadow-[0_1px_0_0_hsl(var(--border)/0.4),0_20px_40px_-24px_hsl(0_0%_0%/0.5)]">
      {/* Dot grid — quiet capture-surface texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--muted-foreground) / 0.18) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
          backgroundPosition: "0 0",
        }}
      />
      {/* Vignette — soft darkening toward the edges */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, hsl(var(--background) / 0.55) 100%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-7 px-3 flex items-center justify-between border-b border-border/40 bg-card/40 backdrop-blur-sm z-10">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
          {label}
        </span>
        {tag && (
          <span className="font-mono text-[9.5px] text-muted-foreground/60">
            {tag}
          </span>
        )}
      </div>
      <div className="absolute inset-x-0 top-7 bottom-0">{children}</div>
    </div>
  );
}
