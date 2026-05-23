"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/components/nav/Sidebar";
import { useDashboard } from "@/hooks/useDashboard";
import { DashboardData } from "@/types/dashboard";

interface Props {
  children: (props: {
    data: DashboardData;
    update: (fn: (d: DashboardData) => DashboardData) => void;
  }) => ReactNode;
}

export function DashboardShell({ children }: Props) {
  const { data, update, saving, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-sand rounded-full border-t-terracotta animate-spin mx-auto" />
          <p className="font-serif text-xl text-brown">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar saving={saving} />
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {children({ data, update })}
        </div>
      </main>
    </div>
  );
}
