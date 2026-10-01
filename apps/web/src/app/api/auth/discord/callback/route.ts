import { NextResponse, type NextRequest } from "next/server";
import { API_URL, OAUTH_STATE_COOKIE, SESSION_COOKIE, publicPath } from "@/lib/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !cookieState || cookieState !== state) {
    return NextResponse.redirect(publicPath("/login?error=oauth"));
  }
  const apiRes = await fetch(
    `${API_URL}/v1/auth/discord/callback?${new URLSearchParams({ code, state })}`,
    { cache: "no-store", headers: { cookie: `${OAUTH_STATE_COOKIE}=${cookieState}` } },
  );
  if (!apiRes.ok) return NextResponse.redirect(publicPath("/login?error=oauth"));
  const body = (await apiRes.json()) as { sessionId?: string };
  if (!body.sessionId) return NextResponse.redirect(publicPath("/login?error=session"));
  const redirect = NextResponse.redirect(publicPath("/app"));
  redirect.cookies.set({
    name: SESSION_COOKIE,
    value: body.sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect.cookies.set({ name: OAUTH_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
  return redirect;
}
