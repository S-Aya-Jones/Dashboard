"use client";
import { Sidebar } from "@/components/nav/Sidebar";
import { IntegrationsView } from "@/components/integrations/IntegrationsView";

export default function IntegrationsPage() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 overflow-hidden min-h-0 pb-20 md:pb-0">
        <IntegrationsView />
      </main>
    </div>
  );
}
