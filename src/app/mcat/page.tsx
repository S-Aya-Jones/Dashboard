"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { MCATView } from "@/components/mcat/MCATView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <MCATView data={data} update={update} />}</DashboardShell>;
}
