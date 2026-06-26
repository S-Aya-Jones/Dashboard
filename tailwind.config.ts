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
        /* ── Semantic tokens — all driven by CSS vars in globals.css so
           switching [data-theme] flips every one of these app-wide. ── */
        purple: {
          DEFAULT: "var(--purple)",
          light:   "var(--purple-lt)",
          dark:    "var(--purple-dark)",
          soft:    "var(--purple-soft)",
        },
        pink: {
          DEFAULT: "var(--pink)",
          light:   "var(--pink-light)",
          dark:    "var(--pink-dark)",
          soft:    "var(--pink-soft)",
        },
        peach: {
          DEFAULT: "var(--peach)",
          light:   "var(--peach-light)",
          dark:    "var(--peach-dark)",
          soft:    "var(--peach-soft)",
        },
        surface: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          2:       "var(--surface2)",
          3:       "var(--surface3)",
        },
        bg: {
          DEFAULT: "var(--bg)",
          2:       "var(--bg2)",
        },
        ink: {
          DEFAULT: "var(--text)",
          muted:   "var(--text-muted)",
          light:   "var(--text-light)",
        },

        /* ── Legacy aliases — same CSS vars, kept so the 20+ component
           files using these old token names resolve correctly in both
           themes with no per-file rewrites needed.
        ─────────────────────────────────────────────── */

        cream: {
          DEFAULT: "var(--cream)",
          dark:    "var(--cream-dark)",
          darker:  "var(--cream-darker)",
        },

        brown: {
          DEFAULT: "rgb(var(--brown-rgb) / <alpha-value>)",
          light:   "var(--brown-light)",
          dark:    "var(--brown-dark)",
        },

        terracotta: {
          DEFAULT: "rgb(var(--terracotta-rgb) / <alpha-value>)",
          light:   "var(--purple-lt)",
          dark:    "var(--purple-dark)",
        },

        sage: {
          DEFAULT: "rgb(var(--sage-rgb) / <alpha-value>)",
          light:   "var(--pink-light)",
          dark:    "var(--pink-dark)",
        },

        rose: {
          DEFAULT: "rgb(var(--rose-rgb) / <alpha-value>)",
          light:   "var(--rose-light)",
          muted:   "var(--rose-muted)",
        },

        sand: {
          DEFAULT: "var(--sand)",
          light:   "var(--sand-light)",
          dark:    "var(--sand-dark)",
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
