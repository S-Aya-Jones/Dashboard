"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalResisted: number;
  totalActed: number;
  completedReps: number;
  checkinsStreak: number;
  hasCompletedTier3: boolean;
  parkingLetGoCount: number;
}

// ─── Garden SVG ───────────────────────────────────────────────────────────────

function GardenSVG({ stats }: { stats: Stats }) {
  const { totalResisted, completedReps, checkinsStreak, hasCompletedTier3, parkingLetGoCount } = stats;

  // Growth stages
  const treeStage   = totalResisted >= 200 ? 5 : totalResisted >= 100 ? 4 : totalResisted >= 50 ? 3 : totalResisted >= 25 ? 2 : totalResisted >= 10 ? 1 : 0;
  const flowers     = Math.min(completedReps, 8);
  const hasStream   = checkinsStreak >= 7;
  const hasBirds    = parkingLetGoCount >= 3;
  const hasGoldenFlower = hasCompletedTier3;

  // Colors
  const sky     = "#F5F0E8";
  const earth   = "#2C1810";
  const grass   = "#71816D";
  const leaf    = "#4A6741";
  const trunk   = "#5C3D2E";
  const petal   = "#DA667B";
  const gold    = "#D4B896";
  const stream  = "#A8C4D4";

  const treeSizes = [
    { w: 0,  h: 0,  gw: 0,  gh: 0  }, // stage 0: nothing
    { w: 14, h: 20, gw: 22, gh: 16 }, // stage 1: seedling
    { w: 18, h: 35, gw: 36, gh: 28 }, // stage 2: sapling
    { w: 22, h: 55, gw: 52, gh: 42 }, // stage 3: young tree
    { w: 26, h: 75, gw: 72, gh: 58 }, // stage 4: full tree
    { w: 30, h: 90, gw: 90, gh: 72 }, // stage 5: mature tree
  ];
  const ts = treeSizes[treeStage];

  // Flower positions (arc across the grass)
  const flowerPositions = [
    { x: 60,  y: 155 }, { x: 280, y: 148 }, { x: 340, y: 152 },
    { x: 30,  y: 160 }, { x: 100, y: 150 }, { x: 310, y: 145 },
    { x: 20,  y: 158 }, { x: 260, y: 150 },
  ];

  const treeBaseX = 180;
  const groundY   = 165;

  return (
    <svg
      viewBox="0 0 380 200"
      style={{ width: "100%", maxHeight: "280px", display: "block" }}
      aria-label="Your Felt Safety garden — a botanical illustration showing your progress"
    >
      {/* Sky */}
      <rect width="380" height="200" fill={sky} rx="12" />

      {/* Sun / moon */}
      <circle cx="340" cy="38" r="22" fill="#FDEBC3" opacity="0.85" />
      <circle cx="340" cy="38" r="16" fill="#F9D77C" opacity="0.9" />

      {/* Streak stars or sun rays */}
      {checkinsStreak >= 3 && Array.from({ length: Math.min(checkinsStreak, 8) }, (_, i) => {
        const angle = (i / Math.min(checkinsStreak, 8)) * Math.PI * 2;
        return (
          <line key={i}
            x1={340 + Math.cos(angle) * 20} y1={38 + Math.sin(angle) * 20}
            x2={340 + Math.cos(angle) * 28} y2={38 + Math.sin(angle) * 28}
            stroke="#F9D77C" strokeWidth="2" opacity="0.7"
          />
        );
      })}

      {/* Stream */}
      {hasStream && (
        <>
          <path d="M 0 145 Q 60 138 120 142 Q 160 146 180 140" stroke={stream} strokeWidth="3" fill="none" opacity="0.6" />
          <path d="M 0 150 Q 60 143 120 147 Q 160 151 185 145" stroke={stream} strokeWidth="2" fill="none" opacity="0.4" />
        </>
      )}

      {/* Ground */}
      <rect x="0" y={groundY} width="380" height="35" fill={earth} rx="0" />
      <rect x="0" y={groundY - 5} width="380" height="12" fill={grass} opacity="0.85" />

      {/* Wavy grass detail */}
      <path d={`M 0 ${groundY - 5} Q 20 ${groundY - 12} 40 ${groundY - 5} Q 60 ${groundY + 2} 80 ${groundY - 5} Q 100 ${groundY - 12} 120 ${groundY - 5} Q 140 ${groundY + 2} 160 ${groundY - 5} Q 180 ${groundY - 12} 200 ${groundY - 5} Q 220 ${groundY + 2} 240 ${groundY - 5} Q 260 ${groundY - 12} 280 ${groundY - 5} Q 300 ${groundY + 2} 320 ${groundY - 5} Q 340 ${groundY - 12} 360 ${groundY - 5} Q 380 ${groundY + 2} 380 ${groundY - 5}`}
        fill={grass} opacity="0.5"
      />

      {/* Main tree */}
      {treeStage >= 1 && (
        <>
          {/* Trunk */}
          <rect
            x={treeBaseX - ts.w / 2}
            y={groundY - ts.h}
            width={ts.w}
            height={ts.h}
            fill={trunk}
            rx="4"
          />
          {/* Canopy */}
          <ellipse
            cx={treeBaseX}
            cy={groundY - ts.h - ts.gh * 0.3}
            rx={ts.gw / 2}
            ry={ts.gh / 2}
            fill={leaf}
            opacity="0.9"
          />
          {treeStage >= 3 && (
            <ellipse
              cx={treeBaseX - ts.gw * 0.22}
              cy={groundY - ts.h - ts.gh * 0.1}
              rx={ts.gw * 0.38}
              ry={ts.gh * 0.4}
              fill={grass}
              opacity="0.7"
            />
          )}
          {treeStage >= 4 && (
            <ellipse
              cx={treeBaseX + ts.gw * 0.22}
              cy={groundY - ts.h - ts.gh * 0.1}
              rx={ts.gw * 0.35}
              ry={ts.gh * 0.38}
              fill={leaf}
              opacity="0.8"
            />
          )}
        </>
      )}

      {/* Seedling (stage 0) */}
      {treeStage === 0 && totalResisted === 0 && (
        <>
          <line x1={treeBaseX} y1={groundY} x2={treeBaseX} y2={groundY - 12} stroke={grass} strokeWidth="2" />
          <path d={`M ${treeBaseX} ${groundY - 12} Q ${treeBaseX - 8} ${groundY - 22} ${treeBaseX - 4} ${groundY - 26}`} stroke={leaf} strokeWidth="2" fill="none" />
          <path d={`M ${treeBaseX} ${groundY - 14} Q ${treeBaseX + 8} ${groundY - 22} ${treeBaseX + 4} ${groundY - 28}`} stroke={leaf} strokeWidth="2" fill="none" />
        </>
      )}

      {/* Flowers (up to 8 for completed reps) */}
      {flowerPositions.slice(0, flowers).map((pos, i) => {
        const isGold = hasGoldenFlower && i === 0;
        const color  = isGold ? gold : petal;
        const petalR = isGold ? 5 : 4;
        return (
          <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
            <line x1="0" y1="0" x2="0" y2="-14" stroke={grass} strokeWidth="1.5" />
            {/* Petals */}
            {Array.from({ length: 5 }, (_, j) => {
              const a = (j / 5) * Math.PI * 2 - Math.PI / 2;
              return (
                <ellipse key={j}
                  cx={Math.cos(a) * (petalR + 1)} cy={-14 + Math.sin(a) * (petalR + 1)}
                  rx={petalR - 1} ry={petalR + 1}
                  fill={color} opacity="0.85"
                  transform={`rotate(${(j / 5) * 360}, ${Math.cos(a) * (petalR + 1)}, ${-14 + Math.sin(a) * (petalR + 1)})`}
                />
              );
            })}
            {/* Center */}
            <circle cx="0" cy="-14" r={petalR - 2} fill={isGold ? "#E8C878" : "#D4B896"} />
          </g>
        );
      })}

      {/* Birds for released parking lot entries */}
      {hasBirds && Array.from({ length: Math.min(parkingLetGoCount, 5) }, (_, i) => {
        const bx = 60 + i * 42;
        const by = 40 + (i % 2) * 14;
        return (
          <g key={i} opacity="0.7">
            <path d={`M ${bx} ${by} Q ${bx + 5} ${by - 5} ${bx + 10} ${by}`} stroke={trunk} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d={`M ${bx + 10} ${by} Q ${bx + 15} ${by - 5} ${bx + 20} ${by}`} stroke={trunk} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        );
      })}

      {/* Root detail at base of tree */}
      {treeStage >= 2 && (
        <>
          <path d={`M ${treeBaseX - ts.w / 2} ${groundY} Q ${treeBaseX - ts.w * 1.2} ${groundY + 8} ${treeBaseX - ts.w * 1.8} ${groundY + 6}`} stroke={trunk} strokeWidth="3" fill="none" opacity="0.6" />
          <path d={`M ${treeBaseX + ts.w / 2} ${groundY} Q ${treeBaseX + ts.w * 1.2} ${groundY + 8} ${treeBaseX + ts.w * 1.8} ${groundY + 6}`} stroke={trunk} strokeWidth="3" fill="none" opacity="0.6" />
        </>
      )}

      {/* Berries / fruit on mature tree */}
      {treeStage >= 4 && Array.from({ length: 5 }, (_, i) => {
        const angle = (i / 5) * Math.PI * 1.5 - Math.PI * 0.75;
        const r     = ts.gw * 0.32;
        const cx    = treeBaseX + Math.cos(angle) * r;
        const cy    = groundY - ts.h - ts.gh * 0.3 + Math.sin(angle) * r * 0.55;
        return <circle key={i} cx={cx} cy={cy} r="3.5" fill={petal} opacity="0.7" />;
      })}
    </svg>
  );
}

// ─── Stage label ──────────────────────────────────────────────────────────────

function gardenStageLabel(stats: Stats): { title: string; desc: string } {
  const r = stats.totalResisted;
  if (r === 0) return { title: "Bare soil", desc: "Log your first resisted twitch to plant a seed." };
  if (r < 10)  return { title: "First sprouts", desc: "Something is beginning to root." };
  if (r < 25)  return { title: "A sapling", desc: "Tender but real. Keep sitting with it." };
  if (r < 50)  return { title: "Growing steadily", desc: "Roots are deepening with every rep." };
  if (r < 100) return { title: "An established garden", desc: "The nervous system is learning." };
  if (r < 200) return { title: "Flourishing", desc: "This is what rewiring looks like." };
  return { title: "A living archive", desc: "Every rep is a branch that won't be taken back." };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function GardenTab() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/felt-safety/stats")
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card animate-fade-in" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
        Growing…
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card animate-fade-in" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        Could not load garden stats.
      </div>
    );
  }

  const stage = gardenStageLabel(stats);

  return (
    <div className="space-y-6 animate-fade-in">

      <div>
        <h2 className="font-serif" style={{ fontSize: "1.5rem", color: "var(--text)", margin: "0 0 0.2rem" }}>The Garden</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>
          Your practice, made visible. It grows as you do.
        </p>
      </div>

      {/* Garden illustration */}
      <div className="card" style={{ padding: "1.5rem", overflow: "hidden" }}>
        <GardenSVG stats={stats} />
        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", margin: "0 0 0.25rem" }}>{stage.title}</p>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>{stage.desc}</p>
        </div>
      </div>

      {/* Garden legend */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
        {[
          { emoji: "🌳", label: "Tree size", value: `${stats.totalResisted} resisted`, note: "grows with restraint" },
          { emoji: "🌸", label: "Flowers",   value: `${Math.min(stats.completedReps, 8)} / 8`,  note: "from rep completions" },
          { emoji: "🌤️",  label: "Sun rays",  value: stats.checkinsStreak > 0 ? `${stats.checkinsStreak}-day streak` : "No streak yet", note: "daily check-ins" },
          { emoji: "🐦", label: "Birds",     value: `${stats.parkingLetGoCount} released`,      note: "parking lot let-gos" },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: "0.9rem 1rem" }}>
            <p style={{ fontSize: "1.4rem", margin: "0 0 0.35rem" }}>{item.emoji}</p>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 0.15rem" }}>{item.label}</p>
            <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", margin: "0 0 0.1rem" }}>{item.value}</p>
            <p style={{ fontSize: "0.7rem", color: "var(--text-light)", margin: 0 }}>{item.note}</p>
          </div>
        ))}
      </div>

      {/* Tier 3 badge */}
      {stats.hasCompletedTier3 && (
        <div className="card" style={{ padding: "1.25rem", background: "linear-gradient(135deg, rgba(212,184,150,0.15) 0%, rgba(218,102,123,0.08) 100%)", border: "1px solid rgba(212,184,150,0.4)", textAlign: "center" }}>
          <p style={{ fontSize: "1.75rem", margin: "0 0 0.4rem" }}>🏅</p>
          <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", margin: "0 0 0.2rem" }}>Tier 3 Complete</p>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
            You&apos;ve done the hardest reps. The golden flower blooms for you.
          </p>
        </div>
      )}

    </div>
  );
}
