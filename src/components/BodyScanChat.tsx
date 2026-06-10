"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X } from "lucide-react";

interface AnalysisData {
  bodyType: string;
  visualAssessment: string;
  bodyFatEstimate: {
    low: number;
    high: number;
    category: string;
    note: string;
  };
  muscleDefinition: number;
  compositionScore: number;
  potentialScore: number;
  visibleMuscle: Array<{
    group: string;
    development: string;
    note: string;
  }>;
  posture: string;
  strengths: string[];
  areas: string[];
  honestAssessment: string;
  protocol: {
    training: string[];
    diet: string[];
    recovery: string[];
  };
  roadmap: {
    thirtyDay: {
      focus: string;
      expectedChange: string;
      actions: string[];
    };
    ninetyDay: {
      focus: string;
      expectedChange: string;
      actions: string[];
    };
    sixMonth: {
      focus: string;
      expectedChange: string;
      actions: string[];
    };
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  analysis: AnalysisData;
  onClose: () => void;
}

export function BodyScanChat({ analysis, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showInitial, setShowInitial] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setShowInitial(false);
    setIsLoading(true);

    try {
      const res = await fetch("/api/body/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis,
          userMessage: input,
          conversationHistory: messages,
        }),
      });

      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-end z-70" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div
        className="w-full rounded-t-3xl p-5 space-y-4 max-h-[90vh] flex flex-col overflow-hidden"
        style={{ background: "var(--bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>
              AI Coach Feedback
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Honest, informed body composition analysis
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl active:scale-90"
            style={{ color: "var(--text-light)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages container */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
          {showInitial && (
            <>
              {/* Initial analysis display */}
              <div className="space-y-4">
                {/* Score card */}
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)" }}>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs font-semibold text-purple-600">Current State</p>
                      <p className="font-serif text-3xl mt-1" style={{ color: "#7C5CFC" }}>
                        {analysis.compositionScore}/10
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-purple-600">Potential</p>
                      <p className="font-serif text-3xl mt-1" style={{ color: "#9B7FFF" }}>
                        {analysis.potentialScore}/10
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {analysis.visualAssessment}
                  </p>
                </div>

                {/* Body fat estimate */}
                <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(124,92,252,0.05)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                    Estimated Body Fat
                  </p>
                  <p className="font-serif text-2xl" style={{ color: "#7C5CFC" }}>
                    {analysis.bodyFatEstimate.low}–{analysis.bodyFatEstimate.high}%
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {analysis.bodyFatEstimate.category} · {analysis.bodyFatEstimate.note}
                  </p>
                </div>

                {/* Honest assessment */}
                <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(218,102,123,0.08)" }}>
                  <p className="text-xs font-semibold" style={{ color: "#DA667B" }}>
                    The Truth
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                    {analysis.honestAssessment}
                  </p>
                </div>

                {/* Strengths & areas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(124,92,252,0.08)" }}>
                    <p className="text-[10px] font-semibold text-purple-600">Strengths</p>
                    <ul className="text-xs space-y-0.5" style={{ color: "var(--text)" }}>
                      {analysis.strengths.map((s, i) => (
                        <li key={i}>✓ {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(218,102,123,0.08)" }}>
                    <p className="text-[10px] font-semibold text-red-600">Room to Grow</p>
                    <ul className="text-xs space-y-0.5" style={{ color: "var(--text)" }}>
                      {analysis.areas.map((a, i) => (
                        <li key={i}>→ {a}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 30-day roadmap */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(201,154,92,0.08)" }}>
                  <p className="text-xs font-semibold" style={{ color: "#C99A5C" }}>
                    Next 30 Days
                  </p>
                  <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                    Focus: {analysis.roadmap.thirtyDay.focus}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {analysis.roadmap.thirtyDay.expectedChange}
                  </p>
                </div>

                {/* Protocol summary */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                    Action Plan
                  </p>
                  <div className="space-y-1.5">
                    {analysis.protocol.training.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-purple-600">Training</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {analysis.protocol.training[0]}
                        </p>
                      </div>
                    )}
                    {analysis.protocol.diet.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-purple-600">Nutrition</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {analysis.protocol.diet[0]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prompt to chat */}
                <div className="flex items-center justify-center gap-2" style={{ color: "var(--text-muted)" }}>
                  <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                  <p className="text-xs font-semibold">Ask me anything</p>
                  <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                </div>
              </div>
            </>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                  style={{ background: "rgba(124,92,252,0.2)", color: "#7C5CFC" }}
                >
                  🤖
                </div>
              )}
              <div
                className="max-w-xs rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: msg.role === "user" ? "#7C5CFC" : "var(--surface)",
                  color: msg.role === "user" ? "#fff" : "var(--text)",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm animate-pulse"
                style={{ background: "rgba(124,92,252,0.2)", color: "#7C5CFC" }}
              >
                🤖
              </div>
              <div className="flex gap-1.5 items-center">
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: "#7C5CFC", animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: "#7C5CFC", animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: "#7C5CFC", animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 flex-shrink-0">
          <input
            type="text"
            placeholder="Ask anything... (e.g., 'How realistic is my 6-month goal?')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !isLoading && sendMessage()}
            disabled={isLoading}
            style={{
              flex: 1,
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              color: "var(--text)",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-lg active:scale-90 transition-transform"
            style={{
              background: isLoading || !input.trim() ? "rgba(124,92,252,0.3)" : "#7C5CFC",
              color: "#fff",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
