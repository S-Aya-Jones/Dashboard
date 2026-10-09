"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun, Calendar, Brain, BookOpen,
  Sparkles, DollarSign,
  ChevronLeft, ChevronRight, Dumbbell, Gem, UtensilsCrossed,
  LayoutGrid, MoreHorizontal, X, Zap, Shield, Bell, Mail, Clock, Mic, ListChecks, GraduationCap, Users, HeartHandshake, CircleCheck, Scissors, FolderOpen, Layers,
  NotebookPen, Stethoscope, SlidersHorizontal, Flag, type LucideIcon,
} from "lucide-react";
import { visibleModules, pausedModules } from "@/lib/modules";
import { usePausedModules } from "@/hooks/usePausedModules";
import { useState } from "react";
import { SaveIndicator } from "@/components/ui/SaveIndicator";

// Icons live here rather than in lib/modules.ts, which has to stay importable
// from server code. The registry names them; this resolves them.
const ICONS: Record<string, LucideIcon> = {
  Sun, Clock, NotebookPen, CircleCheck, DollarSign, Brain, Shield, Dumbbell,
  Sparkles, UtensilsCrossed, Mic, Layers, ListChecks, GraduationCap, Mail,
  FolderOpen, Users, BookOpen, Scissors, Stethoscope, HeartHandshake, Bell, Gem, Flag,
};

const iconFor = (name: string): LucideIcon => ICONS[name] ?? LayoutGrid;

// The five that get a permanent slot on the phone's bottom bar. Anything paused
// drops out and the next unpaused one moves up, so the bar is never a row of
// dead ends — everything else is behind More.
const MOBILE_PRIORITY = ["/", "/schedule", "/journal", "/break", "/finances", "/habits", "/fitness"];

interface SidebarProps {
  saving?: boolean;
  /** Routes she has put away. Undefined means "never touched", not "none". */
  paused?: string[];
  /**
   * Whether the caller is supplying `paused` at all. Needed because undefined
   * is itself a meaningful value, so it can't double as "nothing was passed".
   */
  hasPaused?: boolean;
}

function isActive(pathname: string, href: string) {
  return pathname === href
    || (href === "/mcat"    && ["/shadowing"].includes(pathname))
    || (href === "/fitness" && pathname === "/workout");
}

export function Sidebar({ saving = false, paused, hasPaused = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  // Pages that mount the sidebar outside DashboardShell pass nothing, so it
  // asks for the list itself rather than showing stale defaults on half the app.
  const effectivePaused = usePausedModules(paused, hasPaused);
  const navItems = visibleModules(effectivePaused).map(m => ({ ...m, icon: iconFor(m.icon) }));
  const pausedCount = pausedModules(effectivePaused).length;
  const mobileMain = MOBILE_PRIORITY
    .filter(h => navItems.some(m => m.href === h))
    .slice(0, 5)
    .map(h => navItems.find(m => m.href === h)!);

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 flex-shrink-0 ${collapsed ? "w-16" : "w-56"}`}
        style={{
          background: "var(--surface)",
          borderRight: "1.5px solid var(--border)",
          boxShadow: "4px 0 24px rgba(180,85,47,0.08)",
        }}
      >
        <div className={`px-4 pt-6 pb-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {collapsed && (
            <span
              className="flex items-center justify-center font-serif"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: "var(--grad)", color: "#fff",
                fontSize: "1rem", lineHeight: 1, paddingBottom: 1,
                boxShadow: "0 3px 10px rgba(180,85,47,.35)",
              }}>
              A
            </span>
          )}
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <span
                className="flex items-center justify-center flex-shrink-0 font-serif"
                style={{
                  width: 34, height: 34, borderRadius: 11,
                  background: "var(--grad)", color: "#fff",
                  fontSize: "1.05rem", lineHeight: 1, paddingBottom: 1,
                  boxShadow: "0 3px 10px rgba(180,85,47,.35)",
                }}>
                A
              </span>
              <span className="leading-tight">
                <span className="block font-serif text-lg" style={{ color: "var(--text)" }}>Aya&apos;s</span>
                <span className="block text-[10px] font-semibold tracking-[.14em] uppercase"
                  style={{ color: "var(--text-light)" }}>Dashboard</span>
              </span>
            </div>
          )}
          {!collapsed && <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; (e.currentTarget as HTMLElement).style.color = "var(--purple)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}>
            <ChevronLeft size={16} />
          </button>}
        </div>
        {collapsed && (
          <button onClick={() => setCollapsed(false)}
            className="mx-auto mb-2 p-1.5 rounded-lg" style={{ color: "var(--text-light)" }}
            title="Expand">
            <ChevronRight size={15} />
          </button>
        )}

        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            const is75 = href === "/75hard";
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${collapsed ? "justify-center" : ""}`}
                style={active
                  ? { background: is75 ? "linear-gradient(135deg, rgba(224,164,74,0.2) 0%, rgba(180,85,47,0.15) 100%)" : "linear-gradient(135deg, rgba(180,85,47,0.15) 0%, rgba(224,164,74,0.12) 100%)", color: is75 ? "#E0A44A" : "var(--purple)", fontWeight: 600, boxShadow: `inset 2px 0 0 ${is75 ? "#E0A44A" : "var(--purple)"}` }
                  : { color: is75 ? "#E0A44A" : "var(--text-muted)" }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; (e.currentTarget as HTMLElement).style.color = is75 ? "#E0A44A" : "var(--purple)"; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = is75 ? "#E0A44A" : "var(--text-muted)"; } }}
                title={collapsed ? label : undefined}>
                <Icon size={17} className="flex-shrink-0" />
                {!collapsed && <span className="font-medium truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="px-4 pb-6 space-y-3">
            <Link href="/modules"
              className="flex items-center gap-2 text-[11px] rounded-lg px-2 py-1.5 transition-colors"
              style={{ color: "var(--text-light)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <SlidersHorizontal size={13} className="flex-shrink-0" />
              {pausedCount > 0 ? `${pausedCount} paused` : "Sections"}
            </Link>
            <SaveIndicator saving={saving} />
          </div>
        )}
        {collapsed && (
          <Link href="/modules" title={pausedCount > 0 ? `${pausedCount} sections paused` : "Sections"}
            className="mx-auto mb-5 p-1.5 rounded-lg" style={{ color: "var(--text-light)" }}>
            <SlidersHorizontal size={15} />
          </Link>
        )}
      </aside>

      {/* ── Mobile bottom nav (hidden on md+) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
        style={{
          background: "var(--surface)",
          borderTop: "1.5px solid var(--border)",
          boxShadow: "0 -4px 24px rgba(180,85,47,0.1)",
          // The page is rendered edge-to-edge (viewport-fit=cover), so the tab
          // row would otherwise sit under the iPhone home indicator — which is
          // why it looked wrong installed but fine in Safari.
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
        {mobileMain.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const is75 = href === "/75hard";
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: active ? (is75 ? "#E0A44A" : "var(--purple)") : "var(--text-muted)" }}>
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
        <button onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
          style={{ color: "var(--text-muted)" }}>
          <MoreHorizontal size={20} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* ── More drawer overlay ── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setMoreOpen(false)}>
          <div className="rounded-t-3xl p-5" style={{
              background: "var(--surface)",
              border: "1.5px solid var(--border)",
              paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
            }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg" style={{ color: "var(--text)" }}>Navigation</h2>
              <button onClick={() => setMoreOpen(false)} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                const is75 = href === "/75hard";
                return (
                  <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl transition-colors"
                    style={active
                      ? { background: "linear-gradient(135deg, rgba(180,85,47,0.15), rgba(224,164,74,0.12))", color: is75 ? "#E0A44A" : "var(--purple)" }
                      : { background: "var(--bg)", color: is75 ? "#E0A44A" : "var(--text-muted)" }}>
                    <Icon size={22} />
                    <span className="text-xs font-medium text-center leading-tight">{label}</span>
                  </Link>
                );
              })}
            </div>
            <Link href="/modules" onClick={() => setMoreOpen(false)}
              className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-semibold"
              style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
              <SlidersHorizontal size={14} />
              {pausedCount > 0 ? `${pausedCount} sections paused` : "Choose sections"}
            </Link>
            {saving && <div className="mt-4"><SaveIndicator saving={saving} /></div>}
          </div>
        </div>
      )}
    </>
  );
}
