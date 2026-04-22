import { NavLink } from "@/components/NavLink";
import {
  LayoutList,
  Gauge,
  Beaker,
  Server,
  FileText,
  Camera,
  Check,
  ArrowUpRight,
  Star,
  Activity,
  Plug,
  Inbox,
  ShieldCheck,
  HeartPulse,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Pill } from "@/components/ui/pill";
import { useLocation, useNavigate } from "react-router-dom";
import { nodeCounts } from "@/data/nodes";
import { useToast } from "@/hooks/use-toast";
import { useVipCases } from "@/hooks/useVipCases";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";

type BadgeTone = "violet" | "rose" | "crimson" | "amber" | "mint" | "slate";

type Section = {
  title: string;
  url: string;
  icon: typeof LayoutList;
  count?: number;
  tone?: BadgeTone;
};

// Device Nodes badge — derives from current node fleet health. Rose tone if
// any device is offline (top-of-mind incident), amber if only degraded, no
// badge at all when everything is steady so the sidebar stays calm.
// Sub-navigation under Operator Console — each entry is an *anchor* into a
// real surface that already exists in the app. We deliberately don't invent
// new pages; the labels describe operator-facing destinations and route to
// the workspace section that owns that responsibility.
const operatorSurfaces: {
  label: string;
  icon: typeof Activity;
  url: string;
  count?: number;
  tone?: BadgeTone;
}[] = [
  // Live activity → the case stream the operator sees first.
  { label: "Live activity", icon: Activity, url: "/app/console#live-activity" },
  // Connections → device/node fleet that feeds events into the desk.
  { label: "Connections", icon: Plug, url: "/app/console/runtime#connections" },
  // Action queue → pending approvals, jumps straight to the first one.
  {
    label: "Action queue",
    icon: Inbox,
    url: "/app/console#action-queue",
  },
  // Safety rules → policy snapshots are governed in Simulation Lab.
  { label: "Safety rules", icon: ShieldCheck, url: "/app/console/runtime#safety-rules" },
  // Health check → fleet health lives in Device Nodes.
  { label: "Health check", icon: HeartPulse, url: "/app/console/runtime#health-check" },
];

const judgeArtifacts: { label: string; icon: typeof FileText; count?: number; tone?: BadgeTone; url?: string }[] = [
  { label: "Presentation Bundle", icon: FileText, url: "/bundle" },
  { label: "Visual Evidence", icon: Camera, count: 8, tone: "mint", url: "/evidence" },
];

// Tone → tinted badge styles. Keeps the colour vocabulary consistent with the
// rest of the workspace (live desk pills, sla hashes, awaiting signals).
const TONE_STYLES: Record<BadgeTone, { bg: string; fg: string; ring: string }> = {
  violet:  { bg: "hsl(var(--tint-violet) / 0.16)",  fg: "hsl(var(--tint-violet-fg))",  ring: "hsl(var(--tint-violet) / 0.28)" },
  rose:    { bg: "hsl(var(--tint-rose) / 0.16)",    fg: "hsl(var(--tint-rose-fg))",    ring: "hsl(var(--tint-rose) / 0.32)" },
  crimson: { bg: "hsl(var(--tint-crimson) / 0.18)", fg: "hsl(var(--tint-crimson-fg))", ring: "hsl(var(--tint-crimson) / 0.36)" },
  amber:   { bg: "hsl(var(--tint-amber) / 0.16)",   fg: "hsl(var(--tint-amber-fg))",   ring: "hsl(var(--tint-amber) / 0.28)" },
  mint:    { bg: "hsl(var(--tint-mint) / 0.16)",    fg: "hsl(var(--tint-mint-fg))",    ring: "hsl(var(--tint-mint) / 0.28)" },
  slate:   { bg: "hsl(var(--tint-slate) / 0.16)",   fg: "hsl(var(--tint-slate-fg))",   ring: "hsl(var(--tint-slate) / 0.28)" },
};

// Compact, ringed count badge — pill with soft tint, mono digits. Optional
// pulse for urgency (used on Operator Console pending approvals).
function CountBadge({ count, tone, pulse }: { count: number; tone?: BadgeTone; pulse?: boolean }) {
  if (!tone) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums shrink-0">
        {count}
      </span>
    );
  }
  const t = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full font-mono text-[10px] tabular-nums shrink-0 ring-1 ring-inset transition-smooth ${pulse ? "animate-pulse-soft" : ""}`}
      style={{ backgroundColor: t.bg, color: t.fg, ['--tw-ring-color' as any]: t.ring }}
    >
      {count}
    </span>
  );
}

// Shared row layout — icon hover-shifts right by 1px for a tactile cue, keeps
// label/count perfectly aligned. Active state uses a violet-tinted gradient
// + left accent rail (added inside the NavLink) so the current section
// reads at a glance without screaming.
const ROW =
  "group/row relative flex items-center gap-3 h-9 px-2.5 rounded-md text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-smooth";
const ROW_ACTIVE =
  "bg-sidebar-accent/60 text-sidebar-accent-foreground";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    cases,
    deviceNodes,
    pendingApprovals,
    activeCaseCount,
    pendingApprovalCount,
  } = useWorkspaceRuntime();
  const runtimeNodeCounts = nodeCounts(deviceNodes);
  const runtimeNodesBadge: { count: number; tone: BadgeTone } | null =
    runtimeNodeCounts.offline > 0
      ? { count: runtimeNodeCounts.offline + runtimeNodeCounts.degraded, tone: "crimson" }
      : runtimeNodeCounts.degraded > 0
        ? { count: runtimeNodeCounts.degraded, tone: "amber" }
        : null;
  const runtimeSections: Section[] = [
    { title: "Live Desk", url: "/app", icon: LayoutList, count: activeCaseCount, tone: "violet" },
    { title: "Operator Console", url: "/app/console", icon: Gauge, count: pendingApprovalCount, tone: "rose" },
    { title: "Simulation Lab", url: "/app/simulation", icon: Beaker },
    {
      title: "Device Nodes",
      url: "/app/nodes",
      icon: Server,
      ...(runtimeNodesBadge ?? {}),
    },
  ];
  const runtimeOperatorSurfaces = operatorSurfaces.map((surface) =>
    surface.label === "Action queue"
      ? {
          ...surface,
          count: pendingApprovalCount,
          tone: pendingApprovalCount > 0 ? "amber" : undefined,
        }
      : surface,
  );
  const firstPending = pendingApprovals[0];
  const firstPendingRef = firstPending?.caseRef;
  const firstPendingCase = firstPendingRef
    ? cases.find((c) => c.ref === firstPendingRef)
    : undefined;

  // VIP cases — pulled from the persisted localStorage set so the count
  // updates the moment the operator toggles a case in the client tooltip.
  const { vipSet } = useVipCases();
  const vipCases = cases.filter((c) => vipSet.has(c.ref));
  const vipCount = vipCases.length;

  const handleApprove = () => {
    if (!firstPending) return;
    toast({
      title: "Approval sent",
      description: `${firstPending.caseRef} · ${firstPending.kind}`,
    });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header — wordmark only, like the reference */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2.5 py-3.5">
          <div className="relative h-6 w-6 shrink-0">
            <div className="absolute inset-0 rounded-[5px] bg-gradient-primary opacity-90" />
            <div className="absolute inset-[3px] rounded-[3px] bg-sidebar flex items-center justify-center">
              <div className="h-1 w-1 rounded-full bg-primary animate-pulse-glow" />
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold tracking-tight truncate">
                Action Desk
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2.5 py-5 gap-7">
        {/* Primary sections */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {runtimeSections.map((s) => {
                const active =
                  s.title === "Operator Console"
                    ? pathname.startsWith("/app/console")
                    : pathname === s.url;
                // Sub-menu stays open when the operator is anywhere a sub
                // entry points to — so e.g. on /app/simulation the operator
                // still sees "Safety rules" highlighted under Console. This
                // turns the sub-nav into a persistent map of where they are
                // rather than a state-only-on-Console disclosure.
                const onAnySubDest =
                  s.title === "Operator Console" &&
                    runtimeOperatorSurfaces.some((sub) => {
                      const [subPath, subHash = ""] = sub.url.split("#");
                      return subPath === pathname && (!subHash || `#${subHash}` === hash);
                    });
                const showSub =
                  (active || onAnySubDest) &&
                  !collapsed &&
                  s.title === "Operator Console";
                const pulseRose =
                  s.title === "Operator Console" && (s.count ?? 0) > 0;
                return (
                  <SidebarMenuItem key={s.url}>
                    <SidebarMenuButton
                      asChild
                      tooltip={collapsed ? s.title : undefined}
                      className="h-8 p-0 hover:bg-transparent data-[active=true]:bg-transparent"
                    >
                      <NavLink
                        to={s.url}
                        end
                        className={ROW}
                        activeClassName={ROW_ACTIVE}
                      >
                        {/* Active accent rail — 2px violet bar on the left
                            edge, only when this row is the current section. */}
                        {active && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-primary"
                          />
                        )}
                        <s.icon
                          className={`h-[15px] w-[15px] shrink-0 transition-smooth group-hover/row:translate-x-0.5 ${
                            active ? "text-primary opacity-100" : "opacity-70 group-hover/row:opacity-100"
                          }`}
                          strokeWidth={1.75}
                        />
                        {!collapsed && (
                          <>
                            <span className={`text-[13px] truncate flex-1 ${active ? "font-medium" : ""}`}>
                              {s.title}
                            </span>
                            {typeof s.count === "number" && (
                                pulseRose ? (
                                <HoverCard openDelay={200} closeDelay={100}>
                                  <HoverCardTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigate(
                                          firstPendingRef
                                            ? `/app/console?ref=${encodeURIComponent(firstPendingRef)}`
                                            : "/app/console",
                                        );
                                      }}
                                      title={
                                        firstPendingRef
                                          ? `Open pending approval · ${firstPendingRef}`
                                          : "Open Operator Console"
                                      }
                                      className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full font-mono text-[10px] tabular-nums shrink-0 animate-pulse-soft cursor-pointer hover:brightness-125 transition-smooth ring-1 ring-inset"
                                      style={{
                                        backgroundColor: "hsl(var(--tint-rose) / 0.16)",
                                        color: "hsl(var(--tint-rose-fg))",
                                        ['--tw-ring-color' as any]: "hsl(var(--tint-rose) / 0.32)",
                                      }}
                                    >
                                      {s.count}
                                    </button>
                                  </HoverCardTrigger>
                                  {firstPending && (
                                    <HoverCardContent
                                      side="right"
                                      align="start"
                                      sideOffset={12}
                                      className="w-80 p-0 border-border bg-popover/95 backdrop-blur-md"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {/* Header strip — rose tint, mirrors sla band */}
                                      <div
                                        className="flex items-center gap-2 px-3.5 py-2 border-b border-border"
                                        style={{ backgroundColor: "hsl(var(--tint-rose) / 0.08)" }}
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
                                          className="text-[10px] font-medium uppercase tracking-[0.14em]"
                                          style={{ color: "hsl(var(--tint-rose-fg))" }}
                                        >
                                          Pending approval
                                        </span>
                                        <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
                                          {firstPending.caseRef}
                                        </span>
                                      </div>

                                      {/* Body */}
                                      <div className="px-3.5 py-3 space-y-2.5">
                                        {firstPendingCase && (
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-[13px] font-medium truncate">
                                              {firstPendingCase.client}
                                            </span>
                                            <Pill tone="violet" size="sm">
                                              {firstPendingCase.visa}
                                            </Pill>
                                            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                                              · {firstPendingCase.country}
                                            </span>
                                          </div>
                                        )}
                                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                                          {firstPending.kind}
                                        </p>
                                        {firstPendingCase && (
                                          <div className="flex items-center gap-3 pt-0.5 text-[10px] text-muted-foreground">
                                            <span>Owner · {firstPendingCase.owner}</span>
                                            <span className="text-border">|</span>
                                            <span
                                              className="font-mono tabular-nums"
                                              style={
                                                firstPendingCase.slaWarn
                                                  ? { color: "hsl(var(--tint-rose-fg))" }
                                                  : undefined
                                              }
                                            >
                                              SLA · {firstPendingCase.sla}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Actions */}
                                      <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-t border-border bg-secondary/20">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleApprove();
                                          }}
                                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-smooth hover:brightness-125"
                                          style={{
                                            backgroundColor: "hsl(var(--tint-mint) / 0.18)",
                                            color: "hsl(var(--tint-mint-fg))",
                                          }}
                                        >
                                          <Check className="h-3 w-3" strokeWidth={2.5} />
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            navigate(
                                              `/app/console?ref=${encodeURIComponent(firstPending.caseRef)}`,
                                            );
                                          }}
                                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-smooth ml-auto"
                                        >
                                          Open in Console
                                          <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                                        </button>
                                      </div>
                                    </HoverCardContent>
                                  )}
                                </HoverCard>
                              ) : (
                                <CountBadge count={s.count} tone={s.tone} />
                              )
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>

                    {showSub && (
                      <SidebarMenuSub className="mx-0 mt-2 mb-1 border-l border-sidebar-border/50 pl-3 gap-0.5">
                        {runtimeOperatorSurfaces.map((sub) => {
                          const SubIcon = sub.icon;
                          // Action queue deep-links to the first pending case
                          // so the click lands on the actual approval, not the
                          // empty /app/console fallback.
                          const target =
                            sub.label === "Action queue" && firstPendingRef
                              ? `/app/console?ref=${encodeURIComponent(firstPendingRef)}#action-queue`
                              : sub.url;
                          // Active when current pathname matches this sub's
                          // destination. Console itself counts as "Action
                          // queue" since that's its primary purpose.
                          const [subPath, subHash = ""] = sub.url.split("#");
                          const subActive =
                            (pathname === subPath &&
                              (!subHash || `#${subHash}` === hash)) ||
                            (sub.label === "Action queue" &&
                              pathname === "/app/console" &&
                              (hash === "" || hash === "#action-queue"));
                          return (
                            <SidebarMenuSubItem key={sub.label}>
                              <SidebarMenuSubButton
                                asChild
                                className={
                                  "group/sub relative h-7 px-2 text-[12px] rounded-md transition-smooth " +
                                  (subActive
                                    ? "bg-sidebar-accent/60 text-sidebar-accent-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40")
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => navigate(target)}
                                  className="w-full flex items-center gap-2 text-left"
                                  title={sub.label}
                                >
                                  {/* Active accent — 2px violet rail on the
                                      far-left edge, mirrors the parent row's
                                      active indicator so the visual language
                                      stays consistent across nav levels. */}
                                  {subActive && (
                                    <span
                                      aria-hidden
                                      className="absolute left-[-13px] top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-primary"
                                    />
                                  )}
                                  <SubIcon
                                    className={
                                      "h-3 w-3 shrink-0 transition-smooth " +
                                      (subActive
                                        ? "opacity-100 text-primary"
                                        : "opacity-60 group-hover/sub:opacity-90")
                                    }
                                    strokeWidth={1.75}
                                  />
                                  <span
                                    className={
                                      "flex-1 truncate " +
                                      (subActive ? "font-medium" : "")
                                    }
                                  >
                                    {sub.label}
                                  </span>
                                  {typeof sub.count === "number" && sub.count > 0 && (
                                    <CountBadge count={sub.count} tone={sub.tone} />
                                  )}
                                </button>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* VIP cases — surfaced as a dedicated quiet group so the operator
            sees their flagged clients at a glance. Hidden when nothing is
            marked, to avoid an empty section. In collapsed mode we render a
            minimal star + count chip in place of the group. */}
        {vipCount > 0 && !collapsed && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-2.5 mb-1.5 h-6 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium flex items-center gap-1.5">
              <Star
                className="h-2.5 w-2.5 fill-current"
                style={{ color: "hsl(var(--tint-amber-fg))" }}
                strokeWidth={1.5}
              />
              <span>VIP cases · {vipCount}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {vipCases.slice(0, 5).map((vc) => (
                  <SidebarMenuItem key={vc.ref}>
                    <SidebarMenuButton
                      asChild
                      className="h-8 p-0 hover:bg-transparent"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/app/console?ref=${encodeURIComponent(vc.ref)}`)
                        }
                        className={ROW + " w-full text-left"}
                        title={`Open ${vc.ref} · ${vc.client}`}
                      >
                        <Star
                          className="h-[13px] w-[13px] shrink-0 fill-current transition-smooth group-hover/row:translate-x-0.5"
                          style={{ color: "hsl(var(--tint-amber-fg))" }}
                          strokeWidth={1.5}
                        />
                        <span className="text-[12.5px] truncate flex-1">
                          {vc.client}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums shrink-0">
                          {vc.ref}
                        </span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {vipCount > 5 && (
                  <li className="px-2.5 pt-0.5 text-[10px] text-muted-foreground/60">
                    + {vipCount - 5} more
                  </li>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Collapsed-mode VIP chip — keeps the count visible in icon-only mode. */}
        {vipCount > 0 && collapsed && (
          <button
            type="button"
            onClick={() => navigate("/app")}
            title={`${vipCount} VIP case${vipCount === 1 ? "" : "s"}`}
            className="mx-auto mt-1 inline-flex items-center justify-center gap-1 h-6 px-1.5 rounded-full ring-1 ring-inset transition-smooth hover:brightness-125"
            style={{
              backgroundColor: "hsl(var(--tint-amber) / 0.16)",
              color: "hsl(var(--tint-amber-fg))",
              ['--tw-ring-color' as any]: "hsl(var(--tint-amber) / 0.32)",
            }}
          >
            <Star className="h-2.5 w-2.5 fill-current" strokeWidth={1.5} />
            <span className="font-mono text-[10px] tabular-nums">{vipCount}</span>
          </button>
        )}

        {/* Judge artifacts */}
        {!collapsed && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-2.5 mb-1.5 h-6 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
              Judge artifacts
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {judgeArtifacts.map((j) => {
                  const active = j.url ? pathname === j.url || pathname.startsWith(`${j.url}/`) : false;
                  return (
                    <SidebarMenuItem key={j.label}>
                      <SidebarMenuButton
                        asChild={!!j.url}
                        className={j.url ? "h-8 p-0 hover:bg-transparent data-[active=true]:bg-transparent" : ROW}
                      >
                        {j.url ? (
                          <NavLink
                            to={j.url}
                            className={ROW}
                            activeClassName={ROW_ACTIVE}
                          >
                            {active && (
                              <span
                                aria-hidden
                                className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-primary"
                              />
                            )}
                            <j.icon
                              className={`h-[15px] w-[15px] shrink-0 transition-smooth group-hover/row:translate-x-0.5 ${
                                active ? "text-primary opacity-100" : "opacity-70 group-hover/row:opacity-100"
                              }`}
                              strokeWidth={1.75}
                            />
                            <span className={`text-[13px] truncate flex-1 ${active ? "font-medium" : ""}`}>
                              {j.label}
                            </span>
                            {typeof j.count === "number" && (
                              <CountBadge count={j.count} tone={j.tone} />
                            )}
                          </NavLink>
                        ) : (
                          <>
                            <j.icon
                              className="h-[15px] w-[15px] shrink-0 opacity-70 group-hover/row:opacity-100 group-hover/row:translate-x-0.5 transition-smooth"
                              strokeWidth={1.75}
                            />
                            <span className="text-[13px] truncate flex-1">{j.label}</span>
                            {typeof j.count === "number" && (
                              <CountBadge count={j.count} tone={j.tone} />
                            )}
                          </>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer — quiet user chip */}
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2.5 py-2.5">
          <div className="h-6 w-6 rounded-full bg-gradient-primary shrink-0 flex items-center justify-center text-[10px] font-semibold text-primary-foreground">
            AP
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium truncate leading-tight">
                A. Petrova
              </div>
              <div className="text-[10px] text-muted-foreground truncate leading-tight">
                Operator · EU desk
              </div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
