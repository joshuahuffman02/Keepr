export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://api.keeprstay.com/api"
    : "http://localhost:4000/api");

export async function GET(req: Request, { params }: { params: Promise<{ campgroundId: string }> }) {
  try {
    const { campgroundId } = await params;
    const { searchParams } = new URL(req.url);
    const amountCents = searchParams.get("amountCents");

    if (!amountCents) {
      return new NextResponse("Missing amountCents parameter", { status: 400 });
    }

    const res = await fetch(
      `${API_BASE}/campgrounds/${campgroundId}/charity/calculate-roundup?amountCents=${amountCents}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return new NextResponse("Failed to calculate round-up", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[campground/charity/calculate-roundup][GET] Network error:", err);
    return new NextResponse("Failed to calculate round-up", { status: 500 });
  }
}
