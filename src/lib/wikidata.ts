/**
 * Reading Wikidata's answer about a person.
 *
 * Wikidata rather than Wikipedia because it is the same data already typed:
 * P569 is a birth, P570 a death, and P31 = Q5 says the entity is a person
 * rather than — as the second result for "Ada Lovelace" is — a graphics card.
 * Scraping an infobox would get the same years less reliably.
 *
 * Only the parsing, kept free of Next and of the network for the reason
 * lib/data.ts is kept apart from lib/queries.ts: these are the rules that
 * decide what year gets written into the codex, and tests/lib.test.mts
 * exercises them directly against payloads captured from the live API. The
 * fetching is one module over, in lib/wikidata-lookup.ts.
 */

export interface Candidate {
    /** The Wikidata item id, e.g. "Q7259". Stored on the person we fill. */
    id: string;
    name: string;
    description: string;
    /** Signed year, negative for BC, or null when Wikidata does not agree on one. */
    birth: number | null;
    death: number | null;
    /** English Wikipedia, when the item has an article. */
    url: string | null;
}

/** P31 (instance of) Q5 (human). */
const HUMAN = "Q5";

const MIN_TERM = 2;
const MAX_TERM = 128;

/** How many of the search's results are worth asking about, and offering. */
export const LIMIT = 10;

/**
 * Wikidata's date precisions run from a billion years (0) to a second (14).
 * 9 is a year; 8 is a decade and 7 a century, and neither contains a year we
 * are entitled to write into a field that will be printed as fact.
 */
const YEAR_PRECISION = 9;

interface TimeStatement {
    rank?: string;
    mainsnak?: {
        snaktype?: string;
        datavalue?: { value?: { time?: string; precision?: number } };
    };
}

interface ItemStatement {
    mainsnak?: { datavalue?: { value?: { id?: string } } };
}

interface RawEntity {
    labels?: { en?: { value?: string }; mul?: { value?: string } };
    descriptions?: { en?: { value?: string } };
    sitelinks?: { enwiki?: { url?: string } };
    claims?: { P31?: ItemStatement[]; P569?: TimeStatement[]; P570?: TimeStatement[] };
}

/**
 * The single year a set of statements agrees on, or null.
 *
 * Taking the first statement is wrong often enough to matter. Cicero has two
 * deaths four days apart and one of them is ranked preferred; Sappho has
 * eleven births spread over two centuries. So: drop the ones Wikidata itself
 * disowns, defer to the preferred rank where there is one, ignore anything too
 * coarse to hold a year, and then insist on unanimity. Sappho's preferred
 * birth is a century, so she resolves to nothing and the author reads her
 * description and decides — which is the honest answer, and better than
 * writing down one of eleven guesses.
 */
export function resolveYear(statements: readonly TimeStatement[] | undefined): number | null {
    // "novalue" and "somevalue" are Wikidata's ways of saying it knows there
    // is no date, or that there is one but not which.
    const stated = (statements ?? []).filter(
        (statement) =>
            statement?.mainsnak?.snaktype === "value" && statement.rank !== "deprecated"
    );

    const ranked = stated.some((statement) => statement.rank === "preferred")
        ? stated.filter((statement) => statement.rank === "preferred")
        : stated;

    const years = new Set<number>();
    for (const statement of ranked) {
        const value = statement.mainsnak?.datavalue?.value;
        if (!value?.time) continue;
        if ((value.precision ?? 0) < YEAR_PRECISION) continue;
        // "+1815-12-10T00:00:00Z" and "-0106-01-03T00:00:00Z" — the sign is
        // part of the field, and BC comes out negative, which is already how
        // this codex stores a year. See asYear in components/editors/fields.
        const year = Number.parseInt(value.time.slice(0, 5), 10);
        if (Number.isFinite(year)) years.add(year);
    }

    return years.size === 1 ? years.values().next().value! : null;
}

const isHuman = (entity: RawEntity): boolean =>
    (entity.claims?.P31 ?? []).some(
        (statement) => statement?.mainsnak?.datavalue?.value?.id === HUMAN
    );

/** The item ids a wbsearchentities payload offers, in the order it ranked them. */
export function candidateIds(payload: unknown): string[] {
    const results = (payload as { search?: { id?: unknown }[] } | null)?.search ?? [];
    return results
        .map((result) => result?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .slice(0, LIMIT);
}

/**
 * People, in the order the search ranked them.
 *
 * Everything that is not a person is dropped here rather than in the search,
 * which has no idea what it is looking for: "Ada Lovelace" matches the
 * mathematician, an Nvidia microarchitecture and an episode of In Our Time.
 */
export function parseCandidates(ids: readonly string[], payload: unknown): Candidate[] {
    const entities = (payload as { entities?: Record<string, RawEntity> } | null)?.entities ?? {};

    const found: Candidate[] = [];
    for (const id of ids) {
        const entity = entities[id];
        if (!entity || !isHuman(entity)) continue;

        found.push({
            id,
            // Wikidata has been moving names that read the same in every
            // language to the "mul" label, and takes the English one away when
            // it does — Marie Curie and Douglas Adams both have no `en` label
            // at all. Reading only `en` showed a bare Q-number in the picker.
            name: entity.labels?.en?.value ?? entity.labels?.mul?.value ?? id,
            description: entity.descriptions?.en?.value ?? "",
            birth: resolveYear(entity.claims?.P569),
            death: resolveYear(entity.claims?.P570),
            url: entity.sitelinks?.enwiki?.url ?? null,
        });
    }
    return found;
}

/**
 * The term to search for, or null when there is nothing worth searching.
 *
 * Bounded before it reaches the cache in lib/wikidata-lookup, for the reason
 * searchQuery
 * records in lib/search-term.ts: an unbounded argument to a cached function is
 * an unbounded number of cache entries.
 */
export function lookupTerm(name: string): string | null {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed.length < MIN_TERM) return null;
    return trimmed.slice(0, MAX_TERM);
}
