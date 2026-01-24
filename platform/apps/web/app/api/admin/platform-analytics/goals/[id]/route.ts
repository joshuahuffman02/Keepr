export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://api.keeprstay.com/api"
    : "http://localhost:4000/api");

/**
 * Individual Goal API Route - Proxies to backend NestJS API
 */

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const res = await fetch(`${API_BASE}/admin/platform-analytics/goals/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        return new NextResponse("Goal not found", { status: 404 });
      }
      console.error("[goals][GET] Backend error:", res.status, await res.text());
      return new NextResponse("Failed to load goal", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[goals][GET] Network error:", err);
    return new NextResponse("Failed to load goal", { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const res = await fetch(`${API_BASE}/admin/platform-analytics/goals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return new NextResponse("Goal not found", { status: 404 });
      }
      console.error("[goals][PUT] Backend error:", res.status, await res.text());
      return new NextResponse("Failed to update goal", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[goals][PUT] Network error:", err);
    return new NextResponse("Failed to update goal", { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const res = await fetch(`${API_BASE}/admin/platform-analytics/goals/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return new NextResponse("Goal not found", { status: 404 });
      }
      console.error("[goals][DELETE] Backend error:", res.status, await res.text());
      return new NextResponse("Failed to delete goal", { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[goals][DELETE] Network error:", err);
    return new NextResponse("Failed to delete goal", { status: 500 });
  }
}
