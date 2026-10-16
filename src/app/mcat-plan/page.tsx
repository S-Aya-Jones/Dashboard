"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { McatPlanView } from "@/components/mcat/McatPlanView";

export default function Page() {
  return <DashboardShell>{() => <McatPlanView />}</DashboardShell>;
}
