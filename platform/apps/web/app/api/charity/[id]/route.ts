export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://api.keeprstay.com/api"
    : "http://localhost:4000/api");

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const res = await fetch(`${API_BASE}/charity/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse("Charity not found", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[charity][GET] Network error:", err);
    return new NextResponse("Failed to load charity", { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const res = await fetch(`${API_BASE}/charity/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return new NextResponse("Failed to update charity", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[charity][PUT] Network error:", err);
    return new NextResponse("Failed to update charity", { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const res = await fetch(`${API_BASE}/charity/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      return new NextResponse("Failed to delete charity", { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[charity][DELETE] Network error:", err);
    return new NextResponse("Failed to delete charity", { status: 500 });
  }
}
