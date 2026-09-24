import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090d",
          900: "#0c1117",
          800: "#121a24",
          700: "#1a2533",
          600: "#243142",
        },
        mist: {
          100: "#e8eef5",
          200: "#c5d0de",
          300: "#8b9cb3",
          400: "#5c6f88",
        },
        // Tokens thème (light/dark via CSS vars) — à préférer hors panels dark fixes
        page: {
          DEFAULT: "var(--page-bg)",
          fg: "var(--page-fg)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
        },
        soft: "var(--muted)",
        line: "var(--border)",
        signal: {
          DEFAULT: "#3dcfb0",
          dim: "#2a9e86",
          glow: "#6ef0d0",
        },
        warn: {
          DEFAULT: "#e8a54b",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(61,207,176,0.18), transparent), linear-gradient(to bottom, #07090d, #0c1117)",
        "noise-soft":
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "float-tilt": {
          "0%, 100%": { transform: "translateY(0) rotate(-0.6deg)" },
          "50%": { transform: "translateY(-12px) rotate(0.6deg)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-right": {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-up-delay":
          "fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both",
        "fade-up-delay-2":
          "fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.24s both",
        "fade-up-delay-3":
          "fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.36s both",
        "fade-in": "fade-in 1s ease both",
        "pulse-soft": "pulse-soft 3s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "float-tilt": "float-tilt 7s ease-in-out infinite",
        "scale-in": "scale-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-right":
          "slide-right 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
