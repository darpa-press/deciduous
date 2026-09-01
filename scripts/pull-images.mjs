#!/usr/bin/env node
//
// Download every image and film a piece embeds, named after its page number.
//
// The codex keeps no media collection: pictures and film live as <img>,
// <lightimg>, <video> and <source> tags inside each piece's stored HTML —
// and twice as a CSS url() in a style block — all pointing at the S3 bucket
// the old uploader wrote to. So the inventory is whatever the markup says, in
// the order it says it, and that order is what the numbering preserves: the
// first item on page 0 is 0.1.png, the second 0.2.png, and a page whose first
// embed is film gets 44.1.mp4. One sequence per page, whatever the medium.
//
// Three pieces embed YouTube, which is a player and not a file. Those are
// listed in embeds.txt beside the downloads rather than silently dropped.
//
// The source is the .bson dump by default, which needs nothing running. A
// dump file is concatenated BSON documents, each prefixed with a 4-byte
// little-endian length covering the whole document, exactly as seed-local.mjs
// reads it. Pass --uri to read a live database instead; the dump predates the
// most recent pieces.
//
//   node scripts/pull-images.mjs                     # -> samples/media
//   node scripts/pull-images.mjs --out ../pictures
//   node scripts/pull-images.mjs --uri mongodb://127.0.0.1:27017 --db deciduous
//   node scripts/pull-images.mjs --dry               # list what it would fetch
//
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { deserialize } from "bson";

const args = process.argv.slice(2);
const hasFlag = (n) => args.includes(`--${n}`);
const argOf = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i > -1 && args[i + 1] ? args[i + 1] : d;
};

const DUMP = path.resolve(argOf("dump", "dump/deciduous"));
const URI = argOf("uri", null);
const DB = argOf("db", "deciduous");
const OUT = path.resolve(argOf("out", "samples/media"));
const CONCURRENCY = Math.max(1, Number(argOf("concurrency", 6)) || 6);
const DRY = hasFlag("dry");
const FORCE = hasFlag("force");

// Lazy-load placeholders, not content. They are in the markup only to reserve
// the box until the real picture arrives, and the host has been dead for years.
const SKIP_HOSTS = new Set(["placehold.it", "www.placehold.it"]);

/**
 * Every reference to a file, in one pass so document order is preserved.
 *
 * Three shapes carry one: a media tag's `src`, a <video poster>, and a CSS
 * `url()` — pages 9 and 56 set their picture as a background in a <style>
 * block, so a scan of tags alone misses them. <iframe> is deliberately absent;
 * it is handled separately below.
 */
const MEDIA_REF =
    /<(?:img|lightimg|video|audio|source|picture)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']|\bposter\s*=\s*["']([^"']+)["']|url\((["']?)([^)"']+)\3\)/gi;

/** Players, not files — recorded rather than fetched. */
const EMBED_REF = /<iframe\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;

// A stylesheet is not media. Only page 91 has one, for a Google font.
const SKIP_URL = /^https:\/\/fonts\.googleapis\.com\//;

// content.deciduous.site was a CNAME onto the bucket and no longer resolves,
// but the object is still there under the same path. One piece — page 56 —
// still points at it, so follow the rename rather than lose the file.
const HOST_REWRITE = {
    "content.deciduous.site": "codex-content.s3.us-west-2.amazonaws.com",
};

/** Read every piece, from the dump or from a database. */
async function loadPieces() {
    if (!URI) {
        const file = path.join(DUMP, "pieces.bson");
        if (!existsSync(file)) throw new Error(`No dump at ${file} — pass --dump or --uri.`);
        const buf = readFileSync(file);
        const docs = [];
        for (let at = 0; at < buf.length; ) {
            const len = buf.readInt32LE(at);
            docs.push(deserialize(buf.subarray(at, at + len)));
            at += len;
        }
        return docs;
    }
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(URI);
    try {
        await client.connect();
        return await client.db(DB).collection("pieces").find({}).toArray();
    } finally {
        await client.close();
    }
}

/** Absolute https URL, or null if this src is not one to fetch. */
function normalise(src) {
    const raw = src.trim();
    // The old editor wrote protocol-relative srcs; S3 is https either way.
    const absolute = raw.startsWith("//") ? `https:${raw}` : raw;
    let url;
    try {
        url = new URL(absolute);
    } catch {
        return null;
    }
    if (!/^https?:$/.test(url.protocol) || SKIP_HOSTS.has(url.hostname)) return null;
    url.protocol = "https:";
    if (HOST_REWRITE[url.hostname]) url.hostname = HOST_REWRITE[url.hostname];
    return url;
}

/** ".png", ".jpg" — from the URL path, which is where the uploader put it. */
function extensionOf(url) {
    const name = decodeURIComponent(url.pathname).split("/").pop() || "";
    const match = name.match(/\.[A-Za-z0-9]{1,5}$/);
    return match ? match[0].toLowerCase() : "";
}

const FROM_TYPE = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
    "image/tiff": ".tif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/mp4": ".m4a",
};

/** One entry per file, numbered per page in the order the markup lists them. */
function inventory(pieces) {
    const jobs = [];
    const embeds = [];
    for (const piece of pieces.filter((p) => typeof p.page === "number")) {
        const content = piece.content || "";
        const title = piece.title || "";
        const seen = new Set();
        let n = 0;
        for (const match of content.matchAll(MEDIA_REF)) {
            // src, poster, or the url() body — whichever alternative matched.
            const url = normalise(match[1] ?? match[2] ?? match[4]);
            // The same file twice on one page — a <video src> repeated by its
            // own <source> — is one download, not two numbers.
            if (!url || SKIP_URL.test(url.href) || seen.has(url.href)) continue;
            seen.add(url.href);
            n += 1;
            jobs.push({ page: piece.page, index: n, url, title });
        }
        for (const [, src] of content.matchAll(EMBED_REF)) {
            const url = normalise(src);
            if (url) embeds.push({ page: piece.page, url, title });
        }
    }
    // Page order, which is the order the codex is bound in.
    jobs.sort((a, b) => a.page - b.page || a.index - b.index);
    embeds.sort((a, b) => a.page - b.page);
    return { jobs, embeds };
}

async function download(job) {
    const stem = `${job.page}.${job.index}`;
    const guess = extensionOf(job.url);
    if (!FORCE && guess) {
        const settled = path.join(OUT, stem + guess);
        if (existsSync(settled) && statSync(settled).size > 0) return { ...job, file: stem + guess, skipped: true };
    }

    const response = await fetch(job.url, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    // Trust the served type over the URL when the URL has nothing to say.
    const ext = guess || FROM_TYPE[type] || ".bin";
    const file = stem + ext;
    writeFileSync(path.join(OUT, file), Buffer.from(await response.arrayBuffer()));
    return { ...job, file };
}

async function pool(items, worker, size) {
    const out = new Array(items.length);
    let cursor = 0;
    await Promise.all(
        Array.from({ length: Math.min(size, items.length) }, async () => {
            while (cursor < items.length) {
                const i = cursor++;
                out[i] = await worker(items[i]);
            }
        })
    );
    return out;
}

const pieces = await loadPieces();
const { jobs, embeds } = inventory(pieces);
const pages = new Set(jobs.map((j) => j.page));

console.log(
    `\n  ${jobs.length} files across ${pages.size} pages, ${embeds.length} embeds` +
        `\n  source: ${URI ? `${URI}/${DB}` : DUMP}` +
        `\n  into:   ${OUT}\n`
);

if (DRY) {
    for (const job of jobs) {
        console.log(`  ${`${job.page}.${job.index}`.padEnd(8)} ${job.url.href}`);
    }
    process.exit(0);
}

mkdirSync(OUT, { recursive: true });

const results = await pool(
    jobs,
    async (job) => {
        try {
            return await download(job);
        } catch (error) {
            return { ...job, error: error.message };
        }
    },
    CONCURRENCY
);

const failed = results.filter((r) => r.error);
const saved = results.filter((r) => !r.error);

// Renaming loses where each file came from, so keep the mapping beside them.
writeFileSync(
    path.join(OUT, "index.txt"),
    saved.map((r) => `${r.file}\t${r.url.href}\t${r.title}`).join("\n") + "\n"
);

// Nothing here is a file to fetch, but a piece that is a film is still a
// piece, and the print edition has to know the page carries one.
writeFileSync(
    path.join(OUT, "embeds.txt"),
    embeds.map((e) => `${e.page}\t${e.url.href}\t${e.title}`).join("\n") + "\n"
);

console.log(
    `  saved ${saved.filter((r) => !r.skipped).length}` +
        `, already had ${saved.filter((r) => r.skipped).length}` +
        `, failed ${failed.length}\n`
);
for (const r of failed) {
    console.log(`  !  ${r.page}.${r.index}  ${r.url.href}  — ${r.error}`);
}
