import { getPiecesWithRelations } from "@/lib/queries";

/**
 * The back-of-book indexes as plain text, for typesetting.
 *
 * Two indexes, one per line, in the form the compositor expects:
 *
 *     Marie Curie\t12,45,88
 *
 * The heading, a tab, then the pages it appears on, comma separated and in
 * ascending order. Nothing else on the line — no page prefix, no spaces after
 * the commas — so the line splits on the first tab and the rest parses as a
 * list of integers.
 *
 * Both indexes are inverted from the same read: `getPiecesWithRelations`
 * already returns every piece in page order with its people and words
 * resolved, so walking it once yields heading -> pages for both without a
 * second query. That read is cached and tagged, so these routes cost nothing
 * the card export does not already pay for.
 */

export interface IndexEntry {
    /** The heading, as printed. */
    text: string;
    /** Ascending, deduplicated. Never empty — headings with no pages are dropped. */
    pages: number[];
}

type RawPiece = {
    page?: number;
    persons?: { name?: string }[];
    word?: { word?: string; lemma?: string }[];
};

/**
 * Headings are grouped case-insensitively but printed with the casing of the
 * first piece that used them.
 *
 * Grouping is by printed text rather than by id on purpose. Two people can
 * share a name and two synsets can share a term — "bank" the noun and "bank"
 * the verb are different words — but this format has no room to tell them
 * apart, so keying by id would emit two identical lines and read as a bug.
 * One heading, one line, the pages merged, which is what a printed index does.
 */
class IndexBuilder {
    private entries = new Map<string, { text: string; pages: Set<number> }>();

    add(text: string | undefined | null, page: number | undefined) {
        const heading = text?.trim();
        if (!heading || page == null) return;

        const key = heading.toLowerCase();
        const entry = this.entries.get(key) ?? { text: heading, pages: new Set<number>() };
        entry.pages.add(page);
        this.entries.set(key, entry);
    }

    build(): IndexEntry[] {
        return [...this.entries.values()]
            .map((entry) => ({
                text: entry.text,
                pages: [...entry.pages].sort((a, b) => a - b),
            }))
            .sort(byHeading);
    }
}

// Pinned to "en" rather than the host default so a print run is reproducible
// wherever it is generated. Ties broken by codepoint for the same reason —
// "base" sensitivity treats "Ana" and "Aña" as equal, and a stable order still
// has to pick one.
const collator = new Intl.Collator("en", { sensitivity: "base" });

const byHeading = (a: IndexEntry, b: IndexEntry) =>
    collator.compare(a.text, b.text) || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0);

/** People, by the name on their record. */
export async function buildPersonIndex(): Promise<IndexEntry[]> {
    const pieces = (await getPiecesWithRelations()) as unknown as RawPiece[];
    const index = new IndexBuilder();

    for (const piece of pieces) {
        for (const person of piece.persons ?? []) {
            index.add(person.name, piece.page);
        }
    }

    return index.build();
}

/**
 * Words, by the term itself.
 *
 * The term, not the card's label: `cardWordLabel` prints the synset's gloss,
 * which would put a sentence of glossary text in the heading column here.
 * `lemma` is the fallback for the handful of synsets stored without their
 * searched form.
 */
export async function buildWordIndex(): Promise<IndexEntry[]> {
    const pieces = (await getPiecesWithRelations()) as unknown as RawPiece[];
    const index = new IndexBuilder();

    for (const piece of pieces) {
        for (const word of piece.word ?? []) {
            index.add(word.word ?? word.lemma, piece.page);
        }
    }

    return index.build();
}

/**
 * Entries to the text body.
 *
 * Tabs and newlines are stripped from headings rather than escaped: they would
 * break the one-entry-per-line contract, and neither belongs in a name or a
 * term. Trailing newline so the file ends on a complete line.
 */
export function formatIndexText(entries: IndexEntry[]): string {
    return entries
        .map((entry) => `${entry.text.replace(/[\t\r\n]+/g, " ")}\t${entry.pages.join(",")}\n`)
        .join("");
}
