import type { ReasoningStep } from "@/data/simulationRuns";

// Diff the two reasoning lists by topic, not by exact label. Two steps share
// a "topic" when they describe the same factor (e.g. "Country tier C · base
// risk weighting" and "Country tier B · base risk medium" both belong to the
// "country tier" topic). We derive the topic key as the prefix before " · "
// (or the first three lowercased words when no separator is present), then
// match across the two chains:
//   • same topic, different signal → "changed" (the interesting case — a
//     factor that flipped tone under the new policy)
//   • only in replayed → "added"
//   • only in original → "removed"
// We surface up to three bullets via round-robin across the buckets so an
// asymmetric chain (e.g. 4 added vs 2 removed) doesn't push removed off the
// list and read as "only additions".
export type DiffBullet = {
  kind: "changed" | "added" | "removed";
  label: string;
  fromSignal?: ReasoningStep["signal"];
  toSignal?: ReasoningStep["signal"];
};

const topicKey = (label: string): string => {
  const head = label.split("·")[0]?.trim() ?? label;
  // Take only the first two words: this collapses tier letters, country
  // codes, doc states, etc. so that semantically-paired steps share a key
  // ("Country tier B" and "Country tier C" both reduce to "country tier").
  // Two words is the sweet spot — one is too coarse (everything starting
  // with "Country" collides), four+ keeps the discriminator that breaks
  // matching.
  const words = head.toLowerCase().split(/\s+/).slice(0, 2);
  return words.join(" ");
};

export const diffReasoning = (
  original: ReasoningStep[],
  replayed: ReasoningStep[],
): DiffBullet[] => {
  // Build topic → step indices. Multiple steps on the same topic are rare
  // but possible; we pair them positionally (first orig with first repl).
  const origByTopic = new Map<string, ReasoningStep[]>();
  for (const s of original) {
    const k = topicKey(s.label);
    if (!origByTopic.has(k)) origByTopic.set(k, []);
    origByTopic.get(k)!.push(s);
  }
  const replByTopic = new Map<string, ReasoningStep[]>();
  for (const s of replayed) {
    const k = topicKey(s.label);
    if (!replByTopic.has(k)) replByTopic.set(k, []);
    replByTopic.get(k)!.push(s);
  }

  const changed: DiffBullet[] = [];
  const added: DiffBullet[] = [];
  const removed: DiffBullet[] = [];

  // Walk replayed in order so output mirrors the operator's reading rhythm.
  for (const r of replayed) {
    const k = topicKey(r.label);
    const origPool = origByTopic.get(k);
    if (origPool && origPool.length > 0) {
      const o = origPool.shift()!;
      if (o.signal !== r.signal) {
        changed.push({
          kind: "changed",
          // Use the replayed label — it's the "current truth" the operator
          // is being asked to evaluate. The original signal is conveyed by
          // the inline (− → +) marker.
          label: r.label,
          fromSignal: o.signal,
          toSignal: r.signal,
        });
      }
      // Same topic, same signal → silently identical, drop from the diff.
    } else {
      added.push({ kind: "added", label: r.label, toSignal: r.signal });
    }
  }
  // Anything left in origByTopic was not matched by anything in replayed.
  for (const pool of origByTopic.values()) {
    for (const o of pool) {
      removed.push({ kind: "removed", label: o.label, fromSignal: o.signal });
    }
  }

  // Round-robin in priority order keeps balance without losing the
  // "most important first" intent.
  const buckets = [changed, added, removed];
  const out: DiffBullet[] = [];
  while (out.length < 3 && buckets.some((b) => b.length > 0)) {
    for (const b of buckets) {
      if (out.length >= 3) break;
      const next = b.shift();
      if (next) out.push(next);
    }
  }
  return out;
};

// Tone for a signal — mirrors StepIcon palette so colour reads consistently.
export const signalColor = (sig: ReasoningStep["signal"] | undefined) => {
  if (sig === "positive") return "hsl(var(--tint-mint-fg))";
  if (sig === "negative") return "hsl(var(--tint-rose-fg))";
  return "hsl(var(--muted-foreground))";
};

export const signalLabel = (sig: ReasoningStep["signal"] | undefined) => {
  if (sig === "positive") return "+";
  if (sig === "negative") return "−";
  return "·";
};
