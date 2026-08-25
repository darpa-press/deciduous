#!/usr/bin/env node
//
// Phase 0 — replay and diff.
//
// Replays every request in the captured manifest against a target deployment
// and diffs the responses against the golden snapshots. This is the gate the
// Next.js data layer has to pass before the read path is considered ported.
//
//   node baseline/compare.mjs --base http://localhost:3000
//   node baseline/compare.mjs --base http://localhost:3000 --only piece
//   node baseline/compare.mjs --base http://localhost:3000 --verbose
//
// Exits non-zero if anything differs, so it drops straight into CI.
//

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const OUT = path.resolve(argOf("out", "baseline"));
const BASE = argOf("base", "http://localhost:3000").replace(/\/$/, "");
const ONLY = argOf("only", null);
const CONCURRENCY = Number(argOf("concurrency", 4));
const VERBOSE = hasFlag("verbose");
const MAX_DIFFS_SHOWN = Number(argOf("max-diffs", 12));
const TIMEOUT_MS = 30000;

const sha = (s) => createHash("sha256").update(s).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// See baseline/README.md — /api/word/id/ leaks file descriptors on the legacy
// backend, so that group is replayed serially. Harmless against the port,
// which hoists WordNet to a single shared instance.
const isFragile = (group) => group === "word";
const FRAGILE_DELAY_MS = Number(argOf("fragile-delay", 250));

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

// Structural diff: returns a list of { path, expected, actual } rather than a
// text diff, so a reordered array or a changed ObjectId reads clearly.
function diff(expected, actual, at = "", out = [], limit = 40) {
    if (out.length >= limit) return out;

    const te = expected === null ? "null" : Array.isArray(expected) ? "array" : typeof expected;
    const ta = actual === null ? "null" : Array.isArray(actual) ? "array" : typeof actual;

    if (te !== ta) {
        out.push({ path: at || "(root)", expected: `${te}`, actual: `${ta}` });
        return out;
    }

    if (te === "array") {
        if (expected.length !== actual.length) {
            out.push({ path: `${at}.length`, expected: expected.length, actual: actual.length });
        }
        const n = Math.min(expected.length, actual.length);
        for (let i = 0; i < n && out.length < limit; i++) diff(expected[i], actual[i], `${at}[${i}]`, out, limit);
        return out;
    }

    if (te === "object") {
        const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
        for (const k of keys) {
            if (out.length >= limit) break;
            if (!(k in expected)) out.push({ path: `${at}.${k}`, expected: "(absent)", actual: preview(actual[k]) });
            else if (!(k in actual)) out.push({ path: `${at}.${k}`, expected: preview(expected[k]), actual: "(absent)" });
            else diff(expected[k], actual[k], `${at}.${k}`, out, limit);
        }
        return out;
    }

    if (expected !== actual) out.push({ path: at || "(root)", expected: preview(expected), actual: preview(actual) });
    return out;
}

const preview = (v) => {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (s == null) return String(v);
    return s.length > 70 ? s.slice(0, 67) + "…" : s;
};

async function get(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
        return { status: res.status, text: await res.text() };
    } catch (err) {
        return { status: 0, text: null, error: String(err.message || err) };
    } finally {
        clearTimeout(timer);
    }
}

async function pool(items, worker, size = CONCURRENCY) {
    const results = new Array(items.length);
    let cursor = 0;
    await Promise.all(
        Array.from({ length: Math.min(size, items.length) }, async () => {
            while (cursor < items.length) {
                const i = cursor++;
                results[i] = await worker(items[i]);
            }
        })
    );
    return results;
}

// ---------------------------------------------------------------- run

const manifest = JSON.parse(await readFile(path.join(OUT, "manifest.json"), "utf8"));
let entries = manifest.entries.filter((e) => e.file);
if (ONLY) entries = entries.filter((e) => e.group === ONLY);

console.log(`\n  Deciduous baseline compare`);
console.log(`  baseline: ${manifest.base} (${manifest.capturedAt})`);
console.log(`  target:   ${BASE}`);
if (ONLY) console.log(`  group:    ${ONLY}`);
console.log(`\n  replaying ${entries.length} requests…\n`);

let done = 0;
const compareOne = async (entry) => {
    const res = await get(BASE + entry.url);
    done++;
    if (done % 10 === 0 || done === entries.length) {
        process.stdout.write(`\r    ${done}/${entries.length}   `);
    }

    if (res.text == null) return { entry, kind: "error", detail: res.error || "no body" };
    if (res.status !== entry.status) {
        return { entry, kind: "status", detail: `expected ${entry.status}, got ${res.status}` };
    }

    let parsed;
    try {
        parsed = JSON.parse(res.text);
    } catch {
        parsed = { __raw: res.text };
    }

    const body = JSON.stringify(canonical(parsed), null, 2) + "\n";
    if (sha(body.trimEnd()) === entry.sha256) return { entry, kind: "match" };

    const expected = JSON.parse(await readFile(path.join(OUT, "snapshots", entry.file), "utf8"));
    return { entry, kind: "diff", diffs: diff(expected, canonical(parsed)) };
};

const robust = entries.filter((e) => !isFragile(e.group));
const fragile = entries.filter((e) => isFragile(e.group));

const robustResults = await pool(robust, compareOne);

if (fragile.length) {
    process.stdout.write(`\n    ${fragile.length} word lookups, serially…\n`);
}
const fragileResults = [];
for (const entry of fragile) {
    fragileResults.push(await compareOne(entry));
    await sleep(FRAGILE_DELAY_MS);
}

const results = [...robustResults, ...fragileResults];

process.stdout.write("\n");

// ---------------------------------------------------------------- report

const matched = results.filter((r) => r.kind === "match");
const failures = results.filter((r) => r.kind !== "match");

if (failures.length) {
    console.log(`\n  ${failures.length} of ${results.length} differ:\n`);
    for (const f of failures.slice(0, MAX_DIFFS_SHOWN)) {
        console.log(`  ${f.entry.url}`);
        if (f.kind === "error") console.log(`    request failed: ${f.detail}`);
        else if (f.kind === "status") console.log(`    ${f.detail}`);
        else {
            const shown = VERBOSE ? f.diffs : f.diffs.slice(0, 5);
            for (const d of shown) {
                console.log(`    ${d.path}`);
                console.log(`      expected  ${d.expected}`);
                console.log(`      actual    ${d.actual}`);
            }
            if (!VERBOSE && f.diffs.length > 5) console.log(`    …and ${f.diffs.length - 5} more (use --verbose)`);
        }
        console.log("");
    }
    if (failures.length > MAX_DIFFS_SHOWN) {
        console.log(`  …and ${failures.length - MAX_DIFFS_SHOWN} more failing requests\n`);
    }

    const byGroup = {};
    for (const f of failures) byGroup[f.entry.group] = (byGroup[f.entry.group] || 0) + 1;
    console.log(`  failures by group:`, byGroup);
}

console.log(`\n  ${matched.length} matched, ${failures.length} differed, of ${results.length}\n`);
process.exit(failures.length ? 1 : 0);
