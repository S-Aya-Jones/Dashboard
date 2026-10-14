"use client";

import { useCallback, useEffect, useState } from "react";
import { Car, Mountain, Check, ExternalLink, MapPin } from "lucide-react";

// The three ladders.
//
// Driving, bridges and heights advance independently, because they are
// different fears that happen to overlap rather than harder versions of each
// other. Holding bridges back until driving finishes would stall both.
//
// Addresses are typed here and stored in the database. They are deliberately
// not in the code: the repository is public.

interface Rung {
  id: string; track: string; title: string; why: string;
  /** How many reps it needs, and how many it has. */
  target: number; done: number;
  complete: boolean; current: boolean; link: string | null;
}
interface TrackView { track: string; rungs: Rung[]; doneCount: number; current: Rung | null }
interface Place { key: string; label: string; address: string; kind: "anchor" | "destination" }
interface Dest { key: string; label: string; easy: string; harder: string }
interface Bridge {
  id: number; label: string; note: string | null;
  doneBefore: boolean; reps: number; target: number;
}
interface Payload {
  places: Place[]; destinations: Dest[]; tracks: TrackView[];
  bridges: Bridge[]; nextBridge: Bridge | null;
}

const TRACK_META: Record<string, { label: string; icon: typeof Car; colour: string }> = {
  driving: { label: "Driving",  icon: Car,      colour: "#B4552F" },
  bridges: { label: "Bridges",  icon: MapPin,   colour: "#2E6FBF" },
  heights: { label: "Heights",  icon: Mountain, colour: "#3F6F5E" },
};

export function DrivingLadders() {
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState<string>("driving");
  const [home, setHome] = useState("");
  const [work, setWork] = useState("");
  const [destName, setDestName] = useState("");
  const [destAddr, setDestAddr] = useState("");
  const [brLabel, setBrLabel] = useState("");
  const [brNote, setBrNote] = useState("");
  const [brBefore, setBrBefore] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/driving", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch("/api/driving", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json()).catch(() => null);
    if (res && !res.error) setData(res);
    setSaving(false);
  };

  if (!data) return null;

  const saved = Object.fromEntries(data.places.map(p => [p.key, p.address]));
  const needsPlaces = !saved.home || !saved.work;

  return (
    <div className="space-y-4">
      {/* Addresses — asked for once, kept out of the code */}
      {needsPlaces && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid rgba(180,85,47,0.35)" }}>
          <h3 className="section-title mb-1">Where you start from</h3>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Two addresses, and every route link below avoids interstates automatically.
            These are stored in your database, not in the code — the code is public, your address isn&apos;t.
          </p>
          <input value={home} onChange={e => setHome(e.target.value)} placeholder="Home address"
            className="w-full text-sm px-3 py-2 rounded-xl mb-2"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <input value={work} onChange={e => setWork(e.target.value)} placeholder="Work address"
            className="w-full text-sm px-3 py-2 rounded-xl mb-2"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <button
            onClick={async () => {
              if (home.trim()) await post({ place: { key: "home", label: "Home", address: home } });
              if (work.trim()) await post({ place: { key: "work", label: "Work", address: work } });
              setHome(""); setWork("");
            }}
            disabled={saving || (!home.trim() && !work.trim())}
            className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: "var(--text)", color: "var(--surface)" }}>
            Save
          </button>
        </div>
      )}

      {/* Somewhere to go, and the two ways to get there */}
      {saved.home && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <h3 className="section-title mb-1">Places worth driving to</h3>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            The mall, a cinema, coffee across town. Each one gets two routes — the one that
            avoids interstates, and the one that doesn&apos;t. The gap between them is the ladder.
          </p>

          {(data.destinations ?? []).length > 0 && (
            <div className="space-y-1.5 mb-3">
              {data.destinations.map(d => (
                <div key={d.key} className="rounded-xl px-3 py-2.5" style={{ background: "var(--bg)" }}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{d.label}</span>
                    <button onClick={() => post({ removeKey: d.key })}
                      className="ml-auto text-[11px]" style={{ color: "var(--text-light)" }}>remove</button>
                  </div>
                  <div className="flex gap-3 mt-1.5 flex-wrap">
                    <a href={d.easy} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#3F6F5E" }}>
                      No interstates <ExternalLink size={10} />
                    </a>
                    <a href={d.harder} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#C0562A" }}>
                      Fastest route <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <input value={destName} onChange={e => setDestName(e.target.value)} placeholder="Name, e.g. the mall"
              className="flex-1 min-w-[8rem] text-sm px-3 py-2 rounded-xl"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <input value={destAddr} onChange={e => setDestAddr(e.target.value)} placeholder="Address or place name"
              className="flex-1 min-w-[10rem] text-sm px-3 py-2 rounded-xl"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <button
              onClick={async () => {
                if (!destName.trim() || !destAddr.trim()) return;
                await post({ place: {
                  key: `dest-${Date.now()}`, label: destName.trim(),
                  address: destAddr.trim(), kind: "destination",
                } });
                setDestName(""); setDestAddr("");
              }}
              disabled={saving || !destName.trim() || !destAddr.trim()}
              className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: "var(--text)", color: "var(--surface)" }}>
              Add
            </button>
          </div>
        </div>
      )}

      {/* Track tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg)" }}>
        {data.tracks.map(t => {
          const meta = TRACK_META[t.track];
          const Icon = meta.icon;
          const on = open === t.track;
          return (
            <button key={t.track} onClick={() => setOpen(t.track)}
              className="flex-1 py-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5"
              style={on ? { background: meta.colour, color: "#fff" } : { color: "var(--text-muted)" }}>
              <Icon size={13} />
              {meta.label}
              <span style={{ opacity: 0.75 }}>{t.doneCount}/{t.rungs.length}</span>
            </button>
          );
        })}
      </div>

      {open === "bridges" && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <h3 className="section-title mb-1">Your bridges, easiest first</h3>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Named crossings in your order, not a generic ladder. A bridge you&apos;ve driven
            before is marked — getting one back is a different job from doing it the first time.
          </p>

          {(data.bridges ?? []).length > 0 && (
            <div className="space-y-1.5 mb-3">
              {data.bridges.map(b => {
                const complete = b.reps >= b.target;
                const isNext = data.nextBridge?.id === b.id;
                return (
                  <div key={b.id} className="rounded-xl px-3 py-2.5"
                    style={{
                      background: "var(--bg)",
                      border: isNext ? "1.5px solid rgba(46,111,191,0.45)" : "1.5px solid transparent",
                      opacity: complete ? 0.55 : 1,
                    }}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold"
                        style={{ color: "var(--text)", textDecoration: complete ? "line-through" : undefined }}>
                        {b.label}
                      </span>
                      {b.doneBefore && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(63,111,94,0.14)", color: "#3F6F5E" }}>
                          done before
                        </span>
                      )}
                      <span className="text-[11px] tabular-nums ml-auto" style={{ color: "#2E6FBF", fontWeight: 600 }}>
                        {b.reps}/{b.target}
                      </span>
                      {!complete && (
                        <button onClick={() => post({ logBridge: b.id })} disabled={saving}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                          style={{ background: "#2E6FBF", color: "#fff" }}>Crossed it</button>
                      )}
                      <button onClick={() => post({ removeBridge: b.id })}
                        className="text-[11px]" style={{ color: "var(--text-light)" }}>×</button>
                    </div>
                    {b.note && (
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{b.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 flex-wrap items-center">
            <input value={brLabel} onChange={e => setBrLabel(e.target.value)} placeholder="Bridge, e.g. Charlotte overpass"
              className="flex-1 min-w-[9rem] text-sm px-3 py-2 rounded-xl"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <input value={brNote} onChange={e => setBrNote(e.target.value)} placeholder="Note (optional)"
              className="flex-1 min-w-[9rem] text-sm px-3 py-2 rounded-xl"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <input type="checkbox" checked={brBefore} onChange={e => setBrBefore(e.target.checked)}
                style={{ accentColor: "#3F6F5E" }} />
              done before
            </label>
            <button
              onClick={async () => {
                if (!brLabel.trim()) return;
                await post({ bridge: {
                  label: brLabel.trim(), note: brNote.trim() || null,
                  rank: (data.bridges?.length ?? 0) + 1, doneBefore: brBefore,
                } });
                setBrLabel(""); setBrNote(""); setBrBefore(false);
              }}
              disabled={saving || !brLabel.trim()}
              className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: "var(--text)", color: "var(--surface)" }}>
              Add
            </button>
          </div>
        </div>
      )}

      {data.tracks.filter(t => t.track === open).map(t => {
        const meta = TRACK_META[t.track];
        return (
          <div key={t.track} className="space-y-2">
            {t.rungs.map(r => (
              <div key={r.id} className="rounded-2xl p-4"
                style={{
                  background: "var(--surface)",
                  border: `1.5px solid ${r.current ? `${meta.colour}66` : "var(--border)"}`,
                  opacity: r.complete ? 0.55 : 1,
                }}>
                <div className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center flex-shrink-0 rounded-md mt-0.5"
                    style={{
                      width: 18, height: 18,
                      background: r.complete ? "#0F8A55" : "transparent",
                      border: r.complete ? "none" : `1.5px solid ${r.current ? meta.colour : "var(--border2)"}`,
                    }}>
                    {r.complete && <Check size={11} color="#fff" strokeWidth={3.5} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug"
                      style={{ color: r.complete ? "var(--text-light)" : "var(--text)", textDecoration: r.complete ? "line-through" : undefined }}>
                      {r.title}
                    </p>
                    <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{r.why}</p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] tabular-nums" style={{ color: meta.colour, fontWeight: 600 }}>
                        {r.done} of {r.target}
                      </span>
                      {r.link && (
                        <a href={r.link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold"
                          style={{ color: meta.colour }}>
                          Route, no interstates <ExternalLink size={10} />
                        </a>
                      )}
                      {!r.complete && (
                        <button onClick={() => post({ rung: r.id })} disabled={saving}
                          className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-lg"
                          style={{ background: meta.colour, color: "#fff" }}>
                          Did it
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
