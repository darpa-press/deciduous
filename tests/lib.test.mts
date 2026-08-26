import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { listToTree } from "../src/lib/list-to-tree";
import { shelfMark, cardWordLabel, cardWordSource } from "../src/lib/card";
import { formatIndexText, type IndexEntry } from "../src/lib/export/index-text";
import { searchQuery, MAX_TERM } from "../src/lib/search-term";
import { claimAttempt, clearAttempts } from "../src/lib/auth/throttle";

const OPTS = { keyId: "id", keyParent: "parent", keyChild: "children" };

type Row = { id: string; parent: string; children?: Row[] };
const tree = (rows: Row[]) => listToTree(rows as never[], OPTS) as unknown as Row[];

/** Every id reachable from a built tree. */
function reachable(roots: Row[]): Set<string> {
    const seen = new Set<string>();
    const walk = (node: Row) => {
        seen.add(node.id);
        for (const child of node.children ?? []) walk(child);
    };
    roots.forEach(walk);
    return seen;
}

describe("listToTree", () => {
    test("nests children under their parent", () => {
        const roots = tree([
            { id: "a", parent: "" },
            { id: "b", parent: "a" },
            { id: "c", parent: "b" },
        ]);
        assert.equal(roots.length, 1);
        assert.equal(roots[0].id, "a");
        assert.equal(roots[0].children?.[0].id, "b");
        assert.equal(roots[0].children?.[0].children?.[0].id, "c");
    });

    test("leaves get no children key at all", () => {
        // The golden snapshots assert this: a leaf has no `children` property,
        // rather than an empty array.
        const roots = tree([
            { id: "a", parent: "" },
            { id: "b", parent: "a" },
        ]);
        assert.ok(!("children" in roots[0].children![0]));
    });

    test("a dangling parent reference becomes a root", () => {
        const roots = tree([{ id: "a", parent: "nobody" }]);
        assert.deepEqual(roots.map((r) => r.id), ["a"]);
    });

    // Regression: a node in a parent cycle always had a parent that resolved,
    // so it was filed as somebody's child and never pushed to the result — and
    // no root could reach it. It and its descendants vanished from the index
    // with no error, which one mis-set parent in the editor was enough to do.
    test("a self-parented node stays reachable", () => {
        const roots = tree([
            { id: "a", parent: "" },
            { id: "loop", parent: "loop" },
            { id: "under", parent: "loop" },
        ]);
        const seen = reachable(roots);
        assert.ok(seen.has("loop"), "the cyclic node vanished");
        assert.ok(seen.has("under"), "its descendant vanished with it");
    });

    test("a two-node cycle stays reachable", () => {
        const roots = tree([
            { id: "x", parent: "y" },
            { id: "y", parent: "x" },
        ]);
        const seen = reachable(roots);
        assert.ok(seen.has("x") && seen.has("y"), `lost one of the pair: ${[...seen]}`);
    });

    test("a longer cycle stays reachable", () => {
        const roots = tree([
            { id: "1", parent: "3" },
            { id: "2", parent: "1" },
            { id: "3", parent: "2" },
        ]);
        const seen = reachable(roots);
        assert.equal(seen.size, 3, `lost members of the cycle: ${[...seen]}`);
    });

    test("never loses a node, whatever the parent graph", () => {
        const rows: Row[] = [
            { id: "a", parent: "" },
            { id: "b", parent: "a" },
            { id: "c", parent: "c" },
            { id: "d", parent: "e" },
            { id: "e", parent: "d" },
            { id: "f", parent: "missing" },
        ];
        const seen = reachable(tree(rows));
        for (const row of rows) assert.ok(seen.has(row.id), `${row.id} was dropped`);
    });

    test("terminates on a cycle rather than hanging", () => {
        const rows = Array.from({ length: 200 }, (_, i) => ({
            id: String(i),
            parent: String((i + 1) % 200),
        }));
        assert.doesNotThrow(() => tree(rows));
    });
});

describe("card", () => {
    test("shelf mark carries the page", () => {
        assert.equal(shelfMark(125), "DC001.125");
        assert.equal(shelfMark(0), "DC001.0");
        assert.equal(shelfMark(undefined), "DC001.");
    });

    test("labels alternate gloss and term by position", () => {
        const item = { word: "tree", gloss: "a tall plant; woody" };
        assert.equal(cardWordLabel(item, 0), "a tall plant");
        assert.equal(cardWordSource(item, 0), "gloss");
        assert.equal(cardWordLabel(item, 1), "tree");
        assert.equal(cardWordSource(item, 1), "term");
    });

    test("falls back to the term when there is no gloss", () => {
        assert.equal(cardWordLabel({ word: "tree" }, 0), "tree");
        assert.equal(cardWordSource({ word: "tree" }, 0), "term");
    });
});

describe("formatIndexText", () => {
    const entry = (text: string, pages: number[]): IndexEntry => ({ text, pages });

    test("one entry per line, tab separated, pages comma separated", () => {
        assert.equal(formatIndexText([entry("Marie Curie", [12, 45, 88])]), "Marie Curie\t12,45,88\n");
    });

    test("ends on a complete line", () => {
        const out = formatIndexText([entry("A", [1]), entry("B", [2])]);
        assert.ok(out.endsWith("\n"));
        assert.equal(out.split("\n").filter(Boolean).length, 2);
    });

    test("a tab or newline in a heading cannot break the one-per-line contract", () => {
        const out = formatIndexText([entry("Bad\tName\nHere", [1])]);
        assert.equal(out.split("\n").filter(Boolean).length, 1);
        assert.equal(out.split("\t").length, 2, "only the separator tab may remain");
    });

    test("page 0 is a real page", () => {
        assert.equal(formatIndexText([entry("X", [0, 3])]), "X\t0,3\n");
    });

    test("nothing in, nothing out", () => {
        assert.equal(formatIndexText([]), "");
    });
});

describe("searchQuery", () => {
    test("wraps the term as a phrase, as the legacy client did", () => {
        assert.equal(searchQuery("green paper"), '"green paper"');
    });

    // Regression: a quote closed the phrase early and the remainder degraded
    // from a phrase match to a loose OR.
    test("a quote cannot break out of the phrase", () => {
        const q = searchQuery('a"b unicorn');
        assert.ok(q !== null);
        assert.equal(q!.match(/"/g)?.length, 2, `unbalanced quotes in ${q}`);
        assert.ok(q!.startsWith('"') && q!.endsWith('"'), q!);
    });

    // Regression: the bounds lived only in the client, while searchPieces is a
    // `use cache` boundary keyed on its argument.
    test("rejects anything below the minimum", () => {
        for (const term of ["", " ", "a", '"', '""', "  a  "]) {
            assert.equal(searchQuery(term), null, JSON.stringify(term));
        }
    });

    test("caps the length, so the cache key is bounded", () => {
        const q = searchQuery("x".repeat(100_000));
        assert.ok(q !== null);
        assert.ok(q!.length <= MAX_TERM + 2, `${q!.length} characters`);
    });

    test("trims", () => {
        assert.equal(searchQuery("   tree   "), '"tree"');
    });
});

describe("login throttle", () => {
    test("allows a first attempt and then stops guessing", () => {
        const key = `test-${Math.random()}`;
        let allowed = 0;
        for (let i = 0; i < 50; i++) {
            if (claimAttempt(key) === "ok") allowed++;
        }
        assert.ok(allowed > 0, "refused the very first attempt");
        assert.ok(allowed < 50, "let every attempt through");
    });

    test("a success clears the caller's budget", () => {
        const key = `test-${Math.random()}`;
        while (claimAttempt(key) === "ok") {
            /* exhaust it */
        }
        assert.equal(claimAttempt(key), "too-many");
        clearAttempts(key);
        assert.equal(claimAttempt(key), "ok");
    });

    test("callers are budgeted separately", () => {
        const a = `test-a-${Math.random()}`;
        const b = `test-b-${Math.random()}`;
        while (claimAttempt(a) === "ok") {
            /* exhaust a */
        }
        assert.equal(claimAttempt(b), "ok", "one caller's attempts blocked another's");
    });
});
