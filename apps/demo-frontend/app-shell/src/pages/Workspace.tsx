import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/workspace/AppSidebar";
import { Topbar } from "@/components/workspace/Topbar";
import { LiveDesk } from "@/components/workspace/LiveDesk";
import { CommandPalette } from "@/components/workspace/CommandPalette";
import { ShortcutsOverlay } from "@/components/workspace/ShortcutsOverlay";

const Workspace = () => {
  return (
    <SidebarProvider defaultOpen>
      <div className="h-screen flex w-full bg-background text-foreground overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Topbar section="Live Desk" />
          <main className="flex-1 min-h-0 flex flex-col">
            <LiveDesk />
          </main>
        </div>
        <CommandPalette />
        <ShortcutsOverlay />
      </div>
    </SidebarProvider>
  );
};

export default Workspace;
