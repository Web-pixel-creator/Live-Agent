import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceRuntimeProvider } from "@/hooks/useWorkspaceRuntime";
import Workspace from "./pages/Workspace.tsx";
import Console from "./pages/Console.tsx";
import ConsoleRuntime from "./pages/ConsoleRuntime.tsx";
import Simulation from "./pages/Simulation.tsx";
import Nodes from "./pages/Nodes.tsx";
import Bundle from "./pages/Bundle.tsx";
import Evidence from "./pages/Evidence.tsx";
import EvidenceDetail from "./pages/EvidenceDetail.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WorkspaceRuntimeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate replace to="/app" />} />
            <Route path="/app" element={<Workspace />} />
            <Route path="/app/console" element={<Console />} />
            <Route path="/app/console/runtime" element={<ConsoleRuntime />} />
            <Route path="/app/simulation" element={<Simulation />} />
            <Route path="/app/nodes" element={<Nodes />} />
            <Route path="/bundle" element={<Bundle />} />
            <Route path="/bundle/:id" element={<Bundle />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/evidence/:id" element={<EvidenceDetail />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WorkspaceRuntimeProvider>
  </QueryClientProvider>
);

export default App;
