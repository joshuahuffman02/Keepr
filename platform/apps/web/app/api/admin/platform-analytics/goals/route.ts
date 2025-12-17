import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://camp-everydayapi-production.up.railway.app/api"
    : "http://localhost:4000/api");

/**
 * Goals API Route - Proxies to backend NestJS API
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const url = `${API_BASE}/admin/platform-analytics/goals${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[goals][GET] Backend error:", res.status, await res.text());
      return new NextResponse("Failed to load goals", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[goals][GET] Network error:", err);
    return new NextResponse("Failed to load goals", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_BASE}/admin/platform-analytics/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[goals][POST] Backend error:", res.status, await res.text());
      return new NextResponse("Failed to create goal", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[goals][POST] Network error:", err);
    return new NextResponse("Failed to create goal", { status: 500 });
  }
}
