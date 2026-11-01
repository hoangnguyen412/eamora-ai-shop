import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /seller routes except /seller/login
  if (pathname.startsWith("/seller") && pathname !== "/seller/login") {
    const token = request.cookies.get("eamora.auth.token")?.value;

    if (!token) {
      // Chưa đăng nhập -> redirect về trang đăng nhập người bán
      const loginUrl = new URL("/seller/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Có token -> kiểm tra role cookie (nếu có)
    const role = request.cookies.get("eamora.auth.role")?.value;
    if (role && role !== "seller") {
      // Đã đăng nhập nhưng không phải seller -> redirect về trang chủ kèm lỗi
      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/seller/:path*"],
};
