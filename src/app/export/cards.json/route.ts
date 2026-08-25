import { buildCardExport } from "@/lib/export/cards";

/**
 * The catalogue cards as JSON, for typesetting a print edition.
 *
 *   /export/cards.json              cards without piece content
 *   /export/cards.json?content=1    cards with the raw stored HTML as well
 *
 * Cards come in page order. Everything is resolved — no ids left to chase.
 */
export async function GET(request: Request) {
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
