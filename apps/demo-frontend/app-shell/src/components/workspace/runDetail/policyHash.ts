// Shared visual hash for policy snapshots — a single colour that identifies
// each policy at a glance. Used both as the 3px left bar on simulation cards
// and as the matching bar on the drawer header so the colour identity carries
// through the click. Errors override (rose) — operators triage failures first
// regardless of which policy ran them.
export const policyHashColor = (
  policyId: string,
  isError: boolean,
): string => {
  if (isError) return "hsl(var(--tint-rose-fg))";
  switch (policyId) {
    case "policy-current":
      return "hsl(var(--primary))";
    case "policy-conservative-v2":
      return "hsl(var(--tint-mint-fg))";
    case "policy-draft-v3":
      return "hsl(var(--tint-violet-fg))";
    case "policy-experimental":
      return "hsl(var(--tint-amber-fg))";
    default:
      return "hsl(var(--tint-slate-fg))";
  }
};
