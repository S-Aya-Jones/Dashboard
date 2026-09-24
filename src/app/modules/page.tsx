"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { MODULES, GROUP_LABEL, pausedSet, type ModuleGroup } from "@/lib/modules";
import { Check } from "lucide-react";

// What's on the sidebar.
//
// Pausing hides a section; it never deletes anything. Said plainly on the page
// because "suspend" could just as easily mean "throw away", and she should be
// able to put school down without wondering whether her lectures survived it.

const ORDER: ModuleGroup[] = ["daily", "money", "health", "school", "other"];

export default function Page() {
  return (
    <DashboardShell>
      {({ data, update }) => {
        const paused = pausedSet(data.pausedModules);

        const toggle = (href: string) => {
          update(d => {
            const next = new Set(pausedSet(d.pausedModules));
            if (next.has(href)) next.delete(href); else next.add(href);
            return { ...d, pausedModules: Array.from(next) };
          });
        };

        const setGroup = (group: ModuleGroup, on: boolean) => {
          update(d => {
            const next = new Set(pausedSet(d.pausedModules));
            for (const m of MODULES) {
              if (m.group !== group || m.href === "/") continue;
              if (on) next.delete(m.href); else next.add(m.href);
            }
            return { ...d, pausedModules: Array.from(next) };
          });
        };

        return (
          <>
            <div style={{ marginBottom: "1.25rem" }}>
              <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Sections</h1>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                Paused sections come off the sidebar. Nothing is deleted — every page still works and
                everything in it is exactly where you left it.
              </p>
            </div>

            <div className="space-y-3">
              {ORDER.map(group => {
                const mods = MODULES.filter(m => m.group === group);
                if (!mods.length) return null;
                const onCount = mods.filter(m => m.href === "/" || !paused.has(m.href)).length;

                return (
                  <div key={group} className="rounded-2xl p-4"
                    style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                    <div className="flex items-baseline justify-between gap-3 mb-2.5">
                      <h2 className="section-title">{GROUP_LABEL[group]}</h2>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span style={{ color: "var(--text-light)" }}>{onCount}/{mods.length} on</span>
                        <button onClick={() => setGroup(group, true)} className="underline" style={{ color: "var(--text-muted)" }}>all on</button>
                        <button onClick={() => setGroup(group, false)} className="underline" style={{ color: "var(--text-muted)" }}>all off</button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {mods.map(m => {
                        const locked = m.href === "/";
                        const on = locked || !paused.has(m.href);
                        return (
                          <button key={m.href}
                            onClick={() => !locked && toggle(m.href)}
                            disabled={locked}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors disabled:cursor-default"
                            style={{ background: on ? "var(--bg)" : "transparent", opacity: on ? 1 : 0.55 }}>
                            <span className="flex items-center justify-center flex-shrink-0 rounded-md"
                              style={{
                                width: 20, height: 20,
                                background: on ? "var(--purple)" : "transparent",
                                border: on ? "none" : "1.5px solid var(--border2)",
                              }}>
                              {on && <Check size={13} color="#fff" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="text-sm font-medium block" style={{ color: "var(--text)" }}>
                                {m.label}
                                {locked && <span className="text-[10px] font-normal ml-2" style={{ color: "var(--text-light)" }}>always on</span>}
                              </span>
                              {m.note && (
                                <span className="text-[11px] block leading-relaxed" style={{ color: "var(--text-light)" }}>{m.note}</span>
                              )}
                            </span>
                            <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-light)" }}>{m.href}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      }}
    </DashboardShell>
  );
}
