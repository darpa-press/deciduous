/**
 * The pane grammar.
 *
 * Deciduous puts a *stack* of pages in the URL: `/2/125` shows piece 2 beside
 * piece 125, `/index/p-someone` shows the index beside a person. Each path
 * segment is an independent pane, and the segment's own shape decides what it
 * renders. This is the app's central idea and it is carried over unchanged —
 * only the implementation moves, from client-side path splitting in
 * Routes/Leaves/Leaves.jsx to a single catch-all route rendering server
 * components.
 */

export type Pane =
    | { kind: "piece"; page: number; card: boolean }
    | { kind: "person"; slug: string }
    | { kind: "word"; id: string }
    | { kind: "index"; variant: "tree" | "alpha" }
    | { kind: "persons" }
    | { kind: "words" }
    | { kind: "all" }
    | { kind: "graph" }
    | { kind: "edit-piece"; page: number }
    | { kind: "edit-person"; slug: string }
    | { kind: "new-piece" }
    | { kind: "new-person" }
    | { kind: "notfound"; segment: string };

/** Classify one path segment. Mirrors the Route table in Leaves.jsx. */
export function parseSegment(segment: string): Pane {
    if (segment === "graph") return { kind: "graph" };
    if (segment === "index") return { kind: "index", variant: "tree" };
    if (segment === "index-a") return { kind: "index", variant: "alpha" };
    if (segment === "person") return { kind: "persons" };
    if (segment === "word") return { kind: "words" };
    if (segment === "all") return { kind: "all" };
    if (segment === "new") return { kind: "new-piece" };
    if (segment === "new-person") return { kind: "new-person" };

    // Editors are matched before the person/word prefixes so that
    // `edit-person-x` does not fall through to the `p-` branch.
    const editPiece = /^edit-([0-9]+)$/.exec(segment);
    if (editPiece) return { kind: "edit-piece", page: Number(editPiece[1]) };

    const editPerson = /^edit-person-(.+)$/.exec(segment);
    if (editPerson) return { kind: "edit-person", slug: editPerson[1] };

    if (segment.startsWith("p-")) return { kind: "person", slug: segment.slice(2) };
    if (segment.startsWith("w-")) return { kind: "word", id: segment.slice(2) };

    // `123c` renders the piece as a card; `123` renders it in full.
    const card = /^([0-9]+)c$/.exec(segment);
    if (card) return { kind: "piece", page: Number(card[1]), card: true };

    if (/^[0-9]+$/.test(segment)) return { kind: "piece", page: Number(segment), card: false };

    return { kind: "notfound", segment };
}

/**
 * The most panes one URL may ask for.
 *
 * Every segment costs a database read in the page *and* another in
 * generateMetadata, so an unbounded path is an unauthenticated way to fan one
 * request out into thousands. Well past anything the codex reads with.
 */
export const MAX_PANES = 8;

/**
 * The decoded segments of a pathname.
 *
 * `usePathname` returns the URL still percent-encoded, while the server
 * decodes `params` per segment. Mixing the two made a pane throw away correct
 * server HTML and refetch itself with the escaped string. Everything inside
 * the app works in decoded segments; encoding happens once, on the way out.
 */
export function segmentsFromPathname(pathname: string): string[] {
    return pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                // A malformed escape is not a segment we can decode; leave it
                // as written and let it resolve to notfound.
                return segment;
            }
        })
        .slice(0, MAX_PANES);
}

/** A segment as it appears in a URL. */
export function encodeSegment(segment: string): string {
    return encodeURIComponent(segment);
}

/** A path from decoded segments. */
export function panePath(segments: string[]): string {
    return `/${segments.map(encodeSegment).join("/")}`;
}

/**
 * Build the link factory for the pane at `index`.
 *
 * Ported from Leaves.jsx. A *contextual* link — which is what every `<aa>` in
 * the content is — does not replace the pane it was clicked in. It replaces
 * the pane next door: the one to the right, unless this is already the
 * rightmost pane, in which case the one to the left. That is what makes the
 * codex read as a pair of facing pages rather than a single column.
 *
 * Note the stack never grows this way; a link always writes over an existing
 * pane. Adding a pane is done by editing the URL.
 *
 * The original computed the target position without reference to the stack's
 * length, so an index at or past the end wrote into a hole that `join` then
 * rendered as an empty segment: a one-pane stack produced `//5`, which is
 * protocol-relative and sends the browser to another origin, and a stale index
 * produced `/7/index//p-x`. Both positions are clamped into the stack.
 */
export function buildCreateLink(pathArray: string[], index: number) {
    return function createLink(newItem: string, contextual = true): string {
        // `/index` is served from the root path, so the live pathname can carry
        // no segments at all. That stack still has one position to write into.
        const stack = pathArray.length ? pathArray.slice(0) : [""];
        const last = stack.length - 1;
        const here = Math.min(Math.max(index, 0), last);

        const target = contextual ? (here >= last ? Math.max(here - 1, 0) : here + 1) : here;

        stack[target] = newItem;
        return panePath(stack);
    };
}

/**
 * What a pane is *showing*, ignoring how it is being shown.
 *
 * `/2` and `/2c` are the same piece — the card is laid over it, not a
 * different thing — so moving between them should leave the reader where they
 * were. Moving to a different piece should not. This is the distinction a pane
 * uses to decide whether to reset its scroll.
 */
export function paneIdentity(segment: string): string {
    const pane = parseSegment(segment);

    switch (pane.kind) {
        // Deliberately ignores `card`.
        case "piece":
            return `piece:${pane.page}`;
        case "person":
            return `person:${pane.slug}`;
        case "word":
            return `word:${pane.id}`;
        case "index":
            return `index:${pane.variant}`;
        case "edit-piece":
            return `edit-piece:${pane.page}`;
        case "edit-person":
            return `edit-person:${pane.slug}`;
        case "notfound":
            return `notfound:${pane.segment}`;
        default:
            return pane.kind;
    }
}
