export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

/**
 * Dynamic ticket route - handles operations on specific tickets
 */

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${API_BASE}/tickets/${params.id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        return new NextResponse("Ticket not found", { status: 404 });
      }
      console.error("[tickets][GET:id] Backend error:", res.status);
      return new NextResponse("Failed to load ticket", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[tickets][GET:id] Network error:", err);
    return new NextResponse("Failed to load ticket", { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_BASE}/tickets/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return new NextResponse("Ticket not found", { status: 404 });
      }
      console.error("[tickets][PATCH:id] Backend error:", res.status, await res.text());
      return new NextResponse("Failed to update ticket", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[tickets][PATCH:id] Network error:", err);
    return new NextResponse("Failed to update ticket", { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${API_BASE}/tickets/${params.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return new NextResponse("Ticket not found", { status: 404 });
      }
      console.error("[tickets][DELETE:id] Backend error:", res.status);
      return new NextResponse("Failed to delete ticket", { status: res.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[tickets][DELETE:id] Network error:", err);
    return new NextResponse("Failed to delete ticket", { status: 500 });
  }
}
