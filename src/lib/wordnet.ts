import "server-only";

/**
 * WordNet lookup, behind a single shared instance.
 *
 * This is the code path that is currently crashing the live site. The legacy
 * controller constructed `new WordNet()` per request — and again inside the
 * hypernym loop, so once per level of the chain — each opening the dictionary
 * files and never closing them. One instance is created here and reused.
 *
 * Every call is also wrapped and time-limited. node-wordnet reads its files
 * asynchronously, and an error surfacing outside a promise chain takes the
 * process with it; that cannot be caught from here, but a lookup that hangs or
 * rejects should degrade to "no results" rather than to a broken editor.
 *
 * Used only on admin paths. The `words` collection already mirrors WordNet's
 * schema, so ordinary reading never touches this.
 */

export interface Pointer {
    pointerSymbol?: string;
    synsetOffset?: number;
    pos?: string;
    sourceTarget?: string;
}

export interface Synset {
    synsetOffset: number;
    pos: string;
    lemma?: string;
    word?: string;
    gloss?: string;
    def?: string;
    exp?: string[];
    synonyms?: string[];
    lexId?: string;
    lexFilenum?: number;
    wCnt?: number;
    ptrs: Pointer[];
}

const LOOKUP_TIMEOUT_MS = 8000;
/** A hypernym chain deeper than this is a cycle, not a chain. */
const MAX_HYPERNYM_DEPTH = 40;

interface WordNetLike {
    lookupAsync(term: string): Promise<Synset[]>;
    getAsync(offset: number, pos: string): Promise<Synset>;
}

const globalForWordNet = globalThis as unknown as { _deciduousWordNet?: WordNetLike };

/** One instance for the life of the process. */
function wordnet(): WordNetLike {
    if (!globalForWordNet._deciduousWordNet) {
        // node-wordnet requires es6-shim, which overwrites the global Promise,
        // Map and Set with ES6-era polyfills — and its Promise has no
        // `.finally`, which is ES2018. Next calls `allReady.finally()` on
        // every response it streams, so the first WordNet lookup in a process
        // left every later render throwing "allReady.finally is not a
        // function": the response failed to pipe and the site answered 200
        // with an empty body until it was restarted. Attaching a word
        // refreshes the route, which made that first broken render the click
        // itself — the editor appeared to reload, and the unsaved edits went
        // with it.
        //
        // Nothing here needs the shim: node-wordnet uses its own bluebird, and
        // the natives it is shadowing have been in Node for a decade. So they
        // are put straight back, in a finally so a failed require cannot leave
        // the process running on the polyfills.
        const natives = {
            Promise: globalThis.Promise,
            Map: globalThis.Map,
            Set: globalThis.Set,
        };

        try {
            // Required lazily so that merely importing this module — which
            // happens on any page that imports the editor tree — does not open
            // the dictionary files.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const WordNet = require("node-wordnet");
            globalForWordNet._deciduousWordNet = new WordNet() as WordNetLike;
        } finally {
            Object.assign(globalThis, natives);
        }
    }
    return globalForWordNet._deciduousWordNet;
}

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), LOOKUP_TIMEOUT_MS)),
    ]).catch(() => fallback);
}

/** Synsets for a term, or an empty list if WordNet cannot answer. */
export async function lookup(term: string): Promise<Synset[]> {
    const trimmed = term.trim();
    if (!trimmed) return [];
    return withTimeout(wordnet().lookupAsync(trimmed), []);
}

export async function getSynset(offset: number, pos: string): Promise<Synset | null> {
    return withTimeout(wordnet().getAsync(offset, pos), null as Synset | null);
}

/**
 * Walk a synset's hypernyms — "tree" up to "entity".
 *
 * Ported from getHypernyms in wordController, with two corrections. The
 * original guarded only against a synset pointing at itself, so a two-node
 * cycle would loop forever; this tracks what it has seen. And it constructed a
 * WordNet per iteration, which is what leaked handles.
 */
export async function hypernymChain(start: Synset): Promise<Synset[]> {
    const chain: Synset[] = [];
    const seen = new Set<string>([`${start.synsetOffset}${start.pos}`]);

    let current = start;

    for (let depth = 0; depth < MAX_HYPERNYM_DEPTH; depth++) {
        const pointer = (current.ptrs ?? []).findLast?.((p) => p.pointerSymbol === "@")
            ?? (current.ptrs ?? []).filter((p) => p.pointerSymbol === "@").pop();
        if (!pointer?.synsetOffset || !pointer.pos) break;

        const key = `${pointer.synsetOffset}${pointer.pos}`;
        if (seen.has(key)) break;

        const next = await getSynset(pointer.synsetOffset, pointer.pos);
        if (!next) break;

        seen.add(key);
        chain.push(next);
        current = next;
    }

    return chain;
}

/** The id form used by both the `words` collection and the `w-` URL segment. */
export function synsetId(synset: { synsetOffset?: number; pos?: string }): string {
    return `${synset.synsetOffset ?? ""}${synset.pos ?? ""}`;
}
