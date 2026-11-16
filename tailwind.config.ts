import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ---- Change your brand colors here (the only place) ----
        cream: "#FAF7F4", // soft page sections
        accent: {
          DEFAULT: "#E9D5D0", // blush: badges, tiles
          soft: "#F4E8E5", // very light blush backgrounds
          ink: "#8C4A55", // darker rose for links and small text
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
