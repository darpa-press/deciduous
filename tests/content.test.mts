import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import { toHtml } from "hast-util-to-html";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import type { Root } from "hast";

import { visit } from "unist-util-visit";

import { contentSchema, CUSTOM_ELEMENTS } from "../src/lib/content/schema";
import { normaliseContent } from "../src/lib/content/normalise";
import { scopeCss } from "../src/lib/content/scope-css";

/** Parse the way renderContent does, newline stripping included. */
function parse(html: string | null | undefined): Root {
    return unified().use(rehypeParse, { fragment: true }).parse(normaliseContent(html)) as Root;
}

/** Total length of every text node in a tree. */
function textLength(tree: Root): number {
    let total = 0;
    visit(tree, (node) => {
        if (node.type === "text") total += (node as { value: string }).value.length;
    });
    return total;
}

/** The sanitise half of the pipeline, as renderContent runs it. */
function sanitise(html: string): string {
    const tree = unified()
        .use(rehypeParse, { fragment: true })
        .parse(normaliseContent(html)) as Root;
    const clean = unified().use(rehypeSanitize, contentSchema).runSync(tree) as Root;
    return toHtml(clean);
}

/** The convert half, which is where a malformed style attribute used to throw. */
function toJsx(html: string) {
    const tree = unified()
        .use(rehypeParse, { fragment: true })
        .parse(normaliseContent(html)) as Root;
    const clean = unified().use(rehypeSanitize, contentSchema).runSync(tree) as Root;
    return toJsxRuntime(clean, {
        Fragment,
        jsx,
        jsxs,
        passKeys: true,
        passNode: false,
        development: false,
        ignoreInvalidStyle: true,
    });
}

describe("sanitise: script execution", () => {
    test("drops script tags", () => {
        assert.ok(!sanitise(`<script>alert(1)</script>`).includes("script"));
        assert.ok(!sanitise(`<div><script>alert(1)</script></div>`).includes("alert"));
    });

    test("drops every event handler, including on custom elements", () => {
        for (const tag of ["div", "img", "a", ...CUSTOM_ELEMENTS]) {
            const out = sanitise(`<${tag} onclick="alert(1)" onerror="alert(1)">x</${tag}>`);
            assert.ok(!/on(click|error)/i.test(out), `${tag}: ${out}`);
            assert.ok(!out.includes("alert"), `${tag}: ${out}`);
        }
    });

    test("drops javascript: URLs wherever a URL is allowed", () => {
        for (const html of [
            `<a href="javascript:alert(1)">x</a>`,
            `<img src="javascript:alert(1)">`,
            `<iframe src="javascript:alert(1)"></iframe>`,
            `<link rel="stylesheet" href="javascript:alert(1)">`,
        ]) {
            assert.ok(!sanitise(html).includes("javascript:"), html);
        }
    });

    test("obfuscated javascript: does not survive", () => {
        // normaliseContent strips newlines before parsing, so the tab form is
        // the one worth pinning down.
        const out = sanitise(`<a href="jav&#9;ascript:alert(1)">x</a>`);
        assert.ok(!/javascript:/i.test(out), out);
    });

    test("drops srcdoc and srcset", () => {
        assert.ok(!sanitise(`<iframe srcdoc="<script>alert(1)</script>"></iframe>`).includes("srcdoc"));
        assert.ok(!sanitise(`<img srcset="x 1x">`).includes("srcset"));
        assert.ok(!sanitise(`<source srcset="x 1x">`).includes("srcset"));
    });
});

describe("sanitise: the codex's own vocabulary survives", () => {
    test("keeps custom elements", () => {
        assert.ok(sanitise(`<aa to="125">x</aa>`).includes("<aa"));
        assert.ok(sanitise(`<lightimg src="https://x/a.png"></lightimg>`).includes("<lightimg"));
        assert.ok(sanitise(`<numberofdocuments></numberofdocuments>`).includes("numberofdocuments"));
    });

    test("keeps inline style and per-piece style blocks", () => {
        assert.ok(sanitise(`<p style="color:red">x</p>`).includes("color:red"));
        assert.ok(sanitise(`<style>.green-paper{color:red}</style>`).includes("green-paper"));
    });

    // Regression: the inherited schema restricted className on seven tags to a
    // fixed set of values, so an authored class was not kept — it was emptied.
    test("keeps an authored class on every tag", () => {
        for (const tag of ["a", "code", "li", "ol", "ul", "h2", "section", "p", "div", "span"]) {
            const out = sanitise(`<${tag} class="mine">x</${tag}>`);
            assert.ok(out.includes(`class="mine"`), `${tag} lost its class: ${out}`);
        }
    });

    // Regression: `id` was rewritten to `user-content-id` while `href="#id"`
    // was left alone, so in-page anchors silently went nowhere.
    test("leaves id alone so in-page anchors resolve", () => {
        assert.ok(sanitise(`<div id="foo">x</div>`).includes(`id="foo"`));
        assert.ok(sanitise(`<a href="#foo">jump</a>`).includes(`href="#foo"`));
    });

    test("every piece in the baseline survives sanitising", () => {
        const content: Record<string, string> = JSON.parse(
            readFileSync("baseline/content.json", "utf8")
        );
        const pages = Object.keys(content);
        assert.ok(pages.length > 100, "baseline should carry the whole codex");

        // Measured on the parsed tree, not the source string: an entity such as
        // `&nbsp;` is six characters of HTML and one character of text, so
        // comparing raw source against serialised output reports a loss that
        // has not happened.
        for (const page of pages) {
            const parsed = parse(content[page]);
            const before = textLength(parsed);
            const after = textLength(
                unified().use(rehypeSanitize, contentSchema).runSync(parse(content[page])) as Root
            );
            assert.equal(after, before, `page ${page} lost text`);
        }
    });
});

describe("render: a malformed style attribute must not take the page down", () => {
    // Regression: toJsxRuntime throws on an unparseable style by default, and
    // renderContent runs synchronously inside a server component — so one
    // dropped colon 500'd the piece, /all, and every stack containing it.
    for (const html of [
        `<p style="color">x</p>`,
        `<p style="color:red; font-weight bold">x</p>`,
        `<p style="text-decoration">x</p>`,
        `<p style="/*">x</p>`,
        `<div style=":::">x</div>`,
    ]) {
        test(`renders ${html}`, () => {
            assert.doesNotThrow(() => toJsx(html));
        });
    }

    test("still renders valid styles", () => {
        assert.ok(sanitise(`<p style="color:red">x</p>`).includes("color:red"));
    });
});

describe("normaliseContent", () => {
    test("substitutes an empty div for missing content", () => {
        assert.equal(normaliseContent(null), "<div></div>");
        assert.equal(normaliseContent(undefined), "<div></div>");
        assert.equal(normaliseContent(""), "<div></div>");
    });

    test("strips newlines, as the legacy parser did", () => {
        assert.equal(normaliseContent("a\r\nb\rc\nd"), "abcd");
    });
});

describe("scopeCss", () => {
    // Regression: a <style> block is global wherever it lands, and the codex
    // shows several pieces at once, so page 97's bare `pre` rule reached page
    // 81's ASCII art.
    test("confines a bare element selector to the piece", () => {
        assert.equal(
            scopeCss("pre {font-size: 0.5rem;}", "piece-scope-97"),
            ".piece-scope-97 pre{font-size: 0.5rem;}"
        );
    });

    test("scopes every selector in a list", () => {
        const out = scopeCss(".a, .b > i { color: red }", "s");
        assert.ok(out.includes(".s .a"), out);
        assert.ok(out.includes(".s .b > i"), out);
    });

    test("recurses into at-rules that hold selectors", () => {
        const out = scopeCss("@media (min-width:40em){ p { margin:0 } }", "s");
        assert.ok(out.includes("@media (min-width:40em)"), out);
        assert.ok(out.includes(".s p"), out);
    });

    test("leaves name-defining at-rules alone", () => {
        const out = scopeCss("@keyframes spin { from { opacity: 0 } }", "s");
        assert.ok(!out.includes(".s from"), out);
        assert.ok(out.includes("@keyframes spin"), out);
    });

    test("a comment containing a brace does not derail it", () => {
        const out = scopeCss("/* } */ p { color: blue }", "s");
        assert.ok(out.includes(".s p"), out);
    });

    test("survives an unbalanced stylesheet without hanging", () => {
        assert.doesNotThrow(() => scopeCss("p { color: red", "s"));
        assert.doesNotThrow(() => scopeCss("}}}", "s"));
        assert.doesNotThrow(() => scopeCss("@media {", "s"));
    });

    test("every selector it emits is prefixed", () => {
        const css = "h1{a:b} .x,.y{c:d} @media screen{ .z{e:f} }";
        const out = scopeCss(css, "sc");
        // No rule may begin at the start of a block without the scope class.
        for (const selector of ["h1", ".x", ".y", ".z"]) {
            assert.ok(out.includes(`.sc ${selector}`), `${selector} unscoped in: ${out}`);
        }
    });
});
