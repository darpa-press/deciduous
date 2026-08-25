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
 * Build the link factory for the pane at `index`.
 *
 * Ported verbatim from Leaves.jsx. A *contextual* link — which is what every
 * `<aa>` in the content is — does not replace the pane it was clicked in. It
 * replaces the pane next door: the one to the right, unless this is already
 * the rightmost pane, in which case the one to the left. That is what makes
 * the codex read as a pair of facing pages rather than a single column.
 *
 * Note the stack never grows this way; a link always writes over an existing
 * pane. Adding a pane is done by editing the URL.
 */
export function buildCreateLink(pathArray: string[], index: number) {
    return function createLink(newItem: string, contextual = true): string {
        const target = contextual
            ? index === pathArray.length - 1
                ? index - 1 >= 0
                    ? index - 1
                    : 0
                : index + 1
            : index;

        const next = pathArray.slice(0);
        next[target] = newItem;
        return `/${next.join("/")}`;
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

/** The URL the legacy app redirected `/` to. */
export const HOME_PANES = ["2", "125"];
