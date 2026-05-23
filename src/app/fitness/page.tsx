"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { FitnessView } from "@/components/fitness/FitnessView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <FitnessView data={data} update={update} />}</DashboardShell>;
}
