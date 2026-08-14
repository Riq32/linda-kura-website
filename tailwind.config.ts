import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { bg: "var(--bg)", panel: "var(--panel)", "kenya-black": "var(--kenya-black)", "kenya-red": "var(--kenya-red)", "kenya-green": "var(--kenya-green)", gold: "var(--accent-gold)", ink: "var(--ink)", dim: "var(--ink-dim)" },
      borderRadius: { continuous: "var(--radius-continuous)", panel: "var(--radius-panel)" },
      transitionTimingFunction: { spring: "var(--spring)" },
      boxShadow: { elevation: "var(--shadow-elevation)" },
      fontFamily: { display: ["Inter Display", "Inter", "sans-serif"], data: ["Inter", "Public Sans", "sans-serif"] }
    }
  },
  plugins: []
};
export default config;
