import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { API_BASE } from "@/lib/api-config";

interface SessionWithToken {
  apiToken?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

// Re-export for backwards compatibility
export { API_BASE };

/**
 * Generic API proxy function
 * Forwards requests from Next.js to the NestJS backend
 */
export async function proxyToBackend(req: NextRequest, backendPath: string): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryString = searchParams.toString();
  const url = `${API_BASE}/${backendPath}${queryString ? `?${queryString}` : ""}`;

  try {
    // Get session and API token
    const session = await auth();
    const hasApiToken = (value: unknown): value is SessionWithToken =>
      typeof value === "object" && value !== null && "apiToken" in value;
    const sessionWithToken = hasApiToken(session) ? session : null;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Use session API token for auth
    if (sessionWithToken?.apiToken) {
      headers["Authorization"] = `Bearer ${sessionWithToken.apiToken}`;
    } else {
      // Fallback: forward authorization header if present
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }
    }

    // Forward cookies for session auth (backup)
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
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
    } else if (contentType.includes("text/csv") || contentType.includes("text/markdown")) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": contentType,
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
    console.error(`[api-proxy][${req.method}] Network error for ${backendPath}:`, err);
    return NextResponse.json({ error: "Failed to connect to backend service" }, { status: 500 });
  }
}
