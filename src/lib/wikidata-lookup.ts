import "server-only";

import { cacheLife } from "next/cache";

import { LIMIT, lookupTerm, candidateIds, parseCandidates, type Candidate } from "./wikidata";

/**
 * Asking Wikidata about a name.
 *
 * The half of the lookup that needs the network and the framework, kept apart
 * from the rules in lib/wikidata.ts exactly as lib/queries.ts is kept apart
 * from lib/data.ts — the parsing is worth testing, and a module that imports
 * `server-only` and `next/cache` cannot be imported by a test at all.
 *
 * Nothing here throws at the caller. An unreachable Wikidata degrades to "no
 * matches", as lib/wordnet.ts does for the same reason: a lookup that fails
 * should cost the author a suggestion, not the ability to save.
 */

const ENDPOINT = "https://www.wikidata.org/w/api.php";

/** As lib/wordnet.ts: long enough to be worth waiting for, short enough to give up on. */
const TIMEOUT_MS = 8000;

function userAgent(): string {
    // Wikimedia throttles unidentified callers — a burst of ten anonymous
    // requests is enough to earn a 429 — and asks for a contact address.
    // Read lazily, as lib/mongodb.ts does: a missing env var must not fail the
    // build, and this one has a sensible fallback anyway.
    const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN;
    return origin ? `deciduous-codex/1.0 (${origin})` : "deciduous-codex/1.0";
}

async function api(params: Record<string, string>): Promise<unknown> {
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({ format: "json", ...params }).toString();

    const response = await fetch(url, {
        headers: { "user-agent": userAgent(), accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Wikidata answered ${response.status}.`);
    return response.json();
}

/**
 * Two requests: the name, then everything about the items it matched.
 *
 * The second call is batched over every candidate and asks for the claims, the
 * labels, the descriptions and the Wikipedia link together, so a lookup costs
 * two round trips however many people share the name.
 *
 * Cached because those round trips leave Sydney — see vercel.ts — and because
 * the dates of the dead do not change. Deliberately does not catch: a timeout
 * swallowed in here would be stored as "nobody of that name" and served back
 * for a day.
 */
async function fetchCandidates(term: string): Promise<Candidate[]> {
    "use cache";
    cacheLife("days");

    const search = await api({
        action: "wbsearchentities",
        search: term,
        language: "en",
        uselang: "en",
        type: "item",
        limit: String(LIMIT),
    });

    const ids = candidateIds(search);
    if (ids.length === 0) return [];

    const entities = await api({
        action: "wbgetentities",
        ids: ids.join("|"),
        // "mul" as well as "en": see the name fallback in parseCandidates.
        languages: "en|mul",
        sitefilter: "enwiki",
        props: "claims|labels|descriptions|sitelinks/urls",
    });

    return parseCandidates(ids, entities);
}

/** People on Wikidata matching a name, or an empty list if it cannot answer. */
export async function lookupPerson(name: string): Promise<Candidate[]> {
    const term = lookupTerm(name);
    if (!term) return [];

    try {
        return await fetchCandidates(term);
    } catch {
        // Outside the cache boundary, so a failure is not what gets stored.
        return [];
    }
}
