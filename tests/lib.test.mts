import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { listToTree } from "../src/lib/list-to-tree";
import { shelfMark, cardWordLabel, cardWordSource } from "../src/lib/card";
import { formatIndexText, sortableName, type IndexEntry } from "../src/lib/export/index-text";
import { searchQuery, MAX_TERM } from "../src/lib/search-term";
import { claimAttempt, clearAttempts } from "../src/lib/auth/throttle";
import {
    resolveYear,
    candidateIds,
    parseCandidates,
    lookupTerm,
} from "../src/lib/wikidata";
import { formatYear } from "../src/lib/year";

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

    test("labels are the gloss, cut at the first semicolon", () => {
        const item = { word: "tree", gloss: "a tall plant; woody" };
        assert.equal(cardWordLabel(item), "a tall plant");
        assert.equal(cardWordSource(item), "gloss");
    });

    test("the label does not depend on the word's position", () => {
        // It alternated with position until it was turned off; a card of the
        // same word repeated now reads the same the whole way down.
        const item = { word: "tree", gloss: "a tall plant; woody" };
        const labels = [0, 1, 2, 3].map(() => cardWordLabel(item));
        assert.deepEqual(new Set(labels), new Set(["a tall plant"]));
    });

    test("falls back to the term when there is no gloss", () => {
        assert.equal(cardWordLabel({ word: "tree" }), "tree");
        assert.equal(cardWordSource({ word: "tree" }), "term");
    });
});

describe("formatIndexText", () => {
    const entry = (text: string, pages: number[]): IndexEntry => ({ text, pages });

    test("one entry per line, heading and pages parted by a comma and a space", () => {
        assert.equal(formatIndexText([entry("Marie Curie", [12, 45, 88])]), "Marie Curie, 12,45,88\n");
    });

    // The separator reads as punctuation, so the pages stay tight against each
    // other — otherwise the line is a wash of identical commas and spaces.
    test("pages are packed, unlike the separator", () => {
        assert.equal(formatIndexText([entry("Curie, Marie", [12, 45])]), "Curie, Marie, 12,45\n");
    });

    test("ends on a complete line", () => {
        const out = formatIndexText([entry("A", [1]), entry("B", [2])]);
        assert.ok(out.endsWith("\n"));
        assert.equal(out.split("\n").filter(Boolean).length, 2);
    });

    test("a tab or newline in a heading cannot break the one-per-line contract", () => {
        const out = formatIndexText([entry("Bad\tName\nHere", [1])]);
        assert.equal(out.split("\n").filter(Boolean).length, 1);
        assert.ok(!out.includes("\t"), "no tab survives into the set copy");
    });

    test("page 0 is a real page", () => {
        assert.equal(formatIndexText([entry("X", [0, 3])]), "X, 0,3\n");
    });

    test("nothing in, nothing out", () => {
        assert.equal(formatIndexText([]), "");
    });
});

describe("sortableName", () => {
    test("files a person under the last word", () => {
        assert.equal(sortableName("Marie Curie"), "Curie, Marie");
        assert.equal(sortableName("Jorge Luis Borges"), "Borges, Jorge Luis");
        assert.equal(sortableName("Tim Berners-Lee"), "Berners-Lee, Tim");
    });

    // Initials and a parenthetical middle name both ride along with the
    // forenames — the last word is still the surname in each.
    test("initials and parentheticals stay with the forenames", () => {
        assert.equal(sortableName("T. J. Cobden-Sanderson"), "Cobden-Sanderson, T. J.");
        assert.equal(sortableName("Laura (Riding) Jackson"), "Jackson, Laura (Riding)");
        assert.equal(sortableName("David L. Mills"), "Mills, David L.");
    });

    test("a particle files under the name it precedes, as Chicago has it", () => {
        assert.equal(sortableName("Ludwig van Beethoven"), "Beethoven, Ludwig van");
    });

    test("a suffix trails the forenames rather than being taken for a surname", () => {
        assert.equal(sortableName("Martin Luther King Jr."), "King, Martin Luther Jr.");
        assert.equal(sortableName("Henry Ford III"), "Ford, Henry III");
    });

    test("a name that is only a surname and a suffix is left whole", () => {
        assert.equal(sortableName("King Jr."), "King Jr.");
    });

    test("a mononym has no forename to move", () => {
        assert.equal(sortableName("Epicurus"), "Epicurus");
        assert.equal(sortableName("Thayaht"), "Thayaht");
    });

    test("a pair is not a person", () => {
        assert.equal(sortableName("Poliphilo & Polia"), "Poliphilo & Polia");
        assert.equal(sortableName("Bouvard & Pecuchet"), "Bouvard & Pecuchet");
    });

    // Otherwise the second pass would file "Curie, Marie" under Marie.
    test("a name already inverted is left alone", () => {
        assert.equal(sortableName("Curie, Marie"), "Curie, Marie");
    });

    test("stray whitespace does not become part of a heading", () => {
        assert.equal(sortableName("  Marie   Curie  "), "Curie, Marie");
        assert.equal(sortableName(""), "");
        assert.equal(sortableName(undefined), "");
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

/**
 * Payloads trimmed from real responses — Q7259, Q114068528, Q1541 and Q17892 —
 * keeping the statements that decide a year and dropping the references, the
 * hashes and the other four hundred claims.
 */
const time = (value: string, precision: number, rank = "normal") => ({
    rank,
    mainsnak: {
        snaktype: "value",
        datavalue: { value: { time: value, precision } },
    },
});

const instanceOf = (id: string) => ({
    mainsnak: { snaktype: "value", datavalue: { value: { id } } },
});

const entity = (
    name: string,
    description: string,
    claims: Record<string, unknown[]>,
    article?: string
) => ({
    labels: { en: { value: name } },
    descriptions: { en: { value: description } },
    sitelinks: article ? { enwiki: { url: article } } : {},
    claims: { P31: [instanceOf("Q5")], ...claims },
});

const ENTITIES = {
    entities: {
        Q7259: entity(
            "Ada Lovelace",
            "English mathematician (1815–1852)",
            {
                P569: [time("+1815-12-10T00:00:00Z", 11)],
                P570: [time("+1852-11-27T00:00:00Z", 11)],
            },
            "https://en.wikipedia.org/wiki/Ada_Lovelace"
        ),
        // The second thing Wikidata offers for that name.
        Q114068528: {
            labels: { en: { value: "Ada Lovelace" } },
            descriptions: { en: { value: "GPU microarchitecture designed by Nvidia" } },
            sitelinks: {},
            claims: { P31: [instanceOf("Q259864")] },
        },
        // Wikidata took her English label away when it moved the name to "mul".
        Q7186: {
            labels: { mul: { value: "Marie Curie" } },
            descriptions: { en: { value: "Polish-born French physicist (1867–1934)" } },
            sitelinks: {},
            claims: {
                P31: [instanceOf("Q5")],
                P569: [time("+1867-11-07T00:00:00Z", 11)],
                P570: [time("+1934-07-04T00:00:00Z", 11)],
            },
        },
        Q1541: entity("Cicero", "Roman statesman (106–43 BC)", {
            P569: [time("-0106-01-03T00:00:00Z", 11)],
            P570: [
                time("-0043-12-07T00:00:00Z", 11, "preferred"),
                time("-0043-12-03T00:00:00Z", 11),
            ],
        }),
        Q17892: entity("Sappho", "ancient Greek poet from Lesbos (c. 630-c. 570 BC)", {
            P569: [
                time("-0650-00-00T00:00:00Z", 7),
                time("-0650-00-00T00:00:00Z", 7, "preferred"),
                time("-0630-00-00T00:00:00Z", 9),
                time("-0628-00-00T00:00:00Z", 9),
                time("-0625-00-00T00:00:00Z", 9),
                time("-0450-00-00T00:00:00Z", 7, "deprecated"),
            ],
            P570: [
                time("-0550-00-00T00:00:00Z", 7),
                time("-0570-00-00T00:00:00Z", 9, "preferred"),
                time("-0569-00-00T00:00:00Z", 9),
            ],
        }),
    },
};

describe("wikidata years", () => {
    test("reads a plain dated statement", () => {
        assert.equal(resolveYear([time("+1815-12-10T00:00:00Z", 11)]), 1815);
    });

    test("BC comes back negative, as the codex stores it", () => {
        assert.equal(resolveYear([time("-0106-01-03T00:00:00Z", 11)]), -106);
    });

    test("the preferred rank settles a disagreement", () => {
        const year = resolveYear([
            time("-0043-12-03T00:00:00Z", 11),
            time("-0043-12-07T00:00:00Z", 11, "preferred"),
        ]);
        assert.equal(year, -43);
    });

    test("a deprecated statement is not an answer", () => {
        assert.equal(resolveYear([time("-0450-00-00T00:00:00Z", 11, "deprecated")]), null);
    });

    test("a century is too coarse to write down", () => {
        // Precision 7 is a century and 8 a decade; neither names a year.
        assert.equal(resolveYear([time("-0650-00-00T00:00:00Z", 7)]), null);
        assert.equal(resolveYear([time("+1890-00-00T00:00:00Z", 8)]), null);
    });

    test("knowing there is a date but not which one is not knowing", () => {
        const unknown = { rank: "normal", mainsnak: { snaktype: "somevalue" } };
        assert.equal(resolveYear([unknown]), null);
    });

    // Regression: taking the first statement, or the first preferred one, put a
    // year in the field that Wikidata does not actually claim. Sappho carries
    // eleven birth statements spread over two centuries.
    test("statements that disagree resolve to nothing", () => {
        const year = resolveYear([
            time("-0630-00-00T00:00:00Z", 9),
            time("-0628-00-00T00:00:00Z", 9),
            time("-0625-00-00T00:00:00Z", 9),
        ]);
        assert.equal(year, null, "picked one of several candidate years");
    });

    test("agreement between statements is still an answer", () => {
        const year = resolveYear([
            time("+1815-12-10T00:00:00Z", 11),
            time("+1815-06-01T00:00:00Z", 11),
        ]);
        assert.equal(year, 1815, "the same year twice was read as a disagreement");
    });

    test("nothing at all is null, not a crash", () => {
        assert.equal(resolveYear(undefined), null);
        assert.equal(resolveYear([]), null);
    });
});

describe("wikidata candidates", () => {
    test("takes the ids the search ranked, in order", () => {
        const ids = candidateIds({ search: [{ id: "Q7259" }, { id: "Q114068528" }] });
        assert.deepEqual(ids, ["Q7259", "Q114068528"]);
    });

    test("a search that matched nothing yields nothing", () => {
        assert.deepEqual(candidateIds({ search: [] }), []);
        assert.deepEqual(candidateIds({}), []);
    });

    test("reads a person out of the payload whole", () => {
        const [ada] = parseCandidates(["Q7259"], ENTITIES);
        assert.deepEqual(ada, {
            id: "Q7259",
            name: "Ada Lovelace",
            description: "English mathematician (1815–1852)",
            birth: 1815,
            death: 1852,
            url: "https://en.wikipedia.org/wiki/Ada_Lovelace",
        });
    });

    // Regression: the second result for "Ada Lovelace" is a graphics card, and
    // the search itself has no idea we are looking for a person.
    test("keeps only the people", () => {
        const found = parseCandidates(["Q7259", "Q114068528"], ENTITIES);
        assert.deepEqual(
            found.map((c) => c.id),
            ["Q7259"],
            "offered something that is not a person"
        );
    });

    test("holds the order the search gave", () => {
        const found = parseCandidates(["Q1541", "Q7259"], ENTITIES);
        assert.deepEqual(
            found.map((c) => c.id),
            ["Q1541", "Q7259"]
        );
    });

    test("offers a person whose dates it cannot settle, without dates", () => {
        const [sappho] = parseCandidates(["Q17892"], ENTITIES);
        assert.equal(sappho.birth, null, "invented a birth year");
        assert.equal(sappho.death, -570, "lost the one year that is agreed");
        assert.match(sappho.description, /c\. 630/, "dropped the description that says so");
    });

    test("an item the entities call did not answer for is skipped", () => {
        assert.deepEqual(parseCandidates(["Q404"], ENTITIES), []);
    });

    // Regression: many people — Marie Curie, Douglas Adams — have no English
    // label at all now that Wikidata keeps their name under "mul" instead, and
    // reading only `en` put a bare Q-number in front of the author.
    test("falls back to the multilingual name", () => {
        const [curie] = parseCandidates(["Q7186"], ENTITIES);
        assert.equal(curie.name, "Marie Curie", "offered a Q-number as a name");
        assert.equal(curie.birth, 1867);
    });

    test("no article is null, not an empty link", () => {
        const [cicero] = parseCandidates(["Q1541"], ENTITIES);
        assert.equal(cicero.url, null);
    });
});

describe("wikidata search term", () => {
    test("a name too short to be worth a request is refused", () => {
        assert.equal(lookupTerm(""), null);
        assert.equal(lookupTerm(" a "), null);
    });

    test("trims and collapses, so one name is one cache entry", () => {
        assert.equal(lookupTerm("  Ada   Lovelace  "), "Ada Lovelace");
    });

    test("a very long name is bounded", () => {
        assert.equal(lookupTerm("x".repeat(500))?.length, 128);
    });
});

describe("formatYear", () => {
    test("prints AD plainly and BC in the codex's notation", () => {
        assert.equal(formatYear(1815), "1815");
        assert.equal(formatYear(-106), "BC106");
    });

    test("an unknown year is a dash, not a zero", () => {
        assert.equal(formatYear(null), "—");
        assert.equal(formatYear(undefined), "—");
    });
});
