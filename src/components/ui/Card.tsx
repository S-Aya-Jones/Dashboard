"use client";

import { ReactNode } from "react";

type BubbleColor = "mint" | "lavender" | "peach" | "pink" | "lemon" | "sky" | "rose" | "lilac";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  floating?: boolean;
  gradient?: boolean;
  bubble?: BubbleColor;
}

export function Card({ children, className = "", title, subtitle, action, floating, gradient, bubble }: CardProps) {
  const cls = bubble
    ? `card-${bubble}`
    : gradient
    ? "card-gradient"
    : floating
    ? "card-floating"
    : "card";

  const onBubble = !!bubble || gradient;

  return (
    <div className={`${cls} p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between mb-4" style={{ position: "relative", zIndex: 2 }}>
          <div>
            {title && (
              <h2 className="font-serif text-xl" style={{ color: onBubble ? "rgba(30,19,64,0.85)" : "var(--text)" }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm mt-0.5" style={{ color: onBubble ? "rgba(30,19,64,0.6)" : "var(--text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}
