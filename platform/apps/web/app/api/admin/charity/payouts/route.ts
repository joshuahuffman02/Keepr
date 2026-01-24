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
    const url = `${API_BASE}/admin/charity/payouts${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[admin/charity/payouts][GET] Backend error:", res.status);
      return new NextResponse("Failed to load payouts", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/charity/payouts][GET] Network error:", err);
    return new NextResponse("Failed to load payouts", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_BASE}/admin/charity/payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[admin/charity/payouts][POST] Backend error:", res.status);
      return new NextResponse("Failed to create payout", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/charity/payouts][POST] Network error:", err);
    return new NextResponse("Failed to create payout", { status: 500 });
  }
}
