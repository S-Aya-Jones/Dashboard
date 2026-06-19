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
        /* ── New semantic tokens ───────────────────── */
        purple: {
          DEFAULT: "#7C5CFC",
          light:   "#9B7FFF",
          dark:    "#5A3FD4",
          soft:    "rgba(124,92,252,0.12)",
        },
        pink: {
          DEFAULT: "#E879F9",
          light:   "#F0A5FF",
          dark:    "#C855D8",
          soft:    "rgba(232,121,249,0.12)",
        },
        peach: {
          DEFAULT: "#FB923C",
          light:   "#FDBA74",
          dark:    "#EA7010",
          soft:    "rgba(251,146,60,0.12)",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          2:       "#FAF8FF",
          3:       "#F4F0FE",
        },
        bg: {
          DEFAULT: "#F4F0FE",
          2:       "#EDE8FF",
        },
        ink: {
          DEFAULT: "#1E1340",
          muted:   "#7C6FAE",
          light:   "#A89ECC",
        },

        /* ── Legacy aliases — remapped to light-mode ─
           All the old dark-theme token names used across
           20+ component files now resolve to light-mode
           equivalents so no per-file text rewrites needed.
        ─────────────────────────────────────────────── */

        /* was #1A1A1A / #222 / #2A2A2A → light lavender bg */
        cream: {
          DEFAULT: "#F4F0FE",
          dark:    "#EDE8FF",
          darker:  "rgba(124,92,252,0.12)",
        },

        /* was #FFFFFF / rgba(255,255,255,0.7) → dark ink text */
        brown: {
          DEFAULT: "#1E1340",
          light:   "#7C6FAE",
          dark:    "#2A1F6E",
        },

        /* was #C8FF00 (lime) → purple primary */
        terracotta: {
          DEFAULT: "#7C5CFC",
          light:   "#9B7FFF",
          dark:    "#5A3FD4",
        },

        /* was #9B7FFF (purple) → pink secondary */
        sage: {
          DEFAULT: "#E879F9",
          light:   "#F0A5FF",
          dark:    "#C855D8",
        },

        /* was hot-pink → danger red */
        rose: {
          DEFAULT: "#EF4444",
          light:   "#FCA5A5",
          muted:   "#DC2626",
        },

        /* was rgba(255,255,255,0.35) → purple-tinted muted */
        sand: {
          DEFAULT: "rgba(124,92,252,0.18)",
          light:   "rgba(124,92,252,0.28)",
          dark:    "#7C6FAE",
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
