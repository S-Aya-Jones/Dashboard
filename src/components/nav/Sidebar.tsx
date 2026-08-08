"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun, Calendar, Brain, BookOpen,
  Sparkles, DollarSign,
  ChevronLeft, ChevronRight, Dumbbell, Gem, UtensilsCrossed,
  LayoutGrid, MoreHorizontal, X, Zap, Shield, Bell, Mail, Clock, Mic, ListChecks, GraduationCap, Users
} from "lucide-react";
import { useState } from "react";
import { SaveIndicator } from "@/components/ui/SaveIndicator";

const navItems = [
  { href: "/",             label: "Today",            icon: Sun },
  { href: "/schedule",     label: "Schedule",         icon: Clock },
  { href: "/lectures",     label: "Lecture Studio",   icon: Mic },
  { href: "/qbank",        label: "Question Bank",    icon: ListChecks },
  { href: "/exposure",     label: "Exposure",         icon: Brain },
  { href: "/school-inbox", label: "School Inbox",     icon: Mail },
  { href: "/tutor",        label: "Tutor",            icon: GraduationCap },
  { href: "/partners",     label: "Study Partners",   icon: Users },
  { href: "/mcat",         label: "Med School",       icon: BookOpen },
  { href: "/finances",     label: "Finances",         icon: DollarSign },
  { href: "/reminders",    label: "Telegram",         icon: Bell },
  { href: "/felt-safety",  label: "Felt Safety",      icon: Shield },
  { href: "/fitness",      label: "Fitness",          icon: Dumbbell },
  { href: "/skincare",     label: "Skincare",         icon: Sparkles },
  { href: "/nutrition",    label: "Food",             icon: UtensilsCrossed },
  { href: "/vision",       label: "Vision",           icon: Gem },
];

const mobileMain = [
  { href: "/",          label: "Today",    icon: Sun },
  { href: "/schedule",  label: "Schedule", icon: Clock },
  { href: "/lectures",  label: "Lectures", icon: Mic },
  { href: "/tutor",     label: "Tutor",    icon: GraduationCap },
  { href: "/exposure",  label: "Exposure", icon: Brain },
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
          <div className="px-4 pb-6">
            <SaveIndicator saving={saving} />
          </div>
        )}
      </aside>

      {/* ── Mobile bottom nav (hidden on md+) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
        style={{ background: "var(--surface)", borderTop: "1.5px solid var(--border)", boxShadow: "0 -4px 24px rgba(180,85,47,0.1)" }}>
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
          <div className="rounded-t-3xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
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
            {saving && <div className="mt-4"><SaveIndicator saving={saving} /></div>}
          </div>
        </div>
      )}
    </>
  );
}
