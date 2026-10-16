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
        /* Every colour resolves through a CSS variable holding raw channels,
           so the whole palette flips with the theme and Tailwind's /opacity
           modifiers still work. The legacy names below are kept because they
           are used across 20+ component files; they now point at semantic
           tokens rather than the old violet system. */
        purple: {
          DEFAULT: "rgb(var(--c-clay) / <alpha-value>)",
          light:   "rgb(var(--c-gold) / <alpha-value>)",
          dark:    "rgb(var(--c-clay) / <alpha-value>)",
          soft:    "rgb(var(--c-clay) / 0.12)",
        },
        pink: {
          DEFAULT: "rgb(var(--c-red) / <alpha-value>)",
          light:   "rgb(var(--c-red) / 0.7)",
          dark:    "rgb(var(--c-red) / <alpha-value>)",
          soft:    "rgb(var(--c-red) / 0.12)",
        },
        peach: {
          DEFAULT: "rgb(var(--c-gold) / <alpha-value>)",
          light:   "rgb(var(--c-gold) / 0.7)",
          dark:    "rgb(var(--c-clay) / <alpha-value>)",
          soft:    "rgb(var(--c-gold) / 0.12)",
        },
        surface: {
          DEFAULT: "rgb(var(--c-surface) / <alpha-value>)",
          2:       "rgb(var(--c-bg) / <alpha-value>)",
          3:       "rgb(var(--c-bg2) / <alpha-value>)",
        },
        bg: {
          DEFAULT: "rgb(var(--c-bg) / <alpha-value>)",
          2:       "rgb(var(--c-bg2) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--c-text) / <alpha-value>)",
          muted:   "rgb(var(--c-text-muted) / <alpha-value>)",
          light:   "rgb(var(--c-text-light) / <alpha-value>)",
        },

        /* ── Legacy aliases ─────────────────────────── */

        /* page and card fills */
        cream: {
          DEFAULT: "rgb(var(--c-bg) / <alpha-value>)",
          dark:    "rgb(var(--c-bg2) / <alpha-value>)",
          darker:  "rgb(var(--c-text) / 0.10)",
        },

        /* body text */
        brown: {
          DEFAULT: "rgb(var(--c-text) / <alpha-value>)",
          light:   "rgb(var(--c-text-muted) / <alpha-value>)",
          dark:    "rgb(var(--c-text) / <alpha-value>)",
        },

        /* primary accent */
        terracotta: {
          DEFAULT: "rgb(var(--c-clay) / <alpha-value>)",
          light:   "rgb(var(--c-gold) / <alpha-value>)",
          dark:    "rgb(var(--c-clay) / <alpha-value>)",
        },

        /* success / calm */
        sage: {
          DEFAULT: "rgb(var(--c-sage) / <alpha-value>)",
          light:   "rgb(var(--c-sage) / 0.7)",
          dark:    "rgb(var(--c-sage) / <alpha-value>)",
        },

        /* danger */
        rose: {
          DEFAULT: "rgb(var(--c-red) / <alpha-value>)",
          light:   "rgb(var(--c-red) / 0.65)",
          muted:   "rgb(var(--c-red) / 0.8)",
        },

        /* hairlines and muted type */
        sand: {
          DEFAULT: "rgb(var(--c-text-light) / 0.35)",
          light:   "rgb(var(--c-text-light) / 0.22)",
          dark:    "rgb(var(--c-text-light) / <alpha-value>)",
        },
      },
      fontFamily: {
        serif: ["Space Grotesk", "system-ui", "sans-serif"],
        sans:  ["Inter",         "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft:        "0 2px 12px rgba(28,22,19,0.08)",
        card:        "0 4px 24px rgba(28,22,19,0.10)",
        "card-md":   "0 8px 32px rgba(28,22,19,0.14)",
        "card-lg":   "0 16px 48px rgba(28,22,19,0.18)",
        "card-hover":"0 20px 60px rgba(28,22,19,0.22)",
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
