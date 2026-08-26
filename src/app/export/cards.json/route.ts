import { buildCardExport } from "@/lib/export/cards";
import { isLoggedIn } from "@/lib/auth/session";

/**
 * The catalogue cards as JSON, for typesetting a print edition.
 *
 *   /export/cards.json              cards without piece content
 *   /export/cards.json?content=1    cards with the raw stored HTML as well
 *
 * Cards come in page order. Everything is resolved — no ids left to chase.
 */
export async function GET(request: Request) {
    // The exports are the whole catalogue in one response, and `?content=1`
    // on the XML is every piece's raw stored HTML. They exist to feed a print
    // run, not to be a public mirror of the database.
    if (!(await isLoggedIn())) {
        return new Response("Not authorised.", { status: 401 });
    }

    const includeContent = new URL(request.url).searchParams.get("content") === "1";
    const data = await buildCardExport({ includeContent });

    return new Response(JSON.stringify(data, null, 2) + "\n", {
        headers: {
            "content-type": "application/json; charset=utf-8",
            // Regenerated from live data on request; do not let a proxy pin it.
            "cache-control": "no-store",
        },
    });
}
