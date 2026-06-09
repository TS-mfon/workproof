import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Force browsers to revalidate the HTML for pages that mount the submit modal.
// JS chunks are content-hashed and immutable; HTML caches are what carry stale
// chunk references after a deploy.
const NO_STORE_PATHS = [
  /^\/jobs\b/,
  /^\/dashboard\b/,
  /^\/$/
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (NO_STORE_PATHS.some((re) => re.test(pathname))) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    res.headers.set("Pragma", "no-cache");
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|sw.js).*)"
  ]
};
