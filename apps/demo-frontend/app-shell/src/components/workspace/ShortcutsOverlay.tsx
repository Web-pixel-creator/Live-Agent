// Linear/Notion-style cheatsheet modal. Mounts once at the workspace root
// and listens globally for "?" to open and Esc to close. Content is purely
// declarative — every group lists shortcuts that are actually wired up
// elsewhere (LiveDesk keydown, CommandPalette, undoToast). When you add a
// new shortcut, mirror it here so operators can discover it.
//
// Behavioural notes:
// - "?" is intercepted only when not typing in an input/textarea/contentEditable
//   and when no other modal/dialog/popover already owns focus (we sniff
//   `[role="dialog"]` in the DOM). This keeps the cheatsheet from fighting
//   for focus with the command palette or sheet drawers.
// - The overlay itself is a controlled `Dialog` so it inherits Radix focus
//   management, scroll lock, and Esc-to-close. We don't need our own Esc
//   handler — Radix already does it.
// - Layout is a 2-column grid of category cards on desktop, single column on
//   mobile. Each row is `keys :: label` with monospace kbd chips that match
//   the existing ShortcutHint pattern in LiveDesk.
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

type Shortcut = { keys: string[]; label: string };
type Group = { title: string; items: Shortcut[] };

// Single source of truth — keep this in lockstep with the actual handlers.
// If you add or remove a shortcut anywhere in the workspace, update this list
// so the overlay stays trustworthy. Out-of-date discovery UI is worse than
// no discovery UI at all.
const GROUPS: Group[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["j"], label: "Next case" },
      { keys: ["k"], label: "Previous case" },
      { keys: ["↵"], label: "Open in Console" },
      { keys: ["esc"], label: "Clear focus / selection" },
    ],
  },
  {
    title: "Case actions",
    items: [
      { keys: ["a"], label: "Approve focused case" },
      { keys: ["e"], label: "Reassign owner" },
      { keys: ["x"], label: "Toggle selection" },
      { keys: ["⇧", "x"], label: "Select range" },
    ],
  },
  {
    title: "Filters & search",
    items: [
      { keys: ["/"], label: "Focus filter input" },
      { keys: ["i"], label: "Toggle My requests inbox" },
      { keys: ["m"], label: "Toggle Mine only (assigned to me)" },
      { keys: ["⌘", "k"], label: "Command palette" },
    ],
  },
  {
    title: "Operator Console",
    items: [
      { keys: ["⌘", "1"], label: "Switch to Case history tab" },
      { keys: ["⌘", "2"], label: "Switch to Documents tab" },
    ],
  },
  {
    title: "Global",
    items: [
      { keys: ["⌘", "z"], label: "Undo last action" },
      { keys: ["?"], label: "Show this cheatsheet" },
    ],
  },
];

const Kbd = ({ k }: { k: string }) => (
  <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded bg-secondary/60 ring-1 ring-inset ring-border/60 font-mono text-[10px] text-foreground/85">
    {k}
  </kbd>
);

export const ShortcutsOverlay = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Match "?" by produced character (US layout: Shift+/) AND by
      // Shift+Slash code, since some synthetic key dispatchers (Playwright,
      // a11y tools, non-US layouts) deliver e.key === "/" with shiftKey=true
      // rather than the composed "?". Either path opens the cheatsheet.
      const isQuestion =
        e.key === "?" || (e.shiftKey && (e.key === "/" || e.code === "Slash"));
      if (!isQuestion) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      // If something else is already a dialog (command palette, sheet) let it
      // own the focus — the operator can press Esc, then "?" again.
      if (!open && document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    // Capture phase on document so we run BEFORE any sibling window keydown
    // listeners that might preventDefault or stopPropagation. LiveDesk's
    // handler doesn't match "?" today, but capture-phase guards against
    // future regressions and also wins over Radix focus traps mounted in
    // portals.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border space-y-1.5 text-left">
          <DialogTitle className="flex items-center gap-2 font-serif text-xl tracking-tight">
            <Keyboard
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={1.75}
            />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-secondary/60 ring-1 ring-inset ring-border/60 font-mono text-[9px] text-foreground/80">
              ?
            </kbd>{" "}
            anywhere to open this cheatsheet.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 px-6 py-5 max-h-[70vh] overflow-y-auto">
          {GROUPS.map((g) => (
            <section key={g.title} className="space-y-2.5">
              <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center justify-between gap-4 text-[12px]"
                  >
                    <span className="text-foreground/85">{s.label}</span>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      {s.keys.map((k, i) => (
                        <Kbd key={`${k}-${i}`} k={k} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
