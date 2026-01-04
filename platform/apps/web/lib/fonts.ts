import { DM_Sans, Inter } from "next/font/google";

/**
 * Keepr Brand Typography
 *
 * DM Sans - Headlines and display text (weights 500, 700)
 * Inter - Body text and UI elements (weights 400, 500)
 *
 * These fonts are loaded via next/font for optimal performance:
 * - Automatic self-hosting (no external requests)
 * - Zero layout shift with size-adjust
 * - Subsetting for smaller file sizes
 */

export const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

/**
 * Combined font class names for the html element
 * Usage: <html className={fontVariables}>
 */
export const fontVariables = `${dmSans.variable} ${inter.variable}`;
