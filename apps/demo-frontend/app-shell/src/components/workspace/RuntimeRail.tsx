import {
  Radio,
  Workflow as WorkflowIcon,
  ShieldCheck,
  Globe,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";

type RailState = "ok" | "active" | "review";

type RailItem = {
  icon: typeof Radio;
  label: string;
  state: RailState;
  summary: string;
  rows: Array<[string, string]>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function toText(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dotClass(state: RailState) {
  return state === "ok"
    ? "bg-success"
    : state === "review"
      ? "bg-primary"
      : "bg-primary animate-pulse-glow";
}

const fallbackItems: RailItem[] = [
  {
    icon: Radio,
    label: "Runtime",
    state: "ok",
    summary: "412ms · $0.42",
    rows: [
      ["Session", "sess_8f2a · live"],
      ["Model", "gpt-action-v3"],
      ["Latency p50", "412ms"],
      ["Tokens · 1h", "184k / 500k"],
      ["Cost · case", "$0.42"],
    ],
  },
  {
    icon: WorkflowIcon,
    label: "Workflow",
    state: "active",
    summary: "step 4 / 6",
    rows: [
      ["1 Lead intake", "08:14"],
      ["2 Qualification", "08:16"],
      ["3 Consultation", "08:22"],
      ["4 Document follow-up", "now"],
      ["5 CRM update", "—"],
      ["6 Escalation gate", "—"],
    ],
  },
  {
    icon: ShieldCheck,
    label: "Guardrails",
    state: "review",
    summary: "1 needs review",
    rows: [
      ["PII redaction", "pass"],
      ["Jurisdiction · DE", "pass"],
      ["Tone · RU", "pass"],
      ["Auto-send threshold", "review"],
      ["Replay manifest", "pass"],
    ],
  },
  {
    icon: Globe,
    label: "Workers",
    state: "ok",
    summary: "3 / 4 busy",
    rows: [
      ["wk-01 · BVA portal", "eu-de"],
      ["wk-02 · DHL tracking", "eu-de"],
      ["wk-03 · idle", "eu-fr"],
      ["wk-04 · Apostille", "us-ny"],
    ],
  },
];

export const RuntimeRail = () => {
  const {
    runtimeActive,
    pendingApprovalCount,
    runtimeDiagnostics,
    bootstrapDoctor,
    browserWorkers,
  } = useWorkspaceRuntime();

  const diagnostics = asRecord(runtimeDiagnostics);
  const orchestrator = asRecord(diagnostics?.orchestrator);
  const uiExecutor = asRecord(diagnostics?.uiExecutor);
  const latestCaseWiki = asRecord(orchestrator?.latestCaseWikiRoutingContext);

  const doctor = asRecord(bootstrapDoctor);
  const doctorSummary = asRecord(doctor?.summary);
  const doctorChecks = asRecord(doctorSummary?.checks);

  const workers = asRecord(browserWorkers);
  const workerQueue = asRecord(workers?.queue);
  const recentJobs = Array.isArray(workers?.recent)
    ? workers.recent.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];

  const runtimeRows: Array<[string, string]> = runtimeActive
    ? [
        ["Status", toText(diagnostics?.status)],
        ["Session", toText(orchestrator?.workflowSessionId)],
        ["Route", toText(orchestrator?.workflowRoute)],
        ["Case Wiki", toText(latestCaseWiki?.ingressSource)],
        ["Updated", toText(orchestrator?.workflowUpdatedAt)],
      ]
    : fallbackItems[0].rows;

  const workflowStage = toText(orchestrator?.workflowCurrentStage);
  const workflowRows: Array<[string, string]> = runtimeActive
    ? [
        ["Stage", workflowStage],
        ["Role", toText(orchestrator?.workflowActiveRole)],
        ["Intent", toText(orchestrator?.workflowIntent)],
        ["Route", toText(orchestrator?.workflowRoute)],
        ["Queue", pendingApprovalCount > 0 ? `${pendingApprovalCount} awaiting approval` : "clear"],
      ]
    : fallbackItems[1].rows;

  const guardrailRows: Array<[string, string]> = runtimeActive
    ? [
        ["Doctor", toText(doctor?.status)],
        ["Checks", `${toText(doctorChecks?.ok, "0")} ok / ${toText(doctorChecks?.fail, "0")} fail`],
        ["Top check", toText(asRecord(doctorSummary?.topCheck)?.id)],
        ["Fallback paths", toText(asRecord(doctorSummary?.fallbackPaths)?.readyCount)],
        ["Evidence", toText(asRecord(doctorSummary?.evidenceSigning)?.status)],
      ]
    : fallbackItems[2].rows;

  const workerRunning = toNumber(workerQueue?.running);
  const workerPaused = toNumber(workerQueue?.paused);
  const workerFailed = toNumber(workerQueue?.failed);
  const workerSummary =
    workerRunning !== null || workerPaused !== null || workerFailed !== null
      ? `${workerRunning ?? 0} running · ${workerPaused ?? 0} paused`
      : fallbackItems[3].summary;

  const workerRows: Array<[string, string]> = runtimeActive
    ? [
        ["Running", toText(workerQueue?.running)],
        ["Paused", toText(workerQueue?.paused)],
        ["Failed", toText(workerQueue?.failed)],
        ["Checkpoint ready", toText(workerQueue?.checkpointReady)],
        [
          "Latest job",
          recentJobs.length > 0
            ? `${toText(recentJobs[0]?.label)} · ${toText(recentJobs[0]?.status)}`
            : "—",
        ],
      ]
    : fallbackItems[3].rows;

  const items: RailItem[] = runtimeActive
    ? [
        {
          icon: Radio,
          label: "Runtime",
          state: toText(diagnostics?.status) === "healthy" ? "ok" : "review",
          summary: toText(orchestrator?.workflowRoute, "live"),
          rows: runtimeRows,
        },
        {
          icon: WorkflowIcon,
          label: "Workflow",
          state: pendingApprovalCount > 0 ? "active" : "ok",
          summary: workflowStage,
          rows: workflowRows,
        },
        {
          icon: ShieldCheck,
          label: "Guardrails",
          state: toText(doctor?.status) === "healthy" ? "ok" : "review",
          summary: `${toText(doctorChecks?.fail, "0")} failing`,
          rows: guardrailRows,
        },
        {
          icon: Globe,
          label: "Workers",
          state: (workerFailed ?? 0) > 0 || (workerPaused ?? 0) > 0 ? "review" : "ok",
          summary: workerSummary,
          rows: workerRows,
        },
      ]
    : fallbackItems;

  return (
    <aside className="hidden lg:flex flex-col items-center gap-1 w-12 border-r border-border py-3 bg-background/40">
      {items.map((item) => (
        <Popover key={item.label}>
          <PopoverTrigger asChild>
            <button className="group relative h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-smooth">
              <item.icon className="h-4 w-4" strokeWidth={1.75} />
              <span className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${dotClass(item.state)}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-64 p-0 border-border bg-card"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <item.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{item.summary}</span>
            </div>
            <div className="p-3 space-y-1.5">
              {item.rows.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-xs gap-3">
                  <span className="text-muted-foreground truncate">{key}</span>
                  <span className="font-mono text-[11px] shrink-0">{value}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </aside>
  );
};
