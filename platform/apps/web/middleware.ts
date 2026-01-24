import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = [
  "/",
  "/tickets",
  "/roadmap/public",
  "/auth/signin",
  "/auth/callback",
  "/auth/error",
  "/api/analytics/vitals",
  "/privacy",
  "/terms",
  "/robots.txt",
  "/sitemap.xml",
  "/brand",
  "/pricing",
];

const PUBLIC_PREFIXES = [
  "/_next",
  "/api/auth",
  "/api/public",
  "/static",
  "/assets",
  "/favicon",
  "/manifest",
  "/park", // Public campground pages
  "/images", // Public images
  "/icons", // Public icons
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths
  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPublicPath) return NextResponse.next();

  if (process.env.E2E_BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  // Check if user is authenticated using NextAuth v5 auth wrapper
  if (!req.auth) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  // Redirects for legacy routes
  if (pathname === "/finance/overview") {
    const target = req.nextUrl.clone();
    target.pathname = "/finance";
    return NextResponse.rewrite(target);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
