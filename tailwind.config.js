/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ===== Sistema CLARO Potente (blanco frío + tinta azulada + azul atlántico) =====
        paper: {
          DEFAULT: "#EDF1F7", // blanco frío costero un punto más profundo (pedido Mateo: "muy blanca") — las tarjetas blancas ahora CONTRASTAN
          100: "#FFFFFF", // tarjetas / superficies elevadas
          200: "#DDE5EF", // sub-bloques / hairlines suaves (más presentes)
        },
        graph: {
          DEFAULT: "#0D1521", // tinta azulada (no negro puro)
          700: "#26303F",
          500: "#4D596B", // texto secundario (un punto más de tinta)
          400: "#8792A3", // texto muted
        },
        brand: {
          // azul atlántico Potente (acento = información)
          DEFAULT: "#0C4DA2",
          600: "#0A4189",
          700: "#083469",
          400: "#2F6FC2",
          300: "#7FA9DE",
          50: "#EBF2FA",
          950: "#022352", // navy profundo de marca (el histórico de Potente)
        },
        sea: {
          // celeste mar — SOLO detalles (línea de horizonte, datos vivos)
          DEFAULT: "#1495D8",
          300: "#7CC7EC",
          50: "#E9F6FD",
        },

        // ===== Sistema OSCURO heredado (panel, hasta su barrido a blanco) =====
        ink: { DEFAULT: "#0B1220", 800: "#111A2B", 700: "#1A2436", 600: "#243044" },
        bone: { DEFAULT: "#F6F2E9", 200: "#ECE6D8", 300: "#DED5C2" },
        wheat: { DEFAULT: "#C9A24E", 400: "#D8B566", 600: "#A9842F" },
        field: { DEFAULT: "#5B6B43", 700: "#46532F", 300: "#8FA06B" },
        clay: "#9C6B3C",
      },
      fontFamily: {
        // Par tipográfico Potente: Clash Display (titulares) + General Sans (todo lo demás)
        display: ['"Clash Display"', '"General Sans"', "system-ui", "sans-serif"],
        sans: ['"General Sans"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.28em",
      },
      boxShadow: {
        card: "0 14px 44px -18px rgba(13,21,33,0.28)",
        soft: "0 4px 22px -10px rgba(13,21,33,0.14)",
        ring: "0 0 0 1px rgba(13,21,33,0.09)",
      },
      maxWidth: {
        container: "1240px",
      },
      keyframes: {
        kenburns: {
          "0%": { transform: "scale(1.05) translate3d(0,0,0)" },
          "100%": { transform: "scale(1.18) translate3d(-1.5%,-1.5%,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        horizon: {
          "0%, 100%": { transform: "translateX(-12%) scaleY(1)" },
          "50%": { transform: "translateX(12%) scaleY(1.6)" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(-2%, 1%, 0) scale(1)" },
          "50%": { transform: "translate3d(2%, -1%, 0) scale(1.06)" },
        },
      },
      animation: {
        kenburns: "kenburns 22s ease-out forwards",
        horizon: "horizon 14s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
