// Sticky 400px detail rail for the selected edge node.
//
// 2026 refresh: more breathing room, gradient status banner, glassy metric
// cards with inset highlight, and colour reserved for deviation. Healthy
// reads quiet; broken reads loud.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Server, RotateCw, Wrench, BookOpen, MapPin, Clock, ArrowUpRight } from "lucide-react";
import {
  type EdgeNode,
  STATUS_META,
  KIND_LABEL,
  formatHeartbeatAgo,
  nodeLocalTime,
  heartbeatTone,
} from "@/data/nodes";
import { OwnerAvatar } from "@/components/workspace/OwnerAvatar";
import { countryFlag } from "@/components/workspace/CountryChip";
import { HeartbeatSparkline } from "./HeartbeatSparkline";
import { NodeActivityTimeline } from "./NodeActivityTimeline";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";

interface NodeDetailRailProps {
  node: EdgeNode | null;
}

export function NodeDetailRail({ node }: NodeDetailRailProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { cases } = useWorkspaceRuntime();

  const localTime = useMemo(
    () => (node ? nodeLocalTime(node.tz) : ""),
    [node],
  );

  const relatedCount = useMemo(
    () => (node ? cases.filter((c) => c.sourceNodeId === node.id).length : 0),
    [cases, node],
  );

  if (!node) {
    return (
      <aside className="w-[400px] shrink-0 border-l border-border/50 bg-background/40 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-10 text-center gap-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-secondary/40 ring-1 ring-inset ring-border/60">
            <Server
              className="h-5 w-5 text-muted-foreground/55"
              strokeWidth={1.5}
            />
          </div>
          <div className="text-[12.5px] text-muted-foreground/85">
            Select a node to inspect its health
          </div>
          <div className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-[0.18em]">
            j · k to navigate
          </div>
        </div>
      </aside>
    );
  }

  const meta = STATUS_META[node.status];
  const tint = meta.tint;
  const flag = countryFlag(node.country);
  const hbTone = heartbeatTone(node.heartbeatAgoSec);

  const bannerSubline =
    node.status === "offline"
      ? `unreachable ${formatHeartbeatAgo(node.heartbeatAgoSec).replace(" ago", "")}`
      : node.status === "degraded"
        ? `last heartbeat ${formatHeartbeatAgo(node.heartbeatAgoSec)}`
        : node.status === "maintenance"
          ? `under scheduled maintenance`
          : `last heartbeat ${formatHeartbeatAgo(node.heartbeatAgoSec)}`;

  const handleRestart = () => {
    toast({
      title: "Restart requested",
      description: `${node.id} · queued for next heartbeat window`,
    });
  };
  const handleMaintenance = () => {
    toast({
      title: "Maintenance flag toggled",
      description: `${node.id} · routing paused`,
    });
  };
  const handleRunbook = () => {
    toast({
      title: "Runbook",
      description: `${node.id} · opening incident playbook`,
    });
  };

  return (
    <aside className="w-[400px] shrink-0 border-l border-border/50 bg-background/40 flex flex-col min-h-0 relative">

      <div className="flex-1 min-h-0 overflow-auto relative">
        {/* ── Identity ──────────────────────────────────────────────── */}
        <div className="px-7 pt-7 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[10px] text-muted-foreground/85 tabular-nums uppercase tracking-[0.14em]">
              {node.id}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/75">
              {KIND_LABEL[node.kind]}
            </span>
          </div>
          <h2 className="font-serif text-[26px] leading-[1.1] tracking-tight text-foreground">
            {node.label}
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground/85">
            <span className="inline-flex items-center gap-1.5">
              {flag && <span className="text-[14px] leading-none">{flag}</span>}
              <MapPin className="h-3 w-3 text-muted-foreground/60" strokeWidth={1.75} />
              <span className="text-foreground/85">{node.city}</span>
              <span className="text-muted-foreground/55">{node.country}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <Clock className="h-3 w-3 text-muted-foreground/60" strokeWidth={1.75} />
              <span className="text-foreground/85">{localTime}</span>
              <span className="text-muted-foreground/55">local</span>
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2.5">
            <OwnerAvatar name={node.owner} size={22} />
            <span className="text-[11.5px] text-muted-foreground/80">
              Owned by <span className="text-foreground/95 font-medium">{node.owner}</span>
            </span>
          </div>
        </div>

        {/* ── Status banner ─ flat, low-contrast tint, no glow ────── */}
        <div className="px-7 pb-6">
          <div
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg ring-1 ring-inset"
            style={{
              backgroundColor: `hsl(var(--tint-${tint}) / 0.08)`,
              // @ts-expect-error css var
              "--tw-ring-color": `hsl(var(--tint-${tint}) / 0.18)`,
            }}
          >
            <span className="relative inline-flex h-2 w-2 shrink-0">
              {meta.pulse && (
                <span
                  className="absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping"
                  style={{ backgroundColor: `hsl(var(--tint-${tint}-fg))` }}
                />
              )}
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: `hsl(var(--tint-${tint}-fg))` }}
              />
            </span>
            <span
              className="text-[11px] font-medium uppercase tracking-[0.16em]"
              style={{ color: `hsl(var(--tint-${tint}-fg))` }}
            >
              {meta.label}
            </span>
            <span className="ml-auto font-mono text-[10.5px] text-muted-foreground/80 tabular-nums">
              {bannerSubline}
            </span>
          </div>
        </div>

        {/* ── Heartbeat sparkline ───────────────────────────────────── */}
        <div className="px-7 pb-7">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/75 font-medium">
              Heartbeat · 24h
            </span>
            <span className="font-mono text-[10.5px] tabular-nums">
              <span
                style={{
                  color:
                    hbTone === "stale"
                      ? "hsl(var(--tint-rose-fg))"
                      : hbTone === "slipping"
                        ? "hsl(var(--tint-amber-fg))"
                        : "hsl(var(--foreground) / 0.85)",
                }}
                className="font-medium"
              >
                {(node.uptime7d * 100).toFixed(1)}%
              </span>
              <span className="text-muted-foreground/55"> · 7d uptime</span>
            </span>
          </div>
          <div className="relative rounded-lg p-3 ring-1 ring-inset ring-border/30 bg-card/30">
            <HeartbeatSparkline data={node.heartbeatHistory} status={node.status} />
            <div className="mt-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground/45">
              <span>−24h</span>
              <span>now</span>
            </div>
          </div>
        </div>

        {/* ── Metrics 2x2 ───────────────────────────────────────────── */}
        <div className="px-7 pb-7">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/75 font-medium mb-3">
            Telemetry
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Metric
              label="Queue depth"
              value={node.queueDepth.toString()}
              hint={
                node.queueDepth >= 20
                  ? "backlog growing"
                  : node.queueDepth > 0
                    ? "uploads pending"
                    : "drained"
              }
              tone={
                node.queueDepth >= 20
                  ? "rose"
                  : node.queueDepth >= 10
                    ? "amber"
                    : "neutral"
              }
            />
            <Metric
              label="Errors · 24h"
              value={`${(node.errorRate24h * 100).toFixed(2)}%`}
              hint={
                node.errorRate24h >= 0.05
                  ? "above threshold"
                  : "within band"
              }
              tone={
                node.errorRate24h >= 0.05
                  ? "rose"
                  : node.errorRate24h >= 0.025
                    ? "amber"
                    : "neutral"
              }
            />
            <Metric
              label="Throughput · 24h"
              value={node.throughput24h.toString()}
              hint="documents"
              tone="neutral"
            />
            <Metric
              label="Firmware"
              value={node.firmware.replace(/^agent /, "")}
              hint="agent build"
              tone="neutral"
            />
          </div>
        </div>

        {/* ── Last incident ─────────────────────────────────────────── */}
        {node.lastIncident && (
          <div className="px-7 pb-6">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 font-medium mb-2">
              Last incident
            </div>
            <div className="rounded-lg px-3.5 py-3 ring-1 ring-inset ring-border/30 bg-card/30">
              <div className="text-[12.5px] text-foreground/90 leading-snug">
                {node.lastIncident.label}
              </div>
              <div className="mt-1.5 font-mono text-[10px] text-muted-foreground/65 tabular-nums">
                {new Date(node.lastIncident.at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Activity timeline ─────────────────────────────────────── */}
        <NodeActivityTimeline node={node} />

        {/* ── Related cases ─────────────────────────────────────────── */}
        {relatedCount > 0 && (
          <div className="px-7 pb-7 pt-1">
            <button
              onClick={() => navigate(`/app?node=${encodeURIComponent(node.id)}`)}
              className="w-full rounded-lg px-4 py-3 ring-1 ring-inset ring-border/40 hover:ring-border hover:bg-secondary/30 bg-card/30 flex items-center gap-3 text-left transition-smooth group/rc"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 font-medium mb-1">
                  Related cases
                </div>
                <div className="text-[12.5px] text-foreground/90 leading-snug">
                  <span className="font-mono tabular-nums text-foreground font-medium">
                    {relatedCount}
                  </span>{" "}
                  case{relatedCount === 1 ? "" : "s"} captured by this device
                </div>
              </div>
              <ArrowUpRight
                className="h-4 w-4 text-muted-foreground/45 group-hover/rc:text-foreground/80 group-hover/rc:translate-x-0.5 transition-smooth shrink-0"
                strokeWidth={1.75}
              />
            </button>
          </div>
        )}
      </div>

      {/* ── Action footer ──────────────────────────────────────────── */}
      {/* Calmer button language: restart is the primary CTA but expressed
          through structure (icon capsule + neutral surface) rather than a
          saturated tinted background. Mirrors the "New replay" pattern from
          Simulation Lab so primary actions read consistent across surfaces. */}
      <div className="shrink-0 border-t border-border/40 bg-background/70 backdrop-blur-md px-7 py-3.5 flex items-center gap-1.5">
        <button
          onClick={handleRestart}
          className="group/btn inline-flex items-center gap-2 h-8 pl-1.5 pr-3 rounded-md bg-secondary/60 ring-1 ring-inset ring-border text-foreground text-[11.5px] font-medium hover:bg-secondary hover:ring-primary/35 transition-smooth"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] bg-primary/12 ring-1 ring-inset ring-primary/30 group-hover/btn:ring-primary/55 transition-smooth">
            <RotateCw className="h-2.5 w-2.5 text-primary" strokeWidth={2.25} />
          </span>
          Request restart
        </button>
        <button
          onClick={handleMaintenance}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-smooth"
        >
          <Wrench className="h-3 w-3" strokeWidth={1.75} />
          Maintenance
        </button>
        <button
          onClick={handleRunbook}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-smooth ml-auto"
        >
          <BookOpen className="h-3 w-3" strokeWidth={1.75} />
          Runbook
        </button>
      </div>
    </aside>
  );
}

// Flat metric card — soft border, tone only on the value.
function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "amber" | "rose";
}) {
  const valueColor =
    tone === "rose"
      ? "hsl(var(--tint-rose-fg))"
      : tone === "amber"
        ? "hsl(var(--tint-amber-fg))"
        : "hsl(var(--foreground))";
  return (
    <div className="rounded-lg px-3.5 py-3 ring-1 ring-inset ring-border/30 bg-card/30">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/70 mb-1.5">
        {label}
      </div>
      <div
        className="font-mono text-[20px] leading-none tabular-nums font-medium"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground/60">{hint}</div>
    </div>
  );
}
