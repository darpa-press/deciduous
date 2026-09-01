import { getPiecesWithRelations } from "@/lib/queries";

/**
 * The back-of-book indexes as plain text, for typesetting.
 *
 * Three indexes — people, words, and the two combined — one entry per line, in
 * the form the compositor expects:
 *
 *     Curie, Marie\t12,45,88
 *
 * The heading, a tab, then the pages it appears on, comma separated and in
 * ascending order. Nothing else on the line — no page prefix, no spaces after
 * the commas — so the line splits on the first tab and the rest parses as a
 * list of integers, and the file drops into an InDesign text frame as a single
 * paragraph style with one tab stop.
 *
 * All three are inverted from the same read: `getPiecesWithRelations` already
 * returns every piece in page order with its people and words resolved, so
 * walking it once yields heading -> pages without a second query. That read is
 * cached and tagged, so these routes cost nothing the card export does not
 * already pay for.
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

/**
 * Suffixes that trail a surname rather than being one.
 *
 * Compared with the dots stripped, so "Jr." and "Jr" both match. Kept short on
 * purpose: every entry here is a word that can never be somebody's surname,
 * and a false positive silently files a person under the wrong letter.
 */
const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "md", "esq"]);

/**
 * A person's name as an index heading: surname first.
 *
 * `Person.name` is one free-text field, so the surname has to be inferred, and
 * the last word is the only rule that holds for most of the catalogue —
 * including the awkward ones it happens to get right: "T. J. Cobden-Sanderson"
 * and "Laura (Riding) Jackson" both file correctly, and the Dutch and French
 * particles land where Chicago puts them ("Beethoven, Ludwig van").
 *
 * Three shapes are left exactly as stored, because inverting them produces
 * nonsense rather than a heading:
 *
 *   - a name already containing a comma — someone has typed the sorted form
 *     by hand, and flipping it again would mangle it;
 *   - a name containing "&" — "Poliphilo & Polia" is a pair, not a person;
 *   - a single word — "Epicurus" has no forename to move.
 *
 * What survives is a name like "A cat", which becomes "cat, A". There is no
 * signal in a free-text field that distinguishes it from a real surname, and
 * the alternative is a second field on every person to correct a handful of
 * entries, so it is left to be fixed in the typesetting.
 */
export function sortableName(name: string | undefined | null): string {
    const full = name?.trim().replace(/\s+/g, " ") ?? "";
    if (!full || full.includes(",") || full.includes("&")) return full;

    const parts = full.split(" ");

    // Peel the suffix off before taking the surname, so "Martin Luther King
    // Jr." files under King and keeps the Jr. — but stop while a word is still
    // left in front of it, so a bare "King Jr." is not reduced to a suffix.
    const suffixes: string[] = [];
    while (parts.length > 1 && NAME_SUFFIXES.has(bareWord(parts[parts.length - 1]))) {
        suffixes.unshift(parts.pop()!);
    }

    if (parts.length < 2) return full;

    const surname = parts.pop()!;
    return [`${surname}, ${parts.join(" ")}`, ...suffixes].join(" ");
}

const bareWord = (word: string) => word.toLowerCase().replace(/[.,]/g, "");

interface IndexScope {
    /**
     * Whether people are included, and under which heading.
     *
     * "surname-first" runs the name through `sortableName`; "as-stored" prints
     * it as typed. Heading and sort key are always the same string, so the two
     * cannot drift apart and a combined index interleaves people and words
     * correctly without a second sort key.
     */
    people: false | "as-stored" | "surname-first";
    words: boolean;
}

/** Walk every piece once, taking the headings the caller asked for. */
async function buildIndex(want: IndexScope): Promise<IndexEntry[]> {
    const pieces = (await getPiecesWithRelations()) as unknown as RawPiece[];
    const index = new IndexBuilder();

    for (const piece of pieces) {
        if (want.people) {
            for (const person of piece.persons ?? []) {
                const heading =
                    want.people === "surname-first" ? sortableName(person.name) : person.name;
                index.add(heading, piece.page);
            }
        }
        if (want.words) {
            // The term, not the card's label: `cardWordLabel` prints the
            // synset's gloss, which would put a sentence of glossary text in
            // the heading column. `lemma` is the fallback for the handful of
            // synsets stored without their searched form.
            for (const word of piece.word ?? []) {
                index.add(word.word ?? word.lemma, piece.page);
            }
        }
    }

    return index.build();
}

/**
 * People, by the name on their record.
 *
 * Deliberately not surname-first, unlike the combined index: this file predates
 * that decision and a print run may already be set from it, so the inversion
 * was added alongside rather than underneath. Switch this to "surname-first" to
 * make the two agree.
 */
export const buildPersonIndex = () => buildIndex({ people: "as-stored", words: false });

/** Words, by the term itself. */
export const buildWordIndex = () => buildIndex({ people: false, words: true });

/**
 * People and words in one alphabetical sequence, people filed under surname.
 *
 * A person and a word that share a heading merge into one line, the same way
 * two people with one name do — see `IndexBuilder`. Nothing marks which is
 * which: the file is one uniform list, so it takes a single paragraph style.
 */
export const buildCombinedIndex = () => buildIndex({ people: "surname-first", words: true });

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
