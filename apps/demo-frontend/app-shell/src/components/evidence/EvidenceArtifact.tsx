import type { BundleEvidence } from "@/data/presentationBundles";
import { DocumentMockup } from "./DocumentMockup";
import { TelemetryMockup } from "./TelemetryMockup";
import { ExternalCheckMockup } from "./ExternalCheckMockup";
import { SignalMockup } from "./SignalMockup";

// A quiet inline-SVG mockup for an evidence artifact. Each `kind` renders a
// different stylized "capture" so the gallery feels like a real picture
// trail rather than a repeated card. No raster assets — everything is HSL
// design tokens, which means it inherits theme + tone without extra files.
//
// Mockups are intentionally schematic (think: forensic redaction, not
// product screenshot). The judge should grasp *type* of evidence at a
// glance, not parse fake pixel content.
export function EvidenceArtifact({
  evidence,
  outcomeTone,
}: {
  evidence: BundleEvidence;
  outcomeTone: "mint" | "rose" | "amber";
}) {
  const accent = `hsl(var(--tint-${outcomeTone}-fg))`;

  switch (evidence.kind) {
    case "Document":
      return <DocumentMockup evidence={evidence} accent={accent} />;
    case "Node telemetry":
      return <TelemetryMockup evidence={evidence} accent={accent} />;
    case "External check":
      return <ExternalCheckMockup evidence={evidence} accent={accent} />;
    case "Signal":
      return <SignalMockup evidence={evidence} accent={accent} />;
    default:
      return <DocumentMockup evidence={evidence} accent={accent} />;
  }
}
