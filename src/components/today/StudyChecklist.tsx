"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

// The foundations checklist.
//
// Read-only on purpose. A topic closes when a quiz score says so, which
// happens by text — a tick box here would be a second way to mark something
// done, and the two would disagree within a week.

interface Topic { index: number; title: string; done: boolean; score: string | null }
interface Payload { topics: Topic[]; doneCount: number; total: number; next: { index: number; title: string } | null }

export function StudyChecklist() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch("/api/study", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;
  const pct = (data.doneCount / data.total) * 100;

  return (
    <div className="rounded-2xl p-4 md:p-5 mb-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="section-title">Foundations</h3>
        <span className="text-[11px] tabular-nums" style={{ color: "var(--text-light)" }}>
          {data.doneCount} of {data.total}
        </span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--surface2)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#0F8A55", borderRadius: 4, transition: "width .3s" }} />
      </div>

      <div className="space-y-0.5">
        {data.topics.map(t => {
          const isNext = data.next?.index === t.index;
          return (
            <div key={t.index} className="flex items-start gap-2.5 px-2 py-1 rounded-lg"
              style={{ background: isNext ? "rgba(180,85,47,0.07)" : undefined }}>
              <span className="flex items-center justify-center flex-shrink-0 rounded mt-0.5"
                style={{
                  width: 15, height: 15,
                  background: t.done ? "#0F8A55" : "transparent",
                  border: t.done ? "none" : `1.5px solid ${isNext ? "var(--purple)" : "var(--border2)"}`,
                }}>
                {t.done && <Check size={10} color="#fff" strokeWidth={3.5} />}
              </span>
              <span className="text-[13px] leading-snug"
                style={{
                  color: t.done ? "var(--text-light)" : isNext ? "var(--purple)" : "var(--text)",
                  textDecoration: t.done ? "line-through" : undefined,
                  fontWeight: isNext ? 600 : 400,
                }}>
                {t.title}
              </span>
              {t.score && (
                <span className="ml-auto text-[10px] tabular-nums flex-shrink-0" style={{ color: "var(--text-light)" }}>
                  {t.score}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {data.next
          ? "The next one goes out in Monday, Wednesday and Saturday's text. Reply with 5/6 or better and it ticks off."
          : "All eighteen done."}
      </p>
    </div>
  );
}
