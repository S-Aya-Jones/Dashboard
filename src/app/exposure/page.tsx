"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { ExposureView } from "@/components/exposure/ExposureView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <ExposureView data={data} update={update} />}</DashboardShell>;
}
