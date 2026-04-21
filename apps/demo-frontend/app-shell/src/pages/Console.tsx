import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/workspace/AppSidebar";
import { Topbar } from "@/components/workspace/Topbar";
import { RuntimeRail } from "@/components/workspace/RuntimeRail";
import { ConsoleStage } from "@/components/workspace/ConsoleStage";
import { CommandPalette } from "@/components/workspace/CommandPalette";
import { ShortcutsOverlay } from "@/components/workspace/ShortcutsOverlay";
import { useSearchParams } from "react-router-dom";

const Console = () => {
  const [params] = useSearchParams();
  const caseRef = params.get("ref") || "VS-2841";

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
