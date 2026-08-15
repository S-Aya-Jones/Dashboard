// Every quiz and exam in the Fall 2026 term, from the four syllabi.
//
// Typed out rather than parsed, because these are the dates the whole study
// plan hangs off and a parsing slip would move an exam without anyone
// noticing. Read from:
//   Fundamentals of Biochemistry            GMHS-707
//   Physiology                              GMHS-709
//   Cell and Molecular Biology              GMHS-710
//   Fundamentals of Medical Microbiology    GMHS-706
//
// Note the pattern the syllabi make plain and a week-by-week view hides:
// assessments cluster. Aug 24, 25 and 31 and Sep 1 are four assessments in
// nine days across four courses, and none of them are in the same course.
//
// All four syllabi say the same thing about changes — dates move by email and
// Blackboard is the authority. So this is a planning calendar, not a source of
// truth, and it says so wherever it surfaces.

export type AssessmentKind = "quiz" | "exam";

export interface Assessment {
  id: string;
  course: "Biochemistry" | "Physiology" | "Microbiology" | "Cell & Molecular Bio";
  /** Short form, for tight spaces. */
  short: "Biochem" | "Physio" | "Micro" | "CMB";
  kind: AssessmentKind;
  /** 1-indexed within its kind and course. */
  number: number;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24h. */
  time: string;
  /** Share of the final grade, where the syllabus states it. */
  weightPct: number;
  topics: string[];
}

// Quizzes are 5% each in every course; exams are 15 / 25 / 25.
const EXAM_WEIGHT = [15, 25, 25];

function a(
  course: Assessment["course"], short: Assessment["short"],
  kind: AssessmentKind, number: number, date: string, time: string, topics: string[],
): Assessment {
  return {
    id: `${short.toLowerCase()}-${kind}-${number}`,
    course, short, kind, number, date, time,
    weightPct: kind === "quiz" ? 5 : EXAM_WEIGHT[number - 1] ?? 25,
    topics,
  };
}

export const ASSESSMENTS: Assessment[] = [
  // ── Biochemistry (GMHS-707) ──
  a("Biochemistry", "Biochem", "quiz", 1, "2026-08-14", "08:00", ["Water, ionization, buffers"]),
  a("Biochemistry", "Biochem", "exam", 1, "2026-08-24", "08:00", [
    "Water, ionization and buffers", "Cellular organization", "Amino acids",
    "Protein structure, separation and purification", "Enzymes I",
  ]),
  a("Biochemistry", "Biochem", "quiz", 2, "2026-09-11", "08:00", ["Enzymes II", "Basic concepts of metabolism"]),
  a("Biochemistry", "Biochem", "quiz", 3, "2026-09-25", "08:00", ["TCA cycle", "Oxidative phosphorylation"]),
  a("Biochemistry", "Biochem", "exam", 2, "2026-10-12", "08:00", ["Enzymes II through oxidative phosphorylation"]),
  a("Biochemistry", "Biochem", "quiz", 4, "2026-10-30", "08:00", ["Lipid synthesis", "Nitrogen metabolism", "Sphingolipids"]),
  a("Biochemistry", "Biochem", "quiz", 5, "2026-11-12", "08:00", ["Gluconeogenesis and creatine synthesis", "Nitrogen metabolism"]),
  a("Biochemistry", "Biochem", "exam", 3, "2026-11-16", "08:00", ["Gluconeogenesis and creatine synthesis onward"]),

  // ── Physiology (GMHS-709) ──
  a("Physiology", "Physio", "quiz", 1, "2026-08-13", "13:00", ["Fluid compartments", "Membrane transport", "Skeletal muscle"]),
  a("Physiology", "Physio", "exam", 1, "2026-08-31", "08:00", [
    "Fluid compartments, osmosis and tonicity", "Membrane structure and transport",
    "Skeletal muscle, NMJ and excitation-contraction coupling", "Cardiac and blood",
  ]),
  a("Physiology", "Physio", "quiz", 2, "2026-09-15", "13:00", ["Cardiac electrophysiology", "Flow"]),
  a("Physiology", "Physio", "quiz", 3, "2026-10-02", "08:00", ["Mechanics of breathing"]),
  a("Physiology", "Physio", "exam", 2, "2026-10-09", "08:00", ["Respiration and its regulation", "Pulmonary"]),
  a("Physiology", "Physio", "quiz", 4, "2026-10-23", "08:00", ["Urine collection and dilution"]),
  a("Physiology", "Physio", "quiz", 5, "2026-11-05", "08:00", ["GI motility and secretions"]),
  a("Physiology", "Physio", "exam", 3, "2026-11-20", "08:00", ["Digestion and absorption onward"]),

  // ── Cell & Molecular Bio (GMHS-710) ──
  a("Cell & Molecular Bio", "CMB", "quiz", 1, "2026-08-17", "13:00", [
    "Eukaryotic cell structure", "Cell culture, cell lines and stem cells",
    "Cell communication I and II",
  ]),
  a("Cell & Molecular Bio", "CMB", "exam", 1, "2026-08-25", "08:00", [
    "Eukaryotic cell structure", "Cell culture, cell lines and stem cells",
    "Cell communication I and II", "Eukaryotic cell cycle", "Cell cycle disruption — cancer",
  ]),
  a("Cell & Molecular Bio", "CMB", "quiz", 2, "2026-09-04", "08:00", ["DNA structure and function", "Chromatin and genome structure", "DNA replication"]),
  a("Cell & Molecular Bio", "CMB", "quiz", 3, "2026-09-18", "08:00", ["DNA mutation, repair and recombination", "RNA structure, transcription and translation"]),
  a("Cell & Molecular Bio", "CMB", "exam", 2, "2026-09-22", "08:00", ["DNA structure through epigenetic and post-transcriptional regulation"]),
  a("Cell & Molecular Bio", "CMB", "quiz", 4, "2026-10-07", "13:00", ["Protein isolation and purification", "Recombinant DNA technology I–III"]),
  a("Cell & Molecular Bio", "CMB", "quiz", 5, "2026-10-26", "13:00", ["Mitosis and meiosis", "Molecular and chromosomal basis of inheritance"]),
  a("Cell & Molecular Bio", "CMB", "exam", 3, "2026-11-09", "08:00", ["Protein isolation through population genetics and pedigree analysis"]),

  // ── Microbiology (GMHS-706) ──
  a("Microbiology", "Micro", "quiz", 1, "2026-08-19", "13:00", [
    "Bacterial cytology I and II", "Bacterial physiology I and II", "Antimicrobial agents",
  ]),
  a("Microbiology", "Micro", "exam", 1, "2026-09-01", "08:00", [
    "Bacterial cytology I and II", "Bacterial physiology I and II", "Antimicrobial agents",
    "Regulation of gene expression", "Microbial variation", "Microbial genetic exchange",
  ]),
  a("Microbiology", "Micro", "quiz", 2, "2026-09-16", "13:00", ["Immunology and innate defence", "Antigen receptors", "Complement and blood groups"]),
  a("Microbiology", "Micro", "exam", 2, "2026-10-06", "08:00", ["Immunology and innate defence through immune response and immunodeficiency"]),
  a("Microbiology", "Micro", "quiz", 3, "2026-10-16", "08:00", ["Staphylococcus and Streptococcus", "Corynebacterium, Mycoplasma, Mycobacterium"]),
  a("Microbiology", "Micro", "quiz", 4, "2026-11-02", "13:00", ["Infection of CNS", "Rickettsiae and spirochetes", "Enterics"]),
  a("Microbiology", "Micro", "quiz", 5, "2026-11-11", "13:00", ["General properties of viruses", "RNA and DNA viruses"]),
  a("Microbiology", "Micro", "exam", 3, "2026-11-18", "08:00", ["Staphylococcus and Streptococcus onward, including mycology and virology"]),
];

/** Everything still to come, soonest first. */
export function upcoming(from: Date = new Date(), limit = 6): Assessment[] {
  const today = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  return ASSESSMENTS.filter(x => x.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, limit);
}

/** Anything falling on a given date. */
export function assessmentsOn(date: string): Assessment[] {
  return ASSESSMENTS.filter(x => x.date === date).sort((a, b) => a.time.localeCompare(b.time));
}

export function daysUntil(date: string, from: Date = new Date()): number {
  const a = new Date(`${date}T12:00:00`);
  const b = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/**
 * Whether a date sits inside an assessment crunch — within 5 days of a quiz or
 * 7 of an exam, which is the rule the week plan already uses to decide that a
 * course takes Block 1.
 */
export function crunch(from: Date = new Date()): Assessment[] {
  return ASSESSMENTS.filter(x => {
    const d = daysUntil(x.date, from);
    return d >= 0 && d <= (x.kind === "exam" ? 7 : 5);
  }).sort((a, b) => a.date.localeCompare(b.date));
}
