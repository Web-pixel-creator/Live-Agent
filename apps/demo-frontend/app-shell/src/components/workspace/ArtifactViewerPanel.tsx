import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileJson, Files, RefreshCcw, Copy, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  fetchRuntimeArtifactDocument,
  fetchRuntimeArtifactIndex,
  summarizeRuntimeArtifact,
  type RuntimeArtifactIndexEntry,
} from "@/lib/runtime-artifact-viewer";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "not published";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "not published";
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryOrder(value: string): number {
  switch (value) {
    case "demo-e2e":
      return 0;
    case "runtime":
      return 1;
    case "release-evidence":
      return 2;
    default:
      return 99;
  }
}

export const ArtifactViewerPanel = () => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const artifactIndexQuery = useQuery({
    queryKey: ["app-shell", "runtime-artifact-index"],
    queryFn: () => fetchRuntimeArtifactIndex(),
    staleTime: 30_000,
    retry: 1,
  });

  const artifactEntries = useMemo(
    () =>
      [...(artifactIndexQuery.data ?? [])].sort((left, right) => {
        const categoryDelta = categoryOrder(left.category) - categoryOrder(right.category);
        if (categoryDelta !== 0) {
          return categoryDelta;
        }
        return left.label.localeCompare(right.label);
      }),
    [artifactIndexQuery.data],
  );

  useEffect(() => {
    if (!artifactEntries.length) {
      return;
    }
    if (!selectedPath || !artifactEntries.some((entry) => entry.relativePath === selectedPath)) {
      setSelectedPath(artifactEntries[0]?.relativePath ?? null);
    }
  }, [artifactEntries, selectedPath]);

  const selectedEntry =
    artifactEntries.find((entry) => entry.relativePath === selectedPath) ??
    artifactEntries[0] ??
    null;

  const artifactDocumentQuery = useQuery({
    queryKey: ["app-shell", "runtime-artifact-document", selectedEntry?.relativePath ?? null],
    enabled: Boolean(selectedEntry),
    queryFn: () => fetchRuntimeArtifactDocument(selectedEntry as RuntimeArtifactIndexEntry),
    staleTime: 30_000,
    retry: 1,
  });

  const artifactSummary = summarizeRuntimeArtifact(artifactDocumentQuery.data?.payload);
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, RuntimeArtifactIndexEntry[]>();
    for (const entry of artifactEntries) {
      const current = groups.get(entry.category) ?? [];
      current.push(entry);
      groups.set(entry.category, current);
    }
    return [...groups.entries()];
  }, [artifactEntries]);

  const copyJson = async () => {
    const raw = artifactDocumentQuery.data?.raw;
    if (!raw) {
      return;
    }
    try {
      await navigator.clipboard.writeText(raw);
      toast.success("Artifact JSON copied");
    } catch {
      toast.error("Artifact JSON copy failed");
    }
  };

  return (
    <section
      id="artifact-viewer"
      className="relative mt-6 -mx-8 px-8 py-6 bg-secondary/[0.03] border-y border-border/50 scroll-mt-24"
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-border/70" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary mb-3">
            Artifact Viewer
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[30px] leading-[1.1] tracking-tight">
              Replay and evidence artifact inspector
            </h2>
            <Pill tone="slate" size="sm">
              Euphony-inspired
            </Pill>
            {selectedEntry ? (
              <Pill tone="violet" size="sm">
                {selectedEntry.category}
              </Pill>
            ) : null}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Inspect repo-owned runtime, release, and demo artifacts without leaving the support
            surface. This is a structured debug viewer for replay, proof, and judge evidence lanes,
            not a primary product screen.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            className="h-9 px-3 text-[12px]"
            onClick={() => artifactIndexQuery.refetch()}
          >
            <RefreshCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Refresh index
          </Button>
          <Button
            variant="ghost"
            className="h-9 px-3 text-[12px]"
            onClick={copyJson}
            disabled={!artifactDocumentQuery.data?.raw}
          >
            <Copy className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Copy JSON
          </Button>
          <Button
            variant="ghost"
            className="h-9 px-3 text-[12px]"
            onClick={() => selectedEntry && window.open(selectedEntry.url, "_blank", "noopener,noreferrer")}
            disabled={!selectedEntry}
          >
            <ArrowUpRight className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Open raw
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
        <aside className="rounded-[24px] border border-border/60 bg-background/70 p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Files className="h-3.5 w-3.5" strokeWidth={1.75} />
            Artifact sources
          </div>
          <div className="mt-4 space-y-4">
            {groupedEntries.map(([category, entries]) => (
              <div key={category} className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {category}
                </div>
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const active = entry.relativePath === selectedEntry?.relativePath;
                    return (
                      <button
                        key={entry.relativePath}
                        type="button"
                        onClick={() => setSelectedPath(entry.relativePath)}
                        className={`w-full rounded-2xl border p-3 text-left transition-smooth ${
                          active
                            ? "border-primary/40 bg-secondary/[0.25]"
                            : "border-border/50 bg-background/65 hover:border-border/80 hover:bg-secondary/[0.18]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-foreground/92">{entry.label}</div>
                          <Pill tone={active ? "violet" : "slate"} size="sm">
                            {formatBytes(entry.size)}
                          </Pill>
                        </div>
                        <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {entry.description}
                        </div>
                        <div className="mt-2 font-mono text-[10px] text-muted-foreground/80">
                          {entry.relativePath}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groupedEntries.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-background/65 p-4 text-sm leading-relaxed text-muted-foreground">
                No debug artifacts are available yet. Run the demo or release evidence lanes first.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="rounded-[24px] border border-border/60 bg-background/70 p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <FileJson className="h-3.5 w-3.5" strokeWidth={1.75} />
            Structured inspection
          </div>
          {selectedEntry ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="text-[15px] leading-relaxed text-foreground/92">
                  {selectedEntry.label}
                </div>
                <Pill tone="slate" size="sm">
                  {artifactSummary.shape}
                </Pill>
                <Pill tone="slate" size="sm">
                  {artifactSummary.count}
                </Pill>
              </div>

              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="text-right text-foreground/88">{selectedEntry.category}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Path</dt>
                  <dd className="max-w-[22rem] text-right font-mono text-[11px] text-foreground/88">
                    {selectedEntry.relativePath}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd className="text-right font-mono text-[11px] text-foreground/88">
                    {formatTimestamp(selectedEntry.updatedAt)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Top-level keys</dt>
                  <dd className="max-w-[22rem] text-right font-mono text-[11px] text-foreground/88">
                    {artifactSummary.topLevelKeys.length > 0
                      ? artifactSummary.topLevelKeys.join(", ")
                      : "none"}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 rounded-2xl border border-border/50 bg-secondary/[0.2] p-4 text-sm leading-relaxed text-muted-foreground">
                {selectedEntry.description}
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background/65">
                <div className="border-b border-border/50 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Raw JSON
                </div>
                <div className="max-h-[34rem] overflow-auto px-4 py-3">
                  <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-foreground/88">
                    {artifactDocumentQuery.isLoading
                      ? "Loading artifact\u2026"
                      : artifactDocumentQuery.isError
                        ? "Artifact load failed."
                        : artifactDocumentQuery.data?.raw ?? "Artifact payload is empty."}
                  </pre>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-border/50 bg-background/65 p-4 text-sm leading-relaxed text-muted-foreground">
              Select an artifact to inspect runtime, demo, or release evidence.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
