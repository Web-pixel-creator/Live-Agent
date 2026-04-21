/**
 * SectionDivider — hairline rule between landing sections. Sits inside
 * the container so it lines up with the content edge, fades in from
 * left and right, and carries a tiny lavender index marker in the
 * middle (dashboard "section break" idiom).
 */
interface SectionDividerProps {
  /** Two-digit section index — e.g., "01" */
  index?: string;
  /** Optional label shown next to the index (lowercase mono) */
  label?: string;
}

export const SectionDivider = ({ index, label }: SectionDividerProps) => (
  <div className="container-narrow" aria-hidden>
    <div className="flex items-center gap-5 py-2">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/15 to-primary/25" />
      {(index || label) && (
        <span className="flex items-center gap-2.5 font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/90">
          {index && <span className="text-primary/70">{index}</span>}
          {index && label && <span className="h-px w-3 bg-primary/25" />}
          {label && <span>{label}</span>}
        </span>
      )}
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-primary/15 to-primary/25" />
    </div>
  </div>
);
