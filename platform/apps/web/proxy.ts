"use server";

import { NextResponse, type NextRequest } from "next/server";

// Public routes that don't require authentication
const publicRoutes = [
  "/", // Public marketplace homepage
  "/park", // Public campground detail pages
  "/auth",
  "/booking",
  "/marketing",
  "/api/auth",
];

type ProxyRequest = NextRequest & { auth?: unknown };

export function proxy(req: ProxyRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));
  if (isPublic) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  if (!req.auth) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Don't run middleware on static files or Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
