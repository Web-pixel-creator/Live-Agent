import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FilePlus2, Loader2, Check } from "lucide-react";
import { workspaceCases, type WorkspaceCase } from "@/data/workspace";
import { edgeNodes } from "@/data/nodes";

interface NewCaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired with the new case ref so the parent can bump a counter / re-render. */
  onCreated: (caseRef: string) => void;
}

// Compact intake form. Quiet by default — same airy language as
// NewReplaySheet: numbered sections, neutral selection with violet rail,
// muted helpers. We only ask for the minimum needed to spawn a row in
// Live Desk; the rest of the case profile gets backfilled by the AI in
// real life.
export function NewCaseSheet({
  open,
  onOpenChange,
  onCreated,
}: NewCaseSheetProps) {
  const [client, setClient] = useState("");
  const [country, setCountry] = useState("");
  const [visa, setVisa] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on each open so a half-filled draft doesn't haunt the next launch.
  useEffect(() => {
    if (open) {
      setClient("");
      setCountry("");
      setVisa("");
      setEmail("");
      setSubmitting(false);
    }
  }, [open]);

  const canSubmit =
    !!client.trim() && !!country.trim() && !!visa.trim() && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    // Tiny artificial latency so the action registers as a real spawn,
    // matching the rhythm of NewReplaySheet's 1.5s synth.
    setTimeout(() => {
      const nextNumber =
        workspaceCases.reduce((max, c) => {
          const n = parseInt(c.ref.replace("VS-", ""), 10);
          return Number.isFinite(n) && n > max ? n : max;
        }, 2840) + 1;
      const ref = `VS-${nextNumber}`;
      const now = new Date().toISOString();
      const fallbackNode = edgeNodes[0]?.id ?? "NODE-BER-01";
      const newCase: WorkspaceCase = {
        ref,
        client: client.trim(),
        email: email.trim() || `${client.trim().toLowerCase().replace(/[^a-z]/g, ".")}@client-mail.com`,
        phone: "+00 000 000 0000",
        visa: visa.trim(),
        country: country.trim().toUpperCase().slice(0, 2),
        stage: "Intake",
        stageEnteredAt: now,
        owner: "A. Petrova",
        status: "in_flight",
        sla: "24h 00m",
        updated: "now",
        sourceNodeId: fallbackNode,
        events: [
          { at: now, actor: "Operator", title: "Case created manually" },
          { at: now, actor: "AI", title: "Lead intake initialised" },
        ],
        documents: [],
      };
      // Mutating the shared module-level array on purpose: this is a demo
      // prototype with no backend, and re-architecting LiveDesk's 1.5k LOC
      // to source cases from state isn't justified for a single intake flow.
      // The parent bumps a counter to force a re-render.
      workspaceCases.unshift(newCase);
      onCreated(ref);
      setSubmitting(false);
      onOpenChange(false);
    }, 900);
  };

  // Country + visa quick-pick chips so the operator rarely has to type.
  // Pulled from the demo seed for consistency.
  const countryQuickPicks = ["DE", "CA", "UK", "JP", "US", "PT", "FR"];
  const visaQuickPicks = [
    "EU Blue Card",
    "Skilled Worker",
    "Humanitarian",
    "D7 Passive Income",
    "O-1A",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
      >
        {/* ─── Header ────────────────────────────────────────────────── */}
        <SheetHeader className="px-7 py-5 border-b border-border/70 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <FilePlus2
              className="h-3.5 w-3.5 text-muted-foreground/70"
              strokeWidth={1.75}
            />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              New case
            </span>
          </div>
          <SheetTitle className="font-serif text-[22px] tracking-tight leading-[1.2]">
            Spawn a case in Live Desk.
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-muted-foreground/85 leading-relaxed">
            Operators rarely create cases by hand — the AI does it from intake
            calls. Use this when a referral comes in off-channel or a partner
            hands off a lead.
          </SheetDescription>
        </SheetHeader>

        {/* ─── Body ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-auto">
          {/* Step 1 — client */}
          <section className="px-7 pt-7 pb-7 border-b border-border/50 space-y-5">
            <SectionHeader index={1} label="Client" />
            <Field label="Full name" required>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="A. Petrov"
                className={inputClass}
                autoFocus
              />
            </Field>
            <Field label="Email" hint="optional">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className={inputClass}
              />
            </Field>
          </section>

          {/* Step 2 — destination. Country sits narrow next to a wider Visa
              field so the row reads as one line: "where + which visa". */}
          <section className="px-7 pt-7 pb-7 space-y-5">
            <SectionHeader index={2} label="Destination" />

            <div className="grid grid-cols-[88px_1fr] gap-4">
              <Field label="Country" required>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="DE"
                  maxLength={2}
                  className={inputClass + " text-center font-mono uppercase tracking-[0.2em]"}
                />
              </Field>
              <Field label="Visa type" required>
                <input
                  type="text"
                  value={visa}
                  onChange={(e) => setVisa(e.target.value)}
                  placeholder="EU Blue Card"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="space-y-3">
              <SubLabel>Common picks</SubLabel>
              <ChipRow
                items={countryQuickPicks}
                active={country.toUpperCase()}
                onPick={(v) => setCountry(v)}
                mono
              />
              <ChipRow
                items={visaQuickPicks}
                active={visa}
                onPick={(v) => setVisa(v)}
              />
            </div>
          </section>
        </div>

        {/* ─── Footer ────────────────────────────────────────────────── */}
        <div className="px-7 py-4 border-t border-border/70 flex items-center gap-3">
          <p className="text-[11px] text-muted-foreground/85 leading-snug">
            {!canSubmit && !submitting
              ? "Fill name, country, and visa to continue."
              : submitting
                ? "Spawning — usually under a second."
                : "Ready. The new case will appear at the top of Live Desk."}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="ml-auto h-10 px-5 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2
                  className="mr-2 h-3.5 w-3.5 animate-spin"
                  strokeWidth={2}
                />
                Spawning…
              </>
            ) : (
              <>
                <Check className="mr-2 h-3.5 w-3.5" strokeWidth={2} />
                Create case
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Tiny local primitives ──────────────────────────────────────────────────
// Kept inline so the file reads top-to-bottom without hopping around. None of
// these are reused elsewhere yet.

const inputClass =
  "w-full h-9 px-3 rounded-md bg-secondary/30 border border-transparent text-[13px] text-foreground placeholder:text-muted-foreground/45 focus-visible:outline-none focus-visible:border-border/80 focus-visible:bg-secondary/45 transition-smooth";

function SectionHeader({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[10px] text-muted-foreground/55 tabular-nums">
        0{index}
      </span>
      <span className="text-[10.5px] uppercase tracking-[0.2em] text-foreground/85 font-medium">
        {label}
      </span>
      <span aria-hidden className="flex-1 h-px bg-border/40" />
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground/65 font-medium">
      {children}
    </span>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/75 font-medium">
          {label}
          {required && (
            <span className="ml-0.5 text-muted-foreground/45">*</span>
          )}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground/55 normal-case tracking-normal italic">
            {hint}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </label>
  );
}

function ChipRow({
  items,
  active,
  onPick,
  mono,
}: {
  items: string[];
  active: string;
  onPick: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const isActive = it === active;
        return (
          <button
            key={it}
            type="button"
            onClick={() => onPick(it)}
            className={
              "h-6 px-2.5 rounded-full border text-[11px] transition-smooth " +
              (mono ? "font-mono " : "") +
              (isActive
                ? "border-border/70 bg-secondary/45 text-foreground"
                : "border-border/40 bg-transparent text-muted-foreground/75 hover:border-border/70 hover:text-foreground/95 hover:bg-secondary/20")
            }
          >
            {it}
          </button>
        );
      })}
    </div>
  );
}
