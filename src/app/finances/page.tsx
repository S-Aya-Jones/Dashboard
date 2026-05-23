"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { FinancesView } from "@/components/finances/FinancesView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <FinancesView data={data} update={update} />}</DashboardShell>;
}
