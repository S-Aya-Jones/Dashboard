"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { HabitsView } from "@/components/habits/HabitsView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <HabitsView data={data} update={update} />}</DashboardShell>;
}
