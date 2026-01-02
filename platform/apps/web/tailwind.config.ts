import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        // Semantic action tokens
        "action-primary": {
          DEFAULT: "hsl(var(--action-primary))",
          foreground: "hsl(var(--action-primary-foreground))",
          hover: "hsl(var(--action-primary-hover))"
        },
        "action-secondary": {
          DEFAULT: "hsl(var(--action-secondary))",
          foreground: "hsl(var(--action-secondary-foreground))",
          hover: "hsl(var(--action-secondary-hover))"
        },
        // Semantic status tokens
        "status-success": {
          DEFAULT: "hsl(var(--status-success))",
          foreground: "hsl(var(--status-success-foreground))",
          bg: "hsl(var(--status-success-bg))",
          border: "hsl(var(--status-success-border))",
          text: "hsl(var(--status-success-text))"
        },
        "status-warning": {
          DEFAULT: "hsl(var(--status-warning))",
          foreground: "hsl(var(--status-warning-foreground))",
          bg: "hsl(var(--status-warning-bg))",
          border: "hsl(var(--status-warning-border))",
          text: "hsl(var(--status-warning-text))"
        },
        "status-error": {
          DEFAULT: "hsl(var(--status-error))",
          foreground: "hsl(var(--status-error-foreground))",
          bg: "hsl(var(--status-error-bg))",
          border: "hsl(var(--status-error-border))",
          text: "hsl(var(--status-error-text))"
        },
        "status-info": {
          DEFAULT: "hsl(var(--status-info))",
          foreground: "hsl(var(--status-info-foreground))",
          bg: "hsl(var(--status-info-bg))",
          border: "hsl(var(--status-info-border))",
          text: "hsl(var(--status-info-text))"
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
          7: "hsl(var(--chart-7))",
          8: "hsl(var(--chart-8))"
        },
        heatmap: {
          low: "hsl(var(--heatmap-low))",
          mid: "hsl(var(--heatmap-mid))",
          high: "hsl(var(--heatmap-high))"
        }
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"]
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        },
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)"
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)"
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)"
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)"
          }
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(3deg)" }
        },
        "float-medium": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-8px) rotate(-2deg)" }
        },
        "float-fast": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-6px) rotate(2deg)" }
        },
        // Seasonal particle animations
        "fall-leaf": {
          "0%": { transform: "translateY(-10px) rotate(0deg)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(720deg)", opacity: "0" }
        },
        "snowfall": {
          "0%": { transform: "translateY(-10px) translateX(0)", opacity: "0" },
          "10%": { opacity: "0.8" },
          "90%": { opacity: "0.8" },
          "100%": { transform: "translateY(100vh) translateX(20px)", opacity: "0" }
        },
        "petal-fall": {
          "0%": { transform: "translateY(-10px) rotate(0deg) translateX(0)", opacity: "0" },
          "10%": { opacity: "0.9" },
          "50%": { transform: "translateY(50vh) rotate(180deg) translateX(30px)" },
          "90%": { opacity: "0.9" },
          "100%": { transform: "translateY(100vh) rotate(360deg) translateX(-10px)", opacity: "0" }
        },
        "firefly": {
          "0%, 100%": { opacity: "0.2", transform: "translateY(0) translateX(0)" },
          "25%": { opacity: "1", transform: "translateY(-20px) translateX(10px)" },
          "50%": { opacity: "0.3", transform: "translateY(-10px) translateX(-15px)" },
          "75%": { opacity: "0.9", transform: "translateY(-30px) translateX(5px)" }
        },
        // Loading state animations
        "campfire-flicker": {
          "0%, 100%": { transform: "scaleY(1) scaleX(1)", opacity: "1" },
          "25%": { transform: "scaleY(1.1) scaleX(0.95)", opacity: "0.9" },
          "50%": { transform: "scaleY(0.95) scaleX(1.05)", opacity: "1" },
          "75%": { transform: "scaleY(1.05) scaleX(0.98)", opacity: "0.95" }
        },
        "tent-bounce": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-8px) rotate(-2deg)" },
          "50%": { transform: "translateY(0) rotate(0deg)" },
          "75%": { transform: "translateY(-4px) rotate(1deg)" }
        },
        // Micro-interactions
        "breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.02)" }
        },
        "bounce-in": {
          "0%": { transform: "scale(1)" },
          "25%": { transform: "scale(1.15)" },
          "50%": { transform: "scale(0.95)" },
          "75%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" }
        },
        "compass-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" }
        },
        // Celebration animations
        "confetti-fall": {
          "0%": { transform: "translateY(-100%) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(720deg)", opacity: "0" }
        },
        "star-burst": {
          "0%": { transform: "scale(0) rotate(0deg)", opacity: "0" },
          "50%": { transform: "scale(1.2) rotate(180deg)", opacity: "1" },
          "100%": { transform: "scale(0) rotate(360deg)", opacity: "0" }
        },
        "heart-float": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "1" },
          "100%": { transform: "translateY(-100px) scale(0.5)", opacity: "0" }
        },
        // Scroll progress
        "climb-mountain": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0%)" }
        },
        // Easter egg animations
        "smore-dance": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-15px) rotate(-10deg)" },
          "50%": { transform: "translateY(0) rotate(0deg)" },
          "75%": { transform: "translateY(-10px) rotate(10deg)" }
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-5deg)" },
          "75%": { transform: "rotate(5deg)" }
        },
        // Activity feed
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" }
        },
        "slide-out-left": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(-100%)", opacity: "0" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        blob: "blob 7s infinite",
        shimmer: "shimmer 1.5s infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out",
        "float-slow": "float-slow 6s ease-in-out infinite",
        "float-medium": "float-medium 4s ease-in-out infinite",
        "float-fast": "float-fast 3s ease-in-out infinite",
        // Seasonal
        "fall-leaf": "fall-leaf 8s linear infinite",
        "snowfall": "snowfall 10s linear infinite",
        "petal-fall": "petal-fall 12s ease-in-out infinite",
        "firefly": "firefly 4s ease-in-out infinite",
        // Loading
        "campfire-flicker": "campfire-flicker 0.5s ease-in-out infinite",
        "tent-bounce": "tent-bounce 1.5s ease-in-out infinite",
        // Micro-interactions
        "breathe": "breathe 3s ease-in-out infinite",
        "bounce-in": "bounce-in 0.4s ease-out",
        "compass-spin": "compass-spin 0.6s ease-out",
        // Celebrations
        "confetti-fall": "confetti-fall 3s linear forwards",
        "star-burst": "star-burst 2.5s ease-out forwards",
        "heart-float": "heart-float 3s ease-out forwards",
        // Other
        "climb-mountain": "climb-mountain 0.3s ease-out",
        "smore-dance": "smore-dance 0.8s ease-in-out infinite",
        "wiggle": "wiggle 0.5s ease-in-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "slide-out-left": "slide-out-left 0.3s ease-out"
      }
    }
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")]
};

export default config;
