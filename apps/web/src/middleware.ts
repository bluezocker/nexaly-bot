import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, publicPath } from "./lib/config";

export function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    const login = publicPath("/login");
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
