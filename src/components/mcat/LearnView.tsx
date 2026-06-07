"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Brain, BookOpen, BarChart2, Loader2, Send,
  Sparkles, HelpCircle, GitBranch, RotateCcw,
  Plus, Check, Printer,
} from "lucide-react";
import { DashboardData, Flashcard, MCATQuestion } from "@/types/dashboard";
import { TutorAvatar } from "./TutorAvatar";
import { format } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  cards?: { front: string; back: string }[];
  question?: MCATQuestion;
}

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUBJECTS = [
  "Biology",
  "Biochemistry",
  "General Chemistry",
  "Organic Chemistry",
  "Physics",
  "Behavioral Sciences",
  "Critical Analysis & Reasoning Skills",
];

const QUICK_STARTS: { concept: string; subject: string; emoji: string }[] = [
  { concept: "Enzyme Kinetics",         subject: "Biochemistry",         emoji: "⚗️" },
  { concept: "Action Potential",        subject: "Biology",              emoji: "⚡" },
  { concept: "Krebs Cycle",            subject: "Biochemistry",         emoji: "🔄" },
  { concept: "Acid-Base Chemistry",    subject: "General Chemistry",    emoji: "🧪" },
  { concept: "Renal Physiology",       subject: "Biology",              emoji: "🫘" },
  { concept: "DNA Replication",        subject: "Biology",              emoji: "🧬" },
  { concept: "Neurotransmitters",      subject: "Behavioral Sciences",  emoji: "🧠" },
  { concept: "Classical Conditioning", subject: "Behavioral Sciences",  emoji: "🔔" },
  { concept: "Thermodynamics",         subject: "Physics",              emoji: "🌡️" },
  { concept: "Stereochemistry",        subject: "Organic Chemistry",    emoji: "🔮" },
  { concept: "Immune System",          subject: "Biology",              emoji: "🛡️" },
  { concept: "Electrochemistry",       subject: "General Chemistry",    emoji: "⚡" },
];

// ── Markdown Renderer ─────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const segments = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/);
  if (segments.length === 1) return text;
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
          return <strong key={i} style={{ fontWeight: 700 }}>{seg.slice(2, -2)}</strong>;
        }
        if (seg.startsWith("`") && seg.endsWith("`") && seg.length > 2) {
          return (
            <code key={i} style={{
              fontFamily: "monospace",
              background: "rgba(124,92,252,0.1)",
              padding: "1px 5px",
              borderRadius: 4,
              fontSize: "0.88em",
              color: "var(--purple)",
            }}>
              {seg.slice(1, -1)}
            </code>
          );
        }
        if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
          return <em key={i}>{seg.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{seg}</React.Fragment>;
      })}
    </>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const k = () => (key++).toString();

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={k()} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />);
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={k()} style={{ fontSize: 19, fontWeight: 800, color: "var(--text)", margin: "20px 0 6px", paddingBottom: 6, borderBottom: "2px solid var(--border)" }}>
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={k()} style={{ fontSize: 15, fontWeight: 700, color: "var(--purple)", margin: "18px 0 6px" }}>
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      blocks.push(
        <h4 key={k()} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "10px 0 4px" }}>
          {renderInline(trimmed.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // Table block
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const rows = tableLines.filter(l => !/^\|[\s\-:|]+\|$/.test(l));
      if (rows.length > 0) {
        blocks.push(
          <div key={k()} style={{ overflowX: "auto", margin: "10px 0" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <tbody>
                {rows.map((row, ri) => {
                  const cells = row.split("|").slice(1, -1).map(c => c.trim());
                  return (
                    <tr key={ri} style={{ background: ri === 0 ? "rgba(124,92,252,0.08)" : ri % 2 === 0 ? "transparent" : "rgba(124,92,252,0.03)" }}>
                      {cells.map((cell, ci) =>
                        ri === 0
                          ? <th key={ci} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text)", borderBottom: "2px solid var(--border)", whiteSpace: "nowrap" }}>{renderInline(cell)}</th>
                          : <td key={ci} style={{ padding: "7px 12px", color: "var(--text)", borderBottom: "1px solid var(--border)" }}>{renderInline(cell)}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Bullet list
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("• "))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <ul key={k()} style={{ paddingLeft: 20, margin: "6px 0 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.65 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+[\.\)]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[\.\)]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[\.\)]\s*/, ""));
        i++;
      }
      blocks.push(
        <ol key={k()} style={{ paddingLeft: 20, margin: "6px 0 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.65 }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph or diagram
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("- ") &&
      !lines[i].trim().startsWith("• ") &&
      !/^\d+[\.\)]\s/.test(lines[i].trim()) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      const joined = paraLines.join("\n");
      const arrowCount = (joined.match(/[→↓↑←⟶⟹]/g) || []).length;
      const looksLikeDiagram = arrowCount >= 2 || (arrowCount >= 1 && paraLines.length >= 3);

      if (looksLikeDiagram) {
        blocks.push(
          <div key={k()} style={{
            fontFamily: "monospace",
            fontSize: 13,
            background: "rgba(124,92,252,0.04)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 18px",
            margin: "10px 0",
            whiteSpace: "pre",
            overflowX: "auto",
            color: "var(--text)",
            lineHeight: 1.9,
          }}>
            {joined}
          </div>
        );
      } else {
        blocks.push(
          <p key={k()} style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, margin: "6px 0 10px" }}>
            {renderInline(paraLines.join(" "))}
          </p>
        );
      }
    }
  }

  return <>{blocks}</>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LearnView({ update }: Props) {
  const [mode, setMode] = useState<"home" | "lesson">("home");
  const [concept, setConcept] = useState("");
  const [subject, setSubject] = useState("Biology");
  const [inputConcept, setInputConcept] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [savedCardIdx, setSavedCardIdx] = useState<Set<number>>(new Set());
  const [savedQIdx, setSavedQIdx] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Print Lesson ───────────────────────────────────────────────────────────────

  function printLesson(markdown: string, topicConcept: string, topicSubject: string) {
    function mdToHtml(md: string): string {
      const lines = md.split("\n");
      const out: string[] = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) { out.push(""); i++; continue; }
        if (trimmed.startsWith("## ")) {
          out.push(`<h2>${trimmed.slice(3)}</h2>`);
          i++; continue;
        }
        if (trimmed.startsWith("### ")) {
          out.push(`<h3>${trimmed.slice(4)}</h3>`);
          i++; continue;
        }
        if (trimmed.startsWith("- ")) {
          const items: string[] = [];
          while (i < lines.length && lines[i].trim().startsWith("- ")) {
            items.push(`<li>${lines[i].trim().slice(2)}</li>`);
            i++;
          }
          out.push(`<ul>${items.join("")}</ul>`);
          continue;
        }
        const withBold = trimmed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        out.push(`<p>${withBold}</p>`);
        i++;
      }
      return out.join("\n");
    }

    const bodyHtml = mdToHtml(markdown);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${topicConcept} — ${topicSubject}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #1a1a2e; line-height: 1.7; }
    h1 { font-size: 22px; color: #7C5CFC; margin-bottom: 4px; }
    h2 { font-size: 18px; color: #7C5CFC; border-bottom: 1.5px solid #7C5CFC; padding-bottom: 4px; margin-top: 28px; }
    h3 { font-size: 15px; color: #5b40c0; margin-top: 20px; }
    p { font-size: 14px; margin: 8px 0; }
    ul { padding-left: 20px; }
    li { font-size: 14px; margin: 4px 0; }
    .subtitle { font-size: 13px; color: #888; margin-bottom: 24px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${topicConcept}</h1>
  <div class="subtitle">${topicSubject}</div>
  ${bodyHtml}
</body>
</html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  }

  // ── API ───────────────────────────────────────────────────────────────────────

  async function callLearn(
    params: { mode: "teach" | "chat" | "aid"; message?: string; aidType?: string },
    currentConcept: string,
    currentSubject: string,
    history: Message[]
  ) {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        concept: currentConcept,
        subject: currentSubject,
        mode: params.mode,
        history: history.map(m => ({ role: m.role, content: m.content })),
      };
      if (params.message) body.message = params.message;
      if (params.aidType) body.aidType = params.aidType;

      const res = await fetch("/api/mcat/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const resp = await res.json();
      const aiMsg: Message = {
        role: "assistant",
        content: resp.text || "I couldn't generate a response. Please try again.",
        cards: resp.cards,
        question: resp.question,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error("Learn API error:", e);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, something went wrong. Please check your connection and try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function startLesson(c: string, s: string) {
    const trimmed = c.trim();
    if (!trimmed) return;
    setConcept(trimmed);
    setSubject(s);
    setMessages([]);
    setSavedCardIdx(new Set());
    setSavedQIdx(new Set());
    setMode("lesson");
    await callLearn({ mode: "teach" }, trimmed, s, []);
  }

  async function sendChat() {
    if (!chatInput.trim() || loading) return;
    const msg = chatInput.trim();
    setChatInput("");
    const userMsg: Message = { role: "user", content: msg };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    await callLearn({ mode: "chat", message: msg }, concept, subject, newHistory);
  }

  async function requestAid(aidType: string) {
    if (loading) return;
    const labels: Record<string, string> = {
      mnemonic:   "Create a mnemonic to help me remember this",
      table:      "Make me a comparison table for this topic",
      diagram:    "Show me a step-by-step diagram or flowchart",
      flashcards: "Generate 5 flashcards for this topic",
      question:   "Give me a practice MCAT question",
    };
    const userMsg: Message = { role: "user", content: labels[aidType] ?? `Help: ${aidType}` };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    await callLearn({ mode: "aid", aidType }, concept, subject, newHistory);
  }

  function saveCards(cards: { front: string; back: string }[], msgIdx: number) {
    const today = format(new Date(), "yyyy-MM-dd");
    const newCards: Flashcard[] = cards.map(c => ({
      id: crypto.randomUUID(),
      front: c.front,
      back: c.back,
      subject,
      topic: concept,
      tags: [],
      deck: "MCAT",
      createdAt: new Date().toISOString(),
      state: "new" as const,
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      learningStep: 0,
      nextReview: today,
    }));
    update(d => ({ ...d, flashcards: [...(d.flashcards ?? []), ...newCards] }));
    setSavedCardIdx(prev => new Set(Array.from(prev).concat(msgIdx)));
  }

  function saveQuestion(question: MCATQuestion, msgIdx: number) {
    update(d => ({ ...d, mcatQuestions: [...(d.mcatQuestions ?? []), question] }));
    setSavedQIdx(prev => new Set(Array.from(prev).concat(msgIdx)));
  }

  // ── Home View ─────────────────────────────────────────────────────────────────

  if (mode === "home") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 0 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: "var(--grad)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 4px 20px rgba(124,92,252,0.3)",
          }}>
            <Brain size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", margin: "0 0 8px" }}>Learn Mode</h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", margin: 0, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            Your personal MCAT tutor. Learn any concept, get mnemonics, tables, diagrams, flashcards, and practice questions.
          </p>
        </div>

        {/* Input card */}
        <div className="card" style={{ padding: "28px 28px 24px", marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            What do you want to learn?
          </label>
          <input
            value={inputConcept}
            onChange={e => setInputConcept(e.target.value)}
            onKeyDown={e => e.key === "Enter" && startLesson(inputConcept, subject)}
            placeholder='e.g. "Enzyme Kinetics" or "How does the kidney regulate pH?"'
            autoFocus
            style={{
              width: "100%", padding: "13px 16px", borderRadius: 12, fontSize: 15,
              border: "1.5px solid var(--border)", background: "var(--bg)",
              color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box",
              marginBottom: 18,
            }}
          />

          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            MCAT Subject
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {SUBJECTS.map(s => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: "1.5px solid",
                  borderColor: subject === s ? "var(--purple)" : "var(--border)",
                  background: subject === s ? "rgba(124,92,252,0.1)" : "transparent",
                  color: subject === s ? "var(--purple)" : "var(--text-muted)",
                  fontWeight: subject === s ? 700 : 500,
                  fontSize: 13, cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={() => startLesson(inputConcept, subject)}
            disabled={!inputConcept.trim()}
            style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none",
              background: inputConcept.trim() ? "var(--grad)" : "var(--border)",
              color: inputConcept.trim() ? "#fff" : "var(--text-muted)",
              fontWeight: 700, fontSize: 15,
              cursor: inputConcept.trim() ? "pointer" : "not-allowed",
              boxShadow: inputConcept.trim() ? "0 2px 16px rgba(124,92,252,0.3)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Sparkles size={17} />
            Teach Me This
          </button>
        </div>

        {/* Quick starts */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Quick Start Topics
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {QUICK_STARTS.map(({ concept: c, subject: s, emoji }) => (
            <button
              key={c}
              onClick={() => startLesson(c, s)}
              style={{
                padding: "12px 14px", borderRadius: 12,
                border: "1.5px solid var(--border)",
                background: "var(--surface)",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{c}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Lesson View ───────────────────────────────────────────────────────────────

  const lastAIText = [...messages].reverse().find(m => m.role === "assistant")?.content ?? "";

  const AID_BUTTONS = [
    { type: "mnemonic",   label: "Mnemonic",   icon: <Brain size={13} /> },
    { type: "table",      label: "Table",      icon: <BarChart2 size={13} /> },
    { type: "diagram",    label: "Diagram",    icon: <GitBranch size={13} /> },
    { type: "flashcards", label: "Flashcards", icon: <BookOpen size={13} /> },
    { type: "question",   label: "Practice Q", icon: <HelpCircle size={13} /> },
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
        {/* Left: concept info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Brain size={18} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{concept}</div>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(124,92,252,0.1)", color: "var(--purple)", fontWeight: 600 }}>
              {subject}
            </span>
          </div>
        </div>

        {/* Center: avatar (only when there's something to speak) */}
        {lastAIText && (
          <TutorAvatar key={lastAIText.slice(0, 80)} text={lastAIText} />
        )}

        {/* Right: new topic */}
        <button
          onClick={() => setMode("home")}
          style={{
            padding: "8px 14px", borderRadius: 10,
            border: "1.5px solid var(--border)", background: "var(--surface)",
            color: "var(--text-muted)", fontWeight: 600, fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            flexShrink: 0,
          }}
        >
          <RotateCcw size={13} /> New Topic
        </button>
      </div>

      {/* Message thread */}
      <div style={{
        minHeight: 200,
        maxHeight: "62vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        paddingRight: 4,
        marginBottom: 12,
      }}>
        {messages.map((msg, idx) => (
          <div key={idx}>
            {msg.role === "user" && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{
                  maxWidth: "78%", padding: "11px 16px",
                  borderRadius: "18px 18px 4px 18px",
                  background: "var(--grad)", color: "#fff",
                  fontSize: 14, lineHeight: 1.55, fontWeight: 500,
                }}>
                  {msg.content}
                </div>
              </div>
            )}

            {msg.role === "assistant" && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, background: "var(--grad)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 2,
                }}>
                  <Brain size={15} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="card" style={{ padding: "16px 20px", borderRadius: "4px 16px 16px 16px" }}>
                    {renderMarkdown(msg.content)}
                  </div>
                  <button
                    onClick={() => printLesson(msg.content, concept, subject)}
                    style={{
                      marginTop: 6, padding: "5px 12px", borderRadius: 8,
                      border: "1.5px solid var(--border)", background: "var(--surface)",
                      color: "var(--text-muted)", fontSize: 11, fontWeight: 600,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <Printer size={12} /> Print Study Sheet
                  </button>

                  {/* Flashcard previews */}
                  {msg.cards && msg.cards.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Generated Flashcards ({msg.cards.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {msg.cards.map((card, ci) => (
                          <div key={ci} className="card" style={{ padding: "10px 14px", borderLeft: "3px solid var(--purple)" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>Q: {card.front}</div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>A: {card.back}</div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => !savedCardIdx.has(idx) && saveCards(msg.cards!, idx)}
                        disabled={savedCardIdx.has(idx)}
                        style={{
                          marginTop: 8, padding: "8px 18px", borderRadius: 10,
                          border: "none",
                          cursor: savedCardIdx.has(idx) ? "default" : "pointer",
                          background: savedCardIdx.has(idx) ? "rgba(16,185,129,0.1)" : "var(--grad)",
                          color: savedCardIdx.has(idx) ? "var(--green)" : "#fff",
                          fontWeight: 700, fontSize: 13,
                          display: "inline-flex", alignItems: "center", gap: 6,
                        }}
                      >
                        {savedCardIdx.has(idx)
                          ? <><Check size={13} /> Saved to Deck</>
                          : <><Plus size={13} /> Save to Flashcard Deck</>
                        }
                      </button>
                    </div>
                  )}

                  {/* Question preview */}
                  {msg.question && (
                    <div style={{ marginTop: 10 }}>
                      <div className="card" style={{ padding: "16px 20px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          MCAT Practice Question · {msg.question.difficulty} · {msg.question.subject}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 14, lineHeight: 1.65 }}>
                          {msg.question.stem}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {msg.question.choices.map(choice => {
                            const isCorrect = choice.letter === msg.question!.correctLetter;
                            return (
                              <div key={choice.letter} style={{
                                padding: "8px 12px", borderRadius: 8,
                                background: isCorrect ? "rgba(16,185,129,0.07)" : "var(--bg)",
                                border: "1px solid",
                                borderColor: isCorrect ? "var(--green)" : "var(--border)",
                                fontSize: 13, color: "var(--text)",
                              }}>
                                <span style={{ fontWeight: 700, marginRight: 8, color: isCorrect ? "var(--green)" : "var(--text-muted)" }}>
                                  {choice.letter}.
                                </span>
                                {choice.text}
                              </div>
                            );
                          })}
                        </div>
                        {msg.question.explanation && (
                          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(124,92,252,0.04)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--purple)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Explanation</div>
                            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.65 }}>{msg.question.explanation}</div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => !savedQIdx.has(idx) && saveQuestion(msg.question!, idx)}
                        disabled={savedQIdx.has(idx)}
                        style={{
                          marginTop: 8, padding: "8px 18px", borderRadius: 10,
                          border: "none",
                          cursor: savedQIdx.has(idx) ? "default" : "pointer",
                          background: savedQIdx.has(idx) ? "rgba(16,185,129,0.1)" : "rgba(124,92,252,0.1)",
                          color: savedQIdx.has(idx) ? "var(--green)" : "var(--purple)",
                          fontWeight: 700, fontSize: 13,
                          display: "inline-flex", alignItems: "center", gap: 6,
                        }}
                      >
                        {savedQIdx.has(idx)
                          ? <><Check size={13} /> Added to Q Bank</>
                          : <><Plus size={13} /> Add to Q Bank</>
                        }
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={15} color="#fff" />
            </div>
            <div className="card" style={{ padding: "14px 18px", borderRadius: "4px 16px 16px 16px", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={15} style={{ color: "var(--purple)", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick action bar */}
      <div style={{
        display: "flex", gap: 7, flexWrap: "wrap",
        paddingBottom: 10,
        borderBottom: "1px solid var(--border)",
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", alignSelf: "center", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 2 }}>
          Get:
        </span>
        {AID_BUTTONS.map(btn => (
          <button
            key={btn.type}
            onClick={() => requestAid(btn.type)}
            disabled={loading}
            style={{
              padding: "6px 13px", borderRadius: 20,
              border: "1.5px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-muted)",
              fontSize: 12, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 5,
              opacity: loading ? 0.5 : 1,
            }}
          >
            {btn.icon}
            {btn.label}
          </button>
        ))}
      </div>

      {/* Chat input */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
          placeholder="Ask a follow-up question..."
          disabled={loading}
          style={{
            flex: 1, padding: "11px 16px", borderRadius: 12, fontSize: 14,
            border: "1.5px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", fontFamily: "inherit",
            boxShadow: "var(--shadow)",
          }}
        />
        <button
          onClick={sendChat}
          disabled={!chatInput.trim() || loading}
          style={{
            padding: "11px 16px", borderRadius: 12, border: "none",
            background: chatInput.trim() && !loading ? "var(--grad)" : "var(--bg)",
            color: chatInput.trim() && !loading ? "#fff" : "var(--text-muted)",
            cursor: chatInput.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center",
          }}
        >
          <Send size={16} />
        </button>
      </div>

      {/* Spin keyframe injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
