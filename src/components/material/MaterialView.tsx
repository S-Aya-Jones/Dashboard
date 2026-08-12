"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Loader2, Trash2, FileText, Users, HelpCircle, BookOpen } from "lucide-react";
import { uploadMaterial, MaterialInput } from "@/lib/materialUpload";

// Study material her class shares.
//
// Everything else in the app is keyed to a lecture she recorded herself, which
// left no way in for a classmate's summary or someone's question set. This is
// course-scoped and carries who it came from, so the tutor can cite it and she
// can tell whose it was.

const COURSES = ["Physiology", "Biochemistry", "Microbiology", "Cell & Molecular Bio", "MCAT", "Other"];

const KINDS = [
  { id: "notes",     label: "Notes",       icon: FileText },
  { id: "questions", label: "Questions",   icon: HelpCircle },
  { id: "guide",     label: "Study guide", icon: BookOpen },
  { id: "other",     label: "Other",       icon: FileText },
] as const;

interface Item {
  id: string; course: string; title: string; source: string;
  kind: string; createdAt: string;
}

export function MaterialView() {
  const [items, setItems] = useState<Item[]>([]);
  const [course, setCourse] = useState(COURSES[1]);
  const [filter, setFilter] = useState<string>("");
  const [source, setSource] = useState("");
  const [kind, setKind] = useState<MaterialInput["kind"]>("notes");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/material${filter ? `?course=${encodeURIComponent(filter)}` : ""}`, { cache: "no-store" });
      const d = await res.json();
      setItems(d.material ?? []);
    } catch { /* the list is a convenience */ }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function onFiles(files: File[]) {
    if (!files.length) return;
    setErr(null);

    // A saved HTML page arrives as the document plus its images.
    const isImage = (f: File) => /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name);
    const docs = files.filter(f => !isImage(f));
    const loose = files.filter(isImage);

    for (const f of docs) {
      setBusy(f.name);
      try {
        await uploadMaterial(
          f,
          { course, title: f.name.replace(/\.[A-Za-z0-9]{1,5}$/, ""), source: source.trim(), kind },
          loose,
          stage => setBusy(`${f.name} — ${stage === "digesting" ? "reading it" : stage}`),
        );
      } catch (e) {
        setErr(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(null);
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/material?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div>
          <h1 className="font-serif text-2xl" style={{ color: "var(--text)" }}>Shared material</h1>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Notes, study guides and question sets from your class. Your tutor and your lessons use
            them alongside your own lectures — and are told to follow the lecture where the two
            disagree.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs block" style={{ color: "var(--text-muted)" }}>
            <span className="block mb-1">Course</span>
            <select value={course} onChange={e => setCourse(e.target.value)}>
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs block" style={{ color: "var(--text-muted)" }}>
            <span className="block mb-1">Who shared it</span>
            <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="a name, or leave blank" />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {KINDS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setKind(id)}
              className="text-xs font-semibold px-3 py-2 rounded-full inline-flex items-center gap-1.5"
              style={kind === id
                ? { background: "var(--text)", color: "var(--surface)" }
                : { background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,application/pdf,.pptx,.html,.htm,text/html,.txt,.md,image/*"
          className="hidden"
          onChange={e => { const f = Array.from(e.target.files ?? []); e.target.value = ""; onFiles(f); }}
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); onFiles(Array.from(e.dataTransfer.files ?? [])); }}
          className="w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-2 disabled:opacity-60"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {busy ? <Loader2 size={22} className="animate-spin" style={{ color: "var(--purple)" }} />
                : <Upload size={22} style={{ color: "var(--purple)" }} />}
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {busy ?? "Drop what they shared"}
          </span>
          <span className="text-xs">PDF, .pptx, HTML or text · an HTML page and its images together</span>
        </button>

        {err && <p className="text-xs" style={{ color: "var(--red)" }}>{err}</p>}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFilter("")}
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={!filter
            ? { background: "var(--text)", color: "var(--surface)" }
            : { background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          All
        </button>
        {COURSES.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={filter === c
              ? { background: "var(--text)", color: "var(--surface)" }
              : { background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {c}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nothing yet. Whatever your class is passing around goes here.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map(m => (
            <div key={m.id} className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
              <FileText size={15} style={{ color: "var(--purple)", flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{m.title}</p>
                <p className="text-xs" style={{ color: "var(--text-light)" }}>
                  {m.course} · {m.kind}
                  {m.source && <> · <Users size={10} className="inline" /> {m.source}</>}
                </p>
              </div>
              <button onClick={() => remove(m.id)} className="p-1.5 rounded-lg flex-shrink-0"
                style={{ color: "var(--text-light)" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
