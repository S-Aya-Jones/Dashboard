"use client";

// The wait, as a ring that empties.
//
// A number counting down tells her how long is left; a ring tells her at a
// glance, which is what she needs while her hands are wet and the phone is on
// the counter. Drawn as SVG rather than animated CSS so the sweep stays exact
// at any duration — a twenty-minute retinoid wait and a thirty-second essence
// wait use the same component.

interface Props {
  /** Seconds remaining. */
  left: number;
  /** Seconds the wait started at, for the sweep. */
  total: number;
  size?: number;
  onSkip?: () => void;
}

export function StepRing({ left, total, size = 96, onSkip }: Props) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Guard the divide: a zero total would make the offset NaN and blank the ring.
  const progress = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const offset = circumference * (1 - progress);

  const mins = Math.floor(left / 60);
  const secs = left % 60;

  return (
    <div className="flex items-center gap-4">
      <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="var(--border)" strokeWidth={stroke}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="var(--purple)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div
          className="absolute inset-0 grid place-items-center tabular-nums"
          style={{ color: "var(--text)" }}
        >
          <span className="font-serif" style={{ fontSize: size / 4.2, lineHeight: 1 }}>
            {mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : secs}
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          {mins >= 1 ? "Let it absorb" : "Nearly there"}
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {mins >= 10
            ? "Long enough to brush your teeth and stage the gym bag."
            : mins >= 1
            ? "Don't layer over it yet."
            : "Next step in a moment."}
        </p>
        {onSkip && (
          <button onClick={onSkip} className="text-xs underline mt-1" style={{ color: "var(--text-light)" }}>
            skip the wait
          </button>
        )}
      </div>
    </div>
  );
}
