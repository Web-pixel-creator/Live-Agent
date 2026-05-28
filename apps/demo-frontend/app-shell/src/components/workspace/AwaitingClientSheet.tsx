import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Send, Check, X } from "lucide-react";
import type { WorkspaceCase } from "@/data/workspace";
import {
  markDocReceived,
  resendDocRequest,
  type RequestRecord,
} from "@/data/sessionRequests";
import { toastWithUndo } from "@/lib/undoToast";

interface AwaitingClientSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseRef: WorkspaceCase | null;
  request: RequestRecord | null;
}

// Compact "5m ago" / "2h ago" / "Jun 24" formatter — tuned for this sheet's
// status line where we want the operator to grok recency at a glance.
const timeAgo = (iso: string) => {
  const diffMs = Date.now() - Date.parse(iso);
  if (Number.isNaN(diffMs)) return "—";
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const AwaitingClientSheet = ({
  open,
  onOpenChange,
  caseRef,
  request,
}: AwaitingClientSheetProps) => {
  if (!caseRef || !request) return null;

  // Use the most recent send (resend wins) for the "Sent X ago" line so the
  // operator sees the freshest signal.
  const lastSentAt = request.resentAt ?? request.at;
  const firstName = caseRef.client.split(".").pop()?.trim() || caseRef.client;

  const handleResend = () => {
    const undo = resendDocRequest(caseRef.ref, request.doc);
    toastWithUndo(`Resent · ${caseRef.ref} · ${request.doc}`, undo, {
      undoneMessage: `Resend undone · ${request.doc}`,
    });
    onOpenChange(false);
  };

  const handleMarkReceived = () => {
    const undo = markDocReceived(caseRef.ref, request.doc);
    toastWithUndo(`Marked received · ${caseRef.ref} · ${request.doc}`, undo, {
      undoneMessage: `Receipt undone · ${request.doc}`,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col gap-0 p-0"
      >
        {/* Header — mirrors RequestDocSheet chrome for visual consistency */}
        <SheetHeader className="px-6 py-4 border-b border-border space-y-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.22em] text-primary">
              Awaiting client
            </span>
            <Pill tone="amber" size="sm" dot>
              In review
            </Pill>
          </div>
          <SheetTitle className="font-serif text-xl tracking-tight">
            {request.doc}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            <span className="font-mono text-foreground/70">{caseRef.ref}</span>
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            {caseRef.client}
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            {caseRef.visa}
          </SheetDescription>
        </SheetHeader>

        {/* Status block */}
        <div className="flex-1 min-h-0 overflow-auto px-6 py-5 space-y-5">
          <div className="rounded-lg border border-border bg-card/60 p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Status
              </span>
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                Sent {timeAgo(lastSentAt)}
              </span>
            </div>
            <div className="text-sm text-foreground/90 leading-relaxed">
              Request sent to{" "}
              <span className="text-foreground">{firstName}</span> via the
              client portal. No upload received yet.
            </div>
            {request.resentAt && (
              <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground font-mono">
                Last resent {timeAgo(request.resentAt)} · originally{" "}
                {timeAgo(request.at)}
              </div>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground leading-relaxed">
            Resend nudges the client with the same draft. Mark received only
            when the upload is confirmed in the portal — the doc will flip to
            verified in this case.
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border flex items-center gap-2">
          <Button
            onClick={handleMarkReceived}
            className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90"
          >
            <Check className="mr-2 h-4 w-4" strokeWidth={2.25} />
            Mark received
          </Button>
          <Button
            variant="ghost"
            onClick={handleResend}
            className="h-10 px-4 text-muted-foreground hover:text-foreground"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
            Resend
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="ml-auto h-10 px-3 text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
