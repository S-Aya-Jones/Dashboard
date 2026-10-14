"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";

// What the Sunday reset turned into.
//
// She answers four questions in one text and the numbers in it land here, so
// the week is a row of figures instead of a paragraph she has to re-read to
// find out whether savings went up.
//
// Read-only, like the foundations list. The way to change a number is to text
// it, because the only moment she knows it is the moment she is looking at the
// bank app on her phone.

interface Review {
  weekEnd: string;
  savings: number | null;
  drives: number | null;
  workouts: number | null;
  applications: number | null;
  avoided: string | null;
  faced: string | null;
  forSomeone: string | null;
  proudOf: string | null;
  raw: string;
}

function Figure({ label, value, delta }: { label: string; value: string; delta?: string | null }) {
  return (
    <div className="flex-1 min-w-[72px]">
      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-light)" }}>{label}</p>
      <p className="text-xl tabular-nums leading-tight" style={{ color: "var(--text)" }}>{value}</p>
      {delta && (
        <p className="text-[10px] tabular-nums" style={{ color: delta.startsWith("−") ? "var(--text-muted)" : "#0F8A55" }}>
          {delta}
        </p>
      )}
    </div>
  );
}

function Answer({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
      <span style={{ color: "var(--text-light)" }}>{label} </span>
      {text}
    </p>
  );
}

export function WeeklyReview() {
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    fetch("/api/weekly-review", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (!d.error) setReviews(d.reviews ?? []); })
      .catch(() => {});
  }, []);

  if (!reviews?.length) return null;

  const [latest, previous] = reviews;
  // A number she did not give is a blank, not a zero — the text message asks
  // for what was missing rather than this screen inventing it.
  const n = (v: number | null) => (v == null ? "—" : String(v));

  const savingsDelta =
    latest.savings != null && previous?.savings != null
      ? (latest.savings - previous.savings >= 0 ? "+" : "−") +
        `$${Math.abs(latest.savings - previous.savings).toLocaleString("en-US")}`
      : null;

  return (
    <div className="rounded-2xl p-4 md:p-5 mb-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="section-title">Week in review</h3>
        <span className="text-[11px]" style={{ color: "var(--text-light)" }}>
          {format(parseISO(latest.weekEnd), "MMM d")}
        </span>
      </div>

      <div className="flex gap-3 mb-3">
        <Figure
          label="Savings"
          value={latest.savings == null ? "—" : `$${latest.savings.toLocaleString("en-US")}`}
          delta={savingsDelta}
        />
        <Figure label="Drives" value={n(latest.drives)} />
        <Figure label="Workouts" value={n(latest.workouts)} />
        <Figure label="Applied" value={n(latest.applications)} />
      </div>

      <div className="space-y-1.5">
        <Answer label="Avoided:" text={latest.avoided} />
        <Answer label="Faced:" text={latest.faced} />
        <Answer label="For someone else:" text={latest.forSomeone} />
        <Answer label="Proud of:" text={latest.proudOf} />
      </div>

      <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        From Sunday&rsquo;s text. Reply to it however it comes out — the whole thing goes in your journal and the numbers come here.
      </p>
    </div>
  );
}
