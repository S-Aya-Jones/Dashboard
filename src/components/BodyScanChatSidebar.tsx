"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle } from "lucide-react";

interface Analysis {
  bodyType: string;
  visualAssessment: string;
  bodyFatEstimate: { low: number; high: number; category: string; note: string };
  muscleDefinition: number;
  compositionScore: number;
  potentialScore: number;
  visibleMuscle: Array<{ group: string; development: string; note: string }>;
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

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function BodyScanChatSidebar({ analysis }: { analysis: Analysis }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-send initial feedback when analysis loads
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initialPrompt = `Based on my body scan results — composition score ${analysis.compositionScore}/10, body fat ${analysis.bodyFatEstimate.low}–${analysis.bodyFatEstimate.high}%, body type ${analysis.bodyType} — give me your honest overall take and the single most important thing I should focus on right now.`;

    setIsLoading(true);

    fetch("/api/body/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis,
        userMessage: initialPrompt,
        conversationHistory: [],
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setMessages([{ role: "assistant", content: data.message }]);
      })
      .catch(() => {
        setMessages([{ role: "assistant", content: "Hey! I've reviewed your scan. Ask me anything about your results, training, or what to focus on next." }]);
      })
      .finally(() => setIsLoading(false));
  }, [analysis]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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
    <div
      className="rounded-2xl overflow-hidden flex flex-col h-[600px] border"
      style={{ background: "var(--surface)", borderColor: "rgba(124,92,252,0.15)" }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: "rgba(124,92,252,0.1)" }}>
        <div className="flex items-center gap-2">
          <MessageCircle size={20} style={{ color: "#7C5CFC" }} />
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              AI Coach
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Ask anything
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Ask me about your analysis, goals, or anything fitness-related
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="text-lg flex-shrink-0">🤖</div>
            )}
            <div
              className="max-w-xs rounded-lg px-3 py-2 text-xs leading-relaxed"
              style={{
                background: msg.role === "user" ? "#7C5CFC" : "rgba(124,92,252,0.1)",
                color: msg.role === "user" ? "#fff" : "var(--text)",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="text-lg">🤖</div>
            <div className="flex gap-1 items-center">
              <div
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: "#7C5CFC", animationDelay: "0ms" }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: "#7C5CFC", animationDelay: "150ms" }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: "#7C5CFC", animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t flex gap-2" style={{ borderColor: "rgba(124,92,252,0.1)" }}>
        <input
          type="text"
          placeholder="Ask..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !isLoading && sendMessage()}
          disabled={isLoading}
          className="flex-1 px-2 py-1.5 rounded-lg text-xs"
          style={{
            background: "rgba(124,92,252,0.05)",
            border: "1px solid rgba(124,92,252,0.15)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="p-1.5 rounded-lg active:scale-90"
          style={{
            background: isLoading || !input.trim() ? "rgba(124,92,252,0.3)" : "#7C5CFC",
            color: "#fff",
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
