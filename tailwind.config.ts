// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      colors: {
        brand: {
          // HoopSpark Orange (marketing)
          50:  "#FFF6EF",
          100: "#FFE7D6",
          200: "#FFC9A8",
          300: "#FFAA79",
          400: "#FF8C4B",
          500: "#FF7A1A", // primary orange
          600: "#E86B12",
          700: "#B7530E",
          800: "#8A3E0B",
          900: "#5E2A07",
        },
        app: {
          // In-app Blue (Figma)
          50:  "#F3F7FF",
          100: "#E6EFFF",
          200: "#C6DAFF",
          300: "#9FC0FF",
          400: "#6F9FFF",
          500: "#3B82F6", // primary blue
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        card: "0 10px 30px rgba(0,0,0,0.08)",
        soft: "0 6px 18px rgba(0,0,0,0.06)",
      },
      maxWidth: {
        "content": "72rem", // 1152px, comfy container
      },
    },
  },
} satisfies Config;
