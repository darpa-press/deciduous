#!/usr/bin/env node
//
// Restore dump/deciduous into a local MongoDB, without needing mongorestore.
//
// A .bson dump file is just concatenated BSON documents, each prefixed with a
// 4-byte little-endian length covering the whole document, so the `bson`
// package that ships with the driver is enough to read them. That keeps local
// setup to "a mongod on a port" rather than a full mongo-tools install.
//
//   node scripts/seed-local.mjs --inspect     # report shapes, no server needed
//   node scripts/seed-local.mjs               # restore into $MONGODB_URI
//   node scripts/seed-local.mjs --drop        # drop collections first
//
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { deserialize } from "bson";
import { MongoClient } from "mongodb";

const args = process.argv.slice(2);
const hasFlag = (n) => args.includes(`--${n}`);
const argOf = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i > -1 && args[i + 1] ? args[i + 1] : d;
};

const DUMP = path.resolve(argOf("dump", "dump/deciduous"));
// The flag wins over the environment, not the other way round. With the old
// precedence a shell that had sourced .env.local — which is what `vercel env
// pull` produces, and where MONGODB_URI is the Atlas string — could not be
// overridden from the command line at all.
const URI = argOf("uri", process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");
const DB = argOf("db", "deciduous");

/**
 * This script only ever writes to a local database.
 *
 * It restores the 2020 dump, and with --drop it drops the collections first.
 * Handed a production URI — which needs nothing more than a shell that has
 * sourced .env.local — that is the catalogue gone. Its sibling pull-live.mjs
 * has refused a non-local target from the start, on exactly these grounds;
 * this one had no guard at all.
 */
const targetIsLocal =
    /(^|@|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal)(:|\/|$)/.test(URI);

if (!targetIsLocal || /mongodb\+srv:/.test(URI)) {
    const redacted = URI.replace(/\/\/[^@]*@/, "//***:***@");
    console.error(`\n  Refusing to write to a non-local target:\n    ${redacted}\n`);
    console.error(`  This script only restores into localhost.`);
    console.error(`  Pass --uri mongodb://127.0.0.1:27017 to be explicit.\n`);
    process.exit(1);
}

function readBson(file) {
    const buf = readFileSync(file);
    const docs = [];
    let off = 0;
    while (off < buf.length) {
        const len = buf.readInt32LE(off);
        if (len <= 0 || off + len > buf.length) break;
        docs.push(deserialize(buf.subarray(off, off + len)));
        off += len;
    }
    return docs;
}

if (!existsSync(DUMP)) {
    console.error(`\n  No dump at ${DUMP}\n`);
    process.exit(1);
}

const files = readdirSync(DUMP)
    .filter((f) => f.endsWith(".bson"))
    .sort();

// Names only. The documents are read one collection at a time, at the point of
// use — holding every collection's parsed documents at once, on top of each
// file's own buffer, is a lot of memory for no reason.
const collections = files.map((f) => path.basename(f, ".bson"));

console.log(`\n  dump: ${DUMP}\n`);
for (const name of collections) {
    console.log(`    ${name}`);
}

if (hasFlag("inspect")) {
    if (collections.includes("pieces")) {
        const docs = readBson(path.join(DUMP, "pieces.bson"));
        const pages = docs.map((d) => d.page).filter((p) => typeof p === "number");
        // Guarded on the page count, not the document count: with no numbered
        // pages, Math.min of nothing is Infinity. Reduced rather than spread,
        // because spreading a large array is a RangeError, not a slow path.
        if (pages.length) {
            const lo = pages.reduce((a, b) => (b < a ? b : a), pages[0]);
            const hi = pages.reduce((a, b) => (b > a ? b : a), pages[0]);
            console.log(`\n    pieces pages ${lo}–${hi} (${pages.length} numbered)`);
        } else {
            console.log(`\n    pieces: ${docs.length} docs, none numbered`);
        }
        if (docs.length) console.log(`    piece fields: ${Object.keys(docs[0]).join(", ")}`);
    }
    if (collections.includes("identitycounters")) {
        console.log(
            `\n    counters: ${JSON.stringify(readBson(path.join(DUMP, "identitycounters.bson")))}`
        );
    }
    console.log("");
    process.exit(0);
}

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
try {
    await client.connect();
} catch (err) {
    console.error(`\n  Could not reach MongoDB at ${URI}`);
    console.error(`  ${err.message}`);
    console.error(`\n  Start one, e.g.:`);
    console.error(`    docker run -d --name deciduous-mongo -p 27017:27017 mongo:8\n`);
    process.exit(1);
}

const db = client.db(DB);
console.log(`\n  restoring into ${DB} at ${URI}\n`);

const BATCH = 500;

for (const name of collections) {
    if (hasFlag("drop")) {
        await db.collection(name).drop().catch(() => {});
    }
    const docs = readBson(path.join(DUMP, `${name}.bson`));
    for (let i = 0; i < docs.length; i += BATCH) {
        await db.collection(name).insertMany(docs.slice(i, i + BATCH), { ordered: false });
    }
    const count = await db.collection(name).countDocuments();
    console.log(`    ${name.padEnd(20)} ${String(count).padStart(5)} docs in db`);
}

// The text index the legacy Piece schema declares. Search fails without it,
// and index creation is not carried in a bson dump's data files.
await db.collection("pieces").createIndex(
    { content: "text", title: "text", readme: "text" },
    { name: "content_text_title_text_readme_text" }
);
// Matches the unique index mongoose-auto-increment-fix creates.
await db.collection("identitycounters").createIndex(
    { field: 1, model: 1 },
    { unique: true, background: true }
);
console.log(`\n    indexes created`);

await client.close();
console.log("");
