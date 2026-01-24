export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[Support Report]", JSON.stringify(body, null, 2));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[Support Report] failed", err);
    return new Response("Failed to record issue", { status: 500 });
  }
}
