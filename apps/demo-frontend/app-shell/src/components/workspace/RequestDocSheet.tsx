import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, X } from "lucide-react";
import { toastWithUndo } from "@/lib/undoToast";
import type { WorkspaceCase } from "@/data/workspace";

interface RequestDocSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseRef: WorkspaceCase | null;
  /** Single-doc request (back-compat). Mutually exclusive with `docNames`. */
  docName?: string | null;
  /** Bulk request — when 2+ docs are selected, sheet renders a bullet list. */
  docNames?: string[] | null;
  /** Fired right after Send for each requested doc — records into session store.
   *  May return an undo thunk so the sheet can wire a bulk Undo affordance. */
  onSent?: (caseRef: string, docName: string) => (() => void) | null | void;
}

// Build a pre-filled email draft for one or many missing documents. The body
// stays short and polite; subject embeds the case ref so client replies thread.
const buildDraft = (c: WorkspaceCase, docs: string[]) => {
  const firstName = c.client.split(".").pop()?.trim() || c.client;
  const isBulk = docs.length > 1;
  const subject = isBulk
    ? `${c.ref} · Action needed: ${docs.length} documents`
    : `${c.ref} · Action needed: ${docs[0]}`;
  const intro = isBulk
    ? `We're finalising your ${c.visa} application and need a few more documents to move forward:`
    : `We're finalising your ${c.visa} application and need one more document to move forward:`;
  const bullets = docs.map((d) => `  • ${d}`).join("\n");
  const body = `Hi ${firstName},

${intro}

${bullets}

Could you upload ${isBulk ? "them" : "it"} via your client portal at your earliest convenience? It usually takes under a minute, and once received we'll continue processing immediately.

Let me know if you have any questions.

Best,
${c.owner}
Action Desk`;
  return { subject, body };
};

export const RequestDocSheet = ({
  open,
  onOpenChange,
  caseRef,
  docName,
  docNames,
  onSent,
}: RequestDocSheetProps) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Normalise inputs: prefer docNames (bulk) when non-empty, else fall back to
  // the single docName for back-compat with existing callers.
  const docs: string[] =
    docNames && docNames.length > 0
      ? docNames
      : docName
        ? [docName]
        : [];
  const isBulk = docs.length > 1;
  // Stable key so the seeding effect re-runs when the doc set changes between
  // opens (e.g., operator selects a different combination).
  const docsKey = docs.join("|");

  // Re-seed the draft whenever the operator opens the sheet for a new set.
  useEffect(() => {
    if (open && caseRef && docs.length > 0) {
      const d = buildDraft(caseRef, docs);
      setSubject(d.subject);
      setBody(d.body);
    }
    // docs is recomputed every render; key by its joined form to stay stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, caseRef, docsKey]);

  if (!caseRef || docs.length === 0) return null;

  const handleSend = () => {
    // Collect per-doc undo thunks so a single "Undo" click rolls back the
    // entire batch atomically. We filter out nulls (no-op idempotent sends).
    const undos = docs
      .map((d) => onSent?.(caseRef.ref, d))
      .filter((u): u is () => void => typeof u === "function");
    const message = isBulk
      ? `Requests sent · ${caseRef.ref} · ${docs.length} documents`
      : `Request sent · ${caseRef.ref} · ${docs[0]}`;
    const undoneMessage = isBulk
      ? `Requests undone · ${docs.length} documents`
      : `Request undone · ${docs[0]}`;
    toastWithUndo(
      message,
      undos.length > 0 ? () => undos.forEach((u) => u()) : null,
      { undoneMessage },
    );
    onOpenChange(false);
  };

  // Header text adapts to single vs bulk so the operator sees a clean title
  // regardless of how many docs are queued up.
  const titleText = isBulk
    ? `${docs.length} documents`
    : docs[0];
  const eyebrow = isBulk ? "Bulk request from client" : "Request from client";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col gap-0 p-0"
      >
        {/* Header — mirrors Console header chrome */}
        <SheetHeader className="px-6 py-4 border-b border-border space-y-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.22em] text-primary">
              {eyebrow}
            </span>
            <Pill tone="rose" size="sm" dot>
              {isBulk ? `${docs.length} missing` : "Missing"}
            </Pill>
          </div>
          <SheetTitle className="font-serif text-xl tracking-tight">
            {titleText}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            <span className="font-mono text-foreground/70">{caseRef.ref}</span>
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            {caseRef.client}
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            {caseRef.visa}
          </SheetDescription>
          {/* Bulk-only summary chip strip — quick visual confirmation of the set */}
          {isBulk && (
            <ul className="pt-2 flex flex-wrap gap-1.5">
              {docs.map((d) => (
                <li
                  key={d}
                  className="inline-flex items-center gap-1.5 h-5 px-2 rounded-sm font-mono text-[10px] tracking-tight ring-1 ring-inset ring-[hsl(var(--tint-rose)/0.22)]"
                  style={{
                    color: "hsl(var(--tint-rose-fg))",
                    backgroundColor: "hsl(var(--tint-rose) / 0.10)",
                  }}
                >
                  <span className="h-1 w-1 rounded-full bg-current opacity-70" />
                  {d}
                </li>
              ))}
            </ul>
          )}
        </SheetHeader>

        {/* Editable draft */}
        <div className="flex-1 min-h-0 overflow-auto px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="req-to" className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              To
            </Label>
            <Input
              id="req-to"
              value={`${caseRef.client.toLowerCase().replace(/[^a-z]/g, "")}@client.actiondesk.app`}
              readOnly
              className="h-9 font-mono text-xs text-muted-foreground bg-secondary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-subj" className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Subject
            </Label>
            <Input
              id="req-subj"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-body" className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Message
            </Label>
            <Textarea
              id="req-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[280px] font-mono text-[12px] leading-relaxed resize-none"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border flex items-center gap-2">
          <Button
            onClick={handleSend}
            className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90"
          >
            <Send className="mr-2 h-3.5 w-3.5" strokeWidth={2} />
            {isBulk ? `Send ${docs.length} requests` : "Send request"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 px-4 text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
