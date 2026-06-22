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
        /* ── New semantic tokens (Aya dark/aurora palette) ── */
        purple: {
          DEFAULT: "#8B6CF2",
          light:   "#A78BFA",
          dark:    "#6B4FD0",
          soft:    "rgba(139,108,242,0.16)",
        },
        pink: {
          DEFAULT: "#E8559A",
          light:   "#F286B8",
          dark:    "#C23E7D",
          soft:    "rgba(232,85,154,0.16)",
        },
        peach: {
          DEFAULT: "#F2845B",
          light:   "#F7AB8A",
          dark:    "#D4663D",
          soft:    "rgba(242,132,91,0.16)",
        },
        surface: {
          DEFAULT: "#1E1233",
          2:       "#261A45",
          3:       "#2E2052",
        },
        bg: {
          DEFAULT: "#170B2E",
          2:       "#20123F",
        },
        ink: {
          DEFAULT: "#F5F1FB",
          muted:   "rgba(245,241,251,0.62)",
          light:   "rgba(245,241,251,0.4)",
        },

        /* ── Legacy aliases — remapped to dark/aurora mode ─
           All the old token names used across 20+ component
           files now resolve to the dark palette so no
           per-file text rewrites needed.
        ─────────────────────────────────────────────── */

        cream: {
          DEFAULT: "#20123F",
          dark:    "#170B2E",
          darker:  "rgba(255,255,255,0.08)",
        },

        brown: {
          DEFAULT: "#F5F1FB",
          light:   "rgba(245,241,251,0.62)",
          dark:    "#FFFFFF",
        },

        terracotta: {
          DEFAULT: "#8B6CF2",
          light:   "#A78BFA",
          dark:    "#6B4FD0",
        },

        sage: {
          DEFAULT: "#E8559A",
          light:   "#F286B8",
          dark:    "#C23E7D",
        },

        rose: {
          DEFAULT: "#F25B5B",
          light:   "#FCA5A5",
          muted:   "#DC2626",
        },

        sand: {
          DEFAULT: "rgba(245,241,251,0.18)",
          light:   "rgba(245,241,251,0.28)",
          dark:    "rgba(245,241,251,0.55)",
        },
      },
      fontFamily: {
        serif: ["Space Grotesk", "system-ui", "sans-serif"],
        sans:  ["Inter",         "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft:        "0 2px 12px rgba(124,92,252,0.10)",
        card:        "0 4px 24px rgba(124,92,252,0.12)",
        "card-md":   "0 8px 32px rgba(124,92,252,0.18)",
        "card-lg":   "0 16px 48px rgba(124,92,252,0.24)",
        "card-hover":"0 20px 60px rgba(124,92,252,0.30)",
      },
      animation: {
        "fade-in":       "fadeIn 0.4s ease-out",
        "slide-up":      "slideUp 0.3s ease-out",
        "gentle-bounce": "gentleBounce 0.5s ease-in-out",
        pop:             "pop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        marquee:         "marquee 50s linear infinite",
        float:           "floatUp 4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        gentleBounce: {
          "0%, 100%": { transform: "scale(1)" },
          "50%":      { transform: "scale(1.05)" },
        },
        pop: {
          "0%":   { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        marquee: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        floatUp: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
