export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://api.keeprstay.com/api"
    : "http://localhost:4000/api");

/**
 * Platform Analytics Catch-All API Route
 * Proxies all /api/admin/platform-analytics/* requests to the NestJS backend
 */

async function proxyRequest(req: NextRequest, path: string[]) {
  const { searchParams } = new URL(req.url);
  const queryString = searchParams.toString();
  const pathStr = path.join("/");
  const url = `${API_BASE}/admin/platform-analytics/${pathStr}${queryString ? `?${queryString}` : ""}`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Forward authorization header if present
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      cache: "no-store",
    };

    // Include body for POST/PUT/PATCH requests
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      try {
        const body = await req.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON - continue without body
      }
    }

    const res = await fetch(url, fetchOptions);

    // Handle different content types
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } else if (contentType.includes("text/markdown")) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": res.headers.get("content-disposition") || "",
        },
      });
    } else {
      // For file downloads or other content types
      const blob = await res.blob();
      return new NextResponse(blob, {
        status: res.status,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": res.headers.get("content-disposition") || "",
        },
      });
    }
  } catch (err) {
    console.error(`[platform-analytics][${req.method}] Network error for ${pathStr}:`, err);
    return NextResponse.json({ error: "Failed to connect to analytics service" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(req, path);
}
