import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";

export async function DELETE(_req: Request, ctx: { params: Promise<{ guildId: string; bindingId: string }> }) {
  const { guildId, bindingId } = await ctx.params;
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  const headers = new Headers({ Accept: "application/json" });
  if (session) headers.set("Cookie", `${SESSION_COOKIE}=${session}`);
  const response = await fetch(`${API_URL}/v1/guilds/${guildId}/embeds/reactions/${bindingId}`, {
    method: "DELETE",
    headers,
  });
  return new NextResponse(await response.text(), { status: response.status });
}
