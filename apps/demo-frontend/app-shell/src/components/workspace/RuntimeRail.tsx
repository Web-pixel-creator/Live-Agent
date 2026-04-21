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

const items = [
  {
    icon: Radio,
    label: "Runtime",
    state: "ok" as const,
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
    state: "active" as const,
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
    state: "review" as const,
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
    state: "ok" as const,
    summary: "3 / 4 busy",
    rows: [
      ["wk-01 · BVA portal", "eu-de"],
      ["wk-02 · DHL tracking", "eu-de"],
      ["wk-03 · idle", "eu-fr"],
      ["wk-04 · Apostille", "us-ny"],
    ],
  },
];

const dotClass = (s: "ok" | "active" | "review") =>
  s === "ok"
    ? "bg-success"
    : s === "review"
    ? "bg-primary"
    : "bg-primary animate-pulse-glow";

export const RuntimeRail = () => (
  <aside className="hidden lg:flex flex-col items-center gap-1 w-12 border-r border-border py-3 bg-background/40">
    {items.map((it) => (
      <Popover key={it.label}>
        <PopoverTrigger asChild>
          <button className="group relative h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-smooth">
            <it.icon className="h-4 w-4" strokeWidth={1.75} />
            <span className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${dotClass(it.state)}`} />
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
              <it.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
              <span className="text-xs font-medium">{it.label}</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {it.summary}
            </span>
          </div>
          <div className="p-3 space-y-1.5">
            {it.rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs gap-3">
                <span className="text-muted-foreground truncate">{k}</span>
                <span className="font-mono text-[11px] shrink-0">{v}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    ))}
  </aside>
);
