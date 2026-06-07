"use client";

// Client-side .apkg parser — runs entirely in the browser, no server upload needed.
// The .apkg file is a ZIP containing a SQLite database (collection.anki21 or collection.anki2).
// We use JSZip + sql.js WASM to parse it, then return Flashcard objects directly.

import JSZip from "jszip";
import { Flashcard } from "@/types/dashboard";
import { randomUUID } from "crypto";

// ── HTML stripping ────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  let text = html.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<img[^>]*>/gi, "[image]");
  text = text.replace(/<[^>]+>/g, "");
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

// ── Subject / topic detection ─────────────────────────────────────────────────

function detectSubject(deckName: string, tags: string): string {
  const combined = (deckName + " " + tags).toLowerCase();
  if (combined.includes("biochem")) return "Biochemistry";
  if (combined.includes("biology") || combined.includes(" bio ") || combined.includes("bio::")) return "Biology";
  if (combined.includes("gen chem") || combined.includes("general chem") || combined.includes("genchem")) return "General Chemistry";
  if (combined.includes("org chem") || combined.includes("organic chem") || combined.includes("orgchem")) return "Organic Chemistry";
  if (combined.includes("physics") || combined.includes(" phys")) return "Physics";
  if (combined.includes("psych") || combined.includes("soc") || combined.includes("behavioral") || combined.includes("behaviour")) return "Behavioral Sciences";
  if (combined.includes("cars") || combined.includes("critical") || combined.includes("verbal")) return "Critical Analysis & Reasoning Skills";
  return "General";
}

function detectTopic(deckName: string): string {
  const parts = deckName.split("::");
  return parts[parts.length - 1].trim();
}

// ── Cloze parsing ─────────────────────────────────────────────────────────────

interface ClozeCard { front: string; back: string; }

function parseClozeCards(fields: string[]): ClozeCard[] {
  const raw = fields[0] ?? "";
  const clozeRegex = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;
  const ordinalSet = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = clozeRegex.exec(raw)) !== null) ordinalSet.add(parseInt(m[1]));
  if (ordinalSet.size === 0) return [];

  return Array.from(ordinalSet).map(ord => {
    const front = raw.replace(/\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g, (_, num, answer, hint) =>
      parseInt(num) === ord ? (hint ? `[${hint}]` : "[...]") : answer
    );
    const back = raw.replace(/\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g, (_, _n, answer) => answer);
    return { front: stripHtml(front), back: stripHtml(back) };
  });
}

// ── Main parser ───────────────────────────────────────────────────────────────

export async function parseApkgInBrowser(
  file: File,
  onProgress?: (msg: string) => void
): Promise<Flashcard[]> {
  onProgress?.("Reading file…");

  const arrayBuffer = await file.arrayBuffer();

  onProgress?.("Unzipping…");
  const zip = await JSZip.loadAsync(arrayBuffer);

  const dbEntry = zip.file("collection.anki21") ?? zip.file("collection.anki2");
  if (!dbEntry) throw new Error("No collection.anki21 or collection.anki2 found in .apkg");

  onProgress?.("Loading database…");
  const dbBuffer = await dbEntry.async("arraybuffer");

  // Load sql.js WASM from public folder
  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs({
    locateFile: () => "/sql-wasm.wasm",
  });

  onProgress?.("Parsing cards…");
  const db = new SQL.Database(new Uint8Array(dbBuffer));

  // Collection metadata
  const colResults = db.exec("SELECT crt, decks, models FROM col LIMIT 1");
  let colCrt = 0;
  let decksMap: Record<string, { id: string; name: string }> = {};
  let modelsMap: Record<string, { id: string; type: number; name: string }> = {};

  if (colResults.length > 0 && colResults[0].values.length > 0) {
    const row = colResults[0].values[0];
    colCrt = Number(row[0]);
    try { decksMap = JSON.parse(String(row[1])); } catch { /* */ }
    try { modelsMap = JSON.parse(String(row[2])); } catch { /* */ }
  }

  const cardResults = db.exec(
    `SELECT n.flds, n.tags, n.mid, c.did, c.type, c.due, c.ivl, c.factor, c.lapses, c.reps
     FROM notes n
     JOIN cards c ON c.nid = n.id
     WHERE c.queue >= 0`
  );

  db.close();

  if (cardResults.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const flashcards: Flashcard[] = [];

  let processed = 0;
  const total = cardResults[0].values.length;

  for (const row of cardResults[0].values) {
    const flds      = String(row[0]);
    const tags      = String(row[1]).trim();
    const mid       = String(row[2]);
    const did       = String(row[3]);
    const cardType  = Number(row[4]);
    const due       = Number(row[5]);
    const ivl       = Number(row[6]);
    const factor    = Number(row[7]);
    const lapses    = Number(row[8]);
    const reps      = Number(row[9]);

    const fields    = flds.split("\x1f");
    const deckName  = decksMap[did]?.name ?? "Imported";
    const isCloze   = modelsMap[mid]?.type === 1;
    const tagList   = tags.split(/\s+/).filter(Boolean);
    const subject   = detectSubject(deckName, tags);
    const topic     = detectTopic(deckName);
    const easeFactor = Math.max(1.3, Math.min(3.0, factor > 0 ? factor / 1000 : 2.5));

    // Compute scheduling state
    let nextReview: string;
    let state: Flashcard["state"];
    let interval: number;

    if (cardType === 0) {
      state = "new"; interval = 0; nextReview = today;
    } else if (cardType === 1) {
      state = "learning"; interval = 0;
      const d = new Date(due * 1000);
      nextReview = d <= now ? now.toISOString() : d.toISOString();
    } else if (cardType === 2) {
      state = "review"; interval = ivl;
      const d = new Date((colCrt + due * 86400) * 1000);
      const s = d.toISOString().slice(0, 10);
      nextReview = s < today ? today : s;
    } else if (cardType === 3) {
      state = "relearning"; interval = Math.max(1, ivl);
      const d = new Date(due * 1000);
      nextReview = d <= now ? now.toISOString() : d.toISOString();
    } else {
      state = "new"; interval = 0; nextReview = today;
    }

    const base = {
      subject, topic, tags: tagList, deck: "MCAT",
      createdAt: now.toISOString(),
      state, interval, easeFactor,
      repetitions: reps, lapses, learningStep: 0, nextReview,
    };

    if (isCloze) {
      for (const cc of parseClozeCards(fields)) {
        if (!cc.front.trim() || !cc.back.trim()) continue;
        flashcards.push({ id: randomUUID(), front: cc.front, back: cc.back, ...base });
      }
    } else {
      const front = stripHtml(fields[0] ?? "");
      const back  = stripHtml(fields[1] ?? "");
      if (front.trim() && back.trim()) {
        flashcards.push({ id: randomUUID(), front, back, ...base });
      }
    }

    processed++;
    if (processed % 500 === 0) {
      onProgress?.(`Parsed ${processed.toLocaleString()} / ${total.toLocaleString()} cards…`);
      // Yield to keep UI responsive
      await new Promise(r => setTimeout(r, 0));
    }
  }

  onProgress?.(`Done — ${flashcards.length.toLocaleString()} cards parsed`);
  return flashcards;
}
