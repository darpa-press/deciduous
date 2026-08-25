import { connection } from "next/server";

import { buildWordIndex, formatIndexText } from "@/lib/export/index-text";

/**
 * The index of words as plain text, for typesetting a print edition.
 *
 *   /export/words.txt
 *
 * One word per line: the term, a tab, then the pages it appears on, comma
 * separated and ascending. Sorted by term; words attached to no page are left
 * out.
 */
export async function GET() {
    // Stops prerendering. Unlike the card exports, this route reads no search
    // params, so under Cache Components it would otherwise be treated as fully
    // static and built at deploy time — which both needs a database the build
    // has no reason to reach and bakes one snapshot of the index into the
    // deployment, contradicting the no-store below.
    await connection();

    const body = formatIndexText(await buildWordIndex());

    return new Response(body, {
        headers: {
            "content-type": "text/plain; charset=utf-8",
            // Regenerated from live data on request; do not let a proxy pin it.
            "cache-control": "no-store",
        },
    });
}
