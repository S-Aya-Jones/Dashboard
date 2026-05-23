"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { WinsView } from "@/components/wins/WinsView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <WinsView data={data} update={update} />}</DashboardShell>;
}
