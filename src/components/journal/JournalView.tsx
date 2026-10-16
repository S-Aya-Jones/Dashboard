"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Check, Trash2, Pencil, Flame, ChevronDown, Heart, NotebookPen } from "lucide-react";
import type { DashboardData, JournalEntry } from "@/types/dashboard";
import { useDictation } from "@/hooks/useDictation";
import {
  THEMES, THEME_BY_TAG, TAGS, TAG_LABEL, TAG_COLOR, SUNDAY_TEMPLATE,
  themeFor, promptFor, wordCount, journalStreak, sundayDone, recentCounts,
  type Tag,
} from "@/lib/journal";

// The journal.
//
// Voice-first, as the break plan asks: the mic is the primary button and the
// box below it is where the words land, editable, because dictation gets things
// wrong and an entry she can't correct is an entry she won't reread.
//
// The prompt is chosen for her rather than picked from a list. Left to choose
// she'd answer the comfortable themes and never the hard ones — which is the
// avoidance the first theme is about. It can still be swapped, just not by
// default.

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

type Mode = "journal" | "prayer";

function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function niceDate(iso: string) {
  const today = isoDate();
  if (iso === today) return "Today";
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === isoDate(y)) return "Yesterday";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function JournalView({ data, update }: Props) {
  const entries = useMemo(
    () => [...(data.journal ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.journal],
  );

  const [today, setToday] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("journal");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState<string | undefined>();
  const [tags, setTags] = useState<Tag[]>([]);
  const [spoken, setSpoken] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [filter, setFilter] = useState<Tag | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setToday(isoDate()); }, []);

  const appendSpoken = useCallback((chunk: string) => {
    setSpoken(true);
    setBody(prev => {
      if (!prev) return chunk.charAt(0).toUpperCase() + chunk.slice(1);
      const needsStop = /[a-z0-9,;:]$/i.test(prev.trimEnd());
      return prev + (needsStop ? ". " : /\s$/.test(prev) ? "" : " ") + chunk;
    });
  }, []);

  const dict = useDictation(appendSpoken);

  // Today's theme, chosen by what she's written least this week.
  const theme = useMemo(() => (today ? themeFor(entries, today) : null), [entries, today]);
  const todaysPrompt = useMemo(() => (theme && today ? promptFor(theme, today) : ""), [theme, today]);
  const counts = useMemo(() => (today ? recentCounts(entries, today) : null), [entries, today]);

  // Offer the theme's prompt on arrival, without pinning it — she can clear it.
  const [promptTouched, setPromptTouched] = useState(false);
  useEffect(() => {
    if (mode === "prayer" || promptTouched || editing) return;
    setPrompt(todaysPrompt || undefined);
    if (theme && !tags.length) setTags([theme.tag]);
    // Only when the day's theme resolves, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaysPrompt, mode, promptTouched, editing]);

  const streak = useMemo(
    () => (today ? journalStreak(entries.map(e => e.date), today) : 0),
    [entries, today],
  );
  const sundayPending = useMemo(
    () => (today && new Date(`${today}T12:00:00`).getDay() === 0 ? !sundayDone(entries, today) : false),
    [entries, today],
  );

  const words = wordCount(body);

  const reset = () => {
    setBody(""); setPrompt(undefined); setTags([]); setSpoken(false);
    setEditing(null); setPromptTouched(false);
  };

  const save = () => {
    const text = body.trim();
    if (!text || !today) return;
    if (dict.listening) dict.stop();

    update(d => {
      const list = [...(d.journal ?? [])];
      if (editing) {
        const i = list.findIndex(e => e.id === editing);
        if (i >= 0) list[i] = { ...list[i], body: text, prompt, tags, updatedAt: new Date().toISOString() };
      } else {
        list.push({
          id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date: today,
          createdAt: new Date().toISOString(),
          body: text,
          source: spoken ? "spoken" : "typed",
          kind: mode,
          ...(mode === "journal" && prompt ? { prompt } : {}),
          ...(tags.length ? { tags } : {}),
        } as JournalEntry);
      }
      return { ...d, journal: list };
    });

    reset();
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const startEdit = (e: JournalEntry) => {
    setMode((e.kind as Mode) ?? "journal");
    setEditing(e.id);
    setBody(e.body);
    setPrompt(e.prompt);
    setTags((e.tags ?? []) as Tag[]);
    setSpoken(e.source === "spoken");
    setPromptTouched(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = (id: string) => {
    update(d => ({ ...d, journal: (d.journal ?? []).filter(e => e.id !== id) }));
    setConfirmDelete(null);
    if (editing === id) reset();
  };

  const startSundayReview = () => {
    setMode("journal");
    setPromptTouched(true);
    setPrompt(undefined);
    setTags(["weekly"]);
    setBody(SUNDAY_TEMPLATE);
    boxRef.current?.focus();
  };

  const toggleTag = (t: Tag) =>
    setTags(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));

  if (!today) return null;

  const shown = filter ? entries.filter(e => (e.tags ?? []).includes(filter)) : entries;
  const isPrayer = mode === "prayer";

  return (
    <div className="space-y-4">
      {/* ── Sunday review, when it's owed ── */}
      {sundayPending && (
        <button onClick={startSundayReview}
          className="w-full text-left rounded-2xl p-4"
          style={{ background: "var(--surface)", border: "1.5px solid rgba(107,93,83,0.4)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            It&apos;s Sunday — the weekly review is waiting
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            What you avoided, what you faced, and the four numbers. Tap to start it filled in.
          </p>
        </button>
      )}

      {/* ── The entry ── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg)" }}>
            {(["journal", "prayer"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setPromptTouched(true); if (m === "prayer") setPrompt(undefined); }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all"
                style={mode === m
                  ? { background: m === "prayer" ? "#2E6FBF" : "var(--text)", color: "#fff" }
                  : { color: "var(--text-muted)" }}>
                {m === "prayer" ? <Heart size={12} /> : <NotebookPen size={12} />}
                {m === "prayer" ? "Prayer" : "Journal"}
              </button>
            ))}
          </div>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "#C0562A" }}>
              <Flame size={15} /> {streak} day{streak === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {editing && (
          <p className="text-[11px] mb-2" style={{ color: "var(--text-light)" }}>Editing an earlier entry</p>
        )}

        {isPrayer ? (
          <p className="text-sm mb-2.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            No prompts here. Be as honest with God as you&apos;ve been with a stranger this week —
            He can take it.
          </p>
        ) : prompt ? (
          <div className="mb-2.5">
            <p className="text-base font-semibold leading-snug" style={{ color: "var(--purple)" }}>{prompt}</p>
            <div className="flex items-center gap-2 mt-1">
              {theme && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: `${TAG_COLOR[theme.tag]}18`, color: TAG_COLOR[theme.tag] }}>
                  {theme.title}
                </span>
              )}
              <button onClick={() => { setPrompt(undefined); setPromptTouched(true); }}
                className="text-[11px] underline" style={{ color: "var(--text-light)" }}>
                blank page instead
              </button>
            </div>
            {theme?.intro && (
              <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{theme.intro}</p>
            )}
          </div>
        ) : null}

        {/* Mic first: the plan says voice-first, typing optional. */}
        {dict.supported && (
          <button
            onClick={() => (dict.listening ? dict.stop() : dict.start())}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold mb-2.5"
            style={dict.listening
              ? { background: "#C0562A", color: "#fff" }
              : { background: "var(--bg)", color: "var(--text)", border: "1.5px solid var(--border2)" }}>
            {dict.listening
              ? <><Square size={15} fill="#fff" /> Stop — {words} word{words === 1 ? "" : "s"}</>
              : <><Mic size={17} /> Talk it out</>}
          </button>
        )}

        <textarea
          ref={boxRef}
          value={body + (dict.interim ? (body && !/\s$/.test(body) ? " " : "") + dict.interim : "")}
          onChange={e => { if (!dict.interim) setBody(e.target.value); }}
          placeholder={isPrayer ? "Say it however it comes." : "However it comes out. Nobody reads this but you."}
          rows={8}
          className="w-full text-base leading-relaxed rounded-xl px-3.5 py-3 resize-y"
          style={{
            background: "var(--bg)",
            border: `1.5px solid ${dict.listening ? "#C0562A" : "var(--border)"}`,
            color: "var(--text)", outline: "none", minHeight: 170,
          }}
        />

        <div className="flex items-center gap-2 flex-wrap mt-2.5">
          <span className="text-xs tabular-nums" style={{ color: "var(--text-light)" }}>
            {dict.listening ? "Listening — pauses are fine" : words > 0 ? `${words} word${words === 1 ? "" : "s"}` : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {(editing || body) && (
              <button onClick={reset} className="text-xs" style={{ color: "var(--text-light)" }}>clear</button>
            )}
            <button onClick={save} disabled={!body.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: isPrayer ? "#2E6FBF" : "var(--text)", color: isPrayer ? "#fff" : "var(--surface)" }}>
              <Check size={15} /> {editing ? "Save changes" : saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        {dict.error && <p className="text-xs mt-2" style={{ color: "#C0503C" }}>{dict.error}</p>}
        {!dict.supported && (
          <p className="text-xs mt-2" style={{ color: "var(--text-light)" }}>
            Dictation needs Safari on iPhone or Chrome. Typing works everywhere.
          </p>
        )}

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap mt-3.5 pt-3.5" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: "var(--text-light)" }}>
            About
          </span>
          {TAGS.map(t => (
            <button key={t} onClick={() => toggleTag(t)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
              style={tags.includes(t)
                ? { background: TAG_COLOR[t], color: "#fff" }
                : { background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              {TAG_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── The other themes, if today's isn't the one ── */}
      {!isPrayer && (
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <button onClick={() => setBrowse(v => !v)}
            className="w-full flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-light)" }}>
              Ask me something else
            </span>
            <ChevronDown size={13} style={{ color: "var(--text-light)", transform: browse ? "rotate(180deg)" : undefined, transition: "transform .18s" }} />
          </button>

          {browse && (
            <div className="mt-3 space-y-3">
              {THEMES.map(t => (
                <div key={t.tag}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold" style={{ color: TAG_COLOR[t.tag] }}>{t.title}</span>
                    {counts && (
                      <span className="text-[10px]" style={{ color: "var(--text-light)" }}>
                        {counts[t.tag] === 0 ? "not this week" : `${counts[t.tag]}× this week`}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {t.prompts.map(q => (
                      <button key={q}
                        onClick={() => {
                          setPrompt(q); setPromptTouched(true);
                          setTags(prev => (prev.includes(t.tag) ? prev : [...prev, t.tag]));
                          boxRef.current?.focus();
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="block w-full text-left text-sm px-3 py-2 rounded-xl"
                        style={{
                          background: prompt === q ? `${TAG_COLOR[t.tag]}14` : "var(--bg)",
                          color: prompt === q ? TAG_COLOR[t.tag] : "var(--text)",
                          fontWeight: prompt === q ? 600 : 400,
                        }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Everything written ── */}
      {entries.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2 px-1 flex-wrap">
            <h3 className="section-title">Everything you&apos;ve written</h3>
            <span className="text-[11px]" style={{ color: "var(--text-light)" }}>
              {shown.length} of {entries.length}
            </span>
          </div>

          <div className="flex gap-1.5 flex-wrap px-1">
            <button onClick={() => setFilter(null)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={filter === null
                ? { background: "var(--text)", color: "var(--surface)" }
                : { background: "var(--bg)", color: "var(--text-muted)" }}>
              all
            </button>
            {TAGS.filter(t => entries.some(e => (e.tags ?? []).includes(t))).map(t => (
              <button key={t} onClick={() => setFilter(filter === t ? null : t)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={filter === t
                  ? { background: TAG_COLOR[t], color: "#fff" }
                  : { background: "var(--bg)", color: "var(--text-muted)" }}>
                {TAG_LABEL[t]}
              </button>
            ))}
          </div>

          {shown.map(e => {
            const prayer = e.kind === "prayer";
            return (
              <article key={e.id} className="rounded-2xl p-4"
                style={{
                  background: "var(--surface)",
                  border: "1.5px solid var(--border)",
                  borderLeft: `4px solid ${prayer ? "#2E6FBF" : e.tags?.[0] ? TAG_COLOR[e.tags[0] as Tag] ?? "var(--border2)" : "var(--border2)"}`,
                }}>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                    {prayer && <Heart size={11} className="inline mr-1" style={{ color: "#2E6FBF" }} />}
                    {niceDate(e.date)}
                    <span className="font-normal" style={{ color: "var(--text-light)" }}>
                      {" · "}
                      {new Date(e.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {e.source === "spoken" ? " · spoken" : ""}
                      {e.updatedAt ? " · edited" : ""}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(e)} title="Edit" style={{ color: "var(--text-light)" }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setConfirmDelete(confirmDelete === e.id ? null : e.id)} title="Delete"
                      style={{ color: "var(--text-light)" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {e.prompt && (
                  <p className="text-[11px] font-semibold mt-1.5" style={{ color: "var(--purple)" }}>{e.prompt}</p>
                )}

                <p className="text-sm mt-1.5 leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                  {e.body}
                </p>

                {(e.tags?.length ?? 0) > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {(e.tags ?? []).map(t => (
                      <span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: `${TAG_COLOR[t as Tag] ?? "#8A7A66"}18`, color: TAG_COLOR[t as Tag] ?? "#8A7A66" }}>
                        {TAG_LABEL[t as Tag] ?? t}
                      </span>
                    ))}
                  </div>
                )}

                {confirmDelete === e.id && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--bg)" }}>
                    <span className="text-xs flex-1" style={{ color: "var(--text)" }}>Delete this? It doesn&apos;t come back.</span>
                    <button onClick={() => remove(e.id)} className="text-xs font-bold px-3 py-1 rounded-lg"
                      style={{ background: "#C0503C", color: "#fff" }}>Delete</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs" style={{ color: "var(--text-light)" }}>keep</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {entries.length === 0 && (
        <div className="rounded-2xl p-5 text-center" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nothing here yet. The first one is always the hardest and it never has to be good.
          </p>
        </div>
      )}
    </div>
  );
}
