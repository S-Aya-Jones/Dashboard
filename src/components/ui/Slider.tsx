"use client";

interface SliderProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  color?: string;
  showValue?: boolean;
  label?: string;
}

const levelColors: Record<number, string> = {
  1: "#71816D", 2: "#8A9E87", 3: "rgba(255,255,255,0.3)",
  4: "#C99A5C", 5: "#C97B5E", 6: "#C86070",
  7: "#DA667B", 8: "#C95070", 9: "#B84060", 10: "#A03050",
};

export function AnxietySlider({ value, onChange, label }: SliderProps) {
  const color = levelColors[value] ?? "#71816D";
  const pct = ((value - 1) / 9) * 100;

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-brown">{label}</p>}
      <div className="flex items-center gap-3">
        <span className="text-xs text-sand-dark w-4">1</span>
        <div className="relative flex-1 h-2 bg-cream-darker rounded-full">
          <div
            className="absolute left-0 top-0 h-2 rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
          <input
            type="range"
            min={1}
            max={10}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-soft transition-all"
            style={{ left: `calc(${pct}% - 8px)`, background: color }}
          />
        </div>
        <span className="text-xs text-sand-dark w-4">10</span>
        <span
          className="w-8 text-center text-sm font-semibold transition-colors"
          style={{ color }}
        >
          {value}
        </span>
      </div>
      <div className="flex justify-between px-7 text-xs text-sand-dark">
        <span>calm</span>
        <span>very anxious</span>
      </div>
    </div>
  );
}
