import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/workspace/AppSidebar";
import { Topbar } from "@/components/workspace/Topbar";
import { RuntimeRail } from "@/components/workspace/RuntimeRail";
import { CommandPalette } from "@/components/workspace/CommandPalette";
import { ShortcutsOverlay } from "@/components/workspace/ShortcutsOverlay";
import { SessionBoundaryPanel } from "@/components/workspace/SessionBoundaryPanel";
import { CaseWikiPanel } from "@/components/workspace/CaseWikiPanel";
import { CaseVaultPanel } from "@/components/workspace/CaseVaultPanel";
import { SessionOpsPanel } from "@/components/workspace/SessionOpsPanel";
import { RuntimeDiagnosticsPanels } from "@/components/workspace/RuntimeDiagnosticsPanels";
import { ArtifactViewerPanel } from "@/components/workspace/ArtifactViewerPanel";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";

const ConsoleRuntime = () => {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { defaultConsoleCaseRef, getCaseByRef, getCaseWikiByRef } = useWorkspaceRuntime();
  const caseRef = params.get("ref") || defaultConsoleCaseRef || "VS-2841";
  const initialArtifactPath = params.get("artifact");
  const initialArtifactIssue = params.get("issue");
  const initialArtifactSection = params.get("section");
  const initialFocusedOnly = params.get("focusedOnly") === "1";
  const caseValue = getCaseByRef(caseRef);
  const runtimeCase =
    caseValue ?? (defaultConsoleCaseRef ? getCaseByRef(defaultConsoleCaseRef) : undefined);
  const wiki = getCaseWikiByRef(runtimeCase?.caseId ?? runtimeCase?.sessionId ?? caseRef);

  const handleFocusedOnlyChange = (enabled: boolean) => {
    const nextParams = new URLSearchParams(params);
    if (enabled) {
      nextParams.set("focusedOnly", "1");
    } else {
      nextParams.delete("focusedOnly");
    }
    const search = nextParams.toString();
    navigate(`/app/console/runtime${search ? `?${search}` : ""}${hash}`, { replace: true });
  };

  useEffect(() => {
    if (!["#live-activity", "#action-queue"].includes(hash)) {
      return;
    }
    const search = params.toString();
    navigate(`/app/console${search ? `?${search}` : ""}${hash}`, { replace: true });
  }, [hash, navigate, params]);

  useEffect(() => {
    if (!hash || ["#live-activity", "#action-queue"].includes(hash)) {
      return;
    }
    const targetId = hash.replace(/^#/, "");
    const frameId = window.requestAnimationFrame(() => {
      document
        .getElementById(targetId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [hash, caseRef]);

  return (
    <SidebarProvider defaultOpen>
      <div className="h-screen flex w-full bg-background text-foreground overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Topbar section="Operator Runtime" caseRef={caseRef} />
          <main className="flex-1 min-h-0 flex">
            <RuntimeRail />
            <div className="flex-1 min-h-0 overflow-auto">
              {runtimeCase ? (
                <div className="px-8 py-8">
                  <SessionBoundaryPanel caseValue={runtimeCase} wiki={wiki} />
                  <CaseWikiPanel caseValue={runtimeCase} wiki={wiki} />
                  <CaseVaultPanel caseValue={runtimeCase} wiki={wiki} />
                  <SessionOpsPanel caseValue={runtimeCase} wiki={wiki} />
                  <RuntimeDiagnosticsPanels caseValue={runtimeCase} wiki={wiki} />
                  <ArtifactViewerPanel
                    initialArtifactPath={initialArtifactPath}
                    initialArtifactIssue={initialArtifactIssue}
                    initialArtifactSection={initialArtifactSection}
                    initialCaseRef={runtimeCase.ref}
                    initialFocusedOnly={initialFocusedOnly}
                    onFocusedOnlyChange={handleFocusedOnlyChange}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center px-8 py-12 text-center">
                  <div className="max-w-md space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-primary">
                      Operator runtime
                    </div>
                    <h2 className="font-serif text-3xl tracking-tight">
                      Runtime support is waiting for a case
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Open a case in Operator Console first, then jump into runtime support to
                      inspect replay, compliance, export, and worker controls for that same case.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
        <CommandPalette />
        <ShortcutsOverlay />
      </div>
    </SidebarProvider>
  );
};

export default ConsoleRuntime;
