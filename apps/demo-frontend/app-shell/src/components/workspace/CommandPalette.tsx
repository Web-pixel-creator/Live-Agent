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
  Files,
  ClipboardCheck,
  PhoneCall,
} from "lucide-react";
import {
  backdateAllRequests,
  clearAllRequests,
  resetDemoState,
  seedDemoRequests,
  useAllRequestCounts,
} from "@/data/sessionRequests";
import { useToast } from "@/hooks/use-toast";
import { toastWithUndo } from "@/lib/undoToast";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";
import { buildCaseBundlePath, buildCaseVaultPath } from "@/lib/case-artifact-links";

// Global cmd+k palette: search cases, jump between surfaces, run quick actions
// against the case currently in context (from /app/console?ref=… or last opened).
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { cases, pendingApprovals } = useWorkspaceRuntime();
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
      return params.get("ref") || pendingApprovals[0]?.caseRef || cases[0]?.ref;
    }
    return pendingApprovals[0]?.caseRef ?? cases.find((c) => c.status === "needs_action")?.ref;
  }, [cases, location, pendingApprovals]);

  const currentCase = cases.find((c) => c.ref === currentCaseRef);
  const leadQualificationCase = useMemo(
    () => cases.find((c) => c.ref === "VS-2838") ?? cases.find((c) => c.stage === "Lead intake"),
    [cases],
  );
  const missingDocumentsCase = useMemo(
    () =>
      cases.find((c) => c.ref === "VS-2841") ??
      cases.find((c) => c.documents.some((doc) => doc.state === "missing") && c.status !== "resolved"),
    [cases],
  );
  const consultationCase = useMemo(
    () => cases.find((c) => c.ref === "VS-2840") ?? cases.find((c) => /consultation/i.test(c.stage)),
    [cases],
  );
  const crmHandoffCase = useMemo(
    () => cases.find((c) => c.ref === "VS-2837") ?? cases.find((c) => /crm/i.test(c.stage) || c.status === "resolved"),
    [cases],
  );

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
          {cases.map((c) => (
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
          <CommandItem onSelect={() => run(() => navigate("/app?demo=visa-intake"))}>
            <ClipboardCheck className="mr-2 h-4 w-4 text-[hsl(var(--tint-violet-fg))]" />
            Start 7-minute demo
            <span className="ml-auto text-xs text-muted-foreground font-mono">demo</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/app?demo=local-services-dispatch&service=ac-repair-dispatch"))}>
            <PhoneCall className="mr-2 h-4 w-4 text-[hsl(var(--tint-mint-fg))]" />
            Local services dispatcher demo
            <span className="ml-auto text-xs text-muted-foreground font-mono">local</span>
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
              run(() => navigate("/app/nodes"))
            }
          >
            <WorkflowIcon className="mr-2 h-4 w-4 text-[hsl(var(--tint-mint-fg))]" />
            Nodes
            <CommandShortcut>g n</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/app/console/runtime"))}>
            <Terminal className="mr-2 h-4 w-4 text-muted-foreground" />
            Runtime Support
            <CommandShortcut>g r</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/app/console/runtime#artifact-viewer"))}>
            <Files className="mr-2 h-4 w-4 text-muted-foreground" />
            Artifact Viewer
            <CommandShortcut>g a</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Playbooks">
          {leadQualificationCase && (
            <CommandItem
              onSelect={() => run(() => navigate(`/app/console?ref=${leadQualificationCase.ref}`))}
            >
              <ClipboardCheck className="mr-2 h-4 w-4 text-[hsl(var(--tint-violet-fg))]" />
              Visa lead qualification
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                {leadQualificationCase.ref}
              </span>
            </CommandItem>
          )}
          {missingDocumentsCase && (
            <CommandItem
              onSelect={() =>
                run(() => navigate(`/app/console?ref=${missingDocumentsCase.ref}&focus=documents`))
              }
            >
              <Files className="mr-2 h-4 w-4 text-[hsl(var(--tint-amber-fg))]" />
              Missing-document follow-up
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                {missingDocumentsCase.ref}
              </span>
            </CommandItem>
          )}
          {consultationCase && (
            <CommandItem
              onSelect={() => run(() => navigate(buildCaseBundlePath(consultationCase)))}
            >
              <FlaskConical className="mr-2 h-4 w-4 text-[hsl(var(--tint-mint-fg))]" />
              Consultation booking prep
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                {consultationCase.ref}
              </span>
            </CommandItem>
          )}
          {crmHandoffCase && (
            <CommandItem
              onSelect={() => run(() => navigate(buildCaseVaultPath(crmHandoffCase)))}
            >
              <Terminal className="mr-2 h-4 w-4 text-muted-foreground" />
              CRM handoff summary
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                {crmHandoffCase.ref}
              </span>
            </CommandItem>
          )}
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
