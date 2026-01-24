export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://api.keeprstay.com/api"
    : "http://localhost:4000/api");

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const url = `${API_BASE}/admin/charity/donations${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[admin/charity/donations][GET] Backend error:", res.status);
      return new NextResponse("Failed to load donations", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/charity/donations][GET] Network error:", err);
    return new NextResponse("Failed to load donations", { status: 500 });
  }
}
