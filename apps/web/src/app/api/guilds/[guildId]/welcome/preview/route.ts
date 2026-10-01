import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";

export async function POST(_req: Request, ctx: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await ctx.params;
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  const headers = new Headers();
  if (session) headers.set("Cookie", `${SESSION_COOKIE}=${session}`);
  const response = await fetch(`${API_URL}/v1/guilds/${guildId}/welcome/preview`, {
    method: "POST",
    headers,
    cache: "no-store",
  });
  const buf = Buffer.from(await response.arrayBuffer());
  return new NextResponse(buf, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream" },
  });
}
