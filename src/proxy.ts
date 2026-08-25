import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Handles the two paths that cannot be expressed by the nested pane routes.
 *
 * `/` redirects to the opening spread. Doing it here rather than in the page
 * keeps it a real 307: the page streams, and a redirect issued mid-stream
 * cannot set a status code.
 *
 * `/index` is the tree index — the destination of the page-number heading
 * above every piece — but Next normalises that exact path to `/` before
 * routing, so it never reaches `[p1]`. Rewriting the path would work but would
 * leak a sentinel into the URL and into every link built from it. A request
 * header does not: the address bar still reads `/index`, and app/page.tsx
 * renders that pane when it sees this.
 *
 * Only the exact single-segment path is affected — `/index/2`, `/2/index` and
 * `/index-a` all route normally.
 */

export const PANE_HEADER = "x-deciduous-pane";

const HOME = "/2/125";

export function proxy(request: NextRequest) {
    if (request.nextUrl.pathname === "/index") {
        const headers = new Headers(request.headers);
        headers.set(PANE_HEADER, "index");
        return NextResponse.next({ request: { headers } });
    }

    return NextResponse.redirect(new URL(HOME, request.url), 307);
}

export const config = {
    matcher: ["/", "/index"],
};
