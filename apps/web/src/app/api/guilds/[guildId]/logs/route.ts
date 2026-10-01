import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";

async function proxy(req: Request, guildId: string, method: string) {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  const headers = new Headers({ Accept: "application/json" });
  if (session) headers.set("Cookie", `${SESSION_COOKIE}=${session}`);
  if (method !== "GET") headers.set("Content-Type", "application/json");

  const body = method === "GET" ? undefined : await req.text();
  const response = await fetch(`${API_URL}/v1/guilds/${guildId}/logs`, {
    method,
    headers,
    body,
    cache: "no-store",
  });
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await ctx.params;
  return proxy(_req, guildId, "GET");
}

export async function PUT(req: Request, ctx: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await ctx.params;
  return proxy(req, guildId, "PUT");
}
