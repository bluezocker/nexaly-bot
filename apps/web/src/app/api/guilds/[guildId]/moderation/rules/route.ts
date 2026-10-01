import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";

export async function POST(req: Request, ctx: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await ctx.params;
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  const headers = new Headers({ Accept: "application/json", "Content-Type": "application/json" });
  if (session) headers.set("Cookie", `${SESSION_COOKIE}=${session}`);
  const response = await fetch(`${API_URL}/v1/guilds/${guildId}/moderation/rules`, {
    method: "POST",
    headers,
    body: await req.text(),
    cache: "no-store",
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
