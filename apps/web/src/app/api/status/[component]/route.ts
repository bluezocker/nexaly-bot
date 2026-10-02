import { NextResponse } from "next/server";
import { API_URL } from "@/lib/config";

// Öffentlicher Status-Check für Uptime Kuma: /api/status/bot und /api/status/worker
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ component: string }> }) {
  const { component } = await ctx.params;
  if (component !== "bot" && component !== "worker") {
    return NextResponse.json({ ok: false, error: "unknown component" }, { status: 404 });
  }
  try {
    const response = await fetch(`${API_URL}/v1/status/${component}`, { cache: "no-store" });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "api unreachable" }, { status: 503 });
  }
}
