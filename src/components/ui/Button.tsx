"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variants = {
  primary: "bg-terracotta text-black hover:bg-terracotta-dark font-semibold",
  secondary: "bg-transparent text-white border border-white/20 hover:bg-white/5",
  ghost: "bg-transparent text-white/70 hover:bg-white/5",
  danger: "bg-rose text-white hover:bg-rose-muted",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={`
        ${variants[variant]} ${sizes[size]}
        rounded-lg font-sans font-medium
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
