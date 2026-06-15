import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      spacing: {
        '50': '12.5rem',
        '70': '17.5rem',
        '239': '59.75rem',
      },
      borderWidth: {
        '1': '1px',
      },
    },
  },
  plugins: [],
};

export default config;
