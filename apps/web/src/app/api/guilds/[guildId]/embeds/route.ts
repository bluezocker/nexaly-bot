import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";

async function proxy(req: Request, guildId: string, method: string, extra = "") {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  const headers = new Headers({ Accept: "application/json" });
  if (session) headers.set("Cookie", `${SESSION_COOKIE}=${session}`);
  if (method !== "GET") headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}/v1/guilds/${guildId}/embeds${extra}`, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : await req.text(),
    cache: "no-store",
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ guildId: string }> }) {
  return proxy(req, (await ctx.params).guildId, "GET");
}
export async function POST(req: Request, ctx: { params: Promise<{ guildId: string }> }) {
  return proxy(req, (await ctx.params).guildId, "POST");
}
