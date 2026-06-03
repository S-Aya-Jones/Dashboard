"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { SmsView } from "@/components/sms/SmsView";
export default function MessagesPage() {
  return (
    <DashboardShell>
      {({ data, update }) => <SmsView data={data} update={update} />}
    </DashboardShell>
  );
}
