// Topbar affordance that surfaces the keyboard-shortcut for the active
// pending undo, plus a brief 2s "Undone" ghost-pill confirmation after a
// rollback lands. Both states mount via subscriptions to the module-level
// slots in `undoToast.tsx`, so timing stays in lockstep with the toast.
//
// Design choice: the two states share visual position but are deliberately
// distinct. The pending pill is solid primary tint with a draining bar
// (action available); the post-undo pill is a ghost (border + muted text,
// no action) so it reads as a transient confirmation rather than another
// CTA. If a new undo-able action fires while the ghost is still fading,
// the pending pill takes precedence — operators always see the most
// actionable state.
import { usePendingUndo, useRecentlyUndone } from "@/lib/undoToast";
import { Command, RotateCcw } from "lucide-react";

export const UndoHintPill = () => {
  const pending = usePendingUndo();
  const recentlyUndone = useRecentlyUndone();

  // Pending undo wins — it's actionable, the confirmation is just an echo.
  if (pending) {
    // Clamp to 0 so a stale snapshot never produces a negative duration that
    // CSS would treat as "infinite". The pub/sub already nulls the snapshot
    // when the timer fires, so this is just a defensive floor.
    const remaining = Math.max(0, pending.expiresAt - Date.now());

    return (
      <div
        // `key` on expiresAt forces a fresh mount when a new undo supersedes
        // the previous one, restarting the countdown animation cleanly.
        key={pending.expiresAt}
        className="hidden md:flex relative items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-md border border-primary/30 bg-primary/10 text-[11px] text-primary overflow-hidden animate-fade-up"
        role="status"
        aria-label="Press Cmd+Z to undo last action"
      >
        <span className="flex items-center gap-0.5 font-mono text-[10px]">
          <Command className="h-2.5 w-2.5" strokeWidth={2} />
          <span>Z</span>
        </span>
        <span className="font-medium">to undo</span>
        {/* Bottom hairline mirrors the toast's primary countdown bar — same
            keyframe, same remaining duration, so they drain in perfect sync. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-primary/70 animate-undo-countdown"
          style={{ animationDuration: `${remaining}ms` }}
        />
      </div>
    );
  }

  if (recentlyUndone) {
    return (
      <div
        key={recentlyUndone.expiresAt}
        // Mint tint reads as "restored / success" — distinct from the primary
        // pending pill so operators can tell at a glance whether the action
        // is still revertable or has already landed.
        className="hidden md:flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[hsl(var(--tint-mint-fg))]/35 bg-[hsl(var(--tint-mint))]/40 text-[11px] text-[hsl(var(--tint-mint-fg))] animate-fade-up"
        role="status"
        aria-live="polite"
      >
        <RotateCcw className="h-3 w-3" strokeWidth={1.75} />
        <span>{recentlyUndone.message}</span>
      </div>
    );
  }

  return null;
};
