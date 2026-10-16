import { neonClient } from "@/lib/neon";

// The foundations checklist.
//
// Eighteen topics in order, from atoms to cell signalling. Every study text —
// Monday, Wednesday, Saturday — points at the next one that isn't done, and a
// topic is only done when a quiz says so. Score 5/6 or better and it moves on;
// anything lower and the same topic comes back next session, which is the
// whole point of ordering them.

export const TOPICS = [
  "Atoms, electrons, and the periodic table",
  "Bonds: covalent, ionic, hydrogen",
  "Water and why it matters",
  "Moles and concentration",
  "Solutions, diffusion, and osmosis",
  "Acids, bases, pH, and buffers",
  "Energy, reactions, and equilibrium",
  "Oxidation and reduction",
  "Functional groups",
  "The four macromolecules",
  "Protein structure",
  "Enzymes",
  "Cell structure and organelles",
  "Membranes and transport",
  "DNA, RNA, and making proteins",
  "Cell division",
  "Cellular respiration",
  "Cell signaling basics",
] as const;

/** 5 out of 6. Anything at or above this closes a topic. */
export const PASS_MARK = 5 / 6;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function ensureStudyTables() {
  const sql = db();
  // Only the finished ones are stored. The topic list lives in code, so a row
  // per topic would be a second copy waiting to disagree with it.
  await sql`
    CREATE TABLE IF NOT EXISTS study_progress (
      idx     INT PRIMARY KEY,
      done_at TIMESTAMPTZ DEFAULT NOW(),
      score   TEXT
    )
  `;
}

/**
 * A quiz score as a fraction, or null when it can't be read.
 *
 * "5/6" is the format she was asked for, but a score typed on a phone arrives
 * as "5 / 6", "83%" or a bare "5" too. A bare number is read out of six,
 * because that is the quiz she is taking — guessing percent would turn a 5 into
 * a fail.
 */
export function scoreFraction(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();

  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const [n, d] = [Number(frac[1]), Number(frac[2])];
    return d > 0 ? n / d : null;
  }

  const pct = s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pct) return Number(pct[1]) / 100;

  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const n = Number(bare[1]);
    if (n <= 6) return n / 6;
    if (n <= 100) return n / 100;
  }
  return null;
}

export function passed(raw: string | null | undefined): boolean {
  const f = scoreFraction(raw);
  // The epsilon is for 5/6, which is 0.8333… in both directions.
  return f !== null && f >= PASS_MARK - 1e-9;
}

export async function doneIndexes(): Promise<number[]> {
  await ensureStudyTables();
  const sql = db();
  const rows = await sql`SELECT idx FROM study_progress ORDER BY idx`;
  return rows.map(r => Number((r as Record<string, unknown>).idx));
}

export interface NextTopic { index: number; title: string }

/** The next topic that isn't done, or null when all eighteen are finished. */
export async function nextTopic(): Promise<NextTopic | null> {
  const done = new Set(await doneIndexes());
  for (let i = 0; i < TOPICS.length; i++) {
    if (!done.has(i)) return { index: i, title: TOPICS[i] };
  }
  return null;
}

/** Close a topic. Idempotent — a second pass on the same topic changes nothing. */
export async function markDone(index: number, score: string | null): Promise<void> {
  if (index < 0 || index >= TOPICS.length) return;
  await ensureStudyTables();
  const sql = db();
  await sql`
    INSERT INTO study_progress (idx, score) VALUES (${index}, ${score})
    ON CONFLICT (idx) DO NOTHING
  `;
}

export interface Progress {
  topics: Array<{ index: number; title: string; done: boolean; score: string | null }>;
  doneCount: number;
  total: number;
  next: NextTopic | null;
}

export async function progress(): Promise<Progress> {
  await ensureStudyTables();
  const sql = db();
  const rows = await sql`SELECT idx, score FROM study_progress`;
  const byIdx = new Map<number, string | null>();
  for (const r of rows) {
    const x = r as Record<string, unknown>;
    byIdx.set(Number(x.idx), (x.score as string) ?? null);
  }
  const topics = TOPICS.map((title, index) => ({
    index, title,
    done: byIdx.has(index),
    score: byIdx.get(index) ?? null,
  }));
  const firstOpen = topics.find(t => !t.done);
  return {
    topics,
    doneCount: topics.filter(t => t.done).length,
    total: TOPICS.length,
    next: firstOpen ? { index: firstOpen.index, title: firstOpen.title } : null,
  };
}
