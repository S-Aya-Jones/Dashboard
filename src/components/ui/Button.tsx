"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gradient";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variants = {
  primary:   "text-white font-semibold",
  secondary: "border font-medium",
  ghost:     "font-medium",
  danger:    "text-white font-semibold",
  gradient:  "text-white font-semibold",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const inlineStyles: Record<string, React.CSSProperties> = {
  primary:   { background: "var(--purple)", boxShadow: "0 2px 12px rgba(124,92,252,0.3)" },
  secondary: { background: "transparent", borderColor: "var(--border2)", color: "var(--purple)" },
  ghost:     { background: "transparent", color: "var(--text-muted)" },
  danger:    { background: "var(--red)", boxShadow: "0 2px 12px rgba(239,68,68,0.3)" },
  gradient:  { background: "var(--grad)", boxShadow: "0 4px 16px rgba(124,92,252,0.35)" },
};

export function Button({ variant = "primary", size = "md", className = "", style, children, ...props }: ButtonProps) {
  return (
    <button
      className={`
        ${variants[variant]} ${sizes[size]}
        rounded-xl font-sans
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer hover:opacity-90 active:scale-95
        ${className}
      `}
      style={{ ...inlineStyles[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
