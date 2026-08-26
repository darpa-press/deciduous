import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Handles the paths the pane route cannot express.
 *
 * `/` redirects to the opening spread. Doing it here rather than in the page
 * keeps it a real 307: the page streams, and a redirect issued mid-stream
 * cannot set a status code.
 *
 * `/index` is the tree index — where the page-number heading above every piece
 * links — but Next normalises that exact path to `/` before routing, so it
 * never arrives with a segment. Rewriting the path would leak a sentinel into
 * the URL and into every link built from it; a request header does not.
 *
 * And a path carrying a percent-escape that cannot be decoded is repaired
 * before it reaches the router — see `repairEscapes`.
 */

export const PANE_HEADER = "x-deciduous-pane";

const HOME = "/2/125";

/**
 * Whether any segment carries a percent-escape that cannot be decoded.
 *
 * Next decodes each param while matching the route, so `/%E0%A4%A` — or a bare
 * `/%` — threw "failed to decode param" inside the framework and answered a
 * bare 500. Rewriting the path does not help: the repaired form is decoded
 * again on the way through, and lands in the same place. Since such a URL
 * cannot name anything, it is answered here and never reaches the router.
 */
function hasUndecodableEscape(pathname: string): boolean {
    return pathname.split("/").some((segment) => {
        try {
            decodeURIComponent(segment);
            return false;
        } catch {
            return true;
        }
    });
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (hasUndecodableEscape(pathname)) {
        return new NextResponse("That address is not a valid URL.", {
            status: 400,
            headers: { "content-type": "text/plain; charset=utf-8" },
        });
    }

    if (pathname === "/index") {
        const headers = new Headers(request.headers);
        headers.set(PANE_HEADER, "index");
        return NextResponse.next({ request: { headers } });
    }

    if (pathname === "/") {
        // The origin comes from a configured value where there is one, not from
        // the request's own Host header. Vercel validates Host against the
        // project's domains, but behind any other proxy that header is the
        // caller's to choose — and it decided where this redirect pointed.
        const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || request.nextUrl.origin;
        return NextResponse.redirect(new URL(HOME, origin), 307);
    }

    return NextResponse.next();
}

export const config = {
    // Everything but the build output and static files: the escape check has
    // to see a request before the router does, and the router is what throws.
    matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
