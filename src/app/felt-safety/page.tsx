"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { FeltSafetyView } from "@/components/felt-safety/FeltSafetyView";

export default function FeltSafetyPage() {
  return (
    <DashboardShell>
      {() => <FeltSafetyView />}
    </DashboardShell>
  );
}
