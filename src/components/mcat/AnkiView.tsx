"use client";

import { useState, useRef } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp,
  Brain, BookOpen, Check, X, Zap, Upload, Loader2, Settings
} from "lucide-react";
import { Flashcard, FlashcardReviewLog, DashboardData } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { format, addDays, parseISO } from "date-fns";
import { parseApkgInBrowser } from "@/lib/ankiParser";

// ── Miles Down / Anki SM-2 Algorithm ────────────────────────────────────────
// Learning steps: 1m 10m | Graduating: 1d | Easy: 4d
// Ease: 2.5 start | Hard: ×1.2 −15% ease | Easy bonus: ×1.3 +15% ease
// Lapse: relearn 10m, new interval = 1d, ease −20%

const MD = {
  learnSteps:    [1, 10],
  relearnSteps:  [10],
  graduateInt:   1,
  easyInt:       4,
  startEase:     2.5,
  hardMult:      1.2,
  easyBonus:     1.3,
  intMod:        1.0,
  newIntMult:    0.0,
  maxInt:        36500,
};

function minutesFromNow(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

function milesDown(card: Flashcard, rating: 0 | 1 | 2 | 3): Partial<Flashcard> {
  const now = new Date();
  const ef  = card.easeFactor ?? MD.startEase;

  if (card.state === "new" || card.state === "learning") {
    if (rating === 0) {
      return { state: "learning", learningStep: 0, nextReview: minutesFromNow(MD.learnSteps[0]), lastReview: now.toISOString() };
    }
    if (rating === 1) {
      const step = MD.learnSteps[card.learningStep] ?? MD.learnSteps[MD.learnSteps.length - 1];
      return { state: "learning", learningStep: card.learningStep, nextReview: minutesFromNow(step), lastReview: now.toISOString() };
    }
    if (rating === 3) {
      return { state: "review", interval: MD.easyInt, learningStep: 0, repetitions: 1, easeFactor: Math.min(3.0, ef + 0.15), nextReview: format(addDays(now, MD.easyInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
    }
    const next = card.learningStep + 1;
    if (next >= MD.learnSteps.length) {
      return { state: "review", interval: MD.graduateInt, learningStep: 0, repetitions: 1, nextReview: format(addDays(now, MD.graduateInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
    }
    return { state: "learning", learningStep: next, nextReview: minutesFromNow(MD.learnSteps[next]), lastReview: now.toISOString() };
  }

  if (card.state === "relearning") {
    if (rating === 0) {
      return { state: "relearning", learningStep: 0, nextReview: minutesFromNow(MD.relearnSteps[0]), lastReview: now.toISOString() };
    }
    const newInt = Math.max(1, Math.round(card.interval * MD.newIntMult) || 1);
    return { state: "review", interval: newInt, learningStep: 0, repetitions: card.repetitions + 1, nextReview: format(addDays(now, newInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
  }

  // Review state
  if (rating === 0) {
    const newInt = Math.max(1, Math.round(card.interval * MD.newIntMult) || 1);
    return { state: "relearning", learningStep: 0, interval: newInt, lapses: (card.lapses ?? 0) + 1, easeFactor: Math.max(1.3, ef - 0.2), nextReview: minutesFromNow(MD.relearnSteps[0]), lastReview: now.toISOString() };
  }
  if (rating === 1) {
    const newInt = Math.min(MD.maxInt, Math.max(card.interval + 1, Math.round(card.interval * MD.hardMult * MD.intMod)));
    return { state: "review", interval: newInt, easeFactor: Math.max(1.3, ef - 0.15), repetitions: card.repetitions + 1, nextReview: format(addDays(now, newInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
  }
  if (rating === 2) {
    const newInt = Math.min(MD.maxInt, Math.max(card.interval + 1, Math.round(card.interval * ef * MD.intMod)));
    return { state: "review", interval: newInt, repetitions: card.repetitions + 1, nextReview: format(addDays(now, newInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
  }
  const newInt = Math.min(MD.maxInt, Math.max(card.interval + 1, Math.round(card.interval * ef * MD.easyBonus * MD.intMod)));
  return { state: "review", interval: newInt, easeFactor: Math.min(3.0, ef + 0.15), repetitions: card.repetitions + 1, nextReview: format(addDays(now, newInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
}

function previewInterval(card: Flashcard, rating: 0 | 1 | 2 | 3): string {
  const updated = milesDown(card, rating);
  if (updated.state === "learning" || updated.state === "relearning") {
    const ms  = new Date(updated.nextReview as string).getTime() - Date.now();
    const min = Math.round(ms / 60_000);
    return min < 60 ? `${min}m` : `${Math.round(min / 60)}h`;
  }
  const days = updated.interval ?? 1;
  if (days < 7)   return `${days}d`;
  if (days < 30)  return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── MCAT Subjects ───────────────────────────────────────────────────────────

const MCAT_SUBJECTS = [
  "Behavioral Sciences", "Biochemistry", "Biology",
  "Critical Analysis & Reasoning Skills",
  "General Chemistry", "Organic Chemistry", "Physics", "General",
];

// ── Types ───────────────────────────────────────────────────────────────────

type View = "home" | "review" | "add" | "browse" | "settings";
type QType = "learn" | "review" | "new";

interface QItem {
  card: Flashcard;
  qType: QType;
}

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function AnkiView({ data, update }: Props) {
  const flashcards = data.flashcards ?? [];
  const ankiSettings = data.ankiSettings ?? { newPerDay: 20, reviewPerDay: 200 };

  const [view, setView] = useState<View>("home");

  // Settings form
  const [settingsNew, setSettingsNew] = useState(ankiSettings.newPerDay);
  const [settingsReview, setSettingsReview] = useState(ankiSettings.reviewPerDay);

  // Review state
  const [queue, setQueue] = useState<QItem[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewStart, setReviewStart] = useState(Date.now());
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [opacity, setOpacity] = useState(1);

  // Add form state
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [deck, setDeck] = useState("MCAT");
  const [subject, setSubject] = useState(MCAT_SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [tags, setTags] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genCount, setGenCount] = useState(3);

  // Browse state
  const [search, setSearch] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; dupes: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queue / session helpers ───────────────────────────────────────────────

  function getDailyCount() {
    const today = getToday();
    return data.ankiDailyCount?.date === today
      ? data.ankiDailyCount
      : { date: today, newSeen: 0, reviewSeen: 0 };
  }

  function computeSessionCounts(deckF: string | null) {
    const now = new Date();
    const daily = getDailyCount();

    let cards = flashcards;
    if (deckF) cards = cards.filter(c => c.deck === deckF);

    const learnCount = cards.filter(c =>
      (c.state === "learning" || c.state === "relearning") &&
      new Date(c.nextReview) <= now
    ).length;

    const reviewSlots = Math.max(0, ankiSettings.reviewPerDay - daily.reviewSeen);
    const reviewDueTotal = cards.filter(c => {
      if (c.state !== "review") return false;
      try { return parseISO(c.nextReview) <= now; } catch { return false; }
    }).length;
    const reviewCount = Math.min(reviewSlots, reviewDueTotal);

    const newSlots = Math.max(0, ankiSettings.newPerDay - daily.newSeen);
    const newCount = Math.min(newSlots, cards.filter(c => c.state === "new").length);

    return { learnCount, reviewCount, newCount, total: learnCount + reviewCount + newCount };
  }

  function startReview(filter: string | null) {
    const now = new Date();
    const todayStr = getToday();
    const daily = getDailyCount();

    let cards = flashcards;
    if (filter) cards = cards.filter(c => c.deck === filter);

    // 1. Learning/relearning due now — always included, no cap
    const learnDue = cards.filter(c =>
      (c.state === "learning" || c.state === "relearning") &&
      new Date(c.nextReview) <= now
    );

    // 2. Review cards due today — capped by daily limit
    const reviewSlots = Math.max(0, ankiSettings.reviewPerDay - daily.reviewSeen);
    const reviewDue = cards
      .filter(c => {
        if (c.state !== "review") return false;
        try { return parseISO(c.nextReview) <= now; } catch { return false; }
      })
      .sort(() => Math.random() - 0.5)
      .slice(0, reviewSlots);

    // 3. New cards — capped by daily limit
    const newSlots = Math.max(0, ankiSettings.newPerDay - daily.newSeen);
    const newCards = cards.filter(c => c.state === "new").slice(0, newSlots);

    const items: QItem[] = [
      ...learnDue.map(c => ({ card: c, qType: "learn" as QType })),
      ...reviewDue.map(c => ({ card: c, qType: "review" as QType })),
      ...newCards.map(c => ({ card: c, qType: "new" as QType })),
    ];

    if (items.length === 0) return;

    // Record daily counts at session start
    update(d => ({
      ...d,
      ankiDailyCount: {
        date: todayStr,
        newSeen: daily.newSeen + newCards.length,
        reviewSeen: daily.reviewSeen + reviewDue.length,
      },
    }));

    setQueue(items);
    setQIdx(0);
    setFlipped(false);
    setSessionCorrect(0);
    setSessionTotal(0);
    setReviewStart(Date.now());
    setView("review");
  }

  function flipCard() {
    if (flipped) return;
    setOpacity(0);
    setTimeout(() => { setFlipped(true); setOpacity(1); }, 150);
  }

  function handleRating(rating: 0 | 1 | 2 | 3) {
    const item = queue[qIdx];
    if (!item) return;
    const { card } = item;

    const updates = milesDown(card, rating);
    const updatedCard: Flashcard = { ...card, ...(updates as Flashcard) };

    const reviewLog: FlashcardReviewLog = {
      cardId: card.id,
      date: new Date().toISOString(),
      rating,
      responseTimeMs: Date.now() - reviewStart,
    };

    update(d => ({
      ...d,
      flashcards: (d.flashcards ?? []).map(c => c.id === card.id ? updatedCard : c),
      flashcardReviews: [...(d.flashcardReviews ?? []), reviewLog],
    }));

    setSessionCorrect(prev => prev + (rating >= 2 ? 1 : 0));
    setSessionTotal(prev => prev + 1);

    // "Again" re-queues the card at the end of the session so it comes back
    const willRequeue = rating === 0;
    const newQueueLen = queue.length + (willRequeue ? 1 : 0);
    if (willRequeue) {
      setQueue(prev => [...prev, { card: updatedCard, qType: "learn" }]);
    }

    const nextIdx = qIdx + 1;
    if (nextIdx >= newQueueLen) {
      setQIdx(nextIdx);
    } else {
      setOpacity(0);
      setTimeout(() => {
        setFlipped(false);
        setQIdx(nextIdx);
        setReviewStart(Date.now());
        setOpacity(1);
      }, 150);
    }
  }

  function saveCard() {
    if (!front.trim() || !back.trim()) return;
    const newCard: Flashcard = {
      id: id(),
      front: front.trim(),
      back: back.trim(),
      deck: deck.trim() || "MCAT",
      subject,
      topic: topic.trim() || undefined,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
      state: "new" as const,
      interval: 0,
      easeFactor: MD.startEase,
      repetitions: 0,
      lapses: 0,
      learningStep: 0,
      nextReview: format(new Date(), "yyyy-MM-dd"),
    };
    update(d => ({ ...d, flashcards: [...(d.flashcards ?? []), newCard] }));
    setFront(""); setBack(""); setTopic(""); setTags("");
    setView("home");
  }

  async function generateWithAI() {
    if (!subject || !topic.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/mcat/generate-flashcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic: topic.trim(), count: genCount }),
      });
      const data2 = await res.json();
      if (data2.cards?.length) {
        update(d => ({ ...d, flashcards: [...(d.flashcards ?? []), ...data2.cards] }));
        setView("home");
      }
    } catch (e) {
      console.error("Generate failed:", e);
    } finally {
      setGenerating(false);
    }
  }

  function deleteCard(cardId: string) {
    update(d => ({ ...d, flashcards: (d.flashcards ?? []).filter(c => c.id !== cardId) }));
  }

  async function handleImport(file: File) {
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      let incoming: Flashcard[] = [];

      if (file.name.toLowerCase().endsWith(".apkg")) {
        incoming = await parseApkgInBrowser(file, msg => setImportError(msg));
        setImportError(null);
      } else {
        const formData = new FormData();
        formData.append("file", file);
        let res: Response;
        try {
          res = await fetch("/api/mcat/import-anki", { method: "POST", body: formData });
        } catch (netErr) {
          setImportError(`Network error — ${netErr instanceof Error ? netErr.message : String(netErr)}`);
          return;
        }
        let data2: { cards?: Flashcard[]; error?: string; detail?: string };
        try {
          data2 = await res.json();
        } catch {
          setImportError(`Server error (HTTP ${res.status}) — open browser console for details`);
          return;
        }
        if (!res.ok || data2.error) {
          setImportError(data2.detail || data2.error || `Import failed (HTTP ${res.status})`);
          return;
        }
        incoming = data2.cards ?? [];
      }

      let dupes = 0;
      update(d => {
        const existing = new Set((d.flashcards ?? []).map(c => `${c.front}||${c.back}`));
        const fresh = incoming.filter(c => {
          const key = `${c.front}||${c.back}`;
          if (existing.has(key)) { dupes++; return false; }
          return true;
        });
        return { ...d, flashcards: [...(d.flashcards ?? []), ...fresh] };
      });
      setImportResult({ count: incoming.length - dupes, dupes });
    } catch (e) {
      console.error("Import error:", e);
      setImportError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleExpand(cardId: string) {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  }

  const filteredCards = flashcards.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.front.toLowerCase().includes(q) ||
      c.back.toLowerCase().includes(q) ||
      c.deck.toLowerCase().includes(q) ||
      (c.topic ?? "").toLowerCase().includes(q) ||
      (c.subject ?? "").toLowerCase().includes(q)
    );
  });

  const decks = Array.from(new Set(flashcards.map(c => c.deck)));

  // ── Render: Settings ──────────────────────────────────────────────────────

  if (view === "settings") {
    return (
      <div style={{ maxWidth: 500, margin: "0 auto", padding: "0 0 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Deck Settings</h2>
          <button
            onClick={() => setView("home")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}
          >
            <X size={16} /> Close
          </button>
        </div>

        <div className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 32 }}>
          {/* New cards per day */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>New cards per day</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Unseen cards introduced each day</div>
              </div>
              <div style={{ width: 52, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--grad)", color: "#fff", fontWeight: 800, fontSize: 20 }}>
                {settingsNew}
              </div>
            </div>
            <input type="range" min={1} max={100} value={settingsNew}
              onChange={e => setSettingsNew(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--purple)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>1</span><span>Recommended: 20</span><span>100</span>
            </div>
          </div>

          {/* Reviews per day */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Maximum reviews per day</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Cap on graduated review cards (learning cards have no cap)</div>
              </div>
              <div style={{ minWidth: 52, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--grad)", color: "#fff", fontWeight: 800, fontSize: settingsReview >= 1000 ? 14 : 18, padding: "0 8px" }}>
                {settingsReview >= 9999 ? "∞" : settingsReview}
              </div>
            </div>
            <input type="range" min={10} max={9999} step={10} value={settingsReview}
              onChange={e => setSettingsReview(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--purple)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>10</span><span>Recommended: 200</span><span>∞</span>
            </div>
          </div>

          {/* How it works */}
          <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(124,92,252,0.07)", border: "1.5px solid rgba(124,92,252,0.15)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--purple)", marginBottom: 8 }}>How the Anki algorithm works</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
              <b>🔵 Learning</b> — new cards work through steps: 1 min → 10 min → graduate<br/>
              <b>🔴 Review</b> — graduated cards come back based on their interval<br/>
              <b>🟢 New</b> — unseen cards, limited to your daily cap<br/>
              <br/>
              <b>Again</b> → card comes back in 1 min; lapses reset ease<br/>
              <b>Hard</b> → shorter interval, ease drops 15%<br/>
              <b>Good</b> → normal growth (interval × ease factor)<br/>
              <b>Easy</b> → bigger jump, ease rises 15%
            </div>
          </div>

          <button
            onClick={() => {
              update(d => ({ ...d, ankiSettings: { newPerDay: settingsNew, reviewPerDay: settingsReview } }));
              setView("home");
            }}
            style={{ padding: "14px", borderRadius: 12, border: "none", cursor: "pointer", background: "var(--grad)", color: "#fff", fontWeight: 700, fontSize: 15 }}
          >
            Save Settings
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Review ────────────────────────────────────────────────────────

  if (view === "review") {
    const done = qIdx >= queue.length;

    if (done) {
      const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "40px 0" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={40} color="#fff" />
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", margin: 0 }}>Session Complete!</h2>
          <div style={{ display: "flex", gap: 32, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--purple)" }}>{sessionCorrect}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Correct</div>
            </div>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text)" }}>{sessionTotal}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Reviewed</div>
            </div>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--green)" }}>{accuracy}%</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Accuracy</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 320, margin: 0, lineHeight: 1.6 }}>
            {accuracy >= 85
              ? "Excellent session! Cards have been scheduled based on your performance."
              : accuracy >= 60
              ? "Good work! Keep reviewing — your ease factors have been adjusted."
              : "Keep going — those tough cards will come back soon for more practice."}
          </p>
          <button
            onClick={() => setView("home")}
            style={{ padding: "12px 32px", borderRadius: 12, border: "none", cursor: "pointer", background: "var(--grad)", color: "#fff", fontWeight: 700, fontSize: 16 }}
          >
            Back to Home
          </button>
        </div>
      );
    }

    const card = queue[qIdx].card;
    const remaining = queue.slice(qIdx);
    const learnLeft  = remaining.filter(q => q.qType === "learn").length;
    const reviewLeft = remaining.filter(q => q.qType === "review").length;
    const newLeft    = remaining.filter(q => q.qType === "new").length;

    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 40px" }}>
        {/* Header with queue counts */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button
            onClick={() => setView("home")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}
          >
            <X size={16} /> Exit
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#3B82F6", background: "rgba(59,130,246,0.12)", padding: "4px 12px", borderRadius: 20 }}>
              {learnLeft}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", background: "rgba(239,68,68,0.12)", padding: "4px 12px", borderRadius: 20 }}>
              {reviewLeft}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", background: "rgba(16,185,129,0.12)", padding: "4px 12px", borderRadius: 20 }}>
              {newLeft}
            </span>
          </div>
        </div>

        {/* Flashcard */}
        <div
          onClick={!flipped ? flipCard : undefined}
          style={{
            background: "var(--surface)", borderRadius: 20, boxShadow: "var(--shadow)",
            padding: "40px 36px", minHeight: 240, cursor: flipped ? "default" : "pointer",
            opacity, transition: "opacity 0.15s ease",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 16, textAlign: "center",
          }}
        >
          {!flipped ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Question
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", lineHeight: 1.55 }}>
                {card.front}
              </div>
              {card.deck && (
                <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "rgba(124,92,252,0.08)", color: "var(--purple)", fontWeight: 600 }}>
                  {card.deck}
                </span>
              )}
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13 }}>
                <ChevronDown size={16} /> Click to reveal answer
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--green)", textTransform: "uppercase" }}>
                Answer
              </div>
              <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text)", lineHeight: 1.6 }}>
                {card.back}
              </div>
              {(card.subject || card.topic) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                  {card.subject && (
                    <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(124,92,252,0.08)", color: "var(--purple)", fontSize: 12, fontWeight: 600 }}>{card.subject}</span>
                  )}
                  {card.topic && (
                    <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(232,121,249,0.08)", color: "var(--pink)", fontSize: 12, fontWeight: 600 }}>{card.topic}</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Rating buttons */}
        {flipped && (
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {([
              { rating: 0 as const, label: "Again", color: "var(--red)", bg: "rgba(239,68,68,0.08)" },
              { rating: 1 as const, label: "Hard",  color: "var(--amber)", bg: "rgba(245,158,11,0.08)" },
              { rating: 2 as const, label: "Good",  color: "var(--purple)", bg: "rgba(124,92,252,0.08)" },
              { rating: 3 as const, label: "Easy",  color: "var(--green)", bg: "rgba(16,185,129,0.08)" },
            ] as const).map(({ rating, label, color, bg }) => (
              <button
                key={rating}
                onClick={() => handleRating(rating)}
                style={{ padding: "14px 8px", borderRadius: 14, border: `2px solid ${color}`, background: bg, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{label}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{previewInterval(card, rating)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Add ───────────────────────────────────────────────────────────

  if (view === "add") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 0 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Add Flashcard</h2>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
            <X size={16} /> Cancel
          </button>
        </div>

        <div className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Front (Question / Prompt)</label>
            <textarea value={front} onChange={e => setFront(e.target.value)} placeholder="What is the Henderson-Hasselbalch equation?" rows={3}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 15, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Back (Answer / Explanation)</label>
            <textarea value={back} onChange={e => setBack(e.target.value)} placeholder="pH = pKa + log([A⁻]/[HA])" rows={4}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 15, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Deck</label>
              <input value={deck} onChange={e => setDeck(e.target.value)} placeholder="MCAT"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box" }}
              >
                {MCAT_SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Topic</label>
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Acid-Base Chemistry"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Tags (comma-separated)</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="pH, buffer, chemistry"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <button onClick={saveCard} disabled={!front.trim() || !back.trim()}
            style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", background: "var(--grad)", color: "#fff", fontWeight: 700, fontSize: 15, opacity: !front.trim() || !back.trim() ? 0.5 : 1 }}
          >
            Save Card
          </button>
        </div>

        <div className="card" style={{ padding: 24, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Zap size={18} style={{ color: "var(--purple)" }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Generate with AI</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>Set a subject and topic above, then generate multiple cards at once.</p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Number of cards</label>
              <input type="number" min={1} max={20} value={genCount} onChange={e => setGenCount(parseInt(e.target.value) || 3)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 14, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", boxSizing: "border-box" }}
              />
            </div>
            <button onClick={generateWithAI} disabled={generating || !topic.trim()}
              style={{ padding: "9px 20px", borderRadius: 10, border: "none", cursor: "pointer", background: "rgba(124,92,252,0.1)", color: "var(--purple)", fontWeight: 700, fontSize: 14, alignSelf: "flex-end", opacity: generating || !topic.trim() ? 0.5 : 1 }}
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Browse ────────────────────────────────────────────────────────

  if (view === "browse") {
    const browseDecks = Array.from(new Set(filteredCards.map(c => c.deck)));
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 0 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Browse Cards</h2>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
            <X size={16} /> Close
          </button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards..."
          style={{ width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 15, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 20, boxShadow: "var(--shadow)" }}
        />
        {filteredCards.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
            {search ? "No cards match your search." : "No cards yet. Add some!"}
          </div>
        )}
        {browseDecks.map(deckName => {
          const cards = filteredCards.filter(c => c.deck === deckName);
          return (
            <div key={deckName} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
                {deckName} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({cards.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map(c => {
                  const expanded = expandedCards.has(c.id);
                  const stateColor = c.state === "new" ? "var(--green)" : c.state === "review" ? "var(--red)" : "#3B82F6";
                  return (
                    <div key={c.id} className="card" style={{ padding: "14px 18px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }} onClick={() => toggleExpand(c.id)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>{c.front}</div>
                          {!expanded && <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{c.back}</div>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${stateColor}20`, color: stateColor, fontWeight: 600 }}>{c.state}</span>
                          {c.state === "review" && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.interval}d</span>}
                          {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                        </div>
                      </div>
                      {expanded && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Answer</div>
                          <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, marginBottom: 12 }}>{c.back}</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {c.subject && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(124,92,252,0.08)", color: "var(--purple)" }}>{c.subject}</span>}
                              {c.topic && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(232,121,249,0.08)", color: "var(--pink)" }}>{c.topic}</span>}
                              {c.tags.map(tag => <span key={tag} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--bg)", color: "var(--text-muted)" }}>{tag}</span>)}
                            </div>
                            <button onClick={e => { e.stopPropagation(); deleteCard(c.id); }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 4, display: "flex", alignItems: "center" }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Home View ─────────────────────────────────────────────────────────────

  const sessionCounts = computeSessionCounts(null);
  const deckStatsList = decks.map(d => {
    const counts = computeSessionCounts(d);
    return { name: d, cardCount: flashcards.filter(c => c.deck === d).length, ...counts };
  });

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Brain size={26} style={{ color: "var(--purple)" }} />
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", margin: 0 }}>Flashcards</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {ankiSettings.newPerDay} new/day · {ankiSettings.reviewPerDay >= 9999 ? "unlimited" : ankiSettings.reviewPerDay} reviews/day
          </p>
        </div>
        <button
          onClick={() => { setSettingsNew(ankiSettings.newPerDay); setSettingsReview(ankiSettings.reviewPerDay); setView("settings"); }}
          style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 10, cursor: "pointer", padding: "8px 14px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, flexShrink: 0 }}
        >
          <Settings size={15} /> Settings
        </button>
      </div>

      {/* Stats row — 4 pillars */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total",    value: flashcards.length,          dot: "var(--purple)", bg: "rgba(124,92,252,0.08)" },
          { label: "Learning", value: sessionCounts.learnCount,   dot: "#3B82F6",       bg: "rgba(59,130,246,0.08)" },
          { label: "Reviews",  value: sessionCounts.reviewCount,  dot: "var(--red)",    bg: "rgba(239,68,68,0.08)" },
          { label: "New",      value: sessionCounts.newCount,     dot: "var(--green)",  bg: "rgba(16,185,129,0.08)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "16px 12px", textAlign: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, margin: "0 auto 8px" }} />
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => startReview(null)}
          disabled={sessionCounts.total === 0}
          style={{
            flex: 1, padding: "14px", borderRadius: 12, border: "none", cursor: sessionCounts.total > 0 ? "pointer" : "default",
            background: sessionCounts.total > 0 ? "var(--grad)" : "var(--bg)",
            color: sessionCounts.total > 0 ? "#fff" : "var(--text-muted)",
            fontWeight: 700, fontSize: 15,
            boxShadow: sessionCounts.total > 0 ? "0 2px 12px rgba(124,92,252,0.3)" : "none",
          }}
        >
          {sessionCounts.total > 0 ? `Study Now (${sessionCounts.total})` : "All caught up — check back later!"}
        </button>
        <button onClick={() => setView("add")}
          style={{ padding: "14px 18px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--purple)", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={16} /> Add
        </button>
        <button onClick={() => setView("browse")}
          style={{ padding: "14px 18px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <BookOpen size={16} /> Browse
        </button>
      </div>

      {/* Import */}
      <div className="card" style={{ padding: "18px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Upload size={16} style={{ color: "var(--purple)" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Import Anki Deck</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>.apkg (parsed in browser) · .txt / .tsv / .csv</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {importResult && (
              <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
                <Check size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                {importResult.count} imported{importResult.dupes > 0 ? `, ${importResult.dupes} dupes skipped` : ""}
              </span>
            )}
            {importError && (
              <span style={{ fontSize: 12, color: importError.startsWith("Parsed") || importError.startsWith("Done") || importError.startsWith("Reading") || importError.startsWith("Loading") || importError.startsWith("Unzip") ? "var(--purple)" : "var(--red)", fontWeight: 600, maxWidth: 220 }}>{importError}</span>
            )}
            <input ref={fileInputRef} type="file" accept=".apkg,.txt,.tsv,.csv" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing}
              style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: importing ? "var(--bg)" : "var(--grad)", color: importing ? "var(--text-muted)" : "#fff", fontWeight: 700, fontSize: 13, cursor: importing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              {importing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Importing...</> : <><Upload size={14} /> Choose File</>}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Deck list */}
      {decks.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <Brain size={40} style={{ color: "var(--text-muted)", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>No flashcards yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>Import an Anki deck or add cards manually</div>
          <button onClick={() => setView("add")}
            style={{ padding: "11px 24px", borderRadius: 10, border: "none", cursor: "pointer", background: "var(--grad)", color: "#fff", fontWeight: 700, fontSize: 14 }}
          >
            Add First Card
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 }}>Your Decks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {deckStatsList.map(d => (
              <div key={d.name} className="card"
                style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: d.cardCount > 0 ? "pointer" : "default" }}
                onClick={d.cardCount > 0 ? () => startReview(d.name) : undefined}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{d.name}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
                    <span style={{ color: "var(--text-muted)" }}>{d.cardCount} cards</span>
                    {d.learnCount > 0 && <span style={{ color: "#3B82F6", fontWeight: 600 }}>● {d.learnCount} learning</span>}
                    {d.reviewCount > 0 && <span style={{ color: "var(--red)", fontWeight: 600 }}>● {d.reviewCount} review</span>}
                    {d.newCount > 0 && <span style={{ color: "var(--green)", fontWeight: 600 }}>● {d.newCount} new</span>}
                    {d.total === 0 && <span style={{ color: "var(--green)" }}>All caught up!</span>}
                  </div>
                </div>
                {d.cardCount > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); startReview(d.name); }}
                    style={{ padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer", background: "var(--grad)", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}
                  >
                    Study ({d.cardCount})
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
