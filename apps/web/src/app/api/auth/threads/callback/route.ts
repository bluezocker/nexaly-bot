import { NextResponse, type NextRequest } from "next/server";
import { API_URL, THREADS_STATE_COOKIE, publicPath } from "@/lib/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(THREADS_STATE_COOKIE)?.value;
  if (!code || !state || !cookieState || cookieState !== state) {
    return NextResponse.redirect(publicPath("/app?error=threads"));
  }
  const apiRes = await fetch(
    `${API_URL}/v1/auth/threads/callback?${new URLSearchParams({ code, state })}`,
    { cache: "no-store" },
  );
  const fail = NextResponse.redirect(publicPath("/app?error=threads"));
  fail.cookies.set({ name: THREADS_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
  if (!apiRes.ok) return fail;
  const body = (await apiRes.json()) as { guildId?: string };
  if (!body.guildId) return fail;
  const redirect = NextResponse.redirect(publicPath(`/app/guilds/${body.guildId}/social?connected=1`));
  redirect.cookies.set({ name: THREADS_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
  return redirect;
}
