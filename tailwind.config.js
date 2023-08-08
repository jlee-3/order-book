/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        background: {
          main: "#131B29",
          hover: "#1E3059",
          "buy-total": "rgba(16, 186, 104, 0.12)",
          "sell-total": "rgba(255, 90, 90, 0.12)",
          "flash-green": "rgba(0, 177, 93, 0.5)",
          "flash-red": "rgba(255, 91, 90, 0.5)",
          "no-change": "rgba(134, 152, 170, 0.12)",
        },
        text: {
          default: "#F0F4F8",
          head: "#8698aa",
          buy: "#00b15d",
          sell: "#FF5B5A",
        },
      },
    },
  },
  plugins: [],
};
