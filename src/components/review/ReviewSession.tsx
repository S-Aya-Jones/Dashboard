"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trophy, RotateCcw, ChevronRight } from "lucide-react";
import type { Flashcard } from "@/types/dashboard";
import { previewInterval, schedule, RATING_LABEL, type Rating } from "@/lib/srs";

// The daily review.
//
// Her lecture flashcards existed as a pile per lecture that she flipped through
// and forgot. This is the part that makes them work: one queue across every
// course, each card carrying its own memory, so what she keeps missing comes
// back tomorrow and what she knows disappears for a month.
//
// Answers post as she goes rather than at the end, because the realistic
// session is four minutes in a car park before work and it has to survive
// being closed mid-deck.

interface DeckCard extends Flashcard {
  lectureId: string;
  cardIndex: number;
  course: string;
  lectureTitle: string;
}

interface Payload {
  counts: { new: number; learning: number; review: number; total: number };
  deckSize: number;
  streak: number;
  reviewedToday: number;
  queue: DeckCard[];
}

const RATING_COLOR: Record<Rating, string> = {
  0: "#C0503C", 1: "#C97A52", 2: "#2E6FBF", 3: "#0F8A55",
};

/** A round number to aim at. Gizmo's whole trick is that the goal is small. */
const DAILY_GOAL = 20;

export function ReviewSession() {
  const [data, setData] = useState<Payload | null>(null);
  const [queue, setQueue] = useState<DeckCard[]>([]);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [again, setAgain] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/review", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErr(d.error); return; }
        setData(d);
        setQueue(d.queue ?? []);
      })
      .catch(() => setErr("Couldn't load your cards."));
  }, []);

  useEffect(() => { load(); }, [load]);

  const card = queue[0];

  const answer = useCallback(async (rating: Rating) => {
    if (!card) return;
    const next = { ...card, ...schedule(card, rating) } as DeckCard;

    // Move on immediately; the write happens behind her.
    setQueue(q => {
      const rest = q.slice(1);
      // A card in learning or relearning comes back this session, a few cards
      // later — that is what makes "Again" mean something.
      //
      // Not isDue(): "Again" schedules it a minute out, so isDue is false the
      // instant it's graded and the card silently left the session. She'd have
      // pressed "Again" on something she'd just failed and never seen it
      // again that day, which is the opposite of what the button says.
      const stillLearning = next.state === "learning" || next.state === "relearning";
      return stillLearning ? [...rest.slice(0, 2), next, ...rest.slice(2)] : rest;
    });
    setShown(false);
    setDone(d => d + 1);
    if (rating === 0) setAgain(a => a + 1);

    fetch("/api/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: card.id, rating, card }),
    }).catch(() => { /* the next load reconciles */ });
  }, [card]);

  // Keyboard, for when she's at a desk: space reveals, 1–4 grade.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.code === "Space") { e.preventDefault(); setShown(s => !s); return; }
      if (!shown) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) { e.preventDefault(); answer((n - 1) as Rating); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, shown, answer]);

  if (err) {
    return <Shell><p className="text-sm" style={{ color: "var(--text-muted)" }}>{err}</p></Shell>;
  }
  if (!data) {
    return <Shell><p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading your cards…</p></Shell>;
  }
  if (!data.deckSize) {
    return (
      <Shell>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>No cards yet.</p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Cards come from your lectures — process one in Lecture Studio and its flashcards land
          here automatically, on their own schedule.
        </p>
      </Shell>
    );
  }

  // ── Nothing due ──
  if (!card) {
    const total = data.reviewedToday + done;
    return (
      <Shell>
        <div className="text-center py-6">
          <Trophy size={44} style={{ color: "#C9A227" }} className="mx-auto mb-3" />
          <h3 className="font-serif text-2xl" style={{ color: "var(--text)" }}>
            {done > 0 ? "Done for today" : "Nothing due right now"}
          </h3>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {done > 0
              ? `${done} card${done === 1 ? "" : "s"} this session${again > 0 ? `, ${again} you'll see again soon` : ""}.`
              : `All ${data.deckSize} cards are scheduled ahead. Come back tomorrow.`}
          </p>
          {total > 0 && (
            <p className="text-xs mt-3" style={{ color: "var(--text-light)" }}>
              {total} answered today · {data.streak + (data.reviewedToday === 0 && done > 0 ? 1 : 0)} day streak
            </p>
          )}
          <button onClick={() => { setDone(0); setAgain(0); load(); }}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--bg)", color: "var(--text)", border: "1.5px solid var(--border)" }}>
            <RotateCcw size={14} /> Check again
          </button>
        </div>
      </Shell>
    );
  }

  const goalPct = Math.min(100, ((data.reviewedToday + done) / DAILY_GOAL) * 100);

  return (
    <div className="space-y-3">
      {/* Where she is */}
      <div className="rounded-2xl px-4 py-3" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-3 flex-wrap">
          {data.streak > 0 && (
            <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "#C0562A" }}>
              <Flame size={15} /> {data.streak}
            </span>
          )}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {queue.length} left · {data.reviewedToday + done} today
          </span>
          <div className="flex gap-2 ml-auto text-[11px] font-semibold">
            <span style={{ color: "#C0503C" }}>{data.counts.learning} learning</span>
            <span style={{ color: "#2E6FBF" }}>{data.counts.review} review</span>
            <span style={{ color: "var(--text-light)" }}>{data.counts.new} new</span>
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
          <div style={{ width: `${goalPct}%`, height: "100%", background: "#0F8A55", borderRadius: 4, transition: "width .25s" }} />
        </div>
      </div>

      {/* The card */}
      <div className="rounded-2xl p-5 md:p-7" style={{ background: "var(--surface)", border: "1.5px solid var(--border)", minHeight: 260 }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-light)" }}>
          {card.course}{card.lectureTitle ? ` · ${card.lectureTitle}` : ""}
          {card.state !== "new" && card.lapses > 0 && (
            <span style={{ color: "#C0503C" }}> · missed {card.lapses}×</span>
          )}
        </p>

        <AnimatePresence mode="wait">
          <motion.p key={card.id + "-front"}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-lg md:text-xl leading-relaxed font-medium"
            style={{ color: "var(--text)" }}>
            {card.front}
          </motion.p>
        </AnimatePresence>

        {shown && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-base leading-relaxed" style={{ color: "var(--text)" }}>{card.back}</p>
          </motion.div>
        )}
      </div>

      {/* Reveal, then grade */}
      {!shown ? (
        <button onClick={() => setShown(true)}
          className="w-full py-4 rounded-2xl text-base font-bold"
          style={{ background: "var(--text)", color: "var(--surface)" }}>
          Show answer
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {([0, 1, 2, 3] as Rating[]).map(r => (
            <button key={r} onClick={() => answer(r)}
              className="py-3 rounded-xl flex flex-col items-center gap-0.5"
              style={{ background: `${RATING_COLOR[r]}14`, border: `1.5px solid ${RATING_COLOR[r]}55` }}>
              <span className="text-sm font-bold" style={{ color: RATING_COLOR[r] }}>{RATING_LABEL[r]}</span>
              <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                {previewInterval(card, r)}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] text-center" style={{ color: "var(--text-light)" }}>
        Each button says when you&apos;ll see this card again. Space to flip, 1–4 to grade.
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      {children}
    </div>
  );
}

/** The strip that lives on the home page. */
export function ReviewCallout() {
  const [data, setData] = useState<Payload | null>(null);
  useEffect(() => {
    fetch("/api/review", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);

  if (!data?.counts.total) return null;

  return (
    <a href="/review" className="block rounded-2xl px-5 py-4 mb-4"
      style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-serif text-2xl" style={{ color: "var(--text)" }}>{data.counts.total}</span>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              card{data.counts.total === 1 ? "" : "s"} to review
            </span>
            {data.streak > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "#C0562A" }}>
                <Flame size={12} /> {data.streak}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {data.counts.learning} learning · {data.counts.review} due again · {data.counts.new} new
          </p>
        </div>
        <ChevronRight size={18} style={{ color: "var(--text-light)" }} />
      </div>
    </a>
  );
}
