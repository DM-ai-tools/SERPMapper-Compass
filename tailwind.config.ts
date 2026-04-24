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
        // Traffic Radius–aligned tokens (GET STARTED green, dark navy, chart blue)
        tr: {
          navy: {
            DEFAULT: "#0B1628",
            soft: "#111E33",
            bar: "#001C2E",
          },
          green: {
            50: "#F4FCE8",
            100: "#E2F5C4",
            200: "#C5EB8E",
            300: "#A8E158",
            400: "#96D43F",
            500: "#8BCF4A",
            600: "#6FB32E",
            700: "#5A9A2A",
            800: "#3D6F1A",
            900: "#2A4D12",
          },
          blue: {
            DEFAULT: "#3B82F6",
            soft: "#DBEAFE",
            bright: "#2563EB",
            muted: "#60A5FA",
          },
          cream: "#FAFDF7",
          // Official bar-mark (logo icon + “Mapper” accent)
          logo: {
            green: "#43A047",
            cyan: "#00A3C4",
            navy: "#001C2E",
          },
        },
        // Legacy SERPMapper / tool green — tuned toward lime, keeps chart & footer links working
        brand: {
          50: "#F4FCE8",
          100: "#E8F6D2",
          200: "#D0EDAA",
          300: "#B0E07A",
          400: "#9AD655",
          500: "#8BCF4A",
          600: "#6FB32E",
          700: "#5A9A2A",
          800: "#3D6F1A",
          900: "#2A4D12",
          950: "#1A3010",
        },
        // Rank-band colours — used by map polygons, legend, and suburb table badges
        rank: {
          top3:    "#22C55E",
          page1:   "#86EFAC",
          page2:   "#FCD34D",
          missing: "#EF4444",
          nodata:  "#D1D5DB",
        },
        // Compass / map & data blue–cyan (chart + “Mapper” wordmark)
        compass: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        cta: {
          orange: "#f59e0b",
          "orange-dark": "#d97706",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 40px -12px rgba(15, 23, 42, 0.1)",
        "card-lg":
          "0 1px 2px rgba(15, 23, 42, 0.05), 0 24px 56px -16px rgba(15, 23, 42, 0.14)",
        "glow-brand": "0 8px 32px -8px rgba(22, 163, 74, 0.45)",
        "inner-light": "inset 0 1px 0 0 rgba(255, 255, 255, 0.6)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "border-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        shimmer: "shimmer 2.2s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2.5s ease-in-out infinite",
        float: "float 7s ease-in-out infinite",
        "border-glow": "border-glow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
