export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://api.keeprstay.com/api"
    : "http://localhost:4000/api");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campgroundId: string }> },
) {
  const { campgroundId } = await params;
  const url = `${API_BASE}/public/campgrounds/${campgroundId}/leads`;

  try {
    const body = await req.json();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
        "user-agent": req.headers.get("user-agent") || "",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[public-leads] Error:", err);
    return NextResponse.json({ error: "Failed to capture lead" }, { status: 500 });
  }
}
