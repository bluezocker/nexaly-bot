import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nx: {
          bg: "#07060f",
          elevated: "#0f0d1a",
          card: "#151225",
          border: "#2d2450",
          muted: "#a39bc4",
          accent: "#9b5cff",
          "accent-soft": "#c4a0ff",
          "accent-deep": "#6b3fd4",
          glow: "#b57bff",
        },
      },
      boxShadow: {
        glow: "0 0 40px rgba(155, 92, 255, 0.28)",
        "glow-sm": "0 0 20px rgba(155, 92, 255, 0.18)",
        ring: "0 0 0 1px rgba(155, 92, 255, 0.35), 0 0 30px rgba(155, 92, 255, 0.15)",
      },
      backgroundImage: {
        "nx-radial":
          "radial-gradient(900px 500px at 15% -10%, rgba(155, 92, 255, 0.22), transparent 60%), radial-gradient(700px 400px at 90% 10%, rgba(107, 63, 212, 0.12), transparent 55%)",
      },
    },
  },
  plugins: [],
};

export default config;
