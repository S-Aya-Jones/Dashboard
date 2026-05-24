"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { VisionView } from "@/components/vision/VisionView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <VisionView data={data} update={update} />}</DashboardShell>;
}
