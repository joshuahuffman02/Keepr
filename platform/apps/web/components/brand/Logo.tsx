import { cn } from "@/lib/utils";

interface LogoProps {
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Color variant - defaults to evergreen */
  variant?: "evergreen" | "white" | "charcoal";
  /** Additional className */
  className?: string;
}

const sizeClasses = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
  xl: "h-12",
  "2xl": "h-16",
};

const colorClasses = {
  evergreen: "text-keepr-evergreen",
  white: "text-white",
  charcoal: "text-keepr-charcoal",
};

/**
 * Keepr wordmark logo
 *
 * Usage:
 * ```tsx
 * <Logo />                          // Default (md, evergreen)
 * <Logo size="lg" />                // Large
 * <Logo variant="white" />          // White on dark backgrounds
 * <Logo size="sm" variant="charcoal" />
 * ```
 */
export function Logo({ size = "md", variant = "evergreen", className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 200 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizeClasses[size], "w-auto", colorClasses[variant], className)}
      aria-label="Keepr"
      role="img"
    >
      <text
        x="0"
        y="38"
        fontFamily="DM Sans, system-ui, sans-serif"
        fontSize="42"
        fontWeight="500"
        fill="currentColor"
        letterSpacing="-0.02em"
      >
        keepr
      </text>
    </svg>
  );
}

/**
 * Keepr logo as an image (for when SVG text rendering is problematic)
 * Uses the PNG file - make sure to save the logo PNG to /public/images/logo/
 */
export function LogoImage({
  size = "md",
  className,
}: Omit<LogoProps, "variant">) {
  const heights = {
    sm: 24,
    md: 32,
    lg: 40,
    xl: 48,
    "2xl": 64,
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/logo/keepr-logo.png"
      alt="Keepr"
      height={heights[size]}
      className={cn(sizeClasses[size], "w-auto", className)}
    />
  );
}

export default Logo;
