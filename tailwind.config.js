/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Restaurant dashboard / settings / login palette — unchanged.
        ink: "#1C1B19",
        ivory: "#F6F1E7",
        sand: "#EDE6D6",
        teal: "#0B3D3A",
        brass: "#C9A24B",
        // Customer-facing app palette (Held redesign, 2026-08-25).
        cream: "#F3EAE0",
        card: "#FBF6EF",
        tan: "#E4D6C6",
        burgundy: "#4A1729",
        burgundyLight: "#6b2440",
        charcoal: "#2B1F21",
        muted: "#7a6a60",
        taupe: "#9a8a7d",
        offwhite: "#F8F1E8",
        warn: "#8C3B2B",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "serif"],
      },
    },
  },
  plugins: [],
};
