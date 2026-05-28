"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun, Calendar, CheckSquare, Brain, BookOpen, Activity,
  Heart, Sparkles, DollarSign, Users, Star, Target, BookMarked,
  Globe, ChevronLeft, ChevronRight, Dumbbell, Gem, UtensilsCrossed
} from "lucide-react";
import { useState } from "react";
import { SaveIndicator } from "@/components/ui/SaveIndicator";

const navItems = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/week", label: "This Week", icon: Calendar },
  { href: "/habits", label: "Habits", icon: CheckSquare },
  { href: "/exposure", label: "Exposure Therapy", icon: Brain },
  { href: "/mcat", label: "MCAT Prep", icon: BookOpen },
  { href: "/school", label: "School & Schedule", icon: Target },
  { href: "/shadowing", label: "Shadowing", icon: Activity },
  { href: "/fitness", label: "Fitness & Sleep", icon: Dumbbell },
  { href: "/skincare", label: "Skincare", icon: Sparkles },
  { href: "/finances", label: "Finances", icon: DollarSign },
  { href: "/connections", label: "Connections", icon: Users },
  { href: "/wins", label: "Wins Jar", icon: Star },
  { href: "/goals", label: "Goals", icon: Heart },
  { href: "/books", label: "Books", icon: BookMarked },
  { href: "/year", label: "Year View", icon: Globe },
  { href: "/vision", label: "Vision", icon: Gem },
  { href: "/nutrition", label: "Food Journal", icon: UtensilsCrossed },
];

interface SidebarProps {
  saving?: boolean;
}

export function Sidebar({ saving = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        flex flex-col h-screen sticky top-0
        border-r border-white/8 transition-all duration-300
        ${collapsed ? "w-16" : "w-56"}
      `}
      style={{ background: "#0D0D0D" }}
    >
      {/* Logo */}
      <div className={`px-4 pt-6 pb-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div>
            <h1 className="font-serif text-2xl text-white leading-tight">Aya&apos;s</h1>
            <p className="text-xs font-medium tracking-wide" style={{ color: "#C8FF00" }}>Dashboard</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm transition-all duration-150
                ${active
                  ? "shadow-soft"
                  : "text-white/50 hover:text-white hover:bg-white/5"
                }
                ${collapsed ? "justify-center" : ""}
              `}
              style={active ? { color: "#C8FF00", background: "rgba(200,255,0,0.1)" } : undefined}
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
        <div className="px-4 pb-4">
          <SaveIndicator saving={saving} />
        </div>
      )}
    </aside>
  );
}
