import { NextResponse } from "next/server";
import { loadData, saveData } from "@/lib/db";
import { SkincareProduct } from "@/types/dashboard";

export const dynamic = "force-dynamic";

// Her stated routine, written in as products so the steps view has something
// real to render. The seven placeholders that shipped with the app ("Gentle
// Cleanser", "Vitamin C Serum") were never hers.
//
// Order is the routine. isActive marks the treatment the peel night excludes.

const ROUTINE: Omit<SkincareProduct, "id">[] = [
  // Morning, daily.
  { name: "Cleanser",                              routine: "am", order: 0, isTesting: false },
  { name: "Toner",                                 routine: "am", order: 1, isTesting: false },
  { name: "NIOD Copper Amino Isolate Serum",       routine: "am", order: 2, isTesting: false },
  { name: "Essence",                               routine: "am", order: 3, isTesting: false },
  { name: "SOD Mist",                              routine: "am", order: 4, isTesting: false },
  { name: "Moisturizer",                           routine: "am", order: 5, isTesting: false },
  { name: "SPF",                                   routine: "am", order: 6, isTesting: false },

  // Night, six of seven.
  { name: "Oil cleanser (first cleanse)",          routine: "pm", order: 0, isTesting: false },
  { name: "Second cleanse",                        routine: "pm", order: 1, isTesting: false },
  { name: "Hydration layers",                      routine: "pm", order: 2, isTesting: false },
  { name: "Active treatment",                      routine: "pm", order: 3, isTesting: false, isActive: true,
    frequency: "six nights a week — never on peel night" },
  { name: "Moisturizer",                           routine: "pm", order: 4, isTesting: false },
  { name: "Cicaplast Balm (sealant)",              routine: "pm", order: 5, isTesting: false },
  { name: "Latisse — upper lash line",             routine: "pm", order: 6, isTesting: false },

  // The one peel night. No active treatment, by rule.
  { name: "Oil cleanser (first cleanse)",          routine: "weekly", order: 0, isTesting: false },
  { name: "Second cleanse",                        routine: "weekly", order: 1, isTesting: false },
  { name: "Dr. Dennis Gross Alpha Beta peel",      routine: "weekly", order: 2, isTesting: false },
  { name: "Regenerative serums",                   routine: "weekly", order: 3, isTesting: false },
  { name: "Moisturizer",                           routine: "weekly", order: 4, isTesting: false },
  { name: "Cicaplast Balm (sealant)",              routine: "weekly", order: 5, isTesting: false },
  { name: "Latisse — upper lash line",             routine: "weekly", order: 6, isTesting: false },
];

export async function POST() {
  try {
    const data = await loadData("aya");
    const products: SkincareProduct[] = ROUTINE.map((p, i) => ({
      ...p,
      id: `rt-${p.routine}-${i}`,
    }));
    await saveData({ ...data, skincareProducts: products });
    return NextResponse.json({ ok: true, count: products.length });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
