import {
  FileSearch,
  TriangleAlert,
  CalendarCheck,
  Mailbox,
  Languages,
  RefreshCcw,
  Hourglass,
  CircleCheck,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";

// Map common stage phrases to a quiet glyph. Falls back to a neutral dashed circle.
// Order matters — first match wins, so put more specific patterns first.
const STAGE_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /escalation|escalate|breach/i, icon: TriangleAlert },
  { match: /consult|meeting|booked/i, icon: CalendarCheck },
  { match: /awaiting|pending|waiting/i, icon: Hourglass },
  { match: /translation|translate/i, icon: Languages },
  { match: /document|follow.?up|missing/i, icon: FileSearch },
  { match: /lead|intake/i, icon: Mailbox },
  { match: /crm|update|sync/i, icon: RefreshCcw },
  { match: /done|resolved|complete/i, icon: CircleCheck },
];

interface StageIconProps {
  stage: string;
}

export function StageIcon({ stage }: StageIconProps) {
  const match = STAGE_ICONS.find((s) => s.match.test(stage));
  const Icon = match?.icon ?? CircleDashed;
  return (
    <Icon
      className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
      strokeWidth={1.75}
      aria-hidden
    />
  );
}
