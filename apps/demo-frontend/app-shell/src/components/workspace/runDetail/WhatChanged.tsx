import { ArrowLeftRight } from "lucide-react";
import type { ReasoningStep } from "@/data/simulationRuns";
import {
  diffReasoning,
  signalColor,
  signalLabel,
} from "./diffReasoning";

// "What changed" — tight bullet list summarising the diff between the two
// reasoning chains. Sits between the outcome strip and the side-by-side so
// operators get a one-glance answer before scanning columns.
export function WhatChanged({
  original,
  replayed,
  sameOutcome,
}: {
  original: ReasoningStep[];
  replayed: ReasoningStep[];
  sameOutcome: boolean;
}) {
  const bullets = diffReasoning(original, replayed);
  // When the verdict didn't move but the reasoning did, call it out so the
  // operator immediately understands why a "no change" card still has a diff
  // worth reading. Suppressed entirely when there's nothing to diff.
  const showSameOutcomeNote = sameOutcome && bullets.length > 0;

  return (
    <div className="px-8 py-6 border-b border-border/60">
      <div className="flex items-center gap-2 mb-3.5">
        <ArrowLeftRight
          className="h-3 w-3 text-muted-foreground/70"
          strokeWidth={1.75}
        />
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">
          What changed
        </span>
        {showSameOutcomeNote && (
          <span className="ml-1 text-[11px] italic text-muted-foreground/70 normal-case tracking-normal">
            Same outcome, different path
          </span>
        )}
      </div>
      {bullets.length === 0 ? (
        <p className="text-[12px] italic text-muted-foreground/70">
          Reasoning chain unchanged — only confidence weighting shifted.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-foreground/85"
            >
              <span
                className="mt-[3px] inline-flex h-4 shrink-0 items-center justify-center rounded-[3px] px-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em]"
                style={{
                  backgroundColor:
                    b.kind === "changed"
                      ? "hsl(var(--tint-amber) / 0.10)"
                      : b.kind === "added"
                        ? "hsl(var(--tint-mint) / 0.10)"
                        : "hsl(var(--tint-rose) / 0.10)",
                  color:
                    b.kind === "changed"
                      ? "hsl(var(--tint-amber-fg) / 0.85)"
                      : b.kind === "added"
                        ? "hsl(var(--tint-mint-fg) / 0.85)"
                        : "hsl(var(--tint-rose-fg) / 0.85)",
                }}
              >
                {b.kind}
              </span>
              <span className="min-w-0">
                {b.label}
                {b.kind === "changed" && (
                  <span className="ml-1.5 font-mono text-[10.5px] text-muted-foreground/70">
                    (
                    <span style={{ color: signalColor(b.fromSignal) }}>
                      {signalLabel(b.fromSignal)}
                    </span>
                    <span className="px-0.5">→</span>
                    <span style={{ color: signalColor(b.toSignal) }}>
                      {signalLabel(b.toSignal)}
                    </span>
                    )
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
