import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = [
  "/",
  "/tickets",
  "/roadmap/public",
  "/auth/signin",
  "/auth/callback",
  "/privacy",
  "/terms",
  "/robots.txt",
  "/sitemap.xml",
];

const PUBLIC_PREFIXES = [
  "/_next",
  "/api/auth",
  "/api/public",
  "/static",
  "/assets",
  "/favicon",
  "/manifest",
];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/campgrounds",
  "/reservations",
  "/guests",
  "/booking",
  "/groups",
  "/billing",
  "/finance",
  "/ledger",
  "/payouts",
  "/disputes",
  "/admin",
  "/owners",
  "/help",
  "/updates",
  "/roadmap",
  "/messages",
  "/nps",
  "/reports",
  "/reports-v2",
  "/settings",
  "/store",
  "/pos",
  "/maintenance",
  "/pwa",
  "/portal",
  "/analytics",
  "/approvals",
  "/operations",
  "/inventory",
  "/calendar",
  "/calendar-v2",
  "/pricing",
  "/tech",
  "/security",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPublicPath) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!isProtected) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  if (pathname === "/pricing" || pathname.startsWith("/pricing/")) {
    const target = new URL("/settings/pricing-rules", req.url);
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target);
  }

  if (pathname === "/finance/overview") {
    const target = req.nextUrl.clone();
    target.pathname = "/finance";
    return NextResponse.rewrite(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
