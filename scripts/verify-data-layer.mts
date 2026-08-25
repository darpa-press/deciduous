#!/usr/bin/env tsx
//
// Phase 2 gate.
//
// Runs the ported Mongoose 8 data layer against local MongoDB and diffs the
// results against the Phase 0 golden snapshots captured from production.
//
// Only the endpoints that are pure data-layer are covered here — the ones whose
// legacy controller does nothing but query, populate and serialise. The
// composed endpoints (graph, tree, search, word) carry controller logic and are
// gated in Phase 3/4 once the routes exist.
//
//   MONGODB_URI=mongodb://127.0.0.1:27017/deciduous npx tsx scripts/verify-data-layer.ts
//
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { connect } from "../src/lib/mongodb";
import { Piece } from "../src/models/Piece";
import { Person } from "../src/models/Person";
import "../src/models/Word";

const OUT = path.resolve("baseline");
const manifest = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf8"));

type Entry = { url: string; file?: string; group: string; sha256?: string };
const entryFor = (url: string) =>
    (manifest.entries as Entry[]).find((e) => e.url === url && e.file) ?? null;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
        return Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((acc, k) => {
                acc[k] = canonical((value as Record<string, unknown>)[k]);
                return acc;
            }, {});
    }
    return value;
}

const preview = (v: unknown) => {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s == null ? String(v) : s.length > 70 ? s.slice(0, 67) + "…" : s;
};

type Diff = { path: string; expected: unknown; actual: unknown };

function diff(expected: unknown, actual: unknown, at = "", out: Diff[] = [], limit = 20): Diff[] {
    if (out.length >= limit) return out;
    const te = expected === null ? "null" : Array.isArray(expected) ? "array" : typeof expected;
    const ta = actual === null ? "null" : Array.isArray(actual) ? "array" : typeof actual;
    if (te !== ta) {
        out.push({ path: at || "(root)", expected: te, actual: ta });
        return out;
    }
    if (te === "array") {
        const e = expected as unknown[];
        const a = actual as unknown[];
        if (e.length !== a.length) out.push({ path: `${at}.length`, expected: e.length, actual: a.length });
        for (let i = 0; i < Math.min(e.length, a.length) && out.length < limit; i++) {
            diff(e[i], a[i], `${at}[${i}]`, out, limit);
        }
        return out;
    }
    if (te === "object") {
        const e = expected as Record<string, unknown>;
        const a = actual as Record<string, unknown>;
        for (const k of [...new Set([...Object.keys(e), ...Object.keys(a)])].sort()) {
            if (out.length >= limit) break;
            if (!(k in e)) out.push({ path: `${at}.${k}`, expected: "(absent)", actual: preview(a[k]) });
            else if (!(k in a)) out.push({ path: `${at}.${k}`, expected: preview(e[k]), actual: "(absent)" });
            else diff(e[k], a[k], `${at}.${k}`, out, limit);
        }
        return out;
    }
    if (expected !== actual) out.push({ path: at || "(root)", expected: preview(expected), actual: preview(actual) });
    return out;
}

/** Serialise the way `res.json(doc)` did — through toJSON. */
const asJson = (v: unknown) => JSON.parse(JSON.stringify(v));

const results: { url: string; ok: boolean; diffs?: Diff[]; skipped?: boolean }[] = [];

function check(url: string, actual: unknown) {
    const entry = entryFor(url);
    if (!entry) {
        results.push({ url, ok: true, skipped: true });
        return;
    }

    // The manifest SHA is authoritative. The on-disk snapshot is only used to
    // render a readable diff — one file was clobbered by an early filename
    // collision in capture.mjs, so trusting the file over the hash would
    // report a regression that does not exist.
    const canon = canonical(asJson(actual));
    const body = JSON.stringify(canon, null, 2);
    if (entry.sha256 && sha(body) === entry.sha256) {
        results.push({ url, ok: true });
        return;
    }

    const expected = JSON.parse(readFileSync(path.join(OUT, "snapshots", entry.file!), "utf8"));
    const d = diff(expected, canon);
    results.push({ url, ok: d.length === 0, diffs: d });
}

await connect();
console.log(`\n  Phase 2 data-layer gate\n`);

// --- /api/piece/?page=N -------------------------------------------------
// Legacy: Piece.findOne({page}).populate("persons").populate("parent")
//         .populate({path:"word", model:"Word"})  ->  res.json(piece)
const pages: number[] = manifest.discovered.pages;
process.stdout.write(`    ${pages.length} pieces by page… `);
for (const page of pages) {
    const piece = await Piece.findOne({ page })
        .populate("persons")
        .populate("parent")
        .populate({ path: "word", model: "Word" });
    check(`/api/piece/?page=${page}`, piece);
}
console.log("done");

// --- /api/persons -------------------------------------------------------
// Legacy: Person.find().sort({name: 1})
process.stdout.write(`    persons listing… `);
check("/api/persons", await Person.find().sort({ name: 1 }));
console.log("done");

// --- /api/person/?slug= -------------------------------------------------
// Legacy: Person.findOne({slug}).lean(), then attach Piece.find({persons: _id})
const slugs: string[] = manifest.discovered.personSlugs;
process.stdout.write(`    ${slugs.length} persons by slug… `);
for (const slug of slugs) {
    const person = await Person.findOne({ slug }).lean();
    if (person) {
        const pieces = await Piece.find({ persons: person._id }).lean();
        if (pieces) (person as Record<string, unknown>).pieces = pieces;
    }
    check(`/api/person/?slug=${encodeURIComponent(slug)}`, person);
}
console.log("done");

// --- /api/pieces (collection) -------------------------------------------
// Legacy: Piece.find().limit(...).sort({[sort]: order}).lean(), then a computed
// `hasLink` flag from the content.
async function regularAllPieces(sort = "title", order: 1 | -1 = 1, limit?: number) {
    const query = Piece.find()
        .sort({ [sort]: order } as Record<string, 1 | -1>)
        .lean();
    if (limit) query.limit(limit);
    const pieces = await query;
    return pieces.map((piece) => ({
        ...piece,
        hasLink: String(piece.content ?? "").toLowerCase().indexOf("<aa") > -1,
    }));
}

process.stdout.write(`    pieces collection variants… `);
check("/api/pieces", await regularAllPieces());
check("/api/pieces?sort=title&order=1", await regularAllPieces("title", 1));
check("/api/pieces?sort=page&order=-1&limit=10", await regularAllPieces("page", -1, 10));
check("/api/pieces?sort=page&order=1&limit=10", await regularAllPieces("page", 1, 10));
check("/api/pieces?sort=created&order=-1&limit=25", await regularAllPieces("created", -1, 25));
check("/api/pieces?limit=2", await regularAllPieces("title", 1, 2));
check("/api/pieces?count=1", await Piece.countDocuments());
console.log("done");

// --- /api/pieces?parent= ------------------------------------------------
const parentIds: string[] = manifest.discovered.parentIds;
process.stdout.write(`    ${parentIds.length} parent queries… `);
for (const id of parentIds) {
    check(`/api/pieces?parent=${encodeURIComponent(id)}`, await Piece.find({ parent: id }).lean());
}
console.log("done");

// --- report -------------------------------------------------------------
const checked = results.filter((r) => !r.skipped);
const failures = checked.filter((r) => !r.ok);
const skipped = results.filter((r) => r.skipped);

if (failures.length) {
    console.log(`\n  ${failures.length} of ${checked.length} differ:\n`);
    for (const f of failures.slice(0, 8)) {
        console.log(`  ${f.url}`);
        for (const d of (f.diffs ?? []).slice(0, 5)) {
            console.log(`    ${d.path}`);
            console.log(`      expected  ${d.expected}`);
            console.log(`      actual    ${d.actual}`);
        }
        if ((f.diffs?.length ?? 0) > 5) console.log(`    …and ${f.diffs!.length - 5} more`);
        console.log("");
    }
    if (failures.length > 8) console.log(`  …and ${failures.length - 8} more failing\n`);
}

console.log(
    `\n  ${checked.length - failures.length} matched, ${failures.length} differed` +
        (skipped.length ? `, ${skipped.length} skipped (no snapshot)` : "") +
        `\n`
);

process.exit(failures.length ? 1 : 0);
