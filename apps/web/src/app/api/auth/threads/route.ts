import { NextResponse, type NextRequest } from "next/server";
import { API_URL, SESSION_COOKIE, THREADS_STATE_COOKIE, publicPath } from "@/lib/config";

export async function GET(request: NextRequest) {
  const guildId = request.nextUrl.searchParams.get("guildId") ?? "";
  const channelId = request.nextUrl.searchParams.get("channelId") ?? "";
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session || !/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(channelId)) {
    return NextResponse.redirect(publicPath("/login"));
  }
  const response = await fetch(
    `${API_URL}/v1/auth/threads?${new URLSearchParams({ guildId, channelId })}`,
    { headers: { cookie: `${SESSION_COOKIE}=${session}` }, cache: "no-store" },
  );
  if (!response.ok) {
    return NextResponse.redirect(publicPath(`/app/guilds/${guildId}/social?error=threads`));
  }
  const data = (await response.json()) as { url: string; state: string };
  const redirect = NextResponse.redirect(data.url);
  redirect.cookies.set({
    name: THREADS_STATE_COOKIE,
    value: data.state,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 600,
  });
  return redirect;
}
