"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { NutritionView } from "@/components/nutrition/NutritionView";

export default function NutritionPage() {
  return (
    <DashboardShell>
      {({ data, update }) => <NutritionView data={data} update={update} />}
    </DashboardShell>
  );
}
