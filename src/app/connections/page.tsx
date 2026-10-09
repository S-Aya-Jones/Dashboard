"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { ConnectionsView } from "@/components/connections/ConnectionsView";

// The Connections view existed but had no route and no link, so it was
// unreachable — which is why she couldn't remember whether we'd built it.
export default function Page() {
  return <DashboardShell>{({ data, update }) => <ConnectionsView data={data} update={update} />}</DashboardShell>;
}
