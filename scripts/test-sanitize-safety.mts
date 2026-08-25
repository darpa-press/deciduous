#!/usr/bin/env tsx
// The allowlist is permissive about presentation. This asserts it is still
// strict about execution.
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { contentSchema } from "../src/lib/content/schema";

const run = (html: string) =>
    String(
        unified()
            .use(rehypeParse, { fragment: true })
            .use(rehypeSanitize, contentSchema)
            .use(rehypeStringify)
            .processSync(html)
    );

const cases: [string, string, (out: string) => boolean][] = [
    ["script tag", `<p>hi</p><script>alert(1)</script>`, (o) => !o.includes("<script")],
    ["inline handler", `<p onclick="alert(1)">hi</p>`, (o) => !o.includes("onclick")],
    ["javascript: href", `<a href="javascript:alert(1)">x</a>`, (o) => !o.includes("javascript:")],
    ["img onerror", `<img src="x" onerror="alert(1)">`, (o) => !o.includes("onerror")],
    ["iframe srcdoc", `<iframe srcdoc="<script>alert(1)</script>"></iframe>`, (o) => !o.includes("srcdoc")],
    ["keeps style block", `<style type="text/css">.a{color:red}</style>`, (o) => o.includes("color:red")],
    ["keeps custom aa", `<aa to="12,13">x</aa>`, (o) => o.includes("<aa") && o.includes("12,13")],
    ["keeps inline style", `<p style="color:red">x</p>`, (o) => o.includes("style")],
];

let bad = 0;
for (const [name, input, assert] of cases) {
    const out = run(input);
    const ok = assert(out);
    if (!ok) bad++;
    console.log(`  ${ok ? "pass" : "FAIL"}  ${name}`);
    if (!ok) console.log(`        -> ${out}`);
}
console.log(`\n  ${cases.length - bad}/${cases.length} passed\n`);
process.exit(bad ? 1 : 0);
