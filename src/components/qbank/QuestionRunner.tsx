"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, GripVertical, PenLine } from "lucide-react";

export interface BankQuestion {
  id: string;
  lectureId: string | null;
  course: string;
  topic: string;
  format: string;
  difficulty: string;
  prompt: string;
  payload: Record<string, unknown>;
  answer: string;
  explanation: string;
}

const idxList = (s: string) => s.split(",").map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n));
const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();
const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export const FORMAT_LABEL: Record<string, string> = {
  mcq: "Single best answer",
  sata: "Select all that apply",
  order: "Put in order",
  match: "Matching",
  data: "Interpret the data",
  short: "Written answer",
  trace: "Draw / trace it",
};

/** One question, self-contained: renders by format, grades, reports the result. */
export function QuestionRunner({
  q, onResult, showNext, onNext,
}: {
  q: BankQuestion;
  onResult: (correct: boolean, chosenLabel: string) => void;
  showNext: boolean;
  onNext: () => void;
}) {
  const [graded, setGraded] = useState(false);
  const [correct, setCorrect] = useState(false);

  // format-specific state
  const [single, setSingle] = useState<number | null>(null);
  const [multi, setMulti] = useState<number[]>([]);
  const [seq, setSeq] = useState<number[]>([]);
  const [pairs, setPairs] = useState<Record<number, number>>({});
  const [written, setWritten] = useState("");
  const [revealed, setRevealed] = useState(false);

  const choices = (q.payload.choices as string[]) ?? [];
  const items = (q.payload.items as string[]) ?? [];
  const left = (q.payload.left as string[]) ?? [];
  const right = (q.payload.right as string[]) ?? [];
  const rubric = (q.payload.rubric as string[]) ?? [];
  const table = (q.payload.table as string) ?? "";

  function finish(isCorrect: boolean, label: string) {
    setCorrect(isCorrect);
    setGraded(true);
    onResult(isCorrect, label);
  }

  function gradeAuto() {
    if (q.format === "mcq" || q.format === "data") {
      if (single === null) return;
      const ok = single === parseInt(q.answer, 10);
      finish(ok, choices[single] ?? "");
    } else if (q.format === "sata") {
      const ok = sameSet(multi, idxList(q.answer));
      finish(ok, multi.map(i => choices[i]).join("; "));
    } else if (q.format === "order") {
      const ok = sameSeq(seq, idxList(q.answer));
      finish(ok, seq.map(i => items[i]).join(" → "));
    } else if (q.format === "match") {
      const key = idxList(q.answer);
      const ok = left.every((_, i) => pairs[i] === key[i]);
      finish(ok, left.map((l, i) => `${l}→${right[pairs[i]] ?? "?"}`).join("; "));
    }
  }

  const canSubmit =
    (q.format === "mcq" || q.format === "data") ? single !== null
    : q.format === "sata" ? multi.length > 0
    : q.format === "order" ? seq.length === items.length
    : q.format === "match" ? left.every((_, i) => pairs[i] !== undefined)
    : false;

  const selfGraded = q.format === "short" || q.format === "trace";

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
          style={{ background: "rgba(124,92,252,.12)", color: "var(--purple)" }}>
          {FORMAT_LABEL[q.format] ?? q.format}
        </span>
        {q.topic && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full"
            style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {q.topic}
          </span>
        )}
        {q.difficulty === "hard" && (
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
            style={{ background: "#ffe3d0", color: "#9a4a05" }}>hard</span>
        )}
      </div>

      <p className="font-semibold text-[15px] leading-relaxed mb-4" style={{ color: "var(--text)" }}>{q.prompt}</p>

      {table && (
        <pre className="text-xs mb-4 p-3 rounded-lg overflow-x-auto whitespace-pre"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "ui-monospace,monospace" }}>
          {table}
        </pre>
      )}

      {/* ── single choice ── */}
      {(q.format === "mcq" || q.format === "data") && (
        <div className="space-y-2.5">
          {choices.map((c, ci) => {
            const isAns = graded && ci === parseInt(q.answer, 10);
            const isWrongPick = graded && single === ci && !isAns;
            return (
              <motion.button key={ci} disabled={graded} onClick={() => setSingle(ci)}
                whileHover={!graded ? { x: 4 } : undefined}
                animate={isWrongPick ? { x: [0, -8, 8, -5, 5, 0] } : {}}
                className="w-full text-left px-4 py-3 rounded-xl text-sm flex items-start gap-2.5 leading-relaxed"
                style={{
                  background: isAns ? "rgba(43,179,163,.13)" : isWrongPick ? "rgba(220,60,60,.10)" : single === ci ? "rgba(124,92,252,.12)" : "var(--bg)",
                  border: `1.5px solid ${isAns ? "rgba(43,179,163,.6)" : isWrongPick ? "rgba(220,60,60,.45)" : single === ci ? "var(--purple)" : "var(--border)"}`,
                  color: "var(--text)",
                }}>
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                  style={{ background: isAns ? "#2bb3a3" : isWrongPick ? "#c0392b" : "var(--surface)",
                           color: isAns || isWrongPick ? "white" : "var(--text-muted)",
                           border: isAns || isWrongPick ? "none" : "1px solid var(--border)" }}>
                  {isAns ? <Check size={12} /> : isWrongPick ? <X size={12} /> : String.fromCharCode(65 + ci)}
                </span>
                <span>{c}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* ── select all that apply ── */}
      {q.format === "sata" && (
        <div className="space-y-2.5">
          {choices.map((c, ci) => {
            const key = idxList(q.answer);
            const picked = multi.includes(ci);
            const shouldBe = graded && key.includes(ci);
            const wrongPick = graded && picked && !key.includes(ci);
            return (
              <button key={ci} disabled={graded}
                onClick={() => setMulti(m => m.includes(ci) ? m.filter(x => x !== ci) : [...m, ci])}
                className="w-full text-left px-4 py-3 rounded-xl text-sm flex items-start gap-2.5 leading-relaxed"
                style={{
                  background: shouldBe ? "rgba(43,179,163,.13)" : wrongPick ? "rgba(220,60,60,.10)" : picked ? "rgba(124,92,252,.12)" : "var(--bg)",
                  border: `1.5px solid ${shouldBe ? "rgba(43,179,163,.6)" : wrongPick ? "rgba(220,60,60,.45)" : picked ? "var(--purple)" : "var(--border)"}`,
                  color: "var(--text)",
                }}>
                <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5"
                  style={{ background: picked || shouldBe ? (shouldBe ? "#2bb3a3" : wrongPick ? "#c0392b" : "var(--purple)") : "var(--surface)",
                           border: "1px solid var(--border)" }}>
                  {(picked || shouldBe) && <Check size={12} color="white" />}
                </span>
                <span>{c}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── ordering ── */}
      {q.format === "order" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Tap the steps in the correct order:
            </p>
            {items.map((it, ii) => {
              const pos = seq.indexOf(ii);
              return (
                <button key={ii} disabled={graded || pos !== -1}
                  onClick={() => setSeq(s => [...s, ii])}
                  className="w-full text-left px-4 py-2.5 rounded-xl text-sm flex items-center gap-2.5"
                  style={{
                    background: pos !== -1 ? "var(--surface)" : "var(--bg)",
                    border: "1.5px solid var(--border)", color: pos !== -1 ? "var(--text-muted)" : "var(--text)",
                    opacity: pos !== -1 ? 0.45 : 1,
                  }}>
                  <GripVertical size={14} style={{ color: "var(--text-muted)" }} />
                  {it}
                </button>
              );
            })}
          </div>
          {seq.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: "var(--bg)", border: "1.5px solid var(--purple)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold" style={{ color: "var(--purple)" }}>Your sequence</span>
                {!graded && (
                  <button onClick={() => setSeq([])} className="text-xs underline" style={{ color: "var(--text-muted)" }}>clear</button>
                )}
              </div>
              <ol className="space-y-1">
                {seq.map((ii, pos) => {
                  const key = idxList(q.answer);
                  const ok = graded && key[pos] === ii;
                  return (
                    <li key={pos} className="text-sm flex gap-2" style={{ color: "var(--text)" }}>
                      <span className="font-bold" style={{ color: graded ? (ok ? "#2bb3a3" : "#c0392b") : "var(--purple)" }}>
                        {pos + 1}.
                      </span>
                      {items[ii]}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {graded && (
            <div className="rounded-xl p-3" style={{ background: "rgba(43,179,163,.08)", border: "1px solid rgba(43,179,163,.3)" }}>
              <span className="text-xs font-bold" style={{ color: "#1e8a7e" }}>Correct order</span>
              <ol className="space-y-1 mt-1">
                {idxList(q.answer).map((ii, pos) => (
                  <li key={pos} className="text-sm" style={{ color: "var(--text)" }}>{pos + 1}. {items[ii]}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ── matching ── */}
      {q.format === "match" && (
        <div className="space-y-2.5">
          {left.map((l, li) => {
            const key = idxList(q.answer);
            const ok = graded && pairs[li] === key[li];
            return (
              <div key={li} className="flex flex-wrap items-center gap-2 rounded-xl p-3"
                style={{ background: "var(--bg)", border: `1.5px solid ${graded ? (ok ? "rgba(43,179,163,.5)" : "rgba(220,60,60,.4)") : "var(--border)"}` }}>
                <span className="text-sm font-semibold flex-1 min-w-[120px]" style={{ color: "var(--text)" }}>{l}</span>
                <select disabled={graded} value={pairs[li] ?? ""}
                  onChange={e => setPairs(p => ({ ...p, [li]: Number(e.target.value) }))}
                  className="rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[160px]"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  <option value="">choose…</option>
                  {right.map((r, ri) => <option key={ri} value={ri}>{r}</option>)}
                </select>
                {graded && !ok && (
                  <span className="text-xs w-full" style={{ color: "#c0392b" }}>
                    correct: {right[key[li]]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── written / trace ── */}
      {selfGraded && (
        <div className="space-y-3">
          {q.format === "trace" && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(124,92,252,.07)", color: "var(--text-muted)" }}>
              Sketch it on paper first, then write out what you drew — you&apos;ll compare against the model answer.
            </p>
          )}
          <textarea value={written} onChange={e => setWritten(e.target.value)} disabled={revealed}
            rows={q.format === "trace" ? 6 : 4} placeholder="Write your answer…"
            className="w-full rounded-xl px-3 py-2.5 text-sm leading-relaxed"
            style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }} />

          {!revealed ? (
            <button onClick={() => setRevealed(true)} disabled={!written.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-40"
              style={{ background: "var(--purple)" }}>
              <PenLine size={15} /> Reveal model answer &amp; rubric
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ background: "rgba(43,179,163,.07)", border: "1px solid rgba(43,179,163,.3)" }}>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#1e8a7e" }}>Model answer</span>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text)" }}>{q.answer}</p>
              </div>
              {rubric.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Did your answer include…
                  </span>
                  <ul className="mt-2 space-y-1.5">
                    {rubric.map((r, ri) => (
                      <li key={ri} className="text-sm flex gap-2" style={{ color: "var(--text)" }}>
                        <span style={{ color: "var(--purple)" }}>▢</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!graded && (
                <div className="flex gap-3">
                  <button onClick={() => finish(false, written.slice(0, 200))}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                    style={{ background: "rgba(220,60,60,.09)", border: "1.5px solid rgba(220,60,60,.35)", color: "#c0392b" }}>
                    Missed it
                  </button>
                  <button onClick={() => finish(true, written.slice(0, 200))}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white"
                    style={{ background: "#2bb3a3" }}>
                    Got it
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── submit / feedback ── */}
      {!selfGraded && !graded && (
        <button onClick={gradeAuto} disabled={!canSubmit}
          className="mt-5 w-full py-3 rounded-xl font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--purple)" }}>
          Check answer
        </button>
      )}

      <AnimatePresence>
        {graded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
            {q.explanation && (
              <div className="mt-4 rounded-xl px-4 py-3 text-sm leading-relaxed"
                style={{ background: correct ? "rgba(43,179,163,.08)" : "rgba(220,60,60,.06)",
                         border: `1px solid ${correct ? "rgba(43,179,163,.3)" : "rgba(220,60,60,.25)"}`,
                         color: "var(--text)" }}>
                <span className="font-bold" style={{ color: correct ? "#1e8a7e" : "#c0392b" }}>
                  {correct ? "Correct. " : "Not quite. "}
                </span>
                {q.explanation}
              </div>
            )}
            {showNext && (
              <button onClick={onNext} className="mt-4 w-full py-3 rounded-xl font-semibold text-white"
                style={{ background: "var(--purple)" }}>
                Next question →
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
