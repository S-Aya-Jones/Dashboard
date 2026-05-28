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
          DEFAULT: "#342A21",
          light: "#4A3728",
          dark: "#2A2018",
        },
        terracotta: {
          DEFAULT: "#DA667B",
          light: "#E8899A",
          dark: "#C24862",
        },
        sage: {
          DEFAULT: "#71816D",
          light: "#8A9E87",
          dark: "#5A6E58",
        },
        rose: {
          DEFAULT: "#DA667B",
          light: "#E8899A",
          muted: "#E07084",
        },
        sand: {
          DEFAULT: "#C9B79C",
          light: "#D9CDBB",
          dark: "#A8967E",
        },
        cream: {
          DEFAULT: "#F1E0C5",
          dark: "#E8D4B0",
          darker: "#DAC9A8",
        },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 15px rgba(52, 42, 33, 0.08)",
        card: "0 4px 20px rgba(52, 42, 33, 0.10)",
        "card-hover": "0 6px 25px rgba(52, 42, 33, 0.15)",
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
