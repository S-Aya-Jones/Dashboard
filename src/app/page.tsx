"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { TodayView } from "@/components/today/TodayView";
export default function HomePage() {
  return (
    <DashboardShell>
      {({ data, update }) => <TodayView data={data} update={update} />}
    </DashboardShell>
  );
}
