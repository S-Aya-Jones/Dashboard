"use client";

import { useState, useRef } from "react";
import { Camera, ChevronDown, ChevronUp, RefreshCw, X } from "lucide-react";

interface BodyAnalysis {
  bodyType: string;
  visualAssessment: string;
  bodyFatEstimate: { low: number; high: number; category: string; note: string };
  muscleDefinition: number;
  compositionScore: number;
  potentialScore: number;
  visibleMuscle: { group: string; development: string; note: string }[];
  posture?: string;
  strengths: string[];
  areas: string[];
  honestAssessment: string;
  protocol: { training: string[]; diet: string[]; recovery: string[] };
  roadmap: {
    thirtyDay: { focus: string; expectedChange: string; actions: string[] };
    ninetyDay: { focus: string; expectedChange: string; actions: string[] };
    sixMonth: { focus: string; expectedChange: string; actions: string[] };
  };
}

type SlotKey = "front" | "back" | "left" | "right";

const SLOTS: { key: SlotKey; label: string; hint: string; icon: string }[] = [
  { key: "front", label: "Front", hint: "Face camera, arms relaxed", icon: "▲" },
  { key: "back",  label: "Back",  hint: "Facing away from camera",  icon: "▽" },
  { key: "left",  label: "Left Side",  hint: "Turn 90° left",  icon: "◁" },
  { key: "right", label: "Right Side", hint: "Turn 90° right", icon: "▷" },
];

const PURPLE = "#9B7FFF";
const GOLD = "#E8C547";
const PEACH = "#E8A87C";
const ROSE = "#DA667B";

function Bar({ label, value, max = 10, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-xs font-bold" style={{ color }}>{value}{max === 10 ? "/10" : "%"}</p>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "rgba(124,92,252,0.1)" }}>
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = false }: { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[rgba(124,92,252,0.1)] last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
        <div className="flex items-center gap-2.5">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</span>
        </div>
        {open ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

const devColor = (d: string) =>
  d === "developed" ? GOLD : d === "average" ? PURPLE : PEACH;

function ResultCard({ analysis, thumbs, onReset }: { analysis: BodyAnalysis; thumbs: string[]; onReset: () => void }) {
  const scoreColor = analysis.compositionScore >= 8 ? GOLD : analysis.compositionScore >= 6 ? PURPLE : PEACH;
  const bfMid = ((analysis.bodyFatEstimate.low + analysis.bodyFatEstimate.high) / 2).toFixed(1);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
      {/* Header */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
        {/* Photo strip */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {thumbs.map((t, i) => (
            <img key={i} src={t} alt={`Angle ${i + 1}`} className="w-16 h-20 rounded-xl object-cover flex-shrink-0" />
          ))}
        </div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>BODY COMPOSITION SCAN</p>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,92,252,0.1)", color: PURPLE }}>{analysis.bodyType}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(124,92,252,0.06)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Body Fat</p>
            <p className="text-lg font-bold" style={{ color: PEACH }}>{bfMid}<span className="text-xs font-normal">%</span></p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{analysis.bodyFatEstimate.low}–{analysis.bodyFatEstimate.high}%</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(124,92,252,0.06)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Score</p>
            <p className="text-lg font-bold" style={{ color: scoreColor }}>{analysis.compositionScore}<span className="text-xs font-normal">/10</span></p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(124,92,252,0.06)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Muscle</p>
            <p className="text-lg font-bold" style={{ color: PURPLE }}>{analysis.muscleDefinition}<span className="text-xs font-normal">/10</span></p>
          </div>
        </div>
        <p className="text-xs mt-2 px-1" style={{ color: "var(--text-muted)" }}>{analysis.bodyFatEstimate.category} · {analysis.bodyFatEstimate.note}</p>
      </div>

      {/* Bars */}
      <div className="px-4 py-3 space-y-2.5" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
        <Bar label="Composition Score" value={analysis.compositionScore} color={scoreColor} />
        <Bar label="Muscle Definition" value={analysis.muscleDefinition} color={PURPLE} />
        <div>
          <div className="flex justify-between mb-1">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Potential</p>
            <p className="text-xs font-bold" style={{ color: GOLD }}>→ {analysis.potentialScore}/10</p>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: "rgba(124,92,252,0.1)" }}>
            <div className="h-full rounded-full" style={{ width: `${(analysis.potentialScore / 10) * 100}%`, background: `linear-gradient(90deg, ${scoreColor}, ${GOLD})` }} />
          </div>
        </div>
      </div>

      <Section title="Assessment" icon="◎" defaultOpen>
        <div className="p-3 rounded-xl mb-2" style={{ background: "rgba(218,102,123,0.06)", border: "1px solid rgba(218,102,123,0.15)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: ROSE }}>Honest Assessment</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{analysis.honestAssessment}</p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{analysis.visualAssessment}</p>
        {analysis.posture && (
          <div className="p-2.5 rounded-xl" style={{ background: "rgba(124,92,252,0.04)" }}>
            <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>Posture</p>
            <p className="text-xs" style={{ color: "var(--text)" }}>{analysis.posture}</p>
          </div>
        )}
      </Section>

      {analysis.visibleMuscle?.length > 0 && (
        <Section title="Muscle Groups" icon="◈">
          <div className="space-y-2">
            {analysis.visibleMuscle.map((m, i) => (
              <div key={i} className="flex items-start justify-between gap-3 p-2.5 rounded-xl" style={{ background: "rgba(124,92,252,0.04)" }}>
                <div className="flex-1">
                  <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{m.group}</p>
                  {m.note && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{m.note}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 capitalize font-medium"
                  style={{ background: `${devColor(m.development)}18`, color: devColor(m.development) }}>
                  {m.development}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Breakdown" icon="◇">
        {analysis.strengths?.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Strengths</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.strengths.map((s, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(232,197,71,0.1)", color: GOLD }}>{s}</span>
              ))}
            </div>
          </div>
        )}
        {analysis.areas?.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Focus Areas</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.areas.map((a, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(218,102,123,0.1)", color: ROSE }}>{a}</span>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Protocol" icon="▸">
        {analysis.protocol.training.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: PURPLE }}>Training</p>
            <ul className="space-y-1.5">
              {analysis.protocol.training.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}><span style={{ color: PURPLE, flexShrink: 0 }}>→</span>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {analysis.protocol.diet.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: GOLD }}>Diet</p>
            <ul className="space-y-1.5">
              {analysis.protocol.diet.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}><span style={{ color: GOLD, flexShrink: 0 }}>→</span>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {analysis.protocol.recovery.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: PEACH }}>Recovery</p>
            <ul className="space-y-1.5">
              {analysis.protocol.recovery.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}><span style={{ color: PEACH, flexShrink: 0 }}>→</span>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Roadmap" icon="◉">
        {[
          { label: "30 Days",  color: PURPLE, bg: "rgba(124,92,252,0.06)", border: "rgba(124,92,252,0.15)", data: analysis.roadmap.thirtyDay },
          { label: "90 Days",  color: PEACH,  bg: "rgba(232,168,124,0.06)", border: "rgba(232,168,124,0.15)", data: analysis.roadmap.ninetyDay },
          { label: "6 Months", color: GOLD,   bg: "rgba(232,197,71,0.06)", border: "rgba(232,197,71,0.15)", data: analysis.roadmap.sixMonth },
        ].map(({ label, color, bg, border, data }) => (
          <div key={label} className="rounded-xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="px-3 pt-3 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold" style={{ color }}>{label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{data.focus}</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{data.expectedChange}</p>
            </div>
            <ul className="px-3 py-2.5 space-y-1.5">
              {data.actions.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                  <span style={{ color, flexShrink: 0 }}>→</span>{a}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <div className="p-4 space-y-3">
        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          Visual AI estimate only. For accurate body fat %, use DEXA scan or hydrostatic weighing.
        </p>
        <div className="flex justify-center">
          <button onClick={onReset} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl"
            style={{ background: "rgba(124,92,252,0.08)", color: "var(--text-muted)" }}>
            <RefreshCw size={14} /> New Scan
          </button>
        </div>
      </div>
    </div>
  );
}

export function BodyScanView() {
  const [photos, setPhotos] = useState<Partial<Record<SlotKey, string>>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<BodyAnalysis | null>(null);
  const [resultThumbs, setResultThumbs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const fileRefs = useRef<Partial<Record<SlotKey, HTMLInputElement | null>>>({});

  const photoCount = Object.keys(photos).length;

  const handleFile = (slot: SlotKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPhotos(prev => ({ ...prev, [slot]: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const removePhoto = (slot: SlotKey) => {
    setPhotos(prev => { const n = { ...prev }; delete n[slot]; return n; });
  };

  const runScan = async () => {
    if (photoCount === 0) return;
    setAnalyzing(true);
    setError("");
    setAnalysis(null);

    const images = SLOTS
      .filter(s => photos[s.key])
      .map(s => {
        const dataUrl = photos[s.key]!;
        const [header, base64] = dataUrl.split(",");
        const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
        return { imageBase64: base64, mimeType: mime, label: s.label };
      });

    const thumbs = images.map((_, i) => photos[SLOTS.filter(s => photos[s.key])[i].key]!);

    try {
      const res = await fetch("/api/body/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, height, weight }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAnalysis(json.analysis);
      setResultThumbs(thumbs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setPhotos({});
    setAnalysis(null);
    setResultThumbs([]);
    setError("");
  };

  if (analysis) return <ResultCard analysis={analysis} thumbs={resultThumbs} onReset={reset} />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
        <div className="p-4" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>BODY COMPOSITION SCAN</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Add photos from multiple angles for the most accurate read. More angles = better analysis.</p>
        </div>

        {/* Optional context */}
        <div className="px-4 pt-3 pb-1 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Height (optional)</p>
            <input type="text" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 5'6&quot;"
              className="w-full text-xs px-3 py-2 rounded-xl outline-none"
              style={{ background: "rgba(124,92,252,0.06)", border: "1px solid rgba(124,92,252,0.12)", color: "var(--text)" }} />
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Weight (optional)</p>
            <input type="text" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 145 lbs"
              className="w-full text-xs px-3 py-2 rounded-xl outline-none"
              style={{ background: "rgba(124,92,252,0.06)", border: "1px solid rgba(124,92,252,0.12)", color: "var(--text)" }} />
          </div>
        </div>

        {/* Photo slots */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {SLOTS.map(slot => {
              const photo = photos[slot.key];
              return (
                <div key={slot.key}>
                  {photo ? (
                    <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "3/4" }}>
                      <img src={photo} alt={slot.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-3">
                        <p className="text-xs font-semibold text-white">{slot.label}</p>
                      </div>
                      <button
                        onClick={() => removePhoto(slot.key)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.5)" }}>
                        <X size={13} color="white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRefs.current[slot.key]?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl transition-colors"
                      style={{ aspectRatio: "3/4", background: "rgba(124,92,252,0.06)", border: "1.5px dashed rgba(124,92,252,0.25)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,92,252,0.1)" }}>
                        <Camera size={18} style={{ color: PURPLE }} />
                      </div>
                      <div className="text-center px-2">
                        <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{slot.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{slot.hint}</p>
                      </div>
                    </button>
                  )}
                  <input
                    ref={el => { fileRefs.current[slot.key] = el; }}
                    type="file" accept="image/*" capture="environment"
                    className="hidden"
                    onChange={handleFile(slot.key)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Analyze button */}
        <div className="px-4 pb-4">
          {photoCount === 0 && (
            <p className="text-xs text-center mb-3" style={{ color: "var(--text-muted)" }}>
              Add at least one photo to begin. Front + back + sides gives the best results.
            </p>
          )}
          {error && (
            <p className="text-xs text-center py-2 px-3 rounded-xl mb-3" style={{ background: "rgba(218,102,123,0.08)", color: ROSE }}>{error}</p>
          )}
          {analyzing ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: PURPLE, animationDelay: `${d}ms` }} />
                ))}
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Analyzing {photoCount} photo{photoCount > 1 ? "s" : ""}…</p>
            </div>
          ) : (
            <button
              onClick={runScan}
              disabled={photoCount === 0}
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-30 transition-all"
              style={{
                background: photoCount >= 3 ? PURPLE : photoCount >= 2 ? "rgba(124,92,252,0.5)" : "rgba(124,92,252,0.25)",
                color: photoCount > 0 ? "white" : "var(--text-muted)",
              }}>
              {photoCount === 0 ? "Add photos to begin" :
               photoCount === 1 ? `Analyze 1 photo (add more for accuracy)` :
               photoCount < 4 ? `Analyze ${photoCount} photos — add ${4 - photoCount} more for full scan` :
               "Analyze All 4 Angles"}
            </button>
          )}
          {photoCount > 0 && photoCount < 4 && !analyzing && (
            <p className="text-xs text-center mt-2" style={{ color: "var(--text-muted)" }}>
              {4 - photoCount} angle{4 - photoCount > 1 ? "s" : ""} missing — more photos = more accurate body fat estimate
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
