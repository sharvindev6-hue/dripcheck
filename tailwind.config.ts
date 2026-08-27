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
        bg: "var(--bg)",
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
        },
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--muted)",
          faint: "var(--faint)",
        },
        hairline: "var(--hairline)",
        "hairline-strong": "var(--hairline-strong)",
        cta: "var(--cta)",
        "cta-text": "var(--cta-text)",
        champagne: {
          start: "var(--champagne-start)",
          end: "var(--champagne-end)",
        },
        brick: "var(--brick)",
        sage: "var(--sage)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        luxe: "0 18px 50px rgba(0, 0, 0, 0.24)",
        "ai-glow": "0 0 24px rgba(233, 211, 172, 0.25)",
      },
      borderRadius: {
        card: "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
