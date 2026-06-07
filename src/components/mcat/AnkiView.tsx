"use client";

import { useState, useEffect, useRef } from "react";
import {
  RotateCcw, Plus, Trash2, ChevronDown, ChevronUp,
  Brain, BookOpen, Check, X, Zap, Clock
} from "lucide-react";
import { Flashcard, FlashcardReviewLog, DashboardData } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { format, addDays, parseISO, isToday, isPast } from "date-fns";

// ── SM-2 Algorithm ──────────────────────────────────────────────────────────

function sm2Update(card: Flashcard, rating: 0 | 1 | 2 | 3): Partial<Flashcard> {
  let { interval, easeFactor, repetitions } = card;
  if (rating === 0) {
    interval = 1; repetitions = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (rating === 1) {
    interval = Math.max(1, Math.round(interval * 1.2));
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === 2) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions++;
  } else {
    if (repetitions === 0) interval = 4;
    else interval = Math.round(interval * easeFactor * 1.3);
    repetitions++;
    easeFactor = Math.min(3.0, easeFactor + 0.15);
  }
  const nextReview = format(addDays(new Date(), interval), "yyyy-MM-dd");
  return { interval, easeFactor, repetitions, nextReview, lastReview: format(new Date(), "yyyy-MM-dd") };
}

function previewInterval(card: Flashcard, rating: 0 | 1 | 2 | 3): string {
  const updated = sm2Update(card, rating);
  const days = updated.interval ?? 1;
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  const weeks = Math.round(days / 7);
  return `${weeks}w`;
}

// ── MCAT Subjects ───────────────────────────────────────────────────────────

const MCAT_SUBJECTS = [
  "Behavioral Sciences",
  "Biochemistry",
  "Biology",
  "Critical Analysis & Reasoning Skills",
  "General Chemistry",
  "Organic Chemistry",
  "Physics",
  "General",
];

// ── Types ───────────────────────────────────────────────────────────────────

type View = "home" | "review" | "add" | "browse";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function AnkiView({ data, update }: Props) {
  const flashcards = data.flashcards ?? [];

  // View state
  const [view, setView] = useState<View>("home");
  const [deckFilter, setDeckFilter] = useState<string | null>(null);

  // Review state
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
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

  // Computed
  const dueCards = flashcards.filter(c => {
    const d = parseISO(c.nextReview);
    return isToday(d) || isPast(d);
  });

  const decks = Array.from(new Set(flashcards.map(c => c.deck)));

  const deckStats = decks.map(d => ({
    name: d,
    total: flashcards.filter(c => c.deck === d).length,
    due: dueCards.filter(c => c.deck === d).length,
  }));

  function startReview(filter: string | null) {
    let queue = dueCards;
    if (filter) queue = queue.filter(c => c.deck === filter);
    // shuffle
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    setDeckFilter(filter);
    setReviewQueue(shuffled);
    setReviewIdx(0);
    setFlipped(false);
    setSessionCorrect(0);
    setSessionTotal(0);
    setReviewStart(Date.now());
    setView("review");
  }

  function flipCard() {
    if (flipped) return;
    setOpacity(0);
    setTimeout(() => {
      setFlipped(true);
      setOpacity(1);
    }, 150);
  }

  function handleRating(rating: 0 | 1 | 2 | 3) {
    const card = reviewQueue[reviewIdx];
    if (!card) return;

    const responseTimeMs = Date.now() - reviewStart;
    const updates = sm2Update(card, rating);

    const reviewLog: FlashcardReviewLog = {
      cardId: card.id,
      date: new Date().toISOString(),
      rating,
      responseTimeMs,
    };

    update(d => ({
      ...d,
      flashcards: (d.flashcards ?? []).map(c =>
        c.id === card.id ? { ...c, ...updates } : c
      ),
      flashcardReviews: [...(d.flashcardReviews ?? []), reviewLog],
    }));

    const newCorrect = sessionCorrect + (rating >= 2 ? 1 : 0);
    const newTotal = sessionTotal + 1;
    setSessionCorrect(newCorrect);
    setSessionTotal(newTotal);

    // Advance
    if (reviewIdx + 1 >= reviewQueue.length) {
      setReviewIdx(reviewIdx + 1); // signals completion
    } else {
      setOpacity(0);
      setTimeout(() => {
        setFlipped(false);
        setReviewIdx(reviewIdx + 1);
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
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      nextReview: format(new Date(), "yyyy-MM-dd"),
    };
    update(d => ({ ...d, flashcards: [...(d.flashcards ?? []), newCard] }));
    setFront("");
    setBack("");
    setTopic("");
    setTags("");
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
    update(d => ({
      ...d,
      flashcards: (d.flashcards ?? []).filter(c => c.id !== cardId),
    }));
  }

  function toggleExpand(cardId: string) {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (view === "review") {
    const done = reviewIdx >= reviewQueue.length;

    if (done) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "40px 0" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "var(--grad)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
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
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--green)" }}>
                {sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0}%
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Accuracy</div>
            </div>
          </div>
          <button
            onClick={() => setView("home")}
            style={{
              padding: "12px 32px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "var(--grad)", color: "#fff", fontWeight: 700, fontSize: 16,
            }}
          >
            Back to Home
          </button>
        </div>
      );
    }

    const card = reviewQueue[reviewIdx];

    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button
            onClick={() => setView("home")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}
          >
            <X size={16} /> Exit
          </button>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
            {sessionCorrect} correct / {sessionTotal} reviewed
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 6, background: "var(--border)", marginBottom: 24, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            borderRadius: 6,
            background: "var(--grad)",
            width: `${(reviewIdx / reviewQueue.length) * 100}%`,
            transition: "width 0.3s ease",
          }} />
        </div>

        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginBottom: 16 }}>
          {reviewIdx + 1} / {reviewQueue.length}
          {card.deck && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 20, background: "rgba(124,92,252,0.08)", color: "var(--purple)", fontWeight: 600 }}>{card.deck}</span>}
        </div>

        {/* Flashcard */}
        <div
          onClick={!flipped ? flipCard : undefined}
          style={{
            background: "var(--surface)",
            borderRadius: 20,
            boxShadow: "var(--shadow)",
            padding: "40px 36px",
            minHeight: 220,
            cursor: flipped ? "default" : "pointer",
            position: "relative",
            opacity,
            transition: "opacity 0.15s ease",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            textAlign: "center",
          }}
        >
          {!flipped ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--text-light)", textTransform: "uppercase", marginBottom: 8 }}>
                Question
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", lineHeight: 1.5 }}>
                {card.front}
              </div>
              <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13 }}>
                <ChevronDown size={16} />
                Click to reveal answer
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--green)", textTransform: "uppercase", marginBottom: 8 }}>
                Answer
              </div>
              <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text)", lineHeight: 1.6 }}>
                {card.back}
              </div>
              {(card.subject || card.topic) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 16 }}>
                  {card.subject && (
                    <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(124,92,252,0.08)", color: "var(--purple)", fontSize: 12, fontWeight: 600 }}>
                      {card.subject}
                    </span>
                  )}
                  {card.topic && (
                    <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(232,121,249,0.08)", color: "var(--pink)", fontSize: 12, fontWeight: 600 }}>
                      {card.topic}
                    </span>
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
              { rating: 1 as const, label: "Hard", color: "var(--amber)", bg: "rgba(245,158,11,0.08)" },
              { rating: 2 as const, label: "Good", color: "var(--purple)", bg: "rgba(124,92,252,0.08)" },
              { rating: 3 as const, label: "Easy", color: "var(--green)", bg: "rgba(16,185,129,0.08)" },
            ] as const).map(({ rating, label, color, bg }) => (
              <button
                key={rating}
                onClick={() => handleRating(rating)}
                style={{
                  padding: "14px 8px",
                  borderRadius: 14,
                  border: `2px solid ${color}`,
                  background: bg,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
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

  if (view === "add") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 0 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Add Flashcard</h2>
          <button
            onClick={() => setView("home")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}
          >
            <X size={16} /> Cancel
          </button>
        </div>

        <div className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Front */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Front (Question / Prompt)
            </label>
            <textarea
              value={front}
              onChange={e => setFront(e.target.value)}
              placeholder="What is the Henderson-Hasselbalch equation?"
              rows={3}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 15,
                border: "1.5px solid var(--border)", background: "var(--bg)",
                color: "var(--text)", resize: "vertical", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Back */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Back (Answer / Explanation)
            </label>
            <textarea
              value={back}
              onChange={e => setBack(e.target.value)}
              placeholder="pH = pKa + log([A⁻]/[HA])"
              rows={4}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 15,
                border: "1.5px solid var(--border)", background: "var(--bg)",
                color: "var(--text)", resize: "vertical", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Deck + Subject row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Deck</label>
              <input
                value={deck}
                onChange={e => setDeck(e.target.value)}
                placeholder="MCAT"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                  border: "1.5px solid var(--border)", background: "var(--bg)",
                  color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Subject</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                  border: "1.5px solid var(--border)", background: "var(--bg)",
                  color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box",
                }}
              >
                {MCAT_SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Topic + Tags row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Topic</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Acid-Base Chemistry"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                  border: "1.5px solid var(--border)", background: "var(--bg)",
                  color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Tags (comma-separated)</label>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="pH, buffer, chemistry"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                  border: "1.5px solid var(--border)", background: "var(--bg)",
                  color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button
              onClick={saveCard}
              disabled={!front.trim() || !back.trim()}
              style={{
                flex: 1, padding: "13px", borderRadius: 12, border: "none", cursor: "pointer",
                background: "var(--grad)", color: "#fff", fontWeight: 700, fontSize: 15,
                opacity: !front.trim() || !back.trim() ? 0.5 : 1,
              }}
            >
              Save Card
            </button>
          </div>
        </div>

        {/* AI Generation Panel */}
        <div className="card" style={{ padding: 24, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Zap size={18} style={{ color: "var(--purple)" }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Generate with AI</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
            Set a subject and topic above, then generate multiple cards at once.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Number of cards</label>
              <input
                type="number"
                min={1}
                max={20}
                value={genCount}
                onChange={e => setGenCount(parseInt(e.target.value) || 3)}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 14,
                  border: "1.5px solid var(--border)", background: "var(--bg)",
                  color: "var(--text)", boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={generateWithAI}
              disabled={generating || !topic.trim()}
              style={{
                padding: "9px 20px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "rgba(124,92,252,0.1)", color: "var(--purple)",
                fontWeight: 700, fontSize: 14, alignSelf: "flex-end", marginBottom: 0,
                opacity: generating || !topic.trim() ? 0.5 : 1,
              }}
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "browse") {
    const browseDecks = Array.from(new Set(filteredCards.map(c => c.deck)));

    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 0 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Browse Cards</h2>
          <button
            onClick={() => setView("home")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}
          >
            <X size={16} /> Close
          </button>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search cards..."
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 15,
            border: "1.5px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box",
            marginBottom: 20, boxShadow: "var(--shadow)",
          }}
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
                {deckName} <span style={{ color: "var(--text-light)" }}>({cards.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map(c => {
                  const expanded = expandedCards.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className="card"
                      style={{ padding: "14px 18px", cursor: "pointer" }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
                        onClick={() => toggleExpand(c.id)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>
                            {c.front}
                          </div>
                          {!expanded && (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                              {c.back}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: "var(--text-light)" }}>
                            Next: {c.nextReview}
                          </span>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(124,92,252,0.08)", color: "var(--purple)" }}>
                            {c.interval}d
                          </span>
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
                            <button
                              onClick={e => { e.stopPropagation(); deleteCard(c.id); }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: "4px", display: "flex", alignItems: "center" }}
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

  // ── Home View ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Brain size={26} style={{ color: "var(--purple)" }} />
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", margin: 0 }}>Flashcards</h1>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
          Spaced repetition for MCAT mastery
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Total Cards", value: flashcards.length, icon: <BookOpen size={18} />, color: "var(--purple)" },
          { label: "Due Today", value: dueCards.length, icon: <Clock size={18} />, color: dueCards.length > 0 ? "var(--red)" : "var(--green)" },
          { label: "Decks", value: decks.length, icon: <Brain size={18} />, color: "var(--pink)" },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: "18px 20px", textAlign: "center" }}>
            <div style={{ color: stat.color, display: "flex", justifyContent: "center", marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => startReview(null)}
          disabled={dueCards.length === 0}
          style={{
            flex: 1, padding: "13px", borderRadius: 12, border: "none", cursor: "pointer",
            background: dueCards.length > 0 ? "var(--grad)" : "var(--bg)",
            color: dueCards.length > 0 ? "#fff" : "var(--text-muted)",
            fontWeight: 700, fontSize: 15,
            boxShadow: dueCards.length > 0 ? "0 2px 12px rgba(124,92,252,0.3)" : "none",
          }}
        >
          Review All Due ({dueCards.length})
        </button>
        <button
          onClick={() => setView("add")}
          style={{
            padding: "13px 20px", borderRadius: 12, border: "1.5px solid var(--border)",
            background: "var(--surface)", color: "var(--purple)", fontWeight: 700, fontSize: 14,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <Plus size={16} /> Add Card
        </button>
        <button
          onClick={() => setView("browse")}
          style={{
            padding: "13px 20px", borderRadius: 12, border: "1.5px solid var(--border)",
            background: "var(--surface)", color: "var(--text-muted)", fontWeight: 700, fontSize: 14,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <BookOpen size={16} /> Browse
        </button>
      </div>

      {/* Deck list */}
      {decks.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <Brain size={40} style={{ color: "var(--text-light)", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>No flashcards yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
            Add your first card or generate them with AI
          </div>
          <button
            onClick={() => setView("add")}
            style={{
              padding: "11px 24px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "var(--grad)", color: "#fff", fontWeight: 700, fontSize: 14,
            }}
          >
            Add First Card
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Your Decks
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {deckStats.map(d => (
              <div
                key={d.name}
                className="card"
                style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: d.due > 0 ? "pointer" : "default" }}
                onClick={d.due > 0 ? () => startReview(d.name) : undefined}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{d.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {d.total} card{d.total !== 1 ? "s" : ""}
                    {d.due > 0 && (
                      <span style={{ marginLeft: 10, color: "var(--red)", fontWeight: 700 }}>
                        {d.due} due
                      </span>
                    )}
                    {d.due === 0 && d.total > 0 && (
                      <span style={{ marginLeft: 10, color: "var(--green)", fontWeight: 600 }}>
                        <Check size={12} style={{ display: "inline", verticalAlign: "middle" }} /> All reviewed
                      </span>
                    )}
                  </div>
                </div>
                {d.due > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); startReview(d.name); }}
                    style={{
                      padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: "var(--grad)", color: "#fff", fontWeight: 700, fontSize: 13,
                    }}
                  >
                    Study
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
