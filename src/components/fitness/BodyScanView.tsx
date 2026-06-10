"use client";

import { useState, useRef } from "react";
import { Camera, ChevronDown, ChevronUp, RefreshCw, X, MessageSquare } from "lucide-react";

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
  goalBodyAssessment?: {
    goalType: string;
    feasibility: number; // 0-100
    feasibilityLabel: string; // "Very Achievable" | "Achievable" | "Challenging" | "Very Challenging"
    geneticNotes: string;
    timelineEstimate: string;
    calorieplan: {
      dailyCalories: number;
      protein: number;
      carbs: number;
      fats: number;
      deficit: number;
      notes: string;
    };
    workoutPlan: {
      daysPerWeek: number;
      focus: string;
      weeklyStructure: { day: string; focus: string; exercises: string[] }[];
      cardio: string;
      keyPrinciples: string[];
    };
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

function ResultCard({ analysis, thumbs, onReset, onChat }: { analysis: BodyAnalysis; thumbs: string[]; onReset: () => void; onChat: () => void }) {
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

      {/* Goal body type assessment */}
      {analysis.goalBodyAssessment && (() => {
        const g = analysis.goalBodyAssessment!;
        const feasColor = g.feasibility >= 75 ? GOLD : g.feasibility >= 50 ? PURPLE : g.feasibility >= 30 ? PEACH : ROSE;
        return (
          <div style={{ borderTop: "1px solid rgba(124,92,252,0.1)" }}>
            <Section title="Goal Body Assessment" icon="🎯" defaultOpen>
              {/* Feasibility */}
              <div className="rounded-xl p-3 space-y-2" style={{ background: `${feasColor}10`, border: `1px solid ${feasColor}30` }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold" style={{ color: feasColor }}>{g.feasibilityLabel}</p>
                  <p className="text-lg font-bold" style={{ color: feasColor }}>{g.feasibility}%</p>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.1)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${g.feasibility}%`, background: feasColor }} />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{g.geneticNotes}</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${feasColor}20`, color: feasColor }}>
                    ⏱ {g.timelineEstimate}
                  </span>
                </div>
              </div>

              {/* Calorie plan */}
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>📊 Your Calorie Plan</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(124,92,252,0.08)" }}>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Daily Calories</p>
                    <p className="text-xl font-bold" style={{ color: PURPLE }}>{g.calorieplan.dailyCalories}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/day</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(218,102,123,0.08)" }}>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Deficit</p>
                    <p className="text-xl font-bold" style={{ color: ROSE }}>{g.calorieplan.deficit > 0 ? `-${g.calorieplan.deficit}` : `+${Math.abs(g.calorieplan.deficit)}`}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/day</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { label: "Protein", val: g.calorieplan.protein, color: GOLD, unit: "g" },
                    { label: "Carbs", val: g.calorieplan.carbs, color: PURPLE, unit: "g" },
                    { label: "Fats", val: g.calorieplan.fats, color: PEACH, unit: "g" },
                  ].map(m => (
                    <div key={m.label} className="rounded-xl p-2 text-center" style={{ background: `${m.color}10` }}>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                      <p className="text-sm font-bold" style={{ color: m.color }}>{m.val}{m.unit}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{g.calorieplan.notes}</p>
              </div>

              {/* Workout plan */}
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>🏋️ Your Workout Plan</p>
                <div className="rounded-xl p-3 mb-2" style={{ background: "rgba(124,92,252,0.06)", border: "1px solid rgba(124,92,252,0.12)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold" style={{ color: PURPLE }}>{g.workoutPlan.daysPerWeek}x per week</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{g.workoutPlan.focus}</p>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Cardio: {g.workoutPlan.cardio}</p>
                </div>
                <div className="space-y-1.5 mb-2">
                  {g.workoutPlan.weeklyStructure.map((day, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="font-bold flex-shrink-0 w-8" style={{ color: PURPLE }}>{day.day}</span>
                      <span className="font-semibold flex-shrink-0" style={{ color: "var(--text)" }}>{day.focus}:</span>
                      <span style={{ color: "var(--text-muted)" }}>{day.exercises.join(", ")}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  {g.workoutPlan.keyPrinciples.map((p, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span style={{ color: PURPLE, flexShrink: 0 }}>→</span>
                      <span style={{ color: "var(--text-muted)" }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        );
      })()}

      <div className="p-4 space-y-3">
        <button onClick={onChat} className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: PURPLE, color: "#fff" }}>
          <MessageSquare size={16} /> Ask Aya About Your Results
        </button>
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
  const [goalPhoto, setGoalPhoto] = useState<string>("");
  const goalPhotoRef = useRef<HTMLInputElement | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<BodyAnalysis | null>(null);
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

    const filledSlots = SLOTS.filter(s => photos[s.key]);
    const images = filledSlots.map(s => {
      const dataUrl = photos[s.key]!;
      const [header, base64] = dataUrl.split(",");
      const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      return { imageBase64: base64, mimeType: mime, label: s.label };
    });

    // Append goal inspiration photo as a reference image (not user's body)
    if (goalPhoto) {
      const [header, base64] = goalPhoto.split(",");
      const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      images.push({ imageBase64: base64, mimeType: mime, label: "GOAL INSPIRATION (Reference Only — Not User's Body)" });
    }

    const thumbs = filledSlots.map(s => photos[s.key]!);

    try {
      const res = await fetch("/api/body/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, height, weight, goalBodyType: goalPhoto ? "custom-photo" : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Analysis failed — please try again.");
      const result: BodyAnalysis = json.analysis;
      setAnalysis(result);
      setActiveAnalysis(result);
      setResultThumbs(thumbs);
      setChatMessages([]);
      // No photo storage — scans are session-only, not tied to user profile
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e) || "Scan failed. Try again.";
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setPhotos({});
    setAnalysis(null);
    setActiveAnalysis(null);
    setResultThumbs([]);
    setError("");
    setShowChat(false);
    setChatMessages([]);
    setGoalPhoto("");
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !activeAnalysis) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user" as const, content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const res = await fetch("/api/body/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: activeAnalysis, userMessage: userMsg, conversationHistory: chatMessages }),
      });
      const json = await res.json();
      setChatMessages([...newMessages, { role: "assistant", content: json.message || "I couldn't respond. Try again." }]);
    } catch {
      setChatMessages([...newMessages, { role: "assistant", content: "Connection error. Try again." }]);
    } finally {
      setChatLoading(false);
    }
  };


  if (analysis) return (
    <>
      <ResultCard analysis={analysis} thumbs={resultThumbs} onReset={reset} onChat={() => setShowChat(true)} />

      {/* Chat modal */}
      {showChat && (
        <div className="fixed inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowChat(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 max-h-[85vh] flex flex-col"
            style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl" style={{ color: "var(--text)" }}>Ask Aya</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Ask anything about your body scan results</p>
              </div>
              <button onClick={() => setShowChat(false)} className="p-2 rounded-xl" style={{ color: "var(--text-light)" }}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              {chatMessages.length === 0 && (
                <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(124,92,252,0.06)", color: "var(--text-muted)" }}>
                  Hi! I&apos;ve reviewed your body scan. Ask me anything — about your score, roadmap, diet, training, or what to focus on first.
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`rounded-xl p-3 text-sm leading-relaxed ${m.role === "user" ? "ml-8" : "mr-8"}`}
                  style={{
                    background: m.role === "user" ? PURPLE : "rgba(124,92,252,0.06)",
                    color: m.role === "user" ? "#fff" : "var(--text)",
                  }}>
                  {m.content}
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-1 px-3 py-4">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: PURPLE, animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Ask about your results..."
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid rgba(124,92,252,0.2)" }}
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
                style={{ background: PURPLE, color: "#fff" }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">

      {/* Chat modal (also accessible from history) */}
      {showChat && activeAnalysis && (
        <div className="fixed inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowChat(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 max-h-[85vh] flex flex-col"
            style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl" style={{ color: "var(--text)" }}>Ask Aya</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Ask anything about your body scan results</p>
              </div>
              <button onClick={() => setShowChat(false)} className="p-2 rounded-xl" style={{ color: "var(--text-light)" }}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              {chatMessages.length === 0 && (
                <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(124,92,252,0.06)", color: "var(--text-muted)" }}>
                  Hi! I&apos;ve reviewed your body scan. Ask me anything — about your score, roadmap, diet, training, or what to focus on first.
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`rounded-xl p-3 text-sm leading-relaxed ${m.role === "user" ? "ml-8" : "mr-8"}`}
                  style={{
                    background: m.role === "user" ? PURPLE : "rgba(124,92,252,0.06)",
                    color: m.role === "user" ? "#fff" : "var(--text)",
                  }}>
                  {m.content}
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-1 px-3 py-4">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: PURPLE, animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Ask about your results..."
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid rgba(124,92,252,0.2)" }}
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
                style={{ background: PURPLE, color: "#fff" }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* Goal inspiration photo upload */}
        <div className="px-4 pb-3 space-y-2" style={{ borderTop: "1px solid rgba(124,92,252,0.08)" }}>
          <div className="pt-3">
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Goal body inspiration <span style={{ fontWeight: 400, color: "var(--text-light)" }}>(optional)</span></p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Upload a photo of a body you want to achieve — Aya will tell you how realistic it is for your genetics and build a plan.</p>
          </div>
          {goalPhoto ? (
            <div className="relative rounded-2xl overflow-hidden" style={{ maxHeight: 200 }}>
              <img src={goalPhoto} alt="Goal inspiration" className="w-full object-cover rounded-2xl" style={{ maxHeight: 200 }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-2xl" />
              <div className="absolute bottom-2 left-3 right-8">
                <p className="text-xs font-semibold text-white">Goal Inspiration</p>
                <p className="text-[10px] text-white/70">Aya will compare this to your body scan</p>
              </div>
              <button
                onClick={() => setGoalPhoto("")}
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.5)" }}>
                <X size={13} color="white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => goalPhotoRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
              style={{ background: "rgba(124,92,252,0.05)", border: "1.5px dashed rgba(124,92,252,0.2)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(124,92,252,0.1)" }}>
                <Camera size={17} style={{ color: PURPLE }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Upload inspiration photo</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>A celebrity, athlete, or any physique goal</p>
              </div>
            </button>
          )}
          <input
            ref={goalPhotoRef}
            type="file" accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => setGoalPhoto(ev.target?.result as string);
              reader.readAsDataURL(file);
              e.target.value = "";
            }}
          />
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
