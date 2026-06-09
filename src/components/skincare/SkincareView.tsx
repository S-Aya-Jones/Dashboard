"use client";

import { useState, useRef } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Sparkles, Camera, ChevronDown, ChevronUp, RefreshCw, Send } from "lucide-react";
import { DashboardData, SkincareProduct } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { today as todayStr, id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

interface SurgicalProcedure {
  name: string;
  impact: string;
  cost: string;
  timing: string;
}

interface Analysis {
  skinScore: number;
  overallRating: number;
  apparentAge: { estimated: number; note: string };
  skinAssessment: {
    summary: string;
    texture: string;
    hydration: string;
    concerns: string[];
    strengths: string[];
  };
  featureAnalysis: {
    summary: string;
    faceShape: string;
    harmony: string;
    standouts: string[];
    areas: string[];
  };
  hairstyleAnalysis: {
    currentStyle: string;
    suitsFaceShape: boolean;
    suitabilityNote: string;
    recommendedStyles: { name: string; why: string }[];
    colorRecommendations: string[];
    stylingTips: string[];
    avoid: string[];
  };
  protocol: {
    immediate: string[];
    routineAdjustments: string[];
    lifestyle: string[];
    treatments: string[];
  };
  surgicalConsiderations?: {
    highYield: SurgicalProcedure[];
    longTerm: SurgicalProcedure[];
    notRecommended: string[];
  };
  roadmap: {
    honestAssessment: string;
    currentRating: number;
    potentialRating: number;
    absoluteCeiling?: number;
    thirtyDay: { focus: string; expectedChange: string; actions: string[] };
    ninetyDay: { focus: string; expectedChange: string; actions: string[] };
    sixMonth: { focus: string; expectedChange: string; actions: string[] };
  };
}

const GOLD = "#E8C547";
const GOLD_BG = "rgba(232,197,71,0.06)";
const GOLD_BG_LIGHT = "rgba(232,197,71,0.04)";
const GOLD_BORDER = "rgba(232,197,71,0.15)";
const GOLD_PILL_BG = "rgba(232,197,71,0.1)";

function Section({ title, icon, children, defaultOpen = false }: { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[rgba(124,92,252,0.1)] last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left">
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

function Pill({ text, variant }: { text: string; variant: "concern" | "strength" | "action" }) {
  const styles = {
    concern: { background: "rgba(218,102,123,0.1)", color: "#DA667B" },
    strength: { background: GOLD_PILL_BG, color: GOLD },
    action: { background: "rgba(124,92,252,0.1)", color: "#9B7FFF" },
  };
  return (
    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium mr-1.5 mb-1.5" style={styles[variant]}>
      {text}
    </span>
  );
}

function RatingBar({ label, value, max = 10, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-xs font-bold" style={{ color }}>{value}{max === 10 ? "/10" : ""}</p>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "rgba(124,92,252,0.1)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function AnalysisCard({ analysis, photo, onReset }: { analysis: Analysis; photo: string; onReset: () => void }) {
  const [qaInput, setQaInput] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaHistory, setQaHistory] = useState<{ question: string; answer: string }[]>([]);

  const ratingColor = analysis.overallRating >= 8 ? GOLD : analysis.overallRating >= 6 ? "#9B7FFF" : "#E8A87C";

  const askQuestion = async () => {
    if (!qaInput.trim() || qaLoading) return;
    const question = qaInput.trim();
    setQaInput("");
    setQaLoading(true);
    try {
      const res = await fetch("/api/skincare/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, analysis }),
      });
      const json = await res.json();
      setQaHistory(h => [...h, { question, answer: json.answer || json.error || "No response" }]);
    } catch {
      setQaHistory(h => [...h, { question, answer: "Failed to get answer — try again" }]);
    } finally {
      setQaLoading(false);
    }
  };

  const hasSurgical = analysis.surgicalConsiderations && (
    (analysis.surgicalConsiderations.highYield?.length ?? 0) > 0 ||
    (analysis.surgicalConsiderations.longTerm?.length ?? 0) > 0 ||
    (analysis.surgicalConsiderations.notRecommended?.length ?? 0) > 0
  );

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
      {/* Header */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
        <div className="flex items-center gap-4 mb-4">
          <img src={photo} alt="Analysis" className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>BEAUTY ANALYSIS</p>
            <p className="text-sm leading-snug" style={{ color: "var(--text)" }}>{analysis.skinAssessment.summary.slice(0, 90)}…</p>
          </div>
        </div>
        {/* Score row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(124,92,252,0.06)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Skin Score</p>
            <p className="text-xl font-bold" style={{ color: analysis.skinScore >= 75 ? GOLD : analysis.skinScore >= 50 ? "#E8A87C" : "#DA667B" }}>{analysis.skinScore}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(124,92,252,0.06)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Rating</p>
            <p className="text-xl font-bold" style={{ color: ratingColor }}>{analysis.overallRating}<span className="text-sm font-normal">/10</span></p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(124,92,252,0.06)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Looks</p>
            <p className="text-xl font-bold" style={{ color: "#9B7FFF" }}>{analysis.apparentAge.estimated}<span className="text-xs font-normal ml-0.5">yrs</span></p>
          </div>
        </div>
        {analysis.apparentAge.note && (
          <p className="text-xs mt-2 px-1" style={{ color: "var(--text-muted)" }}>{analysis.apparentAge.note}</p>
        )}
      </div>

      {/* Score bars */}
      <div className="px-4 py-3 space-y-2.5" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
        <RatingBar label="Overall Aesthetic" value={analysis.overallRating} color={ratingColor} />
        <RatingBar label="Skin Health" value={Math.round(analysis.skinScore / 10)} color="#9B7FFF" />
        <RatingBar label="Facial Harmony" value={analysis.featureAnalysis.standouts.length >= 3 ? 8 : analysis.featureAnalysis.standouts.length >= 2 ? 7 : 6} color="#E8A87C" />
      </div>

      {/* Introduction */}
      <Section title="Introduction" icon="✦" defaultOpen>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{analysis.skinAssessment.summary}</p>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="rounded-xl p-3" style={{ background: "rgba(124,92,252,0.05)" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Texture</p>
            <p className="text-xs" style={{ color: "var(--text)" }}>{analysis.skinAssessment.texture}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(124,92,252,0.05)" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Hydration</p>
            <p className="text-xs" style={{ color: "var(--text)" }}>{analysis.skinAssessment.hydration}</p>
          </div>
        </div>
      </Section>

      {/* Facial Assessments */}
      <Section title="Facial Assessments" icon="◈">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize"
            style={{ background: "rgba(124,92,252,0.1)", color: "#9B7FFF" }}>
            {analysis.featureAnalysis.faceShape} face
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{analysis.featureAnalysis.summary}</p>
        <div className="mt-2 p-3 rounded-xl" style={{ background: "rgba(124,92,252,0.05)" }}>
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Harmony</p>
          <p className="text-xs" style={{ color: "var(--text)" }}>{analysis.featureAnalysis.harmony}</p>
        </div>
      </Section>

      {/* Features Analysis */}
      <Section title="Features Analysis" icon="◇">
        {analysis.skinAssessment.strengths.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Strengths</p>
            <div>{analysis.skinAssessment.strengths.map((s, i) => <Pill key={i} text={s} variant="strength" />)}</div>
          </div>
        )}
        {analysis.skinAssessment.concerns.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Skin concerns</p>
            <div>{analysis.skinAssessment.concerns.map((c, i) => <Pill key={i} text={c} variant="concern" />)}</div>
          </div>
        )}
        {analysis.featureAnalysis.standouts.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Standout features</p>
            <div>{analysis.featureAnalysis.standouts.map((s, i) => <Pill key={i} text={s} variant="strength" />)}</div>
          </div>
        )}
        {analysis.featureAnalysis.areas.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Enhancement opportunities</p>
            <div>{analysis.featureAnalysis.areas.map((a, i) => <Pill key={i} text={a} variant="action" />)}</div>
          </div>
        )}
      </Section>

      {/* Hairstyle */}
      {analysis.hairstyleAnalysis && (
        <Section title="Hairstyle Analysis" icon="✂">
          <div className="p-3 rounded-xl mb-3" style={{ background: "rgba(124,92,252,0.05)" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Current style</p>
            <p className="text-xs" style={{ color: "var(--text)" }}>{analysis.hairstyleAnalysis.currentStyle}</p>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={analysis.hairstyleAnalysis.suitsFaceShape
                ? { background: GOLD_PILL_BG, color: GOLD }
                : { background: "rgba(232,168,124,0.1)", color: "#E8A87C" }}>
              {analysis.hairstyleAnalysis.suitsFaceShape ? "✓ Suits your face shape" : "⚠ Could be optimized"}
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--text)" }}>{analysis.hairstyleAnalysis.suitabilityNote}</p>

          {analysis.hairstyleAnalysis.recommendedStyles.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-2" style={{ color: GOLD }}>Recommended for your face shape</p>
              <div className="space-y-2">
                {analysis.hairstyleAnalysis.recommendedStyles.map((s, i) => (
                  <div key={i} className="p-2.5 rounded-xl" style={{ background: GOLD_BG_LIGHT, border: `1px solid ${GOLD_BORDER}` }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: GOLD }}>{s.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.hairstyleAnalysis.colorRecommendations.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-2" style={{ color: "#9B7FFF" }}>Color recommendations</p>
              <ul className="space-y-1">
                {analysis.hairstyleAnalysis.colorRecommendations.map((c, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                    <span style={{ color: "#9B7FFF" }}>→</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.hairstyleAnalysis.stylingTips.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-2" style={{ color: "#E8A87C" }}>Styling tips</p>
              <ul className="space-y-1">
                {analysis.hairstyleAnalysis.stylingTips.map((t, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                    <span style={{ color: "#E8A87C" }}>→</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.hairstyleAnalysis.avoid.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#DA667B" }}>Avoid</p>
              <ul className="space-y-1">
                {analysis.hairstyleAnalysis.avoid.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                    <span style={{ color: "#DA667B" }}>✕</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Surgical Considerations */}
      {hasSurgical && (
        <Section title="Surgical Considerations" icon="⚕">
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Procedures ranked by impact relative to your specific features. These are investment-level decisions — do your research and consult a board-certified surgeon.
          </p>

          {(analysis.surgicalConsiderations!.highYield?.length ?? 0) > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-2" style={{ color: GOLD }}>High-Yield Procedures</p>
              <div className="space-y-2">
                {analysis.surgicalConsiderations!.highYield.map((p, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ background: GOLD_BG, border: `1px solid ${GOLD_BORDER}` }}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-xs font-semibold" style={{ color: GOLD }}>{p.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium" style={{ background: GOLD_PILL_BG, color: GOLD }}>{p.cost}</span>
                    </div>
                    <p className="text-xs mb-1" style={{ color: "var(--text)" }}>{p.impact}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Timing: {p.timing}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(analysis.surgicalConsiderations!.longTerm?.length ?? 0) > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-2" style={{ color: "#9B7FFF" }}>Long-Term Investments</p>
              <div className="space-y-2">
                {analysis.surgicalConsiderations!.longTerm.map((p, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ background: "rgba(124,92,252,0.05)", border: "1px solid rgba(124,92,252,0.12)" }}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-xs font-semibold" style={{ color: "#9B7FFF" }}>{p.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium" style={{ background: "rgba(124,92,252,0.1)", color: "#9B7FFF" }}>{p.cost}</span>
                    </div>
                    <p className="text-xs mb-1" style={{ color: "var(--text)" }}>{p.impact}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Timing: {p.timing}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(analysis.surgicalConsiderations!.notRecommended?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#DA667B" }}>Not Recommended For You</p>
              <ul className="space-y-1.5">
                {analysis.surgicalConsiderations!.notRecommended.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                    <span style={{ color: "#DA667B", flexShrink: 0 }}>✕</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Beauty Roadmap */}
      {analysis.roadmap && (
        <Section title="Beauty Roadmap" icon="◎">
          {/* Honest assessment */}
          <div className="p-3 rounded-xl mb-4" style={{ background: "rgba(218,102,123,0.06)", border: "1px solid rgba(218,102,123,0.15)" }}>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#DA667B" }}>Honest Assessment</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{analysis.roadmap.honestAssessment}</p>
          </div>

          {/* Trajectory */}
          <div className="mb-4 p-3 rounded-xl" style={{ background: GOLD_BG_LIGHT, border: `1px solid ${GOLD_BORDER}` }}>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Your trajectory</p>
            {/* Natural ceiling bar */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold w-12 flex-shrink-0" style={{ color: "#DA667B" }}>{analysis.roadmap.currentRating}/10</span>
              <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(124,92,252,0.1)" }}>
                <div className="h-full rounded-full" style={{ width: `${(analysis.roadmap.potentialRating / 10) * 100}%`, background: `linear-gradient(90deg, #DA667B, ${GOLD})` }} />
              </div>
              <span className="text-lg font-bold w-12 flex-shrink-0 text-right" style={{ color: GOLD }}>{analysis.roadmap.potentialRating}/10</span>
            </div>
            <div className="flex justify-between mb-2">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Now</p>
              <p className="text-xs font-medium" style={{ color: GOLD }}>Natural ceiling</p>
            </div>
            {/* Surgical ceiling bar */}
            {analysis.roadmap.absoluteCeiling && analysis.roadmap.absoluteCeiling > analysis.roadmap.potentialRating && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold w-12 flex-shrink-0" style={{ color: GOLD }}>{analysis.roadmap.potentialRating}/10</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(124,92,252,0.1)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(analysis.roadmap.absoluteCeiling / 10) * 100}%`, background: `linear-gradient(90deg, ${GOLD}, #9B7FFF)` }} />
                  </div>
                  <span className="text-sm font-bold w-12 flex-shrink-0 text-right" style={{ color: "#9B7FFF" }}>{analysis.roadmap.absoluteCeiling}/10</span>
                </div>
                <div className="flex justify-between">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>With skincare</p>
                  <p className="text-xs font-medium" style={{ color: "#9B7FFF" }}>With procedures</p>
                </div>
              </>
            )}
          </div>

          {/* Timeline cards */}
          {[
            { key: "thirtyDay", label: "30 Days", color: "#9B7FFF", bg: "rgba(124,92,252,0.06)", border: "rgba(124,92,252,0.15)", data: analysis.roadmap.thirtyDay },
            { key: "ninetyDay", label: "90 Days", color: "#E8A87C", bg: "rgba(232,168,124,0.06)", border: "rgba(232,168,124,0.15)", data: analysis.roadmap.ninetyDay },
            { key: "sixMonth", label: "6 Months", color: GOLD, bg: GOLD_BG, border: GOLD_BORDER, data: analysis.roadmap.sixMonth },
          ].map(({ label, color, bg, border, data }) => (
            <div key={label} className="mb-3 rounded-xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="px-3 pt-3 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold" style={{ color }}>{label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>{data.focus}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{data.expectedChange}</p>
              </div>
              <ul className="px-3 py-2.5 space-y-1.5">
                {data.actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                    <span style={{ color, flexShrink: 0 }}>→</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {/* Protocol */}
      <Section title="Protocol" icon="▸">
        {analysis.protocol.immediate.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: GOLD }}>Immediate Actions</p>
            <ul className="space-y-1.5">
              {analysis.protocol.immediate.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                  <span style={{ color: "#9B7FFF" }}>→</span> {a}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.protocol.routineAdjustments.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "#9B7FFF" }}>Routine Adjustments</p>
            <ul className="space-y-1.5">
              {analysis.protocol.routineAdjustments.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                  <span style={{ color: "#9B7FFF" }}>→</span> {a}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.protocol.lifestyle.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "#E8A87C" }}>Lifestyle</p>
            <ul className="space-y-1.5">
              {analysis.protocol.lifestyle.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                  <span style={{ color: "#E8A87C" }}>→</span> {a}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.protocol.treatments.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "#DA667B" }}>Professional Treatments</p>
            <ul className="space-y-1.5">
              {analysis.protocol.treatments.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                  <span style={{ color: "#DA667B" }}>→</span> {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Ask a Question */}
      <Section title="Ask the Analyst" icon="💬">
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Ask anything about your results — specific concerns, whether a treatment makes sense, what to prioritize first.
        </p>
        {qaHistory.length > 0 && (
          <div className="space-y-4 mb-3">
            {qaHistory.map((qa, i) => (
              <div key={i} className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#9B7FFF" }}>You</span>
                  <p className="text-xs" style={{ color: "var(--text)" }}>{qa.question}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: "rgba(124,92,252,0.05)", border: "1px solid rgba(124,92,252,0.1)" }}>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{qa.answer}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={qaInput}
            onChange={e => setQaInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !qaLoading) askQuestion(); }}
            placeholder="e.g. Should I try retinol? What about lip fillers?"
            className="flex-1 text-xs px-3 py-2.5 rounded-xl outline-none"
            style={{ background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.15)", color: "var(--text)" }}
          />
          <button
            onClick={askQuestion}
            disabled={qaLoading || !qaInput.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-opacity disabled:opacity-40"
            style={{ background: "rgba(124,92,252,0.15)", color: "#9B7FFF" }}
          >
            {qaLoading ? (
              <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </Section>

      {/* Re-analyze */}
      <div className="p-4 flex justify-center" style={{ borderTop: "1px solid rgba(124,92,252,0.1)" }}>
        <button onClick={onReset} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl"
          style={{ background: "rgba(124,92,252,0.08)", color: "var(--text-muted)" }}>
          <RefreshCw size={14} /> New Analysis
        </button>
      </div>
    </div>
  );
}

export function SkincareView({ data, update }: Props) {
  const [productOpen, setProductOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [productForm, setProductForm] = useState<{ name: string; brand: string; routine: "am" | "pm" | "both"; isTesting: boolean; startDate: string; notes: string }>({ name: "", brand: "", routine: "am", isTesting: false, startDate: "", notes: "" });
  const [checkInForm, setCheckInForm] = useState({ breakouts: false, observations: "", changes: "" });

  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const today = todayStr();
  const amProducts = data.skincareProducts.filter((p) => p.routine === "am" || p.routine === "both").sort((a, b) => a.order - b.order);
  const pmProducts = data.skincareProducts.filter((p) => p.routine === "pm" || p.routine === "both").sort((a, b) => a.order - b.order);
  const testingProducts = data.skincareProducts.filter((p) => p.isTesting);

  const addProduct = () => {
    if (!productForm.name.trim()) return;
    const maxOrder = Math.max(0, ...data.skincareProducts.filter((p) => p.routine === productForm.routine).map((p) => p.order));
    update((d) => ({ ...d, skincareProducts: [...d.skincareProducts, { ...productForm, id: id(), order: maxOrder + 1 }] }));
    setProductForm({ name: "", brand: "", routine: "am", isTesting: false, startDate: "", notes: "" });
    setProductOpen(false);
  };

  const deleteProduct = (pid: string) => {
    update((d) => ({ ...d, skincareProducts: d.skincareProducts.filter((p) => p.id !== pid) }));
  };

  const addCheckIn = () => {
    if (!checkInForm.observations.trim()) return;
    update((d) => ({ ...d, skinCheckIns: [...d.skinCheckIns, { ...checkInForm, id: id(), date: today }] }));
    setCheckInForm({ breakouts: false, observations: "", changes: "" });
    setCheckInOpen(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64 = result.split(",")[1];
      setPhoto(result);
      runAnalysis(base64, file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = async (base64: string, mime: string) => {
    setAnalyzing(true);
    setAnalyzeError("");
    setAnalysis(null);
    try {
      const res = await fetch("/api/skincare/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: mime,
          products: data.skincareProducts,
          checkIns: data.skinCheckIns,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAnalysis(json.analysis);
    } catch (e: unknown) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setPhoto(null);
    setAnalysis(null);
    setAnalyzeError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const renderProductList = (products: SkincareProduct[], label: string) => (
    <div>
      <p className="text-sm font-semibold text-brown mb-3">{label}</p>
      <div className="space-y-2">
        {products.length === 0 ? (
          <p className="text-sand-dark text-sm">None added yet</p>
        ) : (
          products.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl group ${p.isTesting ? "bg-rose/10 border border-rose/20" : "bg-cream-dark"}`}>
              <span className="text-xs text-sand-dark w-5 text-center font-medium">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-brown font-medium">{p.name}</p>
                {p.brand && <p className="text-xs text-sand-dark">{p.brand}</p>}
                {p.isTesting && <p className="text-xs text-rose">🧪 Testing{p.startDate ? ` since ${format(parseISO(p.startDate), "MMM d")}` : ""}</p>}
                {p.notes && <p className="text-xs text-sand-dark italic">{p.notes}</p>}
              </div>
              <button onClick={() => deleteProduct(p.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose flex-shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Skincare</h1>
          <p className="text-sand-dark mt-1">Real data for your future dermatology practice</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCheckInOpen(true)}>
            <Sparkles size={14} className="mr-1.5 inline" /> Skin Check-in
          </Button>
          <Button onClick={() => setProductOpen(true)}>
            <Plus size={14} className="mr-1.5 inline" /> Add Product
          </Button>
        </div>
      </div>

      {/* Beauty Analysis */}
      {analysis && photo ? (
        <AnalysisCard analysis={analysis} photo={photo} onReset={resetAnalysis} />
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
          <div className="p-4" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>AI BEAUTY ANALYSIS</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Upload a clear selfie — skin assessment, feature analysis, surgical options & personalized protocol</p>
          </div>

          {!photo && !analyzing && (
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 py-10 transition-colors hover:bg-purple-50/10">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(124,92,252,0.1)", border: "1.5px dashed rgba(124,92,252,0.3)" }}>
                <Camera size={24} style={{ color: "#9B7FFF" }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Upload a selfie</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Best results with good lighting, face centered</p>
              </div>
            </button>
          )}

          {photo && analyzing && (
            <div className="flex flex-col items-center gap-4 py-10">
              <img src={photo} alt="Uploading" className="w-20 h-20 rounded-2xl object-cover opacity-60" />
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-2 h-2 rounded-full animate-bounce"
                      style={{ background: "#9B7FFF", animationDelay: `${d}ms` }} />
                  ))}
                </div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Analyzing your skin…</p>
              </div>
            </div>
          )}

          {analyzeError && (
            <div className="px-4 pb-4">
              <p className="text-xs text-center py-3 rounded-xl" style={{ background: "rgba(218,102,123,0.08)", color: "#DA667B" }}>{analyzeError}</p>
              <button onClick={resetAnalysis} className="w-full text-xs text-center mt-2" style={{ color: "var(--text-muted)" }}>Try again</button>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoSelect} />
        </div>
      )}

      {testingProducts.length > 0 && (
        <Card title="Currently Testing" subtitle="Products on trial">
          <div className="space-y-2 mt-2">
            {testingProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose/10 border border-rose/20">
                <span className="text-base">🧪</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-brown">{p.name}</p>
                  {p.startDate && <p className="text-xs text-sand-dark">Started {format(parseISO(p.startDate), "MMMM d, yyyy")}</p>}
                  {p.notes && <p className="text-xs text-brown italic">{p.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>{renderProductList(amProducts, "AM Routine")}</Card>
        <Card>{renderProductList(pmProducts, "PM Routine")}</Card>
      </div>

      <Card title="Skin Check-in Log">
        {data.skinCheckIns.length === 0 ? (
          <p className="text-sand-dark text-sm">No check-ins yet. Log your skin&apos;s journey.</p>
        ) : (
          <div className="space-y-3">
            {[...data.skinCheckIns].reverse().slice(0, 15).map((c) => (
              <div key={c.id} className="p-3 rounded-xl bg-cream-dark">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-sand-dark">{format(parseISO(c.date), "EEEE, MMMM d, yyyy")}</p>
                  {c.breakouts && <span className="text-xs bg-rose/20 text-rose px-2 py-0.5 rounded-full">Breakout</span>}
                </div>
                <p className="text-sm text-brown">{c.observations}</p>
                {c.changes && <p className="text-xs text-sand-dark mt-1">Changed: {c.changes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={productOpen} onClose={() => setProductOpen(false)} title="Add Product">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Product Name</label>
            <input type="text" placeholder="e.g. CeraVe Hydrating Cleanser" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Brand (optional)</label>
            <input type="text" placeholder="e.g. CeraVe" value={productForm.brand} onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Routine</label>
            <select value={productForm.routine} onChange={(e) => { const r = e.target.value as SkincareProduct["routine"]; setProductForm({ ...productForm, routine: r }); }}>
              <option value="am">AM only</option>
              <option value="pm">PM only</option>
              <option value="both">Both AM & PM</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="testing" checked={productForm.isTesting} onChange={(e) => setProductForm({ ...productForm, isTesting: e.target.checked })} className="w-4 h-4 accent-terracotta" />
            <label htmlFor="testing" className="text-sm text-brown">Currently testing / trialing</label>
          </div>
          {productForm.isTesting && (
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Start date</label>
              <input type="date" value={productForm.startDate} onChange={(e) => setProductForm({ ...productForm, startDate: e.target.value })} />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea rows={2} placeholder="Skin concerns it targets, results so far…" value={productForm.notes} onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setProductOpen(false)}>Cancel</Button>
            <Button onClick={addProduct}>Add Product</Button>
          </div>
        </div>
      </Modal>

      <Modal open={checkInOpen} onClose={() => setCheckInOpen(false)} title="Skin Check-in">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="breakout" checked={checkInForm.breakouts} onChange={(e) => setCheckInForm({ ...checkInForm, breakouts: e.target.checked })} className="w-4 h-4 accent-terracotta" />
            <label htmlFor="breakout" className="text-sm text-brown">Any breakouts?</label>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Observations</label>
            <textarea rows={3} placeholder="How does your skin look and feel today? Texture, hydration, redness…" value={checkInForm.observations} onChange={(e) => setCheckInForm({ ...checkInForm, observations: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Any changes (products, diet, sleep)?</label>
            <input type="text" placeholder="e.g. Tried new toner, slept poorly" value={checkInForm.changes} onChange={(e) => setCheckInForm({ ...checkInForm, changes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCheckInOpen(false)}>Cancel</Button>
            <Button onClick={addCheckIn}>Save Check-in</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
