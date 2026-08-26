#!/usr/bin/env node
//
// URL inventory sweep.
//
// Requests every public permalink captured in Phase 0 against a target and
// reports anything that is not a healthy 200. This is the check that has to be
// green before the domain moves in Phase 6 — a codex's URLs get cited, so a
// permalink that 404s after cutover is a real loss.
//
//   node scripts/sweep-urls.mjs --base http://localhost:3100
//   node scripts/sweep-urls.mjs --base http://localhost:3100 --sample 100
//
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const argOf = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i > -1 && args[i + 1] ? args[i + 1] : d;
};

const BASE = argOf("base", "http://localhost:3100").replace(/\/$/, "");
/** A positive integer, or the default — `Number("x")` is NaN, and
 * `Array.from({length: NaN})` is empty, so a typo silently ran zero workers
 * and then crashed on the undefined results it had not filled in. */
const positiveInt = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
};

const CONCURRENCY = positiveInt(argOf("concurrency", 8), 8);
const SAMPLE = positiveInt(argOf("sample", 0), 0);
const TIMEOUT_MS = 45000;

let urls = readFileSync(argOf("urls", "baseline/urls.txt"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

if (SAMPLE && SAMPLE < urls.length) {
    // Deterministic stride sample, so a partial run still spans the whole set.
    const stride = Math.ceil(urls.length / SAMPLE);
    urls = urls.filter((_, i) => i % stride === 0);
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

console.log(`\n  URL sweep\n  target: ${BASE}\n  urls:   ${urls.length}\n`);

let done = 0;
const results = await pool(
    urls,
    async (url) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(BASE + url, { signal: controller.signal, redirect: "follow" });
            const body = await res.text();
            // Next renders a digest-bearing error page on a server exception;
            // a 200 is not on its own proof the pane rendered.
            const errored = /__NEXT_ERROR_CODE|Application error: a server-side exception/.test(body);
            return { url, status: res.status, bytes: body.length, errored };
        } catch (err) {
            return { url, status: 0, bytes: 0, errored: true, message: String(err.message || err) };
        } finally {
            clearTimeout(timer);
            done++;
            if (done % 25 === 0 || done === urls.length) {
                process.stdout.write(`\r    ${done}/${urls.length}   `);
            }
        }
    },
    CONCURRENCY
);

process.stdout.write("\n");

const bad = results.filter((r) => r.status !== 200 || r.errored);
if (bad.length) {
    console.log(`\n  ${bad.length} problem urls:\n`);
    for (const b of bad.slice(0, 25)) {
        console.log(`    ${String(b.status).padStart(3)}  ${b.url}${b.errored ? "  [render error]" : ""}${b.message ? "  " + b.message : ""}`);
    }
    if (bad.length > 25) console.log(`    …and ${bad.length - 25} more`);
}

// A pane that renders nothing is a silent failure the status code will not show.
const thin = results.filter((r) => r.status === 200 && !r.errored && r.bytes < 2000);
if (thin.length) {
    console.log(`\n  ${thin.length} suspiciously small responses (<2000 bytes):`);
    for (const t of thin.slice(0, 10)) console.log(`    ${t.bytes}b  ${t.url}`);
}

console.log(`\n  ${results.length - bad.length}/${results.length} healthy\n`);
process.exit(bad.length ? 1 : 0);
