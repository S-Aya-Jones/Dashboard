import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brown: {
          DEFAULT: "#785b4e",
          light: "#866a5b",
          dark: "#5c4439",
        },
        terracotta: {
          DEFAULT: "#c47a5e",
          light: "#d4927a",
          dark: "#a8624a",
        },
        sage: {
          DEFAULT: "#7a816c",
          light: "#8e967d",
          dark: "#636b58",
        },
        rose: {
          DEFAULT: "#d68d84",
          light: "#e0a89f",
          muted: "#c98a86",
        },
        sand: {
          DEFAULT: "#cfbb9f",
          light: "#ddd0b8",
          dark: "#b8a280",
        },
        cream: {
          DEFAULT: "#f6efdf",
          dark: "#ede3ce",
          darker: "#e0d5c0",
        },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 15px rgba(120, 91, 78, 0.08)",
        card: "0 4px 20px rgba(120, 91, 78, 0.10)",
        "card-hover": "0 6px 25px rgba(120, 91, 78, 0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "gentle-bounce": "gentleBounce 0.5s ease-in-out",
        pop: "pop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        gentleBounce: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        pop: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
