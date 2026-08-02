"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { RemindersView } from "@/components/reminders/RemindersView";

export default function RemindersPage() {
  return (
    <DashboardShell>
      {() => <RemindersView />}
    </DashboardShell>
  );
}
