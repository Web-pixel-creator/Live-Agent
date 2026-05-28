import { useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/workspace/AppSidebar";
import { Topbar } from "@/components/workspace/Topbar";
import { RuntimeRail } from "@/components/workspace/RuntimeRail";
import { ConsoleStage } from "@/components/workspace/ConsoleStage";
import { CommandPalette } from "@/components/workspace/CommandPalette";
import { ShortcutsOverlay } from "@/components/workspace/ShortcutsOverlay";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";

const Console = () => {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { defaultConsoleCaseRef } = useWorkspaceRuntime();
  const caseRef = params.get("ref") || defaultConsoleCaseRef || "VS-2841";

  useEffect(() => {
    if (!["#connections", "#safety-rules", "#health-check"].includes(hash)) {
      return;
    }
    const search = params.toString();
    navigate(`/app/console/runtime${search ? `?${search}` : ""}${hash}`, {
      replace: true,
    });
  }, [hash, navigate, params]);

  useEffect(() => {
    if (!hash || ["#connections", "#safety-rules", "#health-check"].includes(hash)) {
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
          <Topbar section="Operator Console" caseRef={caseRef} />
          <main className="flex-1 min-h-0 flex">
            <RuntimeRail />
            <ConsoleStage caseRef={caseRef} />
          </main>
        </div>
        <CommandPalette />
        <ShortcutsOverlay />
      </div>
    </SidebarProvider>
  );
};

export default Console;
