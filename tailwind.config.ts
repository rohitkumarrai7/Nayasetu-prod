import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0b1b33", soft: "#33415c", muted: "#64708a" },
        // Deep navy — trust, the court.
        brand: { DEFAULT: "#13305c", light: "#1f4b8f", 50: "#eef3fb", 100: "#d9e4f5", 600: "#1a3f78", 700: "#13305c", 900: "#0b1b33" },
        // Saffron — the "setu" (bridge) accent.
        saffron: { DEFAULT: "#d9822b", 50: "#fdf5ec", 100: "#fae6cf", 500: "#e8963c", 600: "#d9822b", 700: "#b4651a" },
        paper: { DEFAULT: "#f7f5f0", dark: "#efebe3" },
        line: "#e4e0d6",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,27,51,0.04), 0 1px 3px rgba(11,27,51,0.06)",
        lift: "0 8px 24px -8px rgba(11,27,51,0.18)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "fade-up": "fade-up .35s ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
