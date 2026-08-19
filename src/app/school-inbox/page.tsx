"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { SchoolInbox } from "@/components/school/SchoolInbox";

export default function SchoolInboxPage() {
  return <DashboardShell>{() => <SchoolInbox />}</DashboardShell>;
}
