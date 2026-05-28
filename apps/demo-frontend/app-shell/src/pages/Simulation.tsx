import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/workspace/AppSidebar";
import { Topbar } from "@/components/workspace/Topbar";
import { CommandPalette } from "@/components/workspace/CommandPalette";
import { ShortcutsOverlay } from "@/components/workspace/ShortcutsOverlay";
import { SimulationLab } from "@/components/workspace/SimulationLab";

const Simulation = () => {
  return (
    <SidebarProvider defaultOpen>
      <div className="h-screen flex w-full bg-background text-foreground overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Topbar section="Simulation Lab" />
          <main className="flex-1 min-h-0 flex flex-col">
            <SimulationLab />
          </main>
        </div>
        <CommandPalette />
        <ShortcutsOverlay />
      </div>
    </SidebarProvider>
  );
};

export default Simulation;
