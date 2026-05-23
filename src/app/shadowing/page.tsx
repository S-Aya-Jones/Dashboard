"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { ShadowingView } from "@/components/shadowing/ShadowingView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <ShadowingView data={data} update={update} />}</DashboardShell>;
}
