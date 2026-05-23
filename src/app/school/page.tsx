"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { ScheduleView } from "@/components/schedule/ScheduleView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <ScheduleView data={data} update={update} />}</DashboardShell>;
}
