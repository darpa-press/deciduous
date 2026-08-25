#!/usr/bin/env node
//
// Phase 0 — golden JSON capture.
//
// Walks every read endpoint of the legacy API against a running deployment and
// writes one snapshot file per request, plus a manifest and a URL inventory.
// The snapshots are the regression gate for the Next.js data layer: after the
// port, `compare.mjs` replays the same request list and diffs the responses.
//
//   node baseline/capture.mjs                        # against production
//   node baseline/capture.mjs --base http://localhost:3000
//
// No dependencies — native fetch, Node 18+.
//

import { writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf("base", "https://deciduous.darpa.press").replace(/\/$/, "");
const OUT = path.resolve(argOf("out", "baseline"));
const SNAPSHOTS = path.join(OUT, "snapshots");
const CONCURRENCY = Number(argOf("concurrency", 4));
const TIMEOUT_MS = 30000;
const RETRIES = 3;

// ---------------------------------------------------------------- http

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, attempt = 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { accept: "application/json" },
        });
        const text = await res.text();
        return { status: res.status, contentType: res.headers.get("content-type"), text };
    } catch (err) {
        if (attempt <= RETRIES) {
            await sleep(400 * attempt);
            return get(url, attempt + 1);
        }
        return { status: 0, contentType: null, text: null, error: String(err.message || err) };
    } finally {
        clearTimeout(timer);
    }
}

async function getJson(pathname) {
    const res = await get(BASE + pathname);
    if (res.text == null) return null;
    try {
        return JSON.parse(res.text);
    } catch {
        return null;
    }
}

// Run tasks with a bounded worker pool, preserving input order in the output.
async function pool(items, worker, size = CONCURRENCY) {
    const results = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
        while (cursor < items.length) {
            const i = cursor++;
            results[i] = await worker(items[i], i);
        }
    });
    await Promise.all(runners);
    return results;
}

// ---------------------------------------------------------------- helpers

const sha = (s) => createHash("sha256").update(s).digest("hex");

// A readable slug plus a short digest of the full path. The digest matters:
// `order=-1` and `order=1` slugify identically once punctuation is stripped,
// and without it one snapshot silently overwrites the other.
const slugForFile = (pathname) => {
    const readable =
        pathname
            .replace(/^\//, "")
            .replace(/[^a-zA-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 100) || "root";
    return `${readable}-${sha(pathname).slice(0, 8)}`;
};

// Deterministic key ordering so a snapshot diff reflects real change, not
// serialisation order.
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((acc, k) => {
                acc[k] = canonical(value[k]);
                return acc;
            }, {});
    }
    return value;
}

function walkWordTree(nodes, out = []) {
    for (const node of nodes || []) {
        if (node.id) out.push(node.id);
        if (node.children && node.children.length) walkWordTree(node.children, out);
    }
    return out;
}

function walkPieceTree(nodes, out = []) {
    for (const node of nodes || []) {
        if (node.page != null) out.push(node.page);
        if (node.children && node.children.length) walkPieceTree(node.children, out);
    }
    return out;
}

// ---------------------------------------------------------------- discovery

console.log(`\n  Deciduous baseline capture`);
console.log(`  base: ${BASE}\n`);

process.stdout.write("  discovering… ");

const [allPieces, allPersons, wordTree, pieceTree] = await Promise.all([
    getJson("/api/pieces"),
    getJson("/api/persons"),
    getJson("/api/word"),
    getJson("/api/pieces?tree=1"),
]);

if (!Array.isArray(allPieces)) {
    console.error("\n  FAILED: /api/pieces did not return an array. Is the deployment up?");
    process.exit(1);
}

const pages = allPieces.map((p) => p.page).filter((p) => p != null).sort((a, b) => a - b);
const personSlugs = (allPersons || []).map((p) => p.slug).filter(Boolean);
// getAllWords buckets pos "a"/"v"/"s" into `qualities` and pos "v" into
// `acts`, so every verb appears in the tree twice. Dedupe or the capture
// requests each verb two times.
const wordIds = [...new Set(walkWordTree(wordTree))];
const parentIds = [...new Set(allPieces.map((p) => p.parent).filter(Boolean).map(String))];
const treePages = walkPieceTree(pieceTree);

// Search terms drawn from real title vocabulary, so the text index is exercised
// against words that actually exist, plus a couple of guaranteed-empty probes.
const titleWords = [
    ...new Set(
        allPieces
            .flatMap((p) => String(p.title || "").toLowerCase().split(/[^a-z]+/i))
            .filter((w) => w.length > 3)
    ),
].sort();
const searchTerms = [...titleWords.slice(0, 12), "tree", "zzzznotarealterm"];

const lookupTerms = ["tree", "leaf", "root", "branch", "seed"];

console.log("done");
console.log(`    pieces        ${allPieces.length}  (pages ${pages[0]}–${pages[pages.length - 1]})`);
console.log(`    tree nodes    ${treePages.length}`);
console.log(`    persons       ${personSlugs.length}`);
console.log(`    words         ${wordIds.length}`);
console.log(`    parent ids    ${parentIds.length}`);
console.log(`    search terms  ${searchTerms.length}`);

// ---------------------------------------------------------------- request list

const requests = [];
const add = (group, pathname) => requests.push({ group, pathname });

// collection reads
add("pieces", "/api/pieces");
add("pieces", "/api/pieces?count=1");
add("pieces", "/api/pieces?graph=1");
add("pieces", "/api/pieces?tree=1");
add("pieces", "/api/pieces?sort=page&order=-1&limit=10");
add("pieces", "/api/pieces?sort=page&order=1&limit=10");
add("pieces", "/api/pieces?sort=title&order=1");
add("pieces", "/api/pieces?sort=created&order=-1&limit=25");
add("pieces", "/api/pieces?limit=2");
for (const id of parentIds) add("pieces-children", `/api/pieces?parent=${encodeURIComponent(id)}`);

// every single piece — the page number is the permalink, so all of them matter
for (const page of pages) add("piece", `/api/piece/?page=${page}`);

// persons
add("persons", "/api/persons");
for (const slug of personSlugs) add("person", `/api/person/?slug=${encodeURIComponent(slug)}`);

// words
add("words", "/api/word");
for (const id of wordIds) add("word", `/api/word/id/?id=w-${encodeURIComponent(id)}`);
for (const term of lookupTerms) add("word-lookup", `/api/word/lookup/?string=${encodeURIComponent(term)}`);

// search
for (const term of searchTerms) add("search", `/api/search?q=${encodeURIComponent(term)}`);

console.log(`\n  capturing ${requests.length} requests (concurrency ${CONCURRENCY})…\n`);

// ---------------------------------------------------------------- capture

await rm(SNAPSHOTS, { recursive: true, force: true });
await mkdir(SNAPSHOTS, { recursive: true });

let done = 0;
let failed = 0;

// `/api/word/id/` leaks file descriptors — getHypernyms constructs a new
// WordNet() inside its while loop, so each request opens the dict files once
// per hypernym level and never closes them. Hammering it exhausts the lambda's
// descriptors and it 500s until the instance recycles. Capture that group
// serially with a pause between requests so a re-capture doesn't take the
// endpoint down. See README.
const isFragile = (group) => group === "word";
const FRAGILE_DELAY_MS = Number(argOf("fragile-delay", 250));

const captureOne = async ({ group, pathname }) => {
    const res = await get(BASE + pathname);
    const entry = {
        group,
        url: pathname,
        status: res.status,
        contentType: res.contentType,
        bytes: res.text ? Buffer.byteLength(res.text) : 0,
    };

    if (res.text == null) {
        entry.error = res.error || "no body";
        failed++;
    } else {
        let parsed;
        try {
            parsed = JSON.parse(res.text);
            entry.json = true;
        } catch {
            parsed = { __raw: res.text };
            entry.json = false;
        }
        const body = JSON.stringify(canonical(parsed), null, 2);
        entry.sha256 = sha(body);
        entry.file = `${group}__${slugForFile(pathname)}.json`;
        await writeFile(path.join(SNAPSHOTS, entry.file), body + "\n");
    }

    done++;
    if (done % 10 === 0 || done === requests.length) {
        process.stdout.write(`\r    ${done}/${requests.length}${failed ? `  (${failed} failed)` : ""}   `);
    }
    return entry;
};

const robust = requests.filter((r) => !isFragile(r.group));
const fragile = requests.filter((r) => isFragile(r.group));

const robustEntries = await pool(robust, captureOne);

if (fragile.length) {
    process.stdout.write(`\n    ${fragile.length} word lookups, serially (fd leak — see README)…\n`);
}
const fragileEntries = [];
for (const req of fragile) {
    fragileEntries.push(await captureOne(req));
    await sleep(FRAGILE_DELAY_MS);
}

const entries = [...robustEntries, ...fragileEntries];

process.stdout.write("\n");

// ---------------------------------------------------------------- outputs

const manifest = {
    base: BASE,
    capturedAt: new Date().toISOString(),
    counts: {
        requests: requests.length,
        captured: entries.filter((e) => e.file).length,
        failed,
        pieces: allPieces.length,
        persons: personSlugs.length,
        words: wordIds.length,
    },
    // The inputs the request list was derived from. Re-deriving these on a
    // later run is how you detect that content changed underneath the baseline.
    discovered: { pages, personSlugs, wordIds, parentIds, searchTerms, lookupTerms },
    entries,
};

await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// URL inventory — every public permalink, for the post-cutover 404 sweep.
const urls = [
    "/",
    "/random",
    "/index",
    "/index-a",
    "/person",
    "/word",
    "/all",
    "/graph",
    ...pages.map((p) => `/${p}`),
    ...pages.map((p) => `/${p}c`),
    ...personSlugs.map((s) => `/p-${s}`),
    ...wordIds.map((id) => `/w-${id}`),
    // representative multi-pane combinations, which is the routing behaviour
    // most likely to break in the port
    ...(pages.length > 1 ? [`/${pages[0]}/${pages[1]}`] : []),
    ...(pages.length > 2 ? [`/${pages[0]}/${pages[1]}/${pages[2]}`] : []),
    ...(personSlugs.length ? [`/${pages[0]}/p-${personSlugs[0]}`] : []),
    ...(wordIds.length ? [`/${pages[0]}/w-${wordIds[0]}`] : []),
    ...(personSlugs.length ? [`/index/p-${personSlugs[0]}`] : []),
];

await writeFile(path.join(OUT, "urls.txt"), urls.join("\n") + "\n");

// Piece content, extracted for the renderer snapshot in Phase 3. The parser
// swap is the other place regressions hide, and it needs the raw HTML.
const contents = {};
for (const piece of allPieces) {
    if (piece.page != null) contents[piece.page] = piece.content ?? "";
}
await writeFile(path.join(OUT, "content.json"), JSON.stringify(contents, null, 2) + "\n");

const customTags = [
    ...new Set(
        Object.values(contents)
            .flatMap((html) => [...String(html).matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)].map((m) => m[1].toLowerCase()))
    ),
].sort();

await writeFile(
    path.join(OUT, "tags.txt"),
    `# Every element appearing in piece content. Anything non-standard here needs\n` +
        `# a handler in the rehype components map.\n` +
        customTags.join("\n") +
        "\n"
);

console.log(`\n  wrote:`);
console.log(`    baseline/snapshots/     ${entries.filter((e) => e.file).length} files`);
console.log(`    baseline/manifest.json`);
console.log(`    baseline/urls.txt       ${urls.length} urls`);
console.log(`    baseline/content.json   ${Object.keys(contents).length} pieces`);
console.log(`    baseline/tags.txt       ${customTags.length} distinct elements`);
if (failed) console.log(`\n  ${failed} request(s) failed — see manifest.json`);
console.log("");
