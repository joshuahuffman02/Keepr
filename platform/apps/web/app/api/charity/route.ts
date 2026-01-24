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
    const url = `${API_BASE}/charity${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[charity][GET] Backend error:", res.status);
      return new NextResponse("Failed to load charities", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[charity][GET] Network error:", err);
    return new NextResponse("Failed to load charities", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_BASE}/charity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[charity][POST] Backend error:", res.status);
      return new NextResponse("Failed to create charity", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[charity][POST] Network error:", err);
    return new NextResponse("Failed to create charity", { status: 500 });
  }
}
