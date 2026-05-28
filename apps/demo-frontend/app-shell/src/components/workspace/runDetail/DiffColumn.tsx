import { Plus, Minus, Circle } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { outcomeTone, type ReasoningStep } from "@/data/simulationRuns";
import { ConfidenceBar } from "./ConfidenceBar";

// Step icon: positive → mint check, negative → rose minus, neutral → muted
// dot. Mirrors the colour rhythm we use elsewhere (mint=safe, rose=block) so
// the eye doesn't have to retrain.
const StepIcon = ({ signal }: { signal: ReasoningStep["signal"] }) => {
  if (signal === "positive") {
    return (
      <span
        className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: "hsl(var(--tint-mint) / 0.12)",
          color: "hsl(var(--tint-mint-fg) / 0.9)",
        }}
      >
        <Plus className="h-2.5 w-2.5" strokeWidth={2.5} />
      </span>
    );
  }
  if (signal === "negative") {
    return (
      <span
        className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: "hsl(var(--tint-rose) / 0.12)",
          color: "hsl(var(--tint-rose-fg) / 0.9)",
        }}
      >
        <Minus className="h-2.5 w-2.5" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/45">
      <Circle className="h-1.5 w-1.5 fill-current" strokeWidth={0} />
    </span>
  );
};

// Side column — used twice (Original / Replayed). Compact stack: outcome pill
// big at the top, confidence row, reasoning list. Both columns stay strictly
// parallel so the diff reads vertically without extra labels.
export function DiffColumn({
  label,
  outcome,
  confidence,
  reasoning,
  policyName,
  isReplayed,
}: {
  label: string;
  outcome: keyof typeof outcomeTone;
  confidence: number;
  reasoning: ReasoningStep[];
  policyName: string;
  isReplayed?: boolean;
}) {
  const tone = outcomeTone[outcome];
  return (
    <div className="flex flex-col gap-3.5 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">
          {label}
        </span>
        <span
          className={
            "font-mono text-[10px] " +
            (isReplayed
              ? "text-[hsl(var(--tint-violet-fg))]/85"
              : "text-muted-foreground/75")
          }
        >
          {policyName}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <Pill tone={tone.tint} size="md" dot>
          {tone.label}
        </Pill>
        <span className="font-mono text-[13px] tabular-nums text-foreground/95">
          {confidence}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/75">
          conf
        </span>
      </div>
      <ConfidenceBar value={confidence} tone={tone.tint} />
      {reasoning.length > 0 ? (
        <ul className="flex flex-col gap-2.5 pt-1.5">
          {reasoning.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-foreground/85"
            >
              <StepIcon signal={step.signal} />
              <span className="min-w-0">{step.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] italic text-muted-foreground/65 pt-1">
          No reasoning emitted — replay aborted before evaluation.
        </p>
      )}
    </div>
  );
}
