import type { Config } from "tailwindcss";

/**
 * Tailwind is a convenience layer only. The canonical visual language lives in
 * `src/styles/tokens.css`, `shell.css`, and `screens.css` and is documented in
 * DESIGN.md. Never introduce a colour that is not one of these tokens.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        s1: "var(--s1)",
        s2: "var(--s2)",
        ph: "var(--ph)",
        ph2: "var(--ph2)",
        ink: "var(--ink)",
        mu: "var(--mu)",
        rule: "var(--rule)",
        ac: "var(--ac)",
        hi: "var(--hi)",
        onac: "var(--onac)",
        bk: "var(--bk)",
        ok: "var(--ok)",
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "Archivo",
          "Arial Narrow",
          "system-ui",
          "sans-serif",
        ],
        body: ["var(--font-body)", "Instrument Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        field: "12px",
        card: "14px",
        art: "16px",
        sheet: "20px",
        phone: "54px",
      },
      boxShadow: {
        ring: "inset 0 0 0 1px var(--rule)",
        "ring-strong": "inset 0 0 0 1.5px var(--ink)",
        phone:
          "0 0 0 9px #0c0b09, 0 0 0 11px #3a372f, 0 40px 80px -10px rgba(23,21,15,.5)",
      },
      transitionTimingFunction: {
        brand: "cubic-bezier(.22,1,.36,1)",
      },
    },
  },
  plugins: [],
};

export default config;
