"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { GoalsView } from "@/components/goals/GoalsView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <GoalsView data={data} update={update} />}</DashboardShell>;
}
