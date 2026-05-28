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
          DEFAULT: "#FFFFFF",
          light: "rgba(255,255,255,0.7)",
          dark: "#F0F0F0",
        },
        terracotta: {
          DEFAULT: "#C8FF00",
          light: "#D4FF33",
          dark: "#A8D400",
        },
        sage: {
          DEFAULT: "#9B7FFF",
          light: "#B09FFF",
          dark: "#7B5FDF",
        },
        rose: {
          DEFAULT: "#FF6B9D",
          light: "#FF8AB5",
          muted: "#FF4A84",
        },
        sand: {
          DEFAULT: "rgba(255,255,255,0.35)",
          light: "rgba(255,255,255,0.5)",
          dark: "rgba(255,255,255,0.55)",
        },
        cream: {
          DEFAULT: "#1A1A1A",
          dark: "#222222",
          darker: "#2A2A2A",
        },
      },
      fontFamily: {
        serif: ["Space Grotesk", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 15px rgba(0,0,0,0.3)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
        "card-hover": "0 6px 32px rgba(0,0,0,0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "gentle-bounce": "gentleBounce 0.5s ease-in-out",
        pop: "pop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        marquee: "marquee 50s linear infinite",
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
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
