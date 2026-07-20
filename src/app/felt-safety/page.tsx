import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { FeltSafetyView } from "@/components/felt-safety/FeltSafetyView";

export const metadata: Metadata = {
  title: "Felt Safety — Aya's Dashboard",
};

export default function FeltSafetyPage() {
  return (
    <DashboardShell>
      {() => <FeltSafetyView />}
    </DashboardShell>
  );
}
