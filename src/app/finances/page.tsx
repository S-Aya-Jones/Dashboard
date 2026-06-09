"use client";
import { Sidebar } from "@/components/nav/Sidebar";
import { useDashboard } from "@/hooks/useDashboard";
import { FinancesView } from "@/components/finances/FinancesView";

export default function Page() {
  const { data, update, saving, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "rgba(124,92,252,0.2)", borderTopColor: "#7C5CFC", borderWidth: 2 }} />
          <p className="font-serif text-xl" style={{ color: "var(--text)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar saving={saving} />
      <main className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-0">
        <FinancesView data={data} update={update} />
      </main>
    </div>
  );
}
