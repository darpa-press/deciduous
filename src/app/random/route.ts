import { NextResponse, connection } from "next/server";

import { getAllPieces } from "@/lib/queries";

/**
 * `/random` opens two randomly chosen pieces side by side. Ported from
 * Routes/RandomPieces, which fetched every piece, shuffled, took two and
 * redirected to `/{a}/{b}`.
 *
 * A route handler rather than a page: there is no UI here, only a redirect,
 * and a page would be caught by partial prerendering — which would either
 * postpone the redirect or, worse, cache one "random" pair forever.
 */

export async function GET(request: Request) {
    // Opts out of any caching: a cached "random" pair is not random.
    await connection();

    const pieces = await getAllPieces({ sort: "title", order: 1 });
    const pages = pieces.map((piece) => piece.page).filter((page): page is number => page != null);

    if (pages.length < 2) {
        return NextResponse.redirect(new URL("/2/125", request.url), 307);
    }

    const shuffled = [...pages];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return NextResponse.redirect(new URL(`/${shuffled[0]}/${shuffled[1]}`, request.url), 307);
}
