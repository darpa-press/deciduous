#!/usr/bin/env tsx
//
// Phase 3 renderer gate — part one.
//
// Proves the sanitise allowlist in src/lib/content/schema.ts loses nothing.
// Parses every piece twice, once sanitised and once not, and reports any
// element, attribute or text that sanitising removed.
//
// This is the check that catches the failure mode the baseline flagged: the
// default schema silently strips <style>, <link> and every custom element,
// which would flatten four pieces' bespoke CSS and blank out 48 <aa> links
// with no error anywhere.
//
//   npx tsx scripts/verify-content-render.mts
//   npx tsx scripts/verify-content-render.mts --page 34
//
import { readFileSync } from "node:fs";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import { visit } from "unist-util-visit";
import type { Root } from "hast";
import { contentSchema } from "../src/lib/content/schema";
import { normaliseContent } from "../src/lib/content/normalise";

const args = process.argv.slice(2);
const onlyPage = args.includes("--page") ? args[args.indexOf("--page") + 1] : null;

const content: Record<string, string> = JSON.parse(readFileSync("baseline/content.json", "utf8"));

const parse = (html: string) => unified().use(rehypeParse, { fragment: true }).parse(html) as Root;
const sanitise = (tree: Root) =>
    unified().use(rehypeSanitize, contentSchema).runSync(tree) as Root;

type Census = {
    elements: Map<string, number>;
    attrs: Map<string, number>;
    /** Counted by `tag.attr=value`, so a *changed* value reads as a loss. */
    values: Map<string, number>;
    textLength: number;
};

/**
 * Values, not just presence.
 *
 * Counting `tag.attr` alone cannot see the failure that actually happened: the
 * inherited schema restricted `className` on seven tags to a fixed set, so
 * `<a class="external">` sanitised to `<a class="">`. The key `a.className`
 * was there before and after, the count never moved, and this gate reported
 * "118 of 118 survive intact" while the value was destroyed. The same blind
 * spot hid `id` being rewritten to `user-content-id`.
 */
const valueOf = (value: unknown): string => {
    if (Array.isArray(value)) return value.join(" ");
    if (value === null || value === undefined) return "";
    return String(value);
};

function census(tree: Root): Census {
    const elements = new Map<string, number>();
    const attrs = new Map<string, number>();
    const values = new Map<string, number>();
    let textLength = 0;

    visit(tree, (node) => {
        if (node.type === "element") {
            const el = node as unknown as { tagName: string; properties?: Record<string, unknown> };
            elements.set(el.tagName, (elements.get(el.tagName) ?? 0) + 1);
            for (const [a, v] of Object.entries(el.properties ?? {})) {
                const key = `${el.tagName}.${a}`;
                attrs.set(key, (attrs.get(key) ?? 0) + 1);
                const valueKey = `${key}=${valueOf(v)}`;
                values.set(valueKey, (values.get(valueKey) ?? 0) + 1);
            }
        } else if (node.type === "text") {
            textLength += (node as unknown as { value: string }).value.length;
        }
    });

    return { elements, attrs, values, textLength };
}

function lost(before: Map<string, number>, after: Map<string, number>) {
    const out: string[] = [];
    for (const [k, n] of before) {
        const m = after.get(k) ?? 0;
        if (m < n) out.push(`${k} ${n}→${m}`);
    }
    return out;
}

const pages = Object.keys(content)
    .filter((p) => !onlyPage || p === onlyPage)
    .sort((a, b) => Number(a) - Number(b));

console.log(`\n  Phase 3 renderer gate — sanitise fidelity\n`);
console.log(`  checking ${pages.length} pieces\n`);

let failures = 0;
const aggregateLoss = new Map<string, number>();

for (const page of pages) {
    const html = normaliseContent(content[page]);
    const before = census(parse(html));
    const after = census(sanitise(parse(html)));

    const lostElements = lost(before.elements, after.elements);
    const lostAttrs = lost(before.attrs, after.attrs);
    const lostValues = lost(before.values, after.values);
    const lostText = before.textLength - after.textLength;

    if (lostElements.length || lostAttrs.length || lostValues.length || lostText > 0) {
        failures++;
        console.log(`  page ${page}`);
        if (lostElements.length) console.log(`    elements: ${lostElements.join(", ")}`);
        if (lostAttrs.length) console.log(`    attrs:    ${lostAttrs.join(", ")}`);
        if (lostValues.length) console.log(`    values:   ${lostValues.slice(0, 6).join(", ")}`);
        if (lostText > 0) console.log(`    text:     ${lostText} characters dropped`);
        console.log("");
        for (const l of [...lostElements, ...lostAttrs, ...lostValues]) {
            const key = l.split(" ")[0];
            aggregateLoss.set(key, (aggregateLoss.get(key) ?? 0) + 1);
        }
    }
}

if (aggregateLoss.size) {
    console.log(`  most commonly lost:`);
    for (const [k, n] of [...aggregateLoss.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
        console.log(`    ${k.padEnd(28)} on ${n} pages`);
    }
    console.log("");
}

console.log(`  ${pages.length - failures} of ${pages.length} pieces survive sanitising intact\n`);
process.exit(failures ? 1 : 0);
