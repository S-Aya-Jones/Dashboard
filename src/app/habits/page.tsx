"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { HabitsView } from "@/components/habits/HabitsView";

// HabitsView was the only code in the app that read data.habits or
// data.habitLogs, and nothing imported it — so eight habits and twenty-four
// logged completions sat in the database with no screen to reach them.
export default function Page() {
  return <DashboardShell>{({ data, update }) => <HabitsView data={data} update={update} />}</DashboardShell>;
}
