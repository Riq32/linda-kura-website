import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { bg: "var(--bg)", panel: "var(--panel)", "kenya-black": "var(--kenya-black)", "kenya-red": "var(--kenya-red)", "kenya-green": "var(--kenya-green)", gold: "var(--accent-gold)", ink: "var(--ink)", dim: "var(--ink-dim)" },
      borderRadius: { continuous: "var(--radius-continuous)", panel: "var(--radius-panel)" },
      transitionTimingFunction: { spring: "var(--spring)" },
      boxShadow: { elevation: "var(--shadow-elevation)" },
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        display: ["var(--font-sans)", "Plus Jakarta Sans", "Inter", "sans-serif"],
        data: ["var(--font-mono)", "JetBrains Mono", "monospace"]
      }
    }
  },
  plugins: []
};
export default config;
