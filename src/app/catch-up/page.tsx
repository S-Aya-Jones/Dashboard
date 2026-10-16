"use client";

import { Sidebar } from "@/components/nav/Sidebar";
import { CatchUpView } from "@/components/schedule/CatchUpView";

export default function Page() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8 pb-28 md:pb-8 max-w-3xl">
        <CatchUpView />
      </main>
    </div>
  );
}
