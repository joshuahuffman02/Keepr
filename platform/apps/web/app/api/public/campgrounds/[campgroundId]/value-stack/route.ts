export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://api.keeprstay.com/api"
    : "http://localhost:4000/api");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campgroundId: string }> },
) {
  const { campgroundId } = await params;
  const url = `${API_BASE}/public/campgrounds/${campgroundId}/value-stack`;

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[public-value-stack] Error:", err);
    return NextResponse.json({ error: "Failed to fetch value stack" }, { status: 500 });
  }
}
