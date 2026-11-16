import type { Config } from "tailwindcss";

// Design tokens live in app/globals.css (:root). Tailwind only maps names to them,
// so a colour or radius is changed in one place.
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "var(--ink)", soft: "var(--ink-soft)" },
        muted: "var(--muted)",
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        paper: { DEFAULT: "var(--paper)", sunk: "var(--paper-sunk)" },
        sand: "var(--bg)",
        sea: {
          DEFAULT: "var(--sea)",
          deep: "var(--sea-deep)",
          mid: "var(--sea-mid)",
          soft: "var(--sea-soft)",
          line: "var(--sea-line)",
        },
        coral: {
          DEFAULT: "var(--coral)",
          deep: "var(--coral-deep)",
          soft: "var(--coral-soft)",
          line: "var(--coral-line)",
        },
        // Earlier class names kept as aliases of the accent.
        tangerine: { DEFAULT: "var(--coral)", soft: "var(--coral-soft)" },
        leaf: { DEFAULT: "var(--leaf)", soft: "var(--leaf-soft)" },
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        float: "var(--shadow-float)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        ctl: "var(--radius-ctl)",
      },
    },
  },
  plugins: [],
};
export default config;
