"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { SkincareView } from "@/components/skincare/SkincareView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <SkincareView data={data} update={update} />}</DashboardShell>;
}
