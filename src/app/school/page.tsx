"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { GradesView } from "@/components/school/GradesView";

// /school used to redirect straight to /mcat, which meant the four courses she
// is actually graded on this semester had no page at all.
export default function Page() {
  return <DashboardShell>{({ data, update }) => <GradesView data={data} update={update} />}</DashboardShell>;
}
