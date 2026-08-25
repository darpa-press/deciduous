#!/usr/bin/env node
//
// Inventory every element and attribute used across all piece content, so the
// sanitise allowlist can be derived from what the codex actually contains
// rather than guessed. Run against baseline/content.json.
//
//   node scripts/analyse-content.mjs
//   node scripts/analyse-content.mjs --json    # emit the inventory as JSON
//
import { readFileSync } from "node:fs";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import { visit } from "unist-util-visit";

const asJson = process.argv.includes("--json");
const content = JSON.parse(readFileSync("baseline/content.json", "utf8"));

// The legacy parser strips every newline before parsing. Replicated here so the
// inventory reflects the tree the app actually renders.
const normalise = (html) => (html ? String(html).replace(/\r?\n|\r/g, "") : "<div></div>");

const processor = unified().use(rehypeParse, { fragment: true });

const elements = new Map(); // tag -> { count, pages:Set, attrs:Map<attr, count> }

for (const [page, html] of Object.entries(content)) {
    const tree = processor.parse(normalise(html));
    visit(tree, "element", (node) => {
        let rec = elements.get(node.tagName);
        if (!rec) {
            rec = { count: 0, pages: new Set(), attrs: new Map() };
            elements.set(node.tagName, rec);
        }
        rec.count++;
        rec.pages.add(page);
        for (const attr of Object.keys(node.properties ?? {})) {
            rec.attrs.set(attr, (rec.attrs.get(attr) ?? 0) + 1);
        }
    });
}

const inventory = [...elements.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([tag, rec]) => ({
        tag,
        uses: rec.count,
        pages: rec.pages.size,
        attrs: [...rec.attrs.entries()].sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a}(${n})`),
    }));

if (asJson) {
    console.log(JSON.stringify(inventory, null, 2));
} else {
    console.log(`\n  ${inventory.length} distinct elements across ${Object.keys(content).length} pieces\n`);
    console.log(`  ${"tag".padEnd(20)} ${"uses".padStart(5)} ${"pages".padStart(6)}  attributes`);
    for (const e of inventory) {
        console.log(
            `  ${e.tag.padEnd(20)} ${String(e.uses).padStart(5)} ${String(e.pages).padStart(6)}  ${e.attrs.join(" ") || "—"}`
        );
    }
    console.log("");
}
