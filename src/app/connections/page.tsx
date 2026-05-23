"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { ConnectionsView } from "@/components/connections/ConnectionsView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <ConnectionsView data={data} update={update} />}</DashboardShell>;
}
