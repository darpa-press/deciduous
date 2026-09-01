import { connection } from "next/server";

import { buildPersonIndex, formatIndexText } from "@/lib/export/index-text";
import { isLoggedIn } from "@/lib/auth/session";

/**
 * The index of people as plain text, for typesetting a print edition.
 *
 *   /export/people.txt
 *
 * One person per line: name, a comma and a space, then the pages they appear
 * on, comma separated and ascending. Sorted by name; people who appear on no
 * page are left out.
 */
export async function GET() {
    // The exports are the whole catalogue in one response, and `?content=1`
    // on the XML is every piece's raw stored HTML. They exist to feed a print
    // run, not to be a public mirror of the database.
    if (!(await isLoggedIn())) {
        return new Response("Not authorised.", { status: 401 });
    }

    // Stops prerendering. Unlike the card exports, this route reads no search
    // params, so under Cache Components it would otherwise be treated as fully
    // static and built at deploy time — which both needs a database the build
    // has no reason to reach and bakes one snapshot of the index into the
    // deployment, contradicting the no-store below.
    await connection();

    const body = formatIndexText(await buildPersonIndex());

    return new Response(body, {
        headers: {
            "content-type": "text/plain; charset=utf-8",
            // Regenerated from live data on request; do not let a proxy pin it.
            "cache-control": "no-store",
        },
    });
}
