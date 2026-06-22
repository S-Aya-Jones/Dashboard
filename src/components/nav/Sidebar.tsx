"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun, Calendar, Brain, BookOpen,
  Sparkles, DollarSign,
  ChevronLeft, ChevronRight, Dumbbell, Gem, UtensilsCrossed,
  MessageSquare, LayoutGrid, MoreHorizontal, X, Smartphone, Zap, Moon
} from "lucide-react";
import { useState } from "react";
import { SaveIndicator } from "@/components/ui/SaveIndicator";
import { useTheme } from "@/hooks/useTheme";

const navItems = [
  { href: "/75hard",       label: "75 Hard",          icon: Zap },
  { href: "/",             label: "Today",            icon: Sun },
  { href: "/week",         label: "This Week",        icon: Calendar },
  { href: "/exposure",     label: "Exposure Therapy", icon: Brain },
  { href: "/mcat",         label: "Med School",       icon: BookOpen },
  { href: "/fitness",      label: "Fitness",          icon: Dumbbell },
  { href: "/skincare",     label: "Skincare",         icon: Sparkles },
  { href: "/finances",     label: "Finances",         icon: DollarSign },
  { href: "/messages",     label: "Messages",         icon: MessageSquare },
  { href: "/shortcuts",    label: "Text Dashboard",   icon: Smartphone },
  { href: "/integrations", label: "Integrations",     icon: LayoutGrid },
  { href: "/vision",       label: "Vision",           icon: Gem },
  { href: "/nutrition",    label: "Food Journal",     icon: UtensilsCrossed },
];

const mobileMain = [
  { href: "/75hard",       label: "75 Hard",      icon: Zap },
  { href: "/",             label: "Today",        icon: Sun },
  { href: "/finances",     label: "Finances",     icon: DollarSign },
  { href: "/mcat",         label: "Med",          icon: BookOpen },
  { href: "/fitness",      label: "Fitness",      icon: Dumbbell },
];

interface SidebarProps {
  saving?: boolean;
}

function isActive(pathname: string, href: string) {
  return pathname === href
    || (href === "/mcat"    && ["/school", "/shadowing"].includes(pathname))
    || (href === "/fitness" && pathname === "/workout");
}

export function Sidebar({ saving = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 flex-shrink-0 ${collapsed ? "w-16" : "w-56"}`}
        style={{
          background: "var(--surface)",
          borderRight: "1.5px solid var(--border)",
          boxShadow: "4px 0 24px rgba(124,92,252,0.08)",
        }}
      >
        <div className={`px-4 pt-6 pb-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div>
              <h1 className="font-serif text-2xl leading-tight"
                style={{ background: "var(--grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Aya&apos;s
              </h1>
              <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--text-muted)" }}>Dashboard</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; (e.currentTarget as HTMLElement).style.color = "var(--purple)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            const is75 = href === "/75hard";
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${collapsed ? "justify-center" : ""}`}
                style={active
                  ? { background: is75 ? "linear-gradient(135deg, rgba(232,121,249,0.2) 0%, rgba(124,92,252,0.15) 100%)" : "linear-gradient(135deg, rgba(124,92,252,0.15) 0%, rgba(232,121,249,0.12) 100%)", color: is75 ? "#E879F9" : "var(--purple)", fontWeight: 600, boxShadow: `inset 2px 0 0 ${is75 ? "#E879F9" : "var(--purple)"}` }
                  : { color: is75 ? "#E879F9" : "var(--text-muted)" }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; (e.currentTarget as HTMLElement).style.color = is75 ? "#E879F9" : "var(--purple)"; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = is75 ? "#E879F9" : "var(--text-muted)"; } }}
                title={collapsed ? label : undefined}>
                <Icon size={17} className="flex-shrink-0" />
                {!collapsed && <span className="font-medium truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`px-4 pb-2 ${collapsed ? "flex justify-center" : ""}`}>
          <button onClick={toggleTheme}
            className={`flex items-center gap-2 rounded-xl text-sm font-medium transition-colors ${collapsed ? "p-2" : "w-full px-3 py-2"}`}
            style={{ color: "var(--text-muted)", background: "var(--bg)" }}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
          </button>
        </div>

        {!collapsed && (
          <div className="px-4 pb-6">
            <SaveIndicator saving={saving} />
          </div>
        )}
      </aside>

      {/* ── Mobile bottom nav (hidden on md+) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
        style={{ background: "var(--surface)", borderTop: "1.5px solid var(--border)", boxShadow: "0 -4px 24px rgba(124,92,252,0.1)" }}>
        {mobileMain.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const is75 = href === "/75hard";
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: active ? (is75 ? "#E879F9" : "var(--purple)") : "var(--text-muted)" }}>
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
          <div className="rounded-t-3xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg" style={{ color: "var(--text)" }}>Navigation</h2>
              <div className="flex items-center gap-2">
                <button onClick={toggleTheme} className="p-2 rounded-lg" style={{ color: "var(--text-muted)", background: "var(--bg)" }}>
                  {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button onClick={() => setMoreOpen(false)} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                const is75 = href === "/75hard";
                return (
                  <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl transition-colors"
                    style={active
                      ? { background: "linear-gradient(135deg, rgba(124,92,252,0.15), rgba(232,121,249,0.12))", color: is75 ? "#E879F9" : "var(--purple)" }
                      : { background: "var(--bg)", color: is75 ? "#E879F9" : "var(--text-muted)" }}>
                    <Icon size={22} />
                    <span className="text-xs font-medium text-center leading-tight">{label}</span>
                  </Link>
                );
              })}
            </div>
            {saving && <div className="mt-4"><SaveIndicator saving={saving} /></div>}
          </div>
        </div>
      )}
    </>
  );
}
