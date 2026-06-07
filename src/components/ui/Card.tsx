"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  floating?: boolean;
  gradient?: boolean;
}

export function Card({ children, className = "", title, subtitle, action, floating, gradient }: CardProps) {
  const cls = gradient ? "card-gradient" : floating ? "card-floating" : "card";
  return (
    <div className={`${cls} p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <h2 className="font-serif text-xl" style={{ color: gradient ? "#fff" : "var(--text)" }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm mt-0.5" style={{ color: gradient ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
