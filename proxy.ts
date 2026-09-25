import { NextResponse } from "next/server";

// Chrome DevTools Protocol discovery (/json/version, /json/list, /json/new)
// hits the dev origin as if it were Chrome's debug port. Answer before the
// App Router renders the root layout.
export function proxy() {
  return new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: ["/json", "/json/:path*"],
};
