// What's on the sidebar, and what's been put away.
//
// September 2026: she's taking a break from school. Eleven of the twenty
// sections existed only to serve a semester — lecture processing, the question
// bank, grades, study partners, the MCAT. Leaving them on the sidebar makes the
// app feel like a list of things she isn't doing.
//
// So they pause rather than disappear. Every page still works, every row is
// still in the database, and turning one back on is a switch on /modules. When
// school comes back, so does the sidebar, with her lectures still in it.

export type ModuleGroup = "daily" | "money" | "health" | "school" | "other";

export interface ModuleDef {
  /** The route, which doubles as the stable id. */
  href: string;
  label: string;
  /** A lucide icon name, resolved in the nav so this file stays server-safe. */
  icon: string;
  group: ModuleGroup;
  /** Paused unless she says otherwise. */
  pausedByDefault?: boolean;
  /** Why it's paused, shown on the modules page. */
  note?: string;
}

export const MODULES: ModuleDef[] = [
  // ── Every day ──
  { href: "/",             label: "Today",           icon: "Sun",            group: "daily" },
  { href: "/schedule",     label: "Schedule",        icon: "Clock",          group: "daily" },
  { href: "/journal",      label: "Journal",         icon: "NotebookPen",    group: "daily" },
  { href: "/break",        label: "The break",       icon: "Flag",           group: "daily" },
  { href: "/habits",       label: "Habits",          icon: "CircleCheck",    group: "daily" },

  // ── Money ──
  { href: "/finances",     label: "Finances",        icon: "DollarSign",     group: "money" },

  // ── Body and head ──
  { href: "/exposure",     label: "Exposure",        icon: "Brain",          group: "health" },
  { href: "/felt-safety",  label: "Felt Safety",     icon: "Shield",         group: "health" },
  { href: "/fitness",      label: "Fitness",         icon: "Dumbbell",       group: "health" },
  { href: "/skincare",     label: "Skincare",        icon: "Sparkles",       group: "health" },
  { href: "/nutrition",    label: "Food",            icon: "UtensilsCrossed", group: "health" },

  // ── School. All paused for the break. ──
  { href: "/lectures",     label: "Lecture Studio",  icon: "Mic",            group: "school", pausedByDefault: true, note: "Your processed lectures are all still here." },
  { href: "/review",       label: "Review",          icon: "Layers",         group: "school", pausedByDefault: true, note: "Flashcard schedules are kept — nothing resets." },
  { href: "/qbank",        label: "Question Bank",   icon: "ListChecks",     group: "school", pausedByDefault: true },
  { href: "/school",       label: "Grades",          icon: "GraduationCap",  group: "school", pausedByDefault: true, note: "Fall 2026 targets, frozen where you left them." },
  { href: "/school-inbox", label: "School Inbox",    icon: "Mail",           group: "school", pausedByDefault: true },
  { href: "/tutor",        label: "Tutor",           icon: "GraduationCap",  group: "school", pausedByDefault: true },
  { href: "/material",     label: "Shared material", icon: "FolderOpen",     group: "school", pausedByDefault: true },
  { href: "/partners",     label: "Study Partners",  icon: "Users",          group: "school", pausedByDefault: true },
  { href: "/mcat",         label: "Med School",      icon: "BookOpen",       group: "school", pausedByDefault: true },
  { href: "/catch-up",     label: "Catch-up week",   icon: "Scissors",       group: "school", pausedByDefault: true, note: "Built for a semester that has to bend. Nothing to bend right now." },
  { href: "/shadowing",    label: "Shadowing",       icon: "Stethoscope",    group: "school", pausedByDefault: true },

  // ── The rest ──
  { href: "/connections",  label: "People",          icon: "HeartHandshake", group: "other" },
  { href: "/reminders",    label: "Telegram",        icon: "Bell",           group: "other" },
  { href: "/vision",       label: "Vision",          icon: "Gem",            group: "other" },
];

export const GROUP_LABEL: Record<ModuleGroup, string> = {
  daily: "Every day",
  money: "Money",
  health: "Body and head",
  school: "School",
  other: "Everything else",
};

export const DEFAULT_PAUSED: string[] = MODULES.filter(m => m.pausedByDefault).map(m => m.href);

/**
 * The live paused set.
 *
 * `null` means she has never touched the switches, so the defaults apply. An
 * empty array means she has deliberately turned everything back on, which is a
 * different thing and must not be overwritten by the defaults.
 */
export function pausedSet(stored: string[] | null | undefined): Set<string> {
  return new Set(stored ?? DEFAULT_PAUSED);
}

export function visibleModules(stored: string[] | null | undefined): ModuleDef[] {
  const paused = pausedSet(stored);
  // Today can't be paused — it's where every other route is reached from.
  return MODULES.filter(m => m.href === "/" || !paused.has(m.href));
}

export function pausedModules(stored: string[] | null | undefined): ModuleDef[] {
  const paused = pausedSet(stored);
  return MODULES.filter(m => m.href !== "/" && paused.has(m.href));
}
