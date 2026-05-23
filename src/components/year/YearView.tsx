"use client";

import { useState } from "react";
import { DashboardData, YearReflection } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const YEAR = "2026";
const QUESTIONS = [
  { key: "vision" as const, label: "My vision for this year", placeholder: "What does thriving look like? What am I building toward?" },
  { key: "nonNegotiables" as const, label: "My non-negotiables", placeholder: "What must happen this year no matter what?" },
  { key: "focus" as const, label: "My one word or theme", placeholder: "If this year had a word, what would it be?" },
  { key: "whatToChange" as const, label: "What I'm leaving behind", placeholder: "What habits, patterns, or beliefs no longer serve me?" },
  { key: "theme" as const, label: "This year's theme / title", placeholder: "e.g. 'The Year I Became Her'" },
];

export function YearView({ data, update }: Props) {
  const existing = data.yearReflections.find((r) => r.year === YEAR);
  const [form, setForm] = useState<YearReflection>(existing ?? {
    year: YEAR,
    vision: "",
    nonNegotiables: "",
    focus: "",
    whatToChange: "",
    theme: "",
    buckets: [
      { title: "Medical School Journey", description: "" },
      { title: "Health & Mental Wellness", description: "" },
      { title: "Finances", description: "" },
      { title: "Relationships & Love", description: "" },
      { title: "Spiritual Growth", description: "" },
      { title: "Joy & Pleasure", description: "" },
    ],
  });

  const [saved, setSaved] = useState(false);

  const save = () => {
    update((d) => ({
      ...d,
      yearReflections: [
        ...d.yearReflections.filter((r) => r.year !== YEAR),
        form,
      ],
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateBucket = (idx: number, field: "title" | "description", val: string) => {
    const buckets = [...form.buckets];
    buckets[idx] = { ...buckets[idx], [field]: val };
    setForm({ ...form, buckets });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Year View — {YEAR}</h1>
          <p className="text-sand-dark mt-1">Your vision, your word, your year 🌟</p>
        </div>
        <Button onClick={save}>{saved ? "Saved ✓" : "Save Reflection"}</Button>
      </div>

      {/* Reflection questions */}
      <Card title="Year Reflection">
        <div className="space-y-5 mt-2">
          {QUESTIONS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-sm font-medium text-brown block mb-1.5">{label}</label>
              <textarea
                rows={3}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="font-serif text-base"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Buckets */}
      <Card title="Themed Buckets" subtitle="What you want each area of life to hold this year">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {form.buckets.map((bucket, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-cream-dark space-y-2">
              <input
                type="text"
                value={bucket.title}
                onChange={(e) => updateBucket(idx, "title", e.target.value)}
                className="font-semibold text-sm bg-transparent border-0 shadow-none p-0 text-brown"
              />
              <textarea
                rows={3}
                placeholder="What does success look like in this area?"
                value={bucket.description}
                onChange={(e) => updateBucket(idx, "description", e.target.value)}
                className="bg-transparent border-0 shadow-none p-0 text-sm resize-none"
              />
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setForm({ ...form, buckets: [...form.buckets, { title: "New Area", description: "" }] })}
          className="mt-3 text-xs"
        >
          + Add bucket
        </Button>
      </Card>
    </div>
  );
}
