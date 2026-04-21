import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, Command, Bell, Radio, Server } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  slaBurningCases,
  parseSlaMinutes,
  degradedInfraCases,
} from "@/data/workspace";
import { UndoHintPill } from "@/components/workspace/UndoHintPill";

interface TopbarProps {
  section: string;
  caseRef?: string;
}

export const Topbar = ({ section, caseRef }: TopbarProps) => {
  const navigate = useNavigate();
  const burning = slaBurningCases;
  const burningCount = burning.length;
  // Aggregate infra-impact — N active cases whose source node is non-healthy.
  // Quiet-by-default: pill only renders when degradedCount > 0 (no "all infra
  // healthy ✓" affordance to balance it). Click hands off to Live Desk with
  // a special `?infra=degraded` filter that narrows the board to exactly
  // those cases.
  const degradedCount = degradedInfraCases.length;

  // Smallest remaining SLA across burning cases — drives the urgency text.
  const tightestMins =
    burning
      .map((c) => parseSlaMinutes(c.sla))
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)[0] ?? null;

  const tightestLabel =
    tightestMins !== null
      ? `${Math.floor(tightestMins / 60)}h ${String(tightestMins % 60).padStart(2, "0")}m`
      : "—";

  return (
    <header className="border-b border-border/60 bg-background">
      <div className="flex h-12 items-center gap-3 px-8">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

        {/* Breadcrumb shows section + optional caseRef. We dropped the
            redundant "Action Desk /" prefix because the AppSidebar brand
            already establishes the workspace context — repeating it on
            every page just steals horizontal space and visual weight from
            the page header below. */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">{section}</span>
          {caseRef && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono text-muted-foreground">{caseRef}</span>
            </>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("command-palette:open"))}
          className="hidden lg:flex items-center gap-2 h-7 px-2.5 rounded-md border border-border bg-secondary/40 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-smooth"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Jump to case, action, doc…</span>
          <span className="ml-4 flex items-center gap-0.5 font-mono text-[10px]">
            <Command className="h-2.5 w-2.5" strokeWidth={1.75} />K
          </span>
        </button>

        <div className="flex items-center gap-1">
          {/* Mounts only while a 5-8s undo window is live — synced via the
              same module-level slot that drives the toast. */}
          <UndoHintPill />
          {/* Aggregate infra-impact pill. Quiet-by-default: only renders
              when at least one active case sits on a non-healthy node.
              Amber tint (degraded is the dominant non-healthy state in the
              dataset; offline is rarer). Click hands off to Live Desk with
              ?infra=degraded so the operator sees exactly the affected
              queue without re-typing a filter. */}
          {degradedCount > 0 && (
            <button
              onClick={() => navigate("/app?infra=degraded")}
              title={`${degradedCount} active case${degradedCount === 1 ? "" : "s"} captured by non-healthy nodes · open Live Desk filtered`}
              className="hidden md:inline-flex items-center gap-1.5 h-7 px-2 rounded-md ring-1 ring-inset transition-smooth hover:brightness-110"
              style={{
                backgroundColor: "hsl(var(--tint-amber) / 0.12)",
                // @ts-expect-error css var
                "--tw-ring-color": "hsl(var(--tint-amber) / 0.32)",
                color: "hsl(var(--tint-amber-fg))",
              }}
            >
              <Server className="h-3 w-3" strokeWidth={2} />
              <span className="text-[11px] font-medium tabular-nums">
                {degradedCount}
              </span>
              <span className="text-[11px] text-muted-foreground hidden lg:inline">
                on degraded nodes
              </span>
            </button>
          )}
          <div className="hidden lg:flex items-center gap-1.5 h-7 px-2 rounded-md bg-secondary/40 text-[11px] text-muted-foreground">
            <Radio className="h-3 w-3 text-success" strokeWidth={1.75} />
            <span className="font-mono">runtime · ok</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Bell className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {/* SLA-burning indicator — thin rose band under breadcrumbs.
          Tightened from 32px → 24px and dropped the ALL-CAPS "TIGHTEST"
          eyebrow: the rose tint + "Xh Ym" mono number already telegraph
          urgency without the label noise. */}
      {burningCount > 0 && (
        <button
          onClick={() => navigate("/app?burning=1")}
          className="group/sla w-full flex items-center gap-2.5 h-6 px-8 border-t border-[hsl(var(--tint-rose)/0.18)] hover:brightness-125 transition-smooth text-left"
          style={{ backgroundColor: "hsl(var(--tint-rose) / 0.06)" }}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
              style={{ backgroundColor: "hsl(var(--tint-rose-fg))" }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "hsl(var(--tint-rose-fg))" }}
            />
          </span>
          <span
            className="text-[10.5px] font-medium tracking-tight"
            style={{ color: "hsl(var(--tint-rose-fg))" }}
          >
            SLA burning
          </span>
          <span className="text-[10.5px] text-muted-foreground/80">
            {burningCount} case{burningCount > 1 ? "s" : ""} under 1h
          </span>
          <span
            className="ml-auto font-mono text-[10.5px] tabular-nums"
            style={{ color: "hsl(var(--tint-rose-fg))" }}
          >
            {tightestLabel}
          </span>
        </button>
      )}
    </header>
  );
};
