import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE, publicPath } from "@/lib/config";

export async function POST() {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  if (session) {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      headers: { Cookie: `${SESSION_COOKIE}=${session}` },
    });
  }
  const response = NextResponse.redirect(publicPath("/"), { status: 303 });
  response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}
