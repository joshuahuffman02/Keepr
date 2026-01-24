export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api-proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToBackend(req, `dynamic-pricing/${path.join("/")}`);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToBackend(req, `dynamic-pricing/${path.join("/")}`);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToBackend(req, `dynamic-pricing/${path.join("/")}`);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToBackend(req, `dynamic-pricing/${path.join("/")}`);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyToBackend(req, `dynamic-pricing/${path.join("/")}`);
}
