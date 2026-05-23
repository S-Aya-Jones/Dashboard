"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { WeekView } from "@/components/today/WeekView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <WeekView data={data} update={update} />}</DashboardShell>;
}
