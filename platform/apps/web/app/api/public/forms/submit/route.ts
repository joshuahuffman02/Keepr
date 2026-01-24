export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://api.keeprstay.com/api"
    : "http://localhost:4000/api");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_BASE}/public/forms/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[public-forms-submit] Error:", err);
    return NextResponse.json({ error: "Failed to submit form" }, { status: 500 });
  }
}
