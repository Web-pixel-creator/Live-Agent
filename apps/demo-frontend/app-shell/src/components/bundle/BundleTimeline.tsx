import type {
  PresentationBundle,
  BundleTimelinePhase,
  BundleTimelineStep,
} from "@/data/presentationBundles";
import { StageIcon } from "@/components/workspace/StageIcon";

const PHASE_LABEL: Record<BundleTimelinePhase, string> = {
  intake: "Intake",
  detection: "Detection",
  resolution: "Resolution",
};

// Group consecutive steps by phase. Steps without a `phase` inherit the
// previous step's phase, or default to "intake" for the first one.
function groupByPhase(
  steps: BundleTimelineStep[]
): { phase: BundleTimelinePhase; steps: BundleTimelineStep[] }[] {
  const groups: { phase: BundleTimelinePhase; steps: BundleTimelineStep[] }[] = [];
  let current: BundleTimelinePhase = "intake";
  for (const step of steps) {
    const phase = step.phase ?? current;
    current = phase;
    const last = groups[groups.length - 1];
    if (last && last.phase === phase) {
      last.steps.push(step);
    } else {
      groups.push({ phase, steps: [step] });
    }
  }
  return groups;
}

// Vertical event log split into narrative phases. Each phase gets a thin
// label in the left rail; the connector restarts per phase so the rail
// visually breaks between acts instead of running unbroken.
export function BundleTimeline({ bundle }: { bundle: PresentationBundle }) {
  const groups = groupByPhase(bundle.timeline);

  return (
    <section id="bundle-timeline" className="border-b border-primary/15 scroll-mt-20">
      <div className="container-narrow py-24 md:py-28">
        <SectionLabel index="01" label="The timeline" hint={bundle.duration} />

        <p className="mt-8 max-w-2xl font-serif text-[20px] md:text-[22px] leading-[1.45] text-foreground/85">
          {bundle.timelineLead}
        </p>

        <div className="mt-14 flex flex-col gap-10">
          {groups.map((group, gi) => (
            <PhaseBlock
              key={gi}
              phase={group.phase}
              steps={group.steps}
              outcomeTone={bundle.outcomeTone}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// Decide which tone (if any) belongs on a phase's dot. The principle is
// "tone where the case actually turns": Resolution always carries the
// outcome tone; Detection carries it only when the *act* of detecting is
// what changed the trajectory (escalation / amber); Intake stays neutral.
function phaseTone(
  phase: BundleTimelinePhase,
  outcomeTone: PresentationBundle["outcomeTone"]
): "mint" | "rose" | "amber" | "slate" {
  if (phase === "resolution") return outcomeTone;
  if (phase === "detection" && outcomeTone === "amber") return "amber";
  return "slate";
}

function PhaseBlock({
  phase,
  steps,
  outcomeTone,
}: {
  phase: BundleTimelinePhase;
  steps: BundleTimelineStep[];
  outcomeTone: PresentationBundle["outcomeTone"];
}) {
  const tone = phaseTone(phase, outcomeTone);
  const isAccented = tone !== "slate";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-x-6">
      {/* Phase label — sits in the left gutter on sm+, stacks above on mobile.
          Tone-coloured dot sits inline with the label; saturated only when
          the phase carries semantic weight for this particular outcome. */}
      <div className="sm:pt-1">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-px w-4 bg-border/60 sm:hidden" />
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full ring-1 ring-inset"
            style={{
              backgroundColor: isAccented
                ? `hsl(var(--tint-${tone}-fg))`
                : "hsl(var(--muted-foreground) / 0.35)",
              ["--tw-ring-color" as any]: isAccented
                ? `hsl(var(--tint-${tone}-fg) / 0.35)`
                : "transparent",
            }}
          />
          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{
              color: isAccented
                ? `hsl(var(--tint-${tone}-fg))`
                : "hsl(var(--muted-foreground) / 0.7)",
            }}
          >
            {PHASE_LABEL[phase]}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/90">
            · {steps.length}
          </span>
        </div>
      </div>

      <ol className="relative mt-3 sm:mt-0">
        <span
          aria-hidden
          className="absolute left-[68px] sm:left-[80px] top-3 bottom-3 w-px bg-border/40"
        />
        {steps.map((step, i) => {
          // Only the first step of an accented phase gets the tone ring —
          // a quiet echo of the phase label, not a repeated drumbeat.
          const isLeadAccent = isAccented && i === 0;
          return (
          <li
            key={i}
            className="group relative grid grid-cols-[56px_24px_1fr_auto] sm:grid-cols-[68px_24px_1fr_auto] gap-x-3 sm:gap-x-4 items-baseline py-3.5 first:pt-1 last:pb-1 rounded-[6px] -mx-2 px-2 transition-colors duration-200 hover:bg-primary/[0.025]"
          >
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground/95 pt-0.5">
              {step.marker}
            </span>

            <span
              className="relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background ring-1 ring-inset transition-colors duration-300 group-hover:bg-primary/[0.06]"
              style={{
                ["--tw-ring-color" as any]: isLeadAccent
                  ? `hsl(var(--tint-${tone}-fg) / 0.45)`
                  : "hsl(var(--border) / 0.6)",
                boxShadow: isLeadAccent
                  ? `0 0 0 3px hsl(var(--tint-${tone}-fg) / 0.08)`
                  : undefined,
              }}
            >
              <StageIcon stage={step.stage} />
            </span>

            <div className="min-w-0">
              <div className="text-[13.5px] font-medium text-foreground/95 leading-tight tracking-tight">
                {step.stage}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-muted-foreground/95 max-w-[60ch]">
                {step.note}
              </p>
            </div>

            <div className="pt-0.5">
              <ActorPill actor={step.actor} />
            </div>
          </li>
          );
        })}
      </ol>
    </div>
  );
}

function ActorPill({ actor }: { actor: "AI" | "Operator" | "Client" | "System" }) {
  const tone =
    actor === "AI"
      ? "violet"
      : actor === "Operator"
        ? "mint"
        : actor === "Client"
          ? "amber"
          : "slate";
  return (
    <span
      className="inline-flex items-center h-[17px] px-1.5 rounded-[4px] ring-1 ring-inset font-mono text-[9.5px] uppercase tracking-[0.14em]"
      style={{
        backgroundColor: `hsl(var(--tint-${tone}) / 0.12)`,
        color: `hsl(var(--tint-${tone}-fg))`,
        ["--tw-ring-color" as any]: `hsl(var(--tint-${tone}) / 0.28)`,
      }}
    >
      {actor}
    </span>
  );
}

export function SectionLabel({
  index,
  label,
  hint,
}: {
  index: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-primary/15 pb-4">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60"
      />
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/95">
        {index}
      </span>
      <span className="text-[10.5px] uppercase tracking-[0.24em] text-foreground/85 font-medium">
        {label}
      </span>
      {hint && (
        <span className="ml-auto font-mono text-[11px] text-muted-foreground/90">
          {hint}
        </span>
      )}
    </div>
  );
}
