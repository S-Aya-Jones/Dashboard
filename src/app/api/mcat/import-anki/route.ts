import { NextResponse } from "next/server";
import JSZip from "jszip";
import initSqlJs from "sql.js";
import path from "path";
import { randomUUID } from "crypto";
import { format } from "date-fns";
import { Flashcard } from "@/types/dashboard";

export const maxDuration = 300;

// ── HTML stripping ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  // Convert <br> variants to newline
  let text = html.replace(/<br\s*\/?>/gi, "\n");
  // Replace <img ...> with [image]
  text = text.replace(/<img[^>]*>/gi, "[image]");
  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return text.trim();
}

// ── MCAT subject detection ──────────────────────────────────────────────────

function detectSubject(deckName: string, tags: string): string {
  const combined = (deckName + " " + tags).toLowerCase();
  if (combined.includes("biochem")) return "Biochemistry";
  if (
    combined.includes("biology") ||
    combined.includes(" bio ") ||
    combined.includes("bio::")
  )
    return "Biology";
  if (
    combined.includes("gen chem") ||
    combined.includes("general chem") ||
    combined.includes("genchem")
  )
    return "General Chemistry";
  if (
    combined.includes("org chem") ||
    combined.includes("organic chem") ||
    combined.includes("orgchem")
  )
    return "Organic Chemistry";
  if (combined.includes("physics") || combined.includes(" phys"))
    return "Physics";
  if (
    combined.includes("psych") ||
    combined.includes("soc") ||
    combined.includes("behavioral") ||
    combined.includes("behaviour")
  )
    return "Behavioral Sciences";
  if (
    combined.includes("cars") ||
    combined.includes("critical") ||
    combined.includes("verbal")
  )
    return "Critical Analysis & Reasoning Skills";
  return "General";
}

function detectTopic(deckName: string): string {
  const parts = deckName.split("::");
  return parts[parts.length - 1].trim();
}

// ── Cloze parsing ───────────────────────────────────────────────────────────

interface ClozeCard {
  front: string;
  back: string;
  ordinal: number;
}

function parseClozeCards(fields: string[]): ClozeCard[] {
  const raw = fields[0] ?? "";
  // Find all unique cloze numbers
  const clozeRegex = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;
  const ordinalMap = new Map<number, boolean>();
  let m: RegExpExecArray | null;
  while ((m = clozeRegex.exec(raw)) !== null) {
    ordinalMap.set(parseInt(m[1]), true);
  }
  if (ordinalMap.size === 0) return [];

  const cards: ClozeCard[] = [];

  for (const ord of Array.from(ordinalMap.keys())) {
    // Build front: target cloze → [...], others → their answer text
    const front = raw.replace(
      /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g,
      (_, num, answer, hint) => {
        if (parseInt(num) === ord) {
          return hint ? `[${hint}]` : "[...]";
        }
        return answer;
      }
    );

    // Build back: reveal all clozed answers
    const back = raw.replace(
      /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g,
      (_, _num, answer) => answer
    );

    cards.push({
      front: stripHtml(front),
      back: stripHtml(back),
      ordinal: ord,
    });
  }

  return cards;
}

// ── .apkg parsing ───────────────────────────────────────────────────────────

async function parseApkg(
  buffer: Buffer,
  today: string
): Promise<Flashcard[]> {
  const zip = await JSZip.loadAsync(buffer);

  // Try anki21 first, fallback to anki2
  let dbEntry = zip.file("collection.anki21");
  if (!dbEntry) dbEntry = zip.file("collection.anki2");
  if (!dbEntry)
    throw new Error(
      "No collection.anki21 or collection.anki2 found in .apkg"
    );

  const dbBuffer = await dbEntry.async("arraybuffer");

  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
  });
  const db = new SQL.Database(new Uint8Array(dbBuffer));

  // Query col table for metadata
  const colResults = db.exec(
    "SELECT crt, decks, models FROM col LIMIT 1"
  );

  let colCrt = 0;
  let decksMap: Record<string, { id: string; name: string }> = {};
  let modelsMap: Record<string, { id: string; type: number; name: string }> = {};

  if (colResults.length > 0 && colResults[0].values.length > 0) {
    const row = colResults[0].values[0];
    colCrt = Number(row[0]);
    try {
      decksMap = JSON.parse(String(row[1]));
    } catch {
      decksMap = {};
    }
    try {
      modelsMap = JSON.parse(String(row[2]));
    } catch {
      modelsMap = {};
    }
  }

  // Query cards + notes
  const cardResults = db.exec(
    `SELECT n.flds, n.tags, n.mid, c.did, c.type, c.due, c.ivl, c.factor, c.lapses, c.reps
     FROM notes n
     JOIN cards c ON c.nid = n.id
     WHERE c.queue >= 0`
  );

  db.close();

  const flashcards: Flashcard[] = [];
  const now = new Date();

  if (cardResults.length === 0) return flashcards;

  for (const row of cardResults[0].values) {
    const flds = String(row[0]);
    const tags = String(row[1]).trim();
    const mid = String(row[2]);
    const did = String(row[3]);
    const cardType = Number(row[4]);
    const due = Number(row[5]);
    const ivl = Number(row[6]);
    const factor = Number(row[7]);
    const lapses = Number(row[8]);
    const reps = Number(row[9]);

    const fields = flds.split("\x1f");
    const deckInfo = decksMap[did];
    const deckName = deckInfo ? deckInfo.name : "Imported";
    const modelInfo = modelsMap[mid];
    const isCloze = modelInfo ? modelInfo.type === 1 : false;

    const tagList = tags
      .split(/\s+/)
      .filter(Boolean);

    const subject = detectSubject(deckName, tags);
    const topic = detectTopic(deckName);

    // Ease factor
    const rawEase = factor > 0 ? factor / 1000 : 2.5;
    const easeFactor = Math.max(1.3, Math.min(3.0, rawEase));

    // Compute nextReview
    let nextReview: string;
    let state: Flashcard["state"];
    let interval: number;

    if (cardType === 0) {
      // New
      state = "new";
      interval = 0;
      nextReview = today;
    } else if (cardType === 1) {
      // Learning — due is Unix timestamp (seconds)
      state = "learning";
      interval = 0;
      const dueDate = new Date(due * 1000);
      nextReview = dueDate <= now ? now.toISOString() : dueDate.toISOString();
    } else if (cardType === 2) {
      // Review — due is days since col.crt
      state = "review";
      interval = ivl;
      const dueDate = new Date((colCrt + due * 86400) * 1000);
      const dueDateStr = format(dueDate, "yyyy-MM-dd");
      nextReview = dueDateStr < today ? today : dueDateStr;
    } else if (cardType === 3) {
      // Relearning — due is Unix timestamp (seconds)
      state = "relearning";
      interval = Math.max(1, ivl);
      const dueDate = new Date(due * 1000);
      nextReview = dueDate <= now ? now.toISOString() : dueDate.toISOString();
    } else {
      // Unknown — treat as new
      state = "new";
      interval = 0;
      nextReview = today;
    }

    if (isCloze) {
      const clozeCards = parseClozeCards(fields);
      for (const cc of clozeCards) {
        if (!cc.front.trim() || !cc.back.trim()) continue;
        flashcards.push({
          id: randomUUID(),
          front: cc.front,
          back: cc.back,
          subject,
          topic,
          tags: tagList,
          deck: "MCAT",
          createdAt: now.toISOString(),
          state,
          interval,
          easeFactor,
          repetitions: reps,
          lapses,
          learningStep: 0,
          nextReview,
        });
      }
    } else {
      const front = stripHtml(fields[0] ?? "");
      const back = stripHtml(fields[1] ?? "");
      if (!front.trim() || !back.trim()) continue;
      flashcards.push({
        id: randomUUID(),
        front,
        back,
        subject,
        topic,
        tags: tagList,
        deck: "MCAT",
        createdAt: now.toISOString(),
        state,
        interval,
        easeFactor,
        repetitions: reps,
        lapses,
        learningStep: 0,
        nextReview,
      });
    }
  }

  return flashcards;
}

// ── .txt / .tsv parsing ─────────────────────────────────────────────────────

function parseTsv(text: string, today: string): Flashcard[] {
  const lines = text.split("\n");
  const flashcards: Flashcard[] = [];
  const now = new Date().toISOString();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("\t");
    if (parts.length < 2) continue;
    const front = parts[0].trim();
    const back = parts[1].trim();
    if (!front || !back) continue;
    const tags = parts[2]
      ? parts[2].split(/[\s,]+/).filter(Boolean)
      : [];

    flashcards.push({
      id: randomUUID(),
      front,
      back,
      subject: detectSubject("", tags.join(" ")),
      topic: "",
      tags,
      deck: "MCAT",
      createdAt: now,
      state: "new",
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      learningStep: 0,
      nextReview: today,
    });
  }

  return flashcards;
}

// ── .csv parsing ────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string, today: string): Flashcard[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length === 0) return [];

  const flashcards: Flashcard[] = [];
  const now = new Date().toISOString();

  // Detect header row
  const firstLine = lines[0].toLowerCase();
  let startIdx = 0;
  let frontIdx = 0;
  let backIdx = 1;

  if (firstLine.includes("front") || firstLine.includes("question")) {
    startIdx = 1;
    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
    frontIdx =
      headers.findIndex(h => h.includes("front") || h.includes("question")) ??
      0;
    backIdx =
      headers.findIndex(h => h.includes("back") || h.includes("answer")) ?? 1;
    if (frontIdx === -1) frontIdx = 0;
    if (backIdx === -1) backIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const front = parts[frontIdx]?.trim() ?? "";
    const back = parts[backIdx]?.trim() ?? "";
    if (!front || !back) continue;

    flashcards.push({
      id: randomUUID(),
      front,
      back,
      subject: "General",
      topic: "",
      tags: [],
      deck: "MCAT",
      createdAt: now,
      state: "new",
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      learningStep: 0,
      nextReview: today,
    });
  }

  return flashcards;
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Guard: warn on very large files (> 300 MB) — can exhaust server memory
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 300) {
      return NextResponse.json(
        { error: `File is ${fileSizeMB.toFixed(0)} MB. Try exporting individual decks rather than your full collection to keep files under 300 MB.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const name = file.name.toLowerCase();
    const today = format(new Date(), "yyyy-MM-dd");

    let cards: Flashcard[] = [];

    if (name.endsWith(".apkg")) {
      cards = await parseApkg(buffer, today);
    } else if (name.endsWith(".txt") || name.endsWith(".tsv")) {
      cards = parseTsv(buffer.toString("utf-8"), today);
    } else if (name.endsWith(".csv")) {
      cards = parseCsv(buffer.toString("utf-8"), today);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use .apkg, .txt, .tsv, or .csv" },
        { status: 400 }
      );
    }

    if (cards.length === 0) {
      return NextResponse.json(
        { error: "No cards could be parsed from the file" },
        { status: 400 }
      );
    }

    return NextResponse.json({ cards, count: cards.length });
  } catch (e) {
    console.error("Import error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Import failed", detail: msg },
      { status: 500 }
    );
  }
}
