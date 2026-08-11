import { SkincareProduct } from "@/types/dashboard";

// Her routine as steps rather than a list of bottles.
//
// The products were already stored in the right order; what was missing is what
// to do with each one. At 8pm after a fourteen-hour day, "Vitamin C Serum" is
// not an instruction — "4–5 drops, face and neck, wait a minute before the next
// one" is.
//
// The default text below is standard sequencing guidance, not a prescription:
// water-based before oil-based, actives on dry skin, sunscreen last and never
// skipped. Anything she is told by a dermatologist wins, which is why every
// field is editable.

interface StepDefaults {
  match: RegExp;
  howTo: string;
  waitAfterSec?: number;
  frequency?: string;
}

// Her stated rules, kept where the routine is rendered so they are visible at
// the moment they apply rather than remembered.
export const CORE_RULES = [
  "Skin fully dry before any active — damp skin is what makes them sting.",
  "Hydrate, then seal. Water first, occlusive last.",
  "Copper peptides are morning only, and never near an acid.",
  "The peel night and an active-treatment night are never the same night.",
];

const DEFAULTS: StepDefaults[] = [
  {
    // NIOD CAIS. Copper peptides and acids deactivate each other, which is the
    // whole reason this one lives in the morning.
    match: /copper|cais|niod/i,
    howTo: "Two or three drops on clean, dry skin — before anything water-light. Copper peptides only in the morning, and never on a day you've used an acid.",
    waitAfterSec: 60,
    frequency: "every morning",
  },
  {
    match: /sod|superoxide|mist/i,
    howTo: "A few passes held at arm's length, then press in with your palms rather than letting it dry on its own.",
    waitAfterSec: 30,
    frequency: "every morning",
  },
  {
    match: /essence/i,
    howTo: "Palms, pressed in while the last layer is still damp. This is a hydration layer, not a treatment.",
    waitAfterSec: 30,
    frequency: "every routine",
  },
  {
    match: /cicaplast|sealant|healing balm/i,
    howTo: "Last skincare step. A thin layer over everything to seal it in — heavier on any patch that's raw or peeling.",
    frequency: "every night",
  },
  {
    match: /latisse|bimatoprost/i,
    howTo: "Upper lash line only, one drop per eye on the applicator, after everything else and after the balm has settled. Never the lower lid.",
    frequency: "every night",
  },
  {
    match: /alpha beta|peel|gross/i,
    howTo: "Step 1 pad over the whole face, avoid the eyes — leave two minutes. Then Step 2 to neutralise. Nothing acidic and no active treatment on this night.",
    waitAfterSec: 300,
    frequency: "one night a week",
  },
  {
    match: /regenerative|peptide serum|growth factor/i,
    howTo: "Straight after the peel neutralises, while skin is bare. This is the point of the peel night — recovery, not more exfoliation.",
    waitAfterSec: 60,
    frequency: "peel night only",
  },
  {
    match: /active treatment|tretinoin|retinoid|retinol|adapalene|differin/i,
    howTo: "Completely DRY skin. A pea-sized amount for the whole face, avoiding the corners of the nose, eyes and mouth. Buffer with moisturiser first if it stings.",
    waitAfterSec: 1200,
    frequency: "six nights a week, never on peel night",
  },
  {
    match: /hydration layer|hydrating/i,
    howTo: "Thinnest to thickest, pressing each one in while the last is still damp.",
    waitAfterSec: 30,
    frequency: "every night",
  },
  {
    match: /oil cleanser|balm|first cleanse/i,
    howTo: "Dry hands, dry face. Massage 60 seconds to break down sunscreen and the day. Add water to emulsify, then rinse.",
    frequency: "every night",
  },
  {
    match: /gentle cleanser|cleanser/i,
    howTo: "Lukewarm water — hot strips the barrier. 30–60 seconds, fingertips only, no scrubbing. Pat dry, leave slightly damp.",
    waitAfterSec: 0,
    frequency: "every wash",
  },
  {
    match: /vitamin c/i,
    howTo: "3–4 drops on damp skin. Face, neck, back of hands. Let it absorb before anything else goes on top.",
    waitAfterSec: 60,
    frequency: "every morning",
  },
  {
    match: /retin|tretinoin|adapalene|differin/i,
    howTo: "Completely DRY skin — damp skin drives irritation. A pea-sized amount for the whole face. Avoid the corners of the nose, eyes and mouth. If it stings, buffer with moisturiser first.",
    waitAfterSec: 1200,
    frequency: "start 2 nights a week, build up slowly",
  },
  {
    match: /niacinamide|hyaluronic|serum/i,
    howTo: "A few drops on damp skin, pressed in rather than rubbed.",
    waitAfterSec: 60,
    frequency: "as needed",
  },
  {
    match: /spf|sunscreen/i,
    howTo: "Two fingers' length for face and neck — this is the step that decides whether the rest of it works. Reapply if you're outside past midday.",
    frequency: "every morning, even indoors",
  },
  {
    match: /moisturis|moisturiz/i,
    howTo: "While skin is still slightly damp, so it seals water in rather than sitting on top. Down the neck too.",
    frequency: "every routine",
  },
  {
    match: /toner/i,
    howTo: "Palms, not cotton — less waste, less dragging. Press in and move on while skin is still damp.",
    waitAfterSec: 30,
    frequency: "every routine",
  },
];

/** Instructions for a product that has none, matched on its name. */
export function defaultsFor(name: string): Omit<StepDefaults, "match"> | null {
  const hit = DEFAULTS.find(d => d.match.test(name));
  if (!hit) return null;
  return { howTo: hit.howTo, waitAfterSec: hit.waitAfterSec, frequency: hit.frequency };
}

export interface RoutineStep {
  product: SkincareProduct;
  n: number;
  howTo: string;
  waitAfterSec: number;
  frequency: string;
}

/**
 * The ordered steps for one routine. Products already carry an order; this
 * fills in the instructions and drops the wait on the final step, where there
 * is nothing left to wait for.
 */
export function routineSteps(products: SkincareProduct[], which: "am" | "pm" | "weekly"): RoutineStep[] {
  const mine = products
    // "both" belongs to the daily routines, never to the weekly peel night —
    // that night is deliberately stripped back.
    .filter(p => p.routine === which || (p.routine === "both" && which !== "weekly"))
    .sort((a, b) => a.order - b.order);

  return mine.map((p, i) => {
    const d = defaultsFor(p.name);
    return {
      product: p,
      n: i + 1,
      howTo: p.howTo ?? d?.howTo ?? "",
      waitAfterSec: i === mine.length - 1 ? 0 : (p.waitAfterSec ?? d?.waitAfterSec ?? 0),
      frequency: p.frequency ?? d?.frequency ?? "",
    };
  });
}

export function waitLabel(sec: number): string {
  if (sec <= 0) return "";
  if (sec < 60) return `wait ${sec}s`;
  const m = Math.round(sec / 60);
  return m >= 15 ? `wait ${m} min before the next step` : `wait ${m} min`;
}

/**
 * Whether a routine breaks one of her own rules. Returned rather than silently
 * corrected — the routine is hers, and a warning she can see beats a change she
 * cannot.
 */
export function ruleWarnings(steps: RoutineStep[], which: "am" | "pm" | "weekly"): string[] {
  const out: string[] = [];
  const names = steps.map(s => s.product.name.toLowerCase()).join(" | ");

  const hasCopper = /copper|cais|niod/.test(names);
  const hasAcid = /acid|peel|aha|bha|glycolic|salicylic|alpha beta/.test(names);
  if (hasCopper && hasAcid) {
    out.push("Copper peptides and an acid are in the same routine — they cancel each other out. Keep the copper to mornings.");
  }
  if (which !== "am" && hasCopper) {
    out.push("Copper peptides are in a night routine. Yours belong in the morning.");
  }

  const hasActive = steps.some(s => s.product.isActive) || /tretinoin|retinoid|retinol|active treatment/.test(names);
  if (which === "weekly" && hasActive) {
    out.push("Peel night has an active treatment in it. Those two never share a night.");
  }

  const sealIdx = steps.findIndex(s => /cicaplast|sealant|healing balm/i.test(s.product.name));
  const lastIdx = steps.length - 1;
  if (sealIdx >= 0 && sealIdx !== lastIdx && !/latisse/i.test(steps[lastIdx]?.product.name ?? "")) {
    out.push("The balm seals everything — it should be the last step, or second-to-last before Latisse.");
  }

  return out;
}

/** Rough clock time for the whole routine, so 8pm is a realistic start. */
export function routineMinutes(steps: RoutineStep[]): number {
  const waits = steps.reduce((n, s) => n + s.waitAfterSec, 0);
  // Roughly a minute of actual doing per step, plus the waits.
  return Math.round(steps.length + waits / 60);
}
