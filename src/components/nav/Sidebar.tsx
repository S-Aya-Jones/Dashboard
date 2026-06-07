"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun, Calendar, CheckSquare, Brain, BookOpen,
  Heart, Sparkles, DollarSign, Users, Star, BookMarked,
  Globe, ChevronLeft, ChevronRight, Dumbbell, Gem, UtensilsCrossed,
  MessageSquare
} from "lucide-react";
import { useState } from "react";
import { SaveIndicator } from "@/components/ui/SaveIndicator";

const navItems = [
  { href: "/",          label: "Today",            icon: Sun },
  { href: "/week",      label: "This Week",        icon: Calendar },
  { href: "/habits",    label: "Habits",           icon: CheckSquare },
  { href: "/exposure",  label: "Exposure Therapy", icon: Brain },
  { href: "/mcat",      label: "Med School",       icon: BookOpen },
  { href: "/fitness",   label: "Fitness",          icon: Dumbbell },
  { href: "/skincare",  label: "Skincare",         icon: Sparkles },
  { href: "/finances",  label: "Finances",         icon: DollarSign },
  { href: "/connections",label:"Connections",      icon: Users },
  { href: "/messages",  label: "Messages",         icon: MessageSquare },
  { href: "/wins",      label: "Wins Jar",         icon: Star },
  { href: "/goals",     label: "Goals",            icon: Heart },
  { href: "/books",     label: "Books",            icon: BookMarked },
  { href: "/year",      label: "Year View",        icon: Globe },
  { href: "/vision",    label: "Vision",           icon: Gem },
  { href: "/nutrition", label: "Food Journal",     icon: UtensilsCrossed },
];

interface SidebarProps {
  saving?: boolean;
}

export function Sidebar({ saving = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside
      className={`flex flex-col h-screen sticky top-0 transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}
      style={{
        background: "var(--surface)",
        borderRight: "1.5px solid var(--border)",
        boxShadow: "4px 0 24px rgba(124,92,252,0.08)",
      }}
    >
      {/* Logo */}
      <div className={`px-4 pt-6 pb-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div>
            <h1
              className="font-serif text-2xl leading-tight"
              style={{ background: "var(--grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              Aya&apos;s
            </h1>
            <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--text-muted)" }}>
              Dashboard
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "var(--bg)";
            (e.currentTarget as HTMLElement).style.color = "var(--purple)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
            || (href === "/mcat"    && ["/school", "/shadowing"].includes(pathname))
            || (href === "/fitness" && pathname === "/workout");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${collapsed ? "justify-center" : ""}`}
              style={active
                ? {
                    background: "linear-gradient(135deg, rgba(124,92,252,0.15) 0%, rgba(232,121,249,0.12) 100%)",
                    color: "var(--purple)",
                    fontWeight: 600,
                    boxShadow: "inset 2px 0 0 var(--purple)",
                  }
                : { color: "var(--text-muted)" }
              }
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "var(--bg)";
                  (e.currentTarget as HTMLElement).style.color = "var(--purple)";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                }
              }}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && <span className="font-medium truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Save indicator */}
      {!collapsed && (
        <div className="px-4 pb-6">
          <SaveIndicator saving={saving} />
        </div>
      )}
    </aside>
  );
}
