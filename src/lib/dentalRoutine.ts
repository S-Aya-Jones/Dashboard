// Teeth, with the same treatment the skincare routine gets.
//
// "My dental care could be better" is almost always a sequencing problem
// rather than a willpower one: nobody brushes for two minutes because nobody
// can feel two minutes, and flossing loses to being the last thing at the end
// of a fourteen-hour day. So the timer is per-quadrant rather than one long
// two-minute countdown, and the order puts flossing before brushing where it
// actually gets done.
//
// The ADA guidance underneath it: two minutes twice a day, clean between the
// teeth once a day, don't rinse the fluoride straight back out.

export type DentalTime = "am" | "pm";

export interface DentalStep {
  id: string;
  title: string;
  /** What to actually do — the part a checklist leaves out. */
  how: string;
  /** Seconds this step should take. 0 means untimed. */
  seconds: number;
  /** Said out loud when the step starts, if voice is on. */
  say: string;
  /** Only in the evening. */
  pmOnly?: boolean;
  /** Why it's here, for the once she wonders. */
  why?: string;
}

const QUADRANTS: Array<[string, string]> = [
  ["Top right", "Outside, then inside, then the chewing surface."],
  ["Top left", "Same three faces. Small circles, not scrubbing."],
  ["Bottom left", "Angle the brush into the gumline at 45 degrees."],
  ["Bottom right", "Last one. Don't rush it because it's last."],
];

export function dentalSteps(when: DentalTime): DentalStep[] {
  const steps: DentalStep[] = [];

  // Floss first. Doing it after brushing is the version that gets skipped,
  // and it also leaves the fluoride less able to reach between the teeth.
  steps.push({
    id: "floss",
    title: "Floss",
    how: "Curve it into a C around each tooth and go just under the gumline. Both sides of every gap, including behind the very back teeth.",
    seconds: 90,
    say: "Floss first. C-shape around each tooth, just under the gum.",
    pmOnly: true,
    why: "Brushing cleans three of the five surfaces of a tooth. Flossing is the only thing that reaches the other two, which is exactly where cavities start between molars.",
  });

  QUADRANTS.forEach(([name, how], i) => {
    steps.push({
      id: `brush-${i}`,
      title: `Brush — ${name}`,
      how,
      seconds: 30,
      say: `${name}. ${how}`,
    });
  });

  steps.push({
    id: "tongue",
    title: "Tongue",
    how: "Brush the tongue front to back, gently. This is most of what morning breath actually is.",
    seconds: 15,
    say: "Tongue, front to back, gently.",
  });

  steps.push({
    id: "spit",
    title: "Spit, don't rinse",
    how: "Spit out the foam and stop there. No water, no mouthwash straight after.",
    seconds: 0,
    say: "Spit, but don't rinse. Let the fluoride stay on.",
    why: "Rinsing washes the fluoride off before it can do anything. This one change is free and it is the single most-missed step.",
  });

  if (when === "pm") {
    steps.push({
      id: "nothing-after",
      title: "Nothing after this",
      how: "No food or drink except water from here to bed.",
      seconds: 0,
      say: "Nothing but water from here on.",
    });
  }

  return steps.filter(s => (when === "pm" ? true : !s.pmOnly));
}

export function dentalSeconds(when: DentalTime): number {
  return dentalSteps(when).reduce((s, x) => s + x.seconds, 0);
}

/**
 * Something to say that isn't "good job".
 *
 * Generic praise stops registering after about three days. These are tied to
 * what she actually just did, which is the only kind that keeps working.
 */
export function encouragement(kind: "skincare" | "dental", streak: number, timeOfDay: "am" | "pm" | "weekly"): string {
  if (streak >= 14) return `Two weeks straight. This isn't a phase any more — it's just what you do.`;
  if (streak >= 7)  return `Seven days. That's the point where skin actually starts showing it.`;
  if (streak >= 3)  return `${streak} days running. The hard part is behind you.`;

  if (kind === "dental") {
    return timeOfDay === "pm"
      ? "This is the one that matters most — eight hours of sleep with clean teeth beats any morning routine."
      : "Two minutes. You've already done harder things today.";
  }

  if (timeOfDay === "pm") return "Fourteen-hour day and you still showed up for this. That counts.";
  if (timeOfDay === "weekly") return "Peel night. Nothing else active tonight — just this, then seal it in.";
  return "Sunscreen is the whole routine. Everything else is optional next to it.";
}
