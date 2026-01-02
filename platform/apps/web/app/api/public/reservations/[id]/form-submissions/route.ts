import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://camp-everydayapi-production.up.railway.app/api"
    : "http://localhost:4000/api");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");

  try {
    const url = new URL(`${API_BASE}/public/reservations/${id}/form-submissions`);
    if (token) {
      url.searchParams.set("token", token);
    }
    const res = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[public-reservation-forms] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch form submissions" },
      { status: 500 }
    );
  }
}
