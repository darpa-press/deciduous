import { buildCardExport, type ExportedCard } from "@/lib/export/cards";
import { isLoggedIn } from "@/lib/auth/session";

/**
 * The catalogue cards as XML, for typesetting a print edition.
 *
 *   /export/cards.xml              cards without piece content
 *   /export/cards.xml?content=1    cards with the raw stored HTML as well
 *
 * Shaped for an IDML step to read: one <card> per piece in page order, each
 * field its own element so it can be mapped to a paragraph or character style
 * rather than parsed out of a blob. Piece content is emitted in CDATA, since
 * it is HTML and would otherwise need double-escaping.
 */

const escape = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const attr = (name: string, value: string | number | boolean | null) =>
    value === null || value === "" ? "" : ` ${name}="${escape(String(value))}"`;

const tag = (name: string, value: string | null, indent: string) =>
    value === null ? "" : `${indent}<${name}>${escape(value)}</${name}>\n`;

/** CDATA cannot contain "]]>", so split any occurrence across two sections. */
const cdata = (value: string) => `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

function cardXml(card: ExportedCard): string {
    const lines: string[] = [];

    lines.push(
        `  <card${attr("page", card.page)}${attr("shelfMark", card.shelfMark)}` +
            `${attr("slug", card.slug)}${attr("stub", card.stub)}>\n`
    );

    lines.push(tag("title", card.title, "    "));
    lines.push(
        card.summary === null
            ? `    <summary available="false"/>\n`
            : `    <summary available="true">${escape(card.summary)}</summary>\n`
    );

    if (card.parent) {
        lines.push(
            `    <parent${attr("page", card.parent.page)}>${escape(card.parent.title ?? "")}</parent>\n`
        );
    }

    if (card.words.length) {
        lines.push(`    <words>\n`);
        for (const word of card.words) {
            lines.push(
                `      <word${attr("id", word.id)}${attr("pos", word.pos)}` +
                    `${attr("synsetOffset", word.synsetOffset)}${attr("source", word.source)}>\n`
            );
            lines.push(tag("label", word.label, "        "));
            lines.push(tag("term", word.term, "        "));
            lines.push(tag("gloss", word.gloss, "        "));
            lines.push(`      </word>\n`);
        }
        lines.push(`    </words>\n`);
    }

    if (card.people.length) {
        lines.push(`    <people>\n`);
        for (const person of card.people) {
            lines.push(
                `      <person${attr("position", person.position)}${attr("slug", person.slug)}` +
                    `${attr("birth", person.birth)}${attr("death", person.death)}>` +
                    `${escape(person.name ?? "")}</person>\n`
            );
        }
        lines.push(`    </people>\n`);
    }

    if (card.content !== undefined) {
        lines.push(`    <content>${cdata(card.content)}</content>\n`);
    }

    lines.push(`  </card>\n`);
    return lines.join("");
}

export async function GET(request: Request) {
    // The exports are the whole catalogue in one response, and `?content=1`
    // on the XML is every piece's raw stored HTML. They exist to feed a print
    // run, not to be a public mirror of the database.
    if (!(await isLoggedIn())) {
        return new Response("Not authorised.", { status: 401 });
    }

    const includeContent = new URL(request.url).searchParams.get("content") === "1";
    const data = await buildCardExport({ includeContent });

    const body =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<codex${attr("name", data.codex.name)}${attr("imprint", data.codex.imprint)}` +
        `${attr("count", data.count)}>\n` +
        data.cards.map(cardXml).join("") +
        `</codex>\n`;

    return new Response(body, {
        headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "no-store",
        },
    });
}
