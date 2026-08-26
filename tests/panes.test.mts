import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    parseSegment,
    paneIdentity,
    buildCreateLink,
    segmentsFromPathname,
    panePath,
    encodeSegment,
    MAX_PANES,
} from "../src/lib/panes";

describe("parseSegment", () => {
    test("classifies each shape in the grammar", () => {
        assert.deepEqual(parseSegment("graph"), { kind: "graph" });
        assert.deepEqual(parseSegment("index"), { kind: "index", variant: "tree" });
        assert.deepEqual(parseSegment("index-a"), { kind: "index", variant: "alpha" });
        assert.deepEqual(parseSegment("person"), { kind: "persons" });
        assert.deepEqual(parseSegment("word"), { kind: "words" });
        assert.deepEqual(parseSegment("all"), { kind: "all" });
        assert.deepEqual(parseSegment("new"), { kind: "new-piece" });
        assert.deepEqual(parseSegment("new-person"), { kind: "new-person" });
        assert.deepEqual(parseSegment("125"), { kind: "piece", page: 125, card: false });
        assert.deepEqual(parseSegment("125c"), { kind: "piece", page: 125, card: true });
        assert.deepEqual(parseSegment("p-someone"), { kind: "person", slug: "someone" });
        assert.deepEqual(parseSegment("w-293253r"), { kind: "word", id: "293253r" });
        assert.deepEqual(parseSegment("edit-2"), { kind: "edit-piece", page: 2 });
        assert.deepEqual(parseSegment("edit-person-x"), { kind: "edit-person", slug: "x" });
    });

    test("editors are matched before the person prefix", () => {
        // `edit-person-x` must not fall through to the `p-` branch.
        assert.equal(parseSegment("edit-person-x").kind, "edit-person");
    });

    test("anything else is notfound rather than a throw", () => {
        for (const segment of ["", "wat", "../etc/passwd", "%%%", "12x", "-1"]) {
            assert.equal(parseSegment(segment).kind, "notfound", segment);
        }
    });
});

describe("paneIdentity", () => {
    test("a card and its piece are the same thing", () => {
        // What decides whether a pane resets its scroll.
        assert.equal(paneIdentity("2"), paneIdentity("2c"));
    });

    test("different pieces are different things", () => {
        assert.notEqual(paneIdentity("2"), paneIdentity("3"));
    });
});

describe("buildCreateLink", () => {
    test("a contextual link replaces the pane next door", () => {
        assert.equal(buildCreateLink(["2", "125"], 0)("5", true), "/2/5");
        assert.equal(buildCreateLink(["2", "125"], 1)("5", true), "/5/125");
    });

    test("a direct link replaces the pane it was clicked in", () => {
        assert.equal(buildCreateLink(["2", "125"], 0)("5", false), "/5/125");
        assert.equal(buildCreateLink(["2", "125"], 1)("5", false), "/2/5");
    });

    // Regression: the target position was computed without reference to the
    // stack's length, so an index at or past the end wrote into a hole that
    // join() then rendered as an empty segment.
    test("never produces a protocol-relative href from an empty stack", () => {
        // `/index` is served from the root path, so the live pathname really
        // can carry no segments — and `//5` is another origin entirely.
        const href = buildCreateLink([], 0)("5", true);
        assert.equal(href, "/5");
        assert.ok(!href.startsWith("//"), "must not be protocol-relative");
    });

    test("never produces an empty segment from a stale index", () => {
        // An index past the end clamps to the last pane, and a contextual link
        // from the rightmost pane writes to the one on its left.
        const href = buildCreateLink(["7", "index"], 2)("p-x", true);
        assert.ok(!href.includes("//"), `${href} has an empty segment`);
        assert.equal(href, "/p-x/index");
    });

    test("clamps any index into the stack", () => {
        for (const index of [-5, 0, 1, 2, 99]) {
            for (const contextual of [true, false]) {
                const href = buildCreateLink(["a", "b"], index)("x", contextual);
                assert.ok(!href.includes("//"), `${index}/${contextual}: ${href}`);
                assert.equal(href.split("/").filter(Boolean).length, 2, href);
            }
        }
    });

    test("the stack never changes length", () => {
        for (const stack of [["a"], ["a", "b"], ["a", "b", "c"]]) {
            const href = buildCreateLink(stack, 1)("x", true);
            assert.equal(href.split("/").filter(Boolean).length, stack.length, href);
        }
    });

    test("encodes what it writes", () => {
        assert.equal(buildCreateLink(["2", "125"], 0)("p-a b", false), "/p-a%20b/125");
        assert.equal(buildCreateLink(["2", "125"], 0)("p-a/b", false), "/p-a%2Fb/125");
    });
});

describe("segmentsFromPathname", () => {
    test("decodes, so it agrees with what the server sees in params", () => {
        assert.deepEqual(segmentsFromPathname("/p-caf%C3%A9"), ["p-café"]);
        assert.deepEqual(segmentsFromPathname("/2/hello%20world"), ["2", "hello world"]);
    });

    test("round-trips through panePath", () => {
        for (const path of ["/2/125", "/index", "/p-caf%C3%A9/2"]) {
            const once = segmentsFromPathname(path);
            assert.deepEqual(segmentsFromPathname(panePath(once)), once, path);
        }
    });

    test("a malformed escape is kept rather than thrown on", () => {
        assert.deepEqual(segmentsFromPathname("/%E0%A4%A"), ["%E0%A4%A"]);
    });

    test("empty pathname yields no segments", () => {
        assert.deepEqual(segmentsFromPathname("/"), []);
        assert.deepEqual(segmentsFromPathname(""), []);
    });

    // Regression: every segment costs two database reads, so an unbounded path
    // was an anonymous way to fan one request out into thousands.
    test("caps the stack", () => {
        const long = "/" + Array.from({ length: 500 }, (_, i) => i).join("/");
        assert.equal(segmentsFromPathname(long).length, MAX_PANES);
    });
});

describe("encodeSegment", () => {
    test("leaves ordinary slugs alone", () => {
        assert.equal(encodeSegment("p-agnes-denes"), "p-agnes-denes");
        assert.equal(encodeSegment("125c"), "125c");
    });

    test("escapes a separator so it cannot become two panes", () => {
        assert.equal(encodeSegment("a/b"), "a%2Fb");
    });
});
