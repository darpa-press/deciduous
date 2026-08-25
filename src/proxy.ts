import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rescue the `/index` URL.
 *
 * Next normalises the exact path `/index` to `/`, so the optional catch-all
 * receives no segments and the route redirects to the home pair. That would
 * silently break a live URL: `/index` is the tree index, and it is where the
 * page-number heading above every piece links to.
 *
 * The fix is a rewrite to a sentinel segment which the pane route strips back
 * off, so the browser keeps showing `/index` and every link generated from the
 * pane stack stays correct. Only the exact single-segment path is affected —
 * `/index/2`, `/2/index` and `/index-a` all route normally.
 */

export const INDEX_SENTINEL = "__pane";

export function proxy(request: NextRequest) {
    const url = request.nextUrl.clone();
    url.pathname = `/${INDEX_SENTINEL}/index`;
    return NextResponse.rewrite(url);
}

export const config = {
    matcher: "/index",
};
