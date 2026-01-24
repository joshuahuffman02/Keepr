export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001/api";

type SessionWithToken = Session & { apiToken?: string };

const hasApiToken = (value: unknown): value is SessionWithToken =>
  typeof value === "object" && value !== null && "apiToken" in value;

export async function GET(request: NextRequest) {
  const session = await auth();
  const apiToken =
    hasApiToken(session) && typeof session.apiToken === "string" ? session.apiToken : undefined;
  if (!session?.user || !apiToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "50";

  try {
    const response = await fetch(`${API_BASE}/internal-messages?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching internal messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const apiToken =
    hasApiToken(session) && typeof session.apiToken === "string" ? session.apiToken : undefined;
  if (!session?.user || !apiToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const response = await fetch(`${API_BASE}/internal-messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error sending internal message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
