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

    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/charity`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        // No charity configured for this campground
        return NextResponse.json(null);
      }
      return new NextResponse("Failed to load charity config", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[campground/charity][GET] Network error:", err);
    return new NextResponse("Failed to load charity config", { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ campgroundId: string }> }) {
  try {
    const { campgroundId } = await params;
    const body = await req.json();

    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/charity`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return new NextResponse("Failed to update charity config", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[campground/charity][PUT] Network error:", err);
    return new NextResponse("Failed to update charity config", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ campgroundId: string }> },
) {
  try {
    const { campgroundId } = await params;

    const res = await fetch(`${API_BASE}/campgrounds/${campgroundId}/charity`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      return new NextResponse("Failed to remove charity config", { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[campground/charity][DELETE] Network error:", err);
    return new NextResponse("Failed to remove charity config", { status: 500 });
  }
}
