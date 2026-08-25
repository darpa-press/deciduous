/**
 * Replacement for the `list-to-tree` package (unmaintained, last published
 * 2018), used to build both the piece index and the word index.
 *
 * This is a deliberate transcription rather than a clean reimplementation,
 * because two of its behaviours are observable in the API output and the
 * golden snapshots assert them:
 *
 *   1. Only nodes that are somebody's parent get a `children` key. Leaves do
 *      not get `children: []` — they have no such property at all.
 *   2. The input is sorted first with a comparator that is *inconsistent*: it
 *      compares by id, then breaks ties by parent, in a way that is not a
 *      total order. Array.prototype.sort with an inconsistent comparator gives
 *      an engine-defined result, and reproducing the original ordering means
 *      reproducing the original comparator.
 *
 * scripts/verify-data-layer.mts asserts the output matches production exactly.
 */

export interface TreeOptions {
    keyId?: string;
    keyParent?: string;
    keyChild?: string;
}

type Node = Record<string, unknown>;

/** The original's sortBy(collection, key_parent, key_id) — transcribed as-is. */
function sortByParentThenId<T extends Node>(collection: T[], keyParent: string, keyId: string): T[] {
    return collection.sort((a, b) => {
        if ((a[keyId] as never) < (b[keyId] as never)) {
            if ((a[keyParent] as never) > (b[keyParent] as never)) return 1;
            return -1;
        } else {
            if ((a[keyParent] as never) < (b[keyParent] as never)) return -1;
            return 1;
        }
    });
}

function unique<T>(values: T[]): T[] {
    return values.filter((value, index, array) => array.indexOf(value) === index);
}

export function listToTree<T extends Node>(list: T[], options: TreeOptions = {}): T[] {
    const keyId = options.keyId ?? "id";
    const keyParent = options.keyParent ?? "parent";
    const keyChild = options.keyChild ?? "child";

    // The original mutates the array it is handed. Callers pass freshly mapped
    // arrays, but copying keeps that from mattering.
    const items = sortByParentThenId([...list], keyParent, keyId);
    const groupParent = unique(items.map((item) => item[keyParent]));

    const result: T[] = [];

    for (const parentId of groupParent) {
        const obj = items.find((item) => item[keyId] === parentId);
        const children = items.filter((item) => item[keyParent] === parentId);

        if (obj === undefined) {
            // No node carries this id — so these are roots (parent "" for
            // top-level items, or a dangling reference).
            for (const child of children) result.push(child);
        } else {
            (obj as Node)[keyChild] = children;
        }
    }

    return result;
}
