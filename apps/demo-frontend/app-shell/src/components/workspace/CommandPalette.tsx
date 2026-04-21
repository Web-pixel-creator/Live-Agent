import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Inbox,
  Terminal,
  FlaskConical,
  Workflow as WorkflowIcon,
  Check,
  UserPlus,
  ArrowRight,
  Hash,
  Trash2,
  Clock,
  Sprout,
  RotateCw,
  Beaker,
} from "lucide-react";
import { workspaceCases } from "@/data/workspace";
import {
  backdateAllRequests,
  clearAllRequests,
  resetDemoState,
  seedDemoRequests,
  useAllRequestCounts,
} from "@/data/sessionRequests";
import { useToast } from "@/hooks/use-toast";
import { toastWithUndo } from "@/lib/undoToast";

// Global cmd+k palette: search cases, jump between surfaces, run quick actions
// against the case currently in context (from /app/console?ref=… or last opened).
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const requestCounts = useAllRequestCounts();
  const totalOutstanding = useMemo(
    () => Array.from(requestCounts.values()).reduce((n, v) => n + v, 0),
    [requestCounts],
  );

  // Resolve "current case" — Console reads ?ref=, Live Desk falls back to first
  // needs_action so quick actions always have a sensible target.
  const currentCaseRef = useMemo(() => {
    if (location.pathname.startsWith("/app/console")) {
      const params = new URLSearchParams(location.search);
      return params.get("ref") || workspaceCases[0]?.ref;
    }
    return workspaceCases.find((c) => c.status === "needs_action")?.ref;
  }, [location]);

  const currentCase = workspaceCases.find((c) => c.ref === currentCaseRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("command-palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("command-palette:open", onOpen);
    };
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    setQuery("");
    // Defer so the dialog unmounts before navigation/toast fires.
    setTimeout(fn, 0);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search cases, jump to a section, run an action…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        {currentCase && (
          <>
            <CommandGroup heading={`Quick actions · ${currentCase.ref} · ${currentCase.client}`}>
              {currentCase.status === "needs_action" && (
                <CommandItem
                  onSelect={() =>
                    run(() =>
                      toast({
                        title: "Approved & sent",
                        description: `${currentCase.ref} · ${currentCase.client}`,
                      }),
                    )
                  }
                >
                  <Check className="mr-2 h-4 w-4 text-[hsl(var(--tint-mint-fg))]" />
                  Approve & send
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              )}
              <CommandItem
                onSelect={() =>
                  run(() =>
                    toast({
                      title: "Reassigned",
                      description: `${currentCase.ref} → operator queue`,
                    }),
                  )
                }
              >
                <UserPlus className="mr-2 h-4 w-4 text-[hsl(var(--tint-violet-fg))]" />
                Reassign to operator
              </CommandItem>
              <CommandItem
                onSelect={() => run(() => navigate(`/app/console?ref=${currentCase.ref}`))}
              >
                <ArrowRight className="mr-2 h-4 w-4 text-muted-foreground" />
                Open in Console
              </CommandItem>
              <CommandItem
                value={`replay this case simulation ${currentCase.ref} ${currentCase.client}`}
                onSelect={() =>
                  run(() => {
                    // Navigate first, then fire the event on the next tick so
                    // SimulationLab is mounted and its window listener is live
                    // by the time the event dispatches.
                    navigate("/app/simulation");
                    setTimeout(() => {
                      window.dispatchEvent(
                        new CustomEvent("simulation:new-replay", {
                          detail: { caseRef: currentCase.ref },
                        }),
                      );
                    }, 50);
                  })
                }
              >
                <Beaker className="mr-2 h-4 w-4 text-[hsl(var(--tint-violet-fg))]" />
                Replay this case in Simulation
                <span className="ml-auto text-xs text-muted-foreground font-mono">
                  {currentCase.ref}
                </span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Cases">
          {workspaceCases.map((c) => (
            <CommandItem
              key={c.ref}
              // Keep value tight — only ref/client/visa/country/stage tokens.
              // Avoid generic words like "demo" leaking in via fuzzy match and
              // stealing Enter from the Demo command group.
              value={`case ${c.ref} ${c.client} ${c.visa} ${c.country} ${c.stage}`}
              keywords={[c.ref, c.client]}
              onSelect={() => run(() => navigate(`/app/console?ref=${c.ref}`))}
            >
              <Hash className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground mr-2">{c.ref}</span>
              <span className="text-foreground">{c.client}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {c.visa} · {c.country}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => navigate("/app"))}>
            <Inbox className="mr-2 h-4 w-4 text-[hsl(var(--tint-violet-fg))]" />
            Live Desk
            <CommandShortcut>g d</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/app/console"))}>
            <Terminal className="mr-2 h-4 w-4 text-[hsl(var(--tint-rose-fg))]" />
            Operator Console
            <CommandShortcut>g c</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/app/simulation"))}>
            <FlaskConical className="mr-2 h-4 w-4 text-[hsl(var(--tint-amber-fg))]" />
            Simulation Lab
            <CommandShortcut>g s</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() =>
                toast({
                  title: "Nodes",
                  description: "Coming soon",
                }),
              )
            }
          >
            <WorkflowIcon className="mr-2 h-4 w-4 text-[hsl(var(--tint-mint-fg))]" />
            Nodes
            <CommandShortcut>g n</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Demo">
          {/* Always visible — gives presenters a one-click way to populate
              the inbox with a curated mix of fresh / day-old / stale rows. */}
          <CommandItem
            value="seed demo requests populate inbox presentation"
            onSelect={() =>
              run(() => {
                const result = seedDemoRequests();
                if (!result) {
                  toast({
                    title: "Demo requests already seeded",
                    description: "Every target case already has a request.",
                  });
                  return;
                }
                const label = `Seeded ${result.seeded} demo request${result.seeded === 1 ? "" : "s"}`;
                toastWithUndo(label, result.undo, {
                  undoneMessage: `Restored — ${label}`,
                });
              })
            }
          >
            <Sprout className="mr-2 h-4 w-4 text-[hsl(var(--tint-mint-fg))]" />
            Seed demo requests
            <span className="ml-auto text-xs text-muted-foreground font-mono">demo</span>
          </CommandItem>
          {/* Combo: clear + seed in a single snapshot. Always shown so a
              presenter can snap back to a known-good demo from any state —
              empty inbox, stale rows, or mid-conversation. One Cmd+Z restores
              whatever was there before. */}
          <CommandItem
            value="reset demo state snapshot presenter clear seed"
            onSelect={() =>
              run(() => {
                const result = resetDemoState();
                const label = `Reset demo · ${result.seeded} request${result.seeded === 1 ? "" : "s"}`;
                toastWithUndo(label, result.undo, {
                  undoneMessage: `Restored — ${label}`,
                });
              })
            }
          >
            <RotateCw className="mr-2 h-4 w-4 text-[hsl(var(--tint-violet-fg))]" />
            Reset demo state
            <span className="ml-auto text-xs text-muted-foreground font-mono">demo</span>
          </CommandItem>
          {totalOutstanding > 0 && (
            <>
              <CommandItem
                value="backdate all requests 48h stale awaiting demo"
                onSelect={() =>
                  run(() => {
                    const undo = backdateAllRequests(48);
                    if (!undo) return;
                    const label = `Backdated ${totalOutstanding} request${totalOutstanding === 1 ? "" : "s"} by 48h`;
                    toastWithUndo(label, undo, {
                      undoneMessage: `Restored — ${label}`,
                    });
                  })
                }
              >
                <Clock className="mr-2 h-4 w-4 text-[hsl(var(--tint-amber-fg))]" />
                Backdate all requests by 48h
                <span className="ml-auto text-xs text-muted-foreground font-mono">dev</span>
              </CommandItem>
              <CommandItem
                value="clear all requests reset inbox demo"
                onSelect={() =>
                  run(() => {
                    const undo = clearAllRequests();
                    if (!undo) return;
                    const label = `Cleared ${totalOutstanding} request${totalOutstanding === 1 ? "" : "s"}`;
                    toastWithUndo(label, undo, {
                      undoneMessage: `Restored — ${label}`,
                    });
                  })
                }
              >
                <Trash2 className="mr-2 h-4 w-4 text-[hsl(var(--tint-rose-fg))]" />
                Clear all requests
                <span className="ml-auto text-xs text-muted-foreground font-mono">
                  {totalOutstanding}
                </span>
              </CommandItem>
            </>
          )}
        </CommandGroup>

      </CommandList>
    </CommandDialog>
  );
}
