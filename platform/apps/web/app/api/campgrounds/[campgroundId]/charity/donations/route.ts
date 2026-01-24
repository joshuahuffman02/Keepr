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
    const queryString = searchParams.toString();
    const url = `${API_BASE}/campgrounds/${campgroundId}/charity/donations${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse("Failed to load donations", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[campground/charity/donations][GET] Network error:", err);
    return new NextResponse("Failed to load donations", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campgroundId: string }> },
) {
  try {
    const { campgroundId } = await params;
    const body = await req.json();

    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/charity/donations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return new NextResponse("Failed to create donation", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[campground/charity/donations][POST] Network error:", err);
    return new NextResponse("Failed to create donation", { status: 500 });
  }
}
