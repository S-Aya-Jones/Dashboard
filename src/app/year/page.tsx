"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { YearView } from "@/components/year/YearView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <YearView data={data} update={update} />}</DashboardShell>;
}
