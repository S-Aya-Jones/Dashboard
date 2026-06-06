"use client";
import { Sidebar } from "@/components/nav/Sidebar";
import { useDashboard } from "@/hooks/useDashboard";
import { FinancesView } from "@/components/finances/FinancesView";

export default function Page() {
  const { data, update, saving, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#0A0A0A" }}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-white/20 rounded-full border-t-white animate-spin mx-auto" />
          <p className="font-serif text-xl text-white">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0A0A0A" }}>
      <Sidebar saving={saving} />
      <main className="flex-1 overflow-y-auto min-h-0">
        <FinancesView data={data} update={update} />
      </main>
    </div>
  );
}
