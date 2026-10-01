import { NextResponse } from "next/server";
import { API_URL, OAUTH_STATE_COOKIE } from "@/lib/config";

export async function GET() {
  const response = await fetch(`${API_URL}/v1/auth/discord`, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ error: "OAuth start failed" }, { status: 502 });
  }
  const data = (await response.json()) as { url: string };
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/nexaly_oauth_state=([^;]+)/);
  if (!match?.[1]) {
    return NextResponse.json({ error: "OAuth state missing" }, { status: 502 });
  }
  const redirect = NextResponse.redirect(data.url);
  redirect.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: decodeURIComponent(match[1]),
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 600,
  });
  return redirect;
}
