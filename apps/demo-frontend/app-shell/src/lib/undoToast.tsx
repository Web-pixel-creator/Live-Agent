// Thin sonner wrapper that pairs a success message with an 8-second "Undo"
// affordance plus a visual countdown bar. Centralising this keeps every
// operator action — single send, bulk send, resend, mark-received —
// consistent in copy, duration and ARIA.
//
// Pattern: callers get back an `undo` thunk from the session store and pass
// it here together with the toast message. If the operator clicks Undo we
// run the thunk and surface a quiet confirmation. If they ignore the toast,
// it auto-dismisses after `duration` ms — no further action.
//
// Visual countdown: the toast renders custom JSX with a 1px bar at the
// bottom that animates from full-width to zero across the full duration via
// a CSS keyframe. This gives operators an unambiguous "time-remaining"
// signal — much clearer than the implicit toast lifetime.
//
// Keyboard parity: while a toast is live we also park the undo thunk in a
// module-level slot. A single global keydown listener (installed lazily on
// first use) translates Cmd+Z / Ctrl+Z into the same rollback so power users
// don't have to reach for the mouse. The slot self-clears when the timer
// elapses or the action fires, so Cmd+Z never reaches a stale operation.
import { toast } from "sonner";
import { Check } from "lucide-react";
import { useSyncExternalStore } from "react";

const DURATION_MS = 8000;

// Single-slot pending undo. We intentionally only track the most recent
// action — chaining multiple pending undos would surprise operators (which
// one does Cmd+Z target?). New action supersedes the previous slot, matching
// how sonner stacks toasts visually.
interface PendingUndo {
  run: () => void;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
  toastId: string | number;
}
let pending: PendingUndo | null = null;

// Lightweight pub/sub so UI affordances (e.g. the Topbar ⌘Z hint pill) can
// mirror the toast lifecycle without us threading callbacks through every
// call site. We snapshot the `expiresAt` timestamp so subscribers can render
// their own countdown and self-tear-down at the same moment the toast
// dismisses — no drift between the toast bar and any external pill.
type Snapshot = { expiresAt: number } | null;
let snapshot: Snapshot = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => snapshot;

/**
 * Subscribe to the currently-pending undo (if any). Returns `null` when no
 * undo is in flight, otherwise `{ expiresAt }` — a wall-clock millisecond
 * timestamp the consumer can use to drive its own countdown animation.
 */
export const usePendingUndo = () =>
  useSyncExternalStore(subscribe, getSnapshot, () => null);

// Companion 2s "recently undone" channel. Drives a quiet ghost-pill in the
// Topbar so an operator who clicked Undo (or fired Cmd+Z) gets a fleeting
// "yes, I really rolled back" confirmation — important because the toast
// itself disappears the instant Undo fires, leaving no UI evidence the
// rollback happened. We use a separate snapshot/timer so the two windows
// (8s pending + 3s recently) can co-exist without stomping each other if a
// new action fires while the ghost-pill is still fading out. 3s gives the
// operator enough time to register the contextual "Restored — …" message.
const UNDONE_DURATION_MS = 3000;
type UndoneSnapshot = { expiresAt: number; message: string } | null;
let undoneSnapshot: UndoneSnapshot = null;
let undoneTimer: ReturnType<typeof setTimeout> | null = null;
const undoneListeners = new Set<() => void>();
const emitUndone = () => undoneListeners.forEach((l) => l());
const subscribeUndone = (l: () => void) => {
  undoneListeners.add(l);
  return () => {
    undoneListeners.delete(l);
  };
};
const getUndoneSnapshot = () => undoneSnapshot;

/**
 * Subscribe to the most recent successful rollback (if it landed in the
 * last ~2 seconds). Returns `null` when nothing was undone recently,
 * otherwise `{ expiresAt, message }` — `message` is the operator-facing
 * confirmation string (e.g. "Undone") so consumers can render it inline.
 */
export const useRecentlyUndone = () =>
  useSyncExternalStore(subscribeUndone, getUndoneSnapshot, () => null);

const markRecentlyUndone = (message: string) => {
  if (undoneTimer) clearTimeout(undoneTimer);
  undoneSnapshot = { expiresAt: Date.now() + UNDONE_DURATION_MS, message };
  emitUndone();
  undoneTimer = setTimeout(() => {
    undoneSnapshot = null;
    undoneTimer = null;
    emitUndone();
  }, UNDONE_DURATION_MS);
};

const clearPending = () => {
  if (!pending) return;
  clearTimeout(pending.timer);
  pending = null;
  snapshot = null;
  emit();
};

// Install the keyboard listener exactly once, the first time someone fires
// an undo-capable toast. Guarded for SSR / non-browser test environments.
let listenerInstalled = false;
const ensureListener = () => {
  if (listenerInstalled || typeof window === "undefined") return;
  listenerInstalled = true;
  window.addEventListener("keydown", (e) => {
    if (!pending) return;
    // Cmd+Z on macOS, Ctrl+Z elsewhere. Ignore Shift+Cmd+Z (redo) and any
    // event that originated inside an editable field — operators expect
    // native text-undo to win inside textareas/inputs.
    const isUndoCombo =
      e.key.toLowerCase() === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey;
    if (!isUndoCombo) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }
    e.preventDefault();
    const slot = pending;
    clearPending();
    toast.dismiss(slot.toastId);
    slot.run();
  });
};

// Custom toast body. Two-row layout: status + message + Undo button on top,
// then a thin progress bar that animates linearly from 100% → 0% across the
// full duration. The bar is purely decorative (aria-hidden) — the action
// button itself remains the accessible affordance.
const UndoToastBody = ({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) => (
  <div className="flex w-full flex-col gap-2.5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 text-sm text-foreground">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <span className="leading-snug">{message}</span>
      </div>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 rounded-md border border-border/70 bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        Undo
        <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          ⌘Z
        </span>
      </button>
    </div>
    <div
      aria-hidden
      className="relative -mx-4 -mb-3 mt-1 h-[2px] overflow-hidden rounded-b bg-border/40"
    >
      <div
        className="animate-undo-countdown h-full w-full bg-primary/70"
        style={{ animationDuration: `${DURATION_MS}ms` }}
      />
    </div>
  </div>
);

export const toastWithUndo = (
  message: string,
  undo: (() => void) | null | undefined,
  opts?: { undoneMessage?: string },
) => {
  // Defensive: if there's nothing to undo (no-op call site), fall back to a
  // plain success toast so behaviour stays predictable.
  if (!undo) {
    toast.success(message);
    return;
  }
  ensureListener();
  const undoneMessage = opts?.undoneMessage ?? "Undone";

  // Tracks whether this specific toast has already triggered its rollback
  // (via either the button or ⌘Z). Prevents double-runs when both paths
  // fire — and, critically, also lets the button keep working even if our
  // internal pending timer expired before sonner dismissed the toast (e.g.
  // sonner pauses-on-hover but the timer doesn't, leaving an active-looking
  // Undo button after the slot was cleared).
  let done = false;

  // Shared rollback runner — invoked by either the Undo button or Cmd+Z.
  // Wrapped so we always emit the confirmation toast and the recently-undone
  // ghost-pill snapshot exactly once, regardless of which entry point fired.
  const runUndo = () => {
    if (done) return;
    done = true;
    undo();
    toast(undoneMessage, { duration: 2500 });
    markRecentlyUndone(undoneMessage);
  };

  // New action supersedes any prior pending undo. Dismiss its visible toast
  // so the screen never stacks two competing countdowns, and cancel its
  // timer so we don't accidentally clear `pending` after the new slot is
  // installed.
  if (pending) {
    toast.dismiss(pending.toastId);
    clearPending();
  }

  // Render the custom JSX toast. We capture the returned id so the keyboard
  // path and the supersede path can both dismiss it deterministically.
  const id = toast.custom(
    (t) => (
      <UndoToastBody
        message={message}
        onUndo={() => {
          // If our internal pending slot still points at this toast, clear it
          // so the keyboard listener can't double-fire. Then run the rollback
          // — `runUndo` is itself guarded by `done` so it's safe to call even
          // if the slot was already cleared by the timer.
          if (pending && pending.run === runUndo) {
            clearPending();
          }
          toast.dismiss(t);
          runUndo();
        }}
      />
    ),
    { duration: DURATION_MS },
  );

  const expiresAt = Date.now() + DURATION_MS;
  const timer = setTimeout(() => {
    pending = null;
    snapshot = null;
    emit();
  }, DURATION_MS);
  pending = { run: runUndo, expiresAt, timer, toastId: id };
  // Publish the new snapshot so subscribers (Topbar pill, etc.) can mount
  // their own countdown affordance, perfectly synced with the toast bar.
  snapshot = { expiresAt };
  emit();
};
